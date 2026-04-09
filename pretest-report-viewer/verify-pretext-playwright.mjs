#!/usr/bin/env node

import { spawn } from "child_process";
import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));

const args = Object.fromEntries(
  process.argv.slice(2).filter(a => a.startsWith("--")).map(a => {
    const [k, v] = a.slice(2).split("=");
    return [k, v ?? "true"];
  })
);

const APP_URL = args.app || "http://localhost:3000";
const RUNNER_URL = args.runner || "http://localhost:4444";
const APP_CMD = args["app-cmd"] || "npm run dev";
const APP_CWD = args["app-cwd"] || join(__dirname, "..");
const OUT_PATH = args.out || join(__dirname, "artifacts", "pretext-playwright-verify.json");
const HEADLESS = args.headed !== "true";
const VIEWPORT_HEIGHT = Number(args.height || 900);
const FAIL_ON_WARN = args["fail-on-warn"] === "true";

const managed = [];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function isHttpAlive(url) {
  try {
    const res = await fetch(url, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForHttp(url, timeoutMs = 120000, label = url) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isHttpAlive(url)) return;
    await sleep(500);
  }
  throw new Error(`Timed out waiting for ${label} at ${url}`);
}

function spawnManaged(label, cmd, cwd) {
  const child = spawn(cmd, {
    cwd,
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env },
  });

  child.stdout.on("data", d => process.stdout.write(`[${label}] ${d}`));
  child.stderr.on("data", d => process.stderr.write(`[${label}] ${d}`));
  managed.push(child);
  return child;
}

async function ensureService({ label, healthUrl, spawnCmd, cwd, timeoutMs = 120000 }) {
  if (await isHttpAlive(healthUrl)) {
    console.log(`${label}: already running`);
    return;
  }
  console.log(`${label}: starting via \`${spawnCmd}\``);
  spawnManaged(label, spawnCmd, cwd);
  await waitForHttp(healthUrl, timeoutMs, label);
  console.log(`${label}: ready`);
}

async function ensurePretextResults(runnerUrl) {
  const browser = await chromium.launch({ headless: HEADLESS });
  try {
    const page = await browser.newPage();
    await page.goto(`${runnerUrl}/`, { waitUntil: "domcontentloaded" });

    for (let i = 0; i < 180; i++) {
      await sleep(500);
      try {
        const res = await fetch(`${runnerUrl}/api/results`);
        if (!res.ok) continue;
        const data = await res.json();
        if (data?.results?.length) return data;
      } catch {}
    }

    throw new Error("pretext runner did not publish results to /api/results");
  } finally {
    await browser.close();
  }
}

function keyFor(label, deviceName) {
  return `${label}@@${deviceName}`;
}

function statusRank(status) {
  if (status === "FAIL") return 3;
  if (status === "WARN") return 2;
  if (status === "ABSENT") return 1;
  return 0;
}

function normalizePagePath(pagePath) {
  if (!pagePath) return "/";
  return pagePath.startsWith("/") ? pagePath : `/${pagePath}`;
}

