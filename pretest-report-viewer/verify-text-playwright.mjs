#!/usr/bin/env node

import { spawn } from "child_process";
import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";
import { buildResolvedConfig, loadConfig } from "./check-config.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

const args = Object.fromEntries(
  process.argv.slice(2).filter(a => a.startsWith("--")).map(a => {
    const [k, v] = a.slice(2).split("=");
    return [k, v ?? "true"];
  })
);

const APP_URL = args.app || "http://localhost:3000";
const APP_CMD = args["app-cmd"] || "npm run dev:local";
const APP_CWD = args["app-cwd"] || join(__dirname, "..");
const CONFIG_PATH = args.config || join(__dirname, "pretext-check-config.json");
const OUT_PATH = args.out || join(__dirname, "artifacts", "text-playwright-verify.json");
const HEADLESS = args.headed !== "true";
const VIEWPORT_HEIGHT = Number(args.height || 900);
const FAIL_ON_WARN = args["fail-on-warn"] === "true";

const managed = [];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function nowMs() {
  return Number(process.hrtime.bigint()) / 1e6;
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
  const startMs = nowMs();
  if (await isHttpAlive(healthUrl)) {
    return { alreadyRunning: true, startupMs: nowMs() - startMs };
  }

  console.log(`${label}: starting via \`${spawnCmd}\``);
  spawnManaged(label, spawnCmd, cwd);
  await waitForHttp(healthUrl, timeoutMs, label);
  console.log(`${label}: ready`);
  return { alreadyRunning: false, startupMs: nowMs() - startMs };
}

function keyFor(label, deviceName) {
  return `${label}@@${deviceName}`;
}

function normalizePagePath(pagePath) {
  if (!pagePath) return "/";
  return pagePath.startsWith("/") ? pagePath : `/${pagePath}`;
}