async function collectDomMetrics(config) {
  const browser = await chromium.launch({ headless: HEADLESS });
  const page = await browser.newPage({ viewport: { width: 1280, height: VIEWPORT_HEIGHT } });

  const metrics = new Map();

  try {
    for (let deviceIndex = 0; deviceIndex < config.breakpoints.length; deviceIndex++) {
      const bp = config.breakpoints[deviceIndex];
      await page.setViewportSize({ width: bp.width, height: VIEWPORT_HEIGHT });

      const checksByPage = new Map();
      for (const check of config.checks) {
        const pagePath = normalizePagePath(check.page || "/");
        if (!checksByPage.has(pagePath)) checksByPage.set(pagePath, []);
        checksByPage.get(pagePath).push(check);
      }

      for (const [pagePath, checks] of checksByPage) {
        await page.goto(`${APP_URL}${pagePath}`, { waitUntil: "domcontentloaded" });
        const landedPath = new URL(page.url()).pathname;
        if (landedPath !== pagePath) {
          for (const check of checks) {
            metrics.set(keyFor(check.label, bp.name), {
              skipped: true,
              skipReason: `redirected:${pagePath}->${landedPath}`,
              checkLabel: check.label,
              deviceName: bp.name,
              width: bp.width,
              page: normalizePagePath(check.page || "/"),
              noWrap: !!check.noWrap,
              wrapStatus: check.wrapStatus || null,
              overflowStatus: check.overflowStatus || null,
              hasText: true,
            });
          }
          continue;
        }
        await page.waitForTimeout(600);
        await page.evaluate(async () => {
          if (document.fonts?.ready) await document.fonts.ready;
        });

        for (const check of checks) {
          const resolved = check.resolved[deviceIndex];
          const evalResult = await page.evaluate((input) => {
            function normalizeText(value) {
              return (value || "").replace(/\s+/g, " ").trim().toLowerCase();
            }

            function findBestMatchElement(root, targetText) {
              const wanted = normalizeText(targetText);
              if (!wanted) return null;
              const walker = document.createTreeWalker(root || document.body, NodeFilter.SHOW_ELEMENT);
              let partial = null;

              while (walker.nextNode()) {
                const el = walker.currentNode;
                if (!(el instanceof HTMLElement)) continue;
                const text = normalizeText(el.innerText || el.textContent || "");
                if (!text) continue;
                if (text === wanted) return el;
                if (!partial && text.includes(wanted)) partial = el;
              }
              return partial;
            }

            function findTarget(selector, text) {
              if (selector) {
                try {
                  const selected = document.querySelector(selector);
                  if (selected) {
                    if (!text) return selected;
                    const inSelected = findBestMatchElement(selected, text);
                    return inSelected || selected;
                  }
                } catch {}
              }
              if (!text) return null;
              return findBestMatchElement(document.body, text);
            }

            function lineCountFor(el) {
              const rects = textRectsFor(el);
              if (!rects.length) return 0;
              const tops = [];
              for (const r of rects) {
                const t = Math.round(r.top * 2) / 2;
                if (!tops.some(x => Math.abs(x - t) < 0.6)) tops.push(t);
              }
              return tops.length;
            }

            function textRectsFor(el) {
              if (!(el instanceof HTMLElement)) return [];
              const range = document.createRange();
              range.selectNodeContents(el);
              return Array.from(range.getClientRects()).filter(r => r.width > 0.5 && r.height > 0.5);
            }

            function unionRect(rects, fallbackRect) {
              if (!rects.length) return fallbackRect;
              const left = Math.min(...rects.map(r => r.left));
              const right = Math.max(...rects.map(r => r.right));
              const top = Math.min(...rects.map(r => r.top));
              const bottom = Math.max(...rects.map(r => r.bottom));
              return {
                left,
                right,
                top,
                bottom,
                width: right - left,
                height: bottom - top,
              };
            }

            function clippingAgainstAncestors(elRect, el) {
              let clippedX = false;
              let clippedY = false;
              let node = el.parentElement;

              while (node && node !== document.documentElement) {
                const s = window.getComputedStyle(node);
                const clipsX = ["hidden", "clip", "scroll", "auto"].includes(s.overflowX);
                const clipsY = ["hidden", "clip", "scroll", "auto"].includes(s.overflowY);
                if (clipsX || clipsY) {
                  const r = node.getBoundingClientRect();
                  if (clipsX && (elRect.left < r.left - 0.5 || elRect.right > r.right + 0.5)) clippedX = true;
                  if (clipsY && (elRect.top < r.top - 0.5 || elRect.bottom > r.bottom + 0.5)) clippedY = true;
                }
                node = node.parentElement;
              }

              return { clippedX, clippedY };
            }

            const target = findTarget(input.selector, input.text);
            if (!target || !(target instanceof HTMLElement)) {
              return {
                found: false,
                lineCount: 0,
                horizontalOverflow: false,
                clippedViewportX: false,
                clippedViewportY: false,
                clippedAncestorX: false,
                clippedAncestorY: false,
                viewportWidth: window.innerWidth,
                viewportHeight: window.innerHeight,
              };
            }

            target.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
            const elementRect = target.getBoundingClientRect();
            const textRects = textRectsFor(target);
            const rect = unionRect(textRects, elementRect);
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            const clippedViewportX = rect.left < -0.5 || rect.right > viewportWidth + 0.5;
            const clippedViewportY = rect.top < -0.5 || rect.bottom > viewportHeight + 0.5;
            const { clippedX, clippedY } = clippingAgainstAncestors(rect, target);

            return {
              found: true,
              lineCount: lineCountFor(target),
              horizontalOverflow:
                target.clientWidth > 0 && (target.scrollWidth - target.clientWidth) > 2,
              clippedViewportX,
              clippedViewportY,
              clippedAncestorX: clippedX,
              clippedAncestorY: clippedY,
              viewportWidth,
              viewportHeight,
              rect: {
                left: Math.round(rect.left * 100) / 100,
                right: Math.round(rect.right * 100) / 100,
                width: Math.round(rect.width * 100) / 100,
              },
              elementRect: {
                left: Math.round(elementRect.left * 100) / 100,
                right: Math.round(elementRect.right * 100) / 100,
                width: Math.round(elementRect.width * 100) / 100,
              },
            };
          }, {
            selector: resolved.selector || check.selector || null,
            text: resolved.text || check.text || "",
          });

          metrics.set(keyFor(check.label, bp.name), {
            ...evalResult,
            checkLabel: check.label,
            deviceName: bp.name,
            width: bp.width,
            expectedContainerWidth: resolved.containerWidth ?? null,
            page: normalizePagePath(check.page || "/"),
            noWrap: !!check.noWrap,
            wrapStatus: check.wrapStatus || null,
            overflowStatus: check.overflowStatus || null,
            hasText: !!(resolved.text || check.text || ""),
          });
        }
      }
    }
  } finally {
    await browser.close();
  }

  return metrics;
}

function classifyActual(check, metric, baselineLines) {
  if (!metric.hasText) return { status: "ABSENT", reason: "empty-text" };
  if (!metric.found) return { status: "FAIL", reason: "missing-target" };

  const clippedX = metric.clippedViewportX || metric.clippedAncestorX;
  const exceedsExpectedContainer = !!(
    check.noWrap &&
    metric?.rect &&
    typeof metric.expectedContainerWidth === "number" &&
    metric.expectedContainerWidth > 0 &&
    metric.rect.width > metric.expectedContainerWidth + 1
  );

  if (check.noWrap) {
    // Viewport clipping is always a hard FAIL — text beyond the screen is unusable.
    if (metric.clippedViewportX) {
      return {
        status: "FAIL",
        reason: "actual-viewport-clip",
      };
    }

    if (metric.horizontalOverflow || metric.clippedAncestorX || exceedsExpectedContainer) {
      return {
        status: check.overflowStatus || "FAIL",
        reason: metric.horizontalOverflow
          ? "actual-horizontal-overflow"
          : metric.clippedAncestorX
            ? "actual-ancestor-clip"
            : "actual-exceeds-container-width",
      };
    }
    return { status: "PASS", reason: "visible-fit" };
  }

  const drift = (metric.lineCount || 0) - (baselineLines || 0);
  if (drift > 0) {
    return {
      status: check.wrapStatus || "WARN",
      reason: `actual-line-drift+${drift}`,
    };
  }

  if (clippedX) {
    return { status: "FAIL", reason: "clipped-even-with-wrap" };
  }

  return { status: "PASS", reason: "baseline-or-better" };
}