function statusRank(status) {
  if (status === "FAIL") return 3;
  if (status === "WARN") return 2;
  if (status === "ABSENT") return 1;
  return 0;
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
    if (metric.clippedViewportX) {
      return { status: "FAIL", reason: "actual-viewport-clip" };
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

async function collectDomMetrics(config) {
  const browserStartMs = nowMs();
  const browser = await chromium.launch({ headless: HEADLESS });
  const page = await browser.newPage({ viewport: { width: 1280, height: VIEWPORT_HEIGHT } });
  const metrics = new Map();
  const perf = {
    browserLaunchMs: 0,
    totalNavigationMs: 0,
    totalEvaluateMs: 0,
    viewportChanges: 0,
    navigations: 0,
  };

  perf.browserLaunchMs = nowMs() - browserStartMs;

  try {
    const checksByPage = new Map();
    for (const check of config.checks) {
      const pagePath = normalizePagePath(check.page || "/");
      if (!checksByPage.has(pagePath)) checksByPage.set(pagePath, []);
      checksByPage.get(pagePath).push(check);
    }

    for (let deviceIndex = 0; deviceIndex < config.breakpoints.length; deviceIndex++) {
      const bp = config.breakpoints[deviceIndex];
      perf.viewportChanges++;
      await page.setViewportSize({ width: bp.width, height: VIEWPORT_HEIGHT });

      for (const [pagePath, checks] of checksByPage) {
        const navStartMs = nowMs();
        await page.goto(`${APP_URL}${pagePath}`, { waitUntil: "domcontentloaded" });
        const landedPath = new URL(page.url()).pathname;
        perf.totalNavigationMs += nowMs() - navStartMs;
        perf.navigations++;

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
        const fontReadyStartMs = nowMs();
        await page.evaluate(async () => {
          if (document.fonts?.ready) await document.fonts.ready;
        });
        perf.totalEvaluateMs += nowMs() - fontReadyStartMs;

        for (const check of checks) {
          const resolved = check.resolved[deviceIndex];
          const evalStartMs = nowMs();
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

            function textRectsFor(el) {
              if (!(el instanceof HTMLElement)) return [];
              const range = document.createRange();
              range.selectNodeContents(el);
              return Array.from(range.getClientRects()).filter(r => r.width > 0.5 && r.height > 0.5);
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

            return {
              found: true,
              lineCount: lineCountFor(target),
              horizontalOverflow:
                target.clientWidth > 0 && (target.scrollWidth - target.clientWidth) > 2,
              clippedViewportX: rect.left < -0.5 || rect.right > viewportWidth + 0.5,
              clippedViewportY: rect.top < -0.5 || rect.bottom > viewportHeight + 0.5,
              ...clippingAgainstAncestors(rect, target),
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
          perf.totalEvaluateMs += nowMs() - evalStartMs;

          metrics.set(keyFor(check.label, bp.name), {
            ...evalResult,
            clippedAncestorX: evalResult.clippedX,
            clippedAncestorY: evalResult.clippedY,
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

  return { metrics, perf };
}

function summarizeResults(config, domMetrics) {
  const desktopName = config.breakpoints[config.breakpoints.length - 1].name;
  const baselineLines = new Map();
  for (const check of config.checks) {
    const metric = domMetrics.get(keyFor(check.label, desktopName));
    baselineLines.set(check.label, metric?.lineCount || 0);
  }

  const counts = { FAIL: 0, WARN: 0, PASS: 0, ABSENT: 0 };
  const byReason = {};
  const results = [];
  let skipped = 0;

  for (const check of config.checks) {
    for (const bp of config.breakpoints) {
      const metric = domMetrics.get(keyFor(check.label, bp.name));
      if (metric?.skipped) {
        skipped++;
        continue;
      }

      const actual = classifyActual(check, metric, baselineLines.get(check.label));
      counts[actual.status] = (counts[actual.status] || 0) + 1;
      byReason[actual.reason] = (byReason[actual.reason] || 0) + 1;

      results.push({
        label: check.label,
        page: normalizePagePath(check.page || "/"),
        device: bp.name,
        width: bp.width,
        status: actual.status,
        reason: actual.reason,
        baselineLines: baselineLines.get(check.label),
        metric,
      });
    }
  }

  results.sort((a, b) => {
    const statusDelta = statusRank(b.status) - statusRank(a.status);
    if (statusDelta !== 0) return statusDelta;
    return a.label.localeCompare(b.label) || a.width - b.width;
  });

  return { results, counts, byReason, skipped };
}

async function main() {
  const totalStartMs = nowMs();
  const appHealth = `${APP_URL}/`;
  const appService = await ensureService({
    label: "app",
    healthUrl: appHealth,
    spawnCmd: APP_CMD,
    cwd: APP_CWD,
    timeoutMs: 180000,
  });

  const configLoadStartMs = nowMs();
  const config = buildResolvedConfig(loadConfig(CONFIG_PATH));
  const configLoadMs = nowMs() - configLoadStartMs;

  console.log("Collecting browser DOM metrics...");
  const domStartMs = nowMs();
  const { metrics: domMetrics, perf } = await collectDomMetrics(config);
  const domCollectionMs = nowMs() - domStartMs;

  const summarizeStartMs = nowMs();
  const { results, counts, byReason, skipped } = summarizeResults(config, domMetrics);
  const summarizeMs = nowMs() - summarizeStartMs;

  const output = {
    createdAt: new Date().toISOString(),
    appUrl: APP_URL,
    configPath: CONFIG_PATH,
    summary: {
      checks: config.checks.length,
      breakpoints: config.breakpoints.length,
      comparisons: config.checks.length * config.breakpoints.length,
      skipped,
      fail: counts.FAIL || 0,
      warn: counts.WARN || 0,
      pass: counts.PASS || 0,
      absent: counts.ABSENT || 0,
    },
    timingsMs: {
      total: nowMs() - totalStartMs,
      appStartup: appService.startupMs,
      configLoad: configLoadMs,
      domCollection: domCollectionMs,
      summarize: summarizeMs,
      browserLaunch: perf.browserLaunchMs,
      totalNavigation: perf.totalNavigationMs,
      totalEvaluate: perf.totalEvaluateMs,
    },
    perf: {
      appAlreadyRunning: appService.alreadyRunning,
      viewportChanges: perf.viewportChanges,
      navigations: perf.navigations,
    },
    reasons: byReason,
    results,
  };

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));

  console.log("\n=== Browser Text Verification ===");
  console.log(`comparisons:   ${output.summary.comparisons}`);
  console.log(`skipped:       ${skipped}`);
  console.log(`fail:          ${output.summary.fail}`);
  console.log(`warn:          ${output.summary.warn}`);
  console.log(`pass:          ${output.summary.pass}`);
  console.log(`output:        ${OUT_PATH}`);
  console.log(`timings(ms):   total=${Math.round(output.timingsMs.total)} app=${Math.round(output.timingsMs.appStartup)} dom=${Math.round(output.timingsMs.domCollection)} nav=${Math.round(output.timingsMs.totalNavigation)} eval=${Math.round(output.timingsMs.totalEvaluate)}`);

  const sample = results.filter(item => item.status === "FAIL" || item.status === "WARN").slice(0, 20);
  if (sample.length) {
    console.log("\nTop browser findings:");
    for (const item of sample) {
      console.log(`- ${item.label} | ${item.device} (${item.width}px) | ${item.status}/${item.reason}`);
    }
  }

  if ((counts.FAIL || 0) > 0 || (FAIL_ON_WARN && (counts.WARN || 0) > 0)) {
    process.exitCode = 1;
  }
}

try {
  await main();
} catch (err) {
  console.error("verify-text-playwright failed:", err);
  process.exitCode = 1;
} finally {
  for (const child of managed) {
    try {
      if (!child.killed) child.kill("SIGTERM");
    } catch {}
  }
}