function summarizeMismatches(config, pretextResults, domMetrics) {
  const pretextMap = new Map();
  for (const check of pretextResults.results) {
    for (const dev of check.devices) {
      pretextMap.set(keyFor(check.label, dev.name), {
        status: dev.status,
        reason: dev.reason,
      });
    }
  }

  const desktopName = config.breakpoints[config.breakpoints.length - 1].name;
  const baselineLines = new Map();
  for (const check of config.checks) {
    const mk = keyFor(check.label, desktopName);
    const m = domMetrics.get(mk);
    baselineLines.set(check.label, m?.lineCount || 0);
  }

  const underReported = [];
  const full = [];
  let skipped = 0;

  for (const check of config.checks) {
    for (const bp of config.breakpoints) {
      const key = keyFor(check.label, bp.name);
      const metric = domMetrics.get(key);
      if (metric?.skipped) {
        skipped++;
        continue;
      }
      const reported = pretextMap.get(key) || { status: "ABSENT", reason: "not-in-report" };
      const actual = classifyActual(check, metric, baselineLines.get(check.label));

      const item = {
        label: check.label,
        page: normalizePagePath(check.page || "/"),
        device: bp.name,
        width: bp.width,
        reportedStatus: reported.status,
        reportedReason: reported.reason,
        actualStatus: actual.status,
        actualReason: actual.reason,
        metric,
      };
      full.push(item);

      if (statusRank(actual.status) > statusRank(reported.status)) {
        underReported.push(item);
      }
    }
  }

  return { underReported, full, skipped };
}

async function main() {
  const runnerHealth = `${RUNNER_URL}/api/config`;
  const appHealth = `${APP_URL}/`;

  await ensureService({
    label: "app",
    healthUrl: appHealth,
    spawnCmd: APP_CMD,
    cwd: APP_CWD,
    timeoutMs: 180000,
  });

  await ensureService({
    label: "runner",
    healthUrl: runnerHealth,
    spawnCmd: `node ${join(__dirname, "pretext-check.mjs")}`,
    cwd: __dirname,
    timeoutMs: 120000,
  });

  const configRes = await fetch(runnerHealth);
  if (!configRes.ok) throw new Error(`Failed to fetch config from ${runnerHealth}`);
  const config = await configRes.json();

  console.log("Running pretext measurement in browser...");
  const pretextResults = await ensurePretextResults(RUNNER_URL);

  console.log("Collecting actual DOM metrics with Playwright...");
  const domMetrics = await collectDomMetrics(config);

  const { underReported, full, skipped } = summarizeMismatches(config, pretextResults, domMetrics);

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify({
    createdAt: new Date().toISOString(),
    appUrl: APP_URL,
    runnerUrl: RUNNER_URL,
    summary: {
      checks: config.checks.length,
      breakpoints: config.breakpoints.length,
      comparisons: config.checks.length * config.breakpoints.length,
      skipped,
      underReported: underReported.length,
    },
    underReported,
    full,
  }, null, 2));

  const bySeverity = { FAIL: 0, WARN: 0, ABSENT: 0, PASS: 0 };
  for (const m of underReported) {
    bySeverity[m.actualStatus] = (bySeverity[m.actualStatus] || 0) + 1;
  }
  const criticalUnderReported = underReported.filter(m => m.actualStatus === "FAIL");
  const warnUnderReported = underReported.filter(m => m.actualStatus === "WARN");

  console.log("\n=== Pretext vs Playwright DOM Verification ===");
  console.log(`comparisons:   ${config.checks.length * config.breakpoints.length}`);
  console.log(`skipped:       ${skipped}`);
  console.log(`under-reports: ${underReported.length}`);
  console.log(`output:        ${OUT_PATH}`);
  console.log(`severity:      FAIL=${bySeverity.FAIL || 0} WARN=${bySeverity.WARN || 0} ABSENT=${bySeverity.ABSENT || 0}`);
  console.log(`policy:        fail-on-warn=${FAIL_ON_WARN ? "true" : "false"}`);

  if (underReported.length) {
    const sample = underReported.slice(0, 20);
    console.log("\nTop mismatches (actual > reported):");
    for (const m of sample) {
      console.log(
        `- ${m.label} | ${m.device} (${m.width}px) | reported=${m.reportedStatus}/${m.reportedReason} | actual=${m.actualStatus}/${m.actualReason}`
      );
    }
    if (criticalUnderReported.length > 0 || (FAIL_ON_WARN && warnUnderReported.length > 0)) {
      process.exitCode = 1;
    }
  }
}

try {
  await main();
} catch (err) {
  console.error("verify-pretext-playwright failed:", err);
  process.exitCode = 1;
} finally {
  for (const child of managed) {
    try {
      if (!child.killed) child.kill("SIGTERM");
    } catch {}
  }
}
