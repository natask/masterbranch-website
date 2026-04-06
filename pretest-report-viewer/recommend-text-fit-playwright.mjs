#!/usr/bin/env node

import { spawn } from "child_process";
import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";
import { buildResolvedConfig, loadConfig } from "./check-config.mjs";
import { listSourceTargets } from "./source-targets.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

const args = Object.fromEntries(
  process.argv.slice(2).filter((arg) => arg.startsWith("--")).map((arg) => {
    const [key, value] = arg.slice(2).split("=");
    return [key, value ?? "true"];
  })
);

const APP_URL = args.app || "http://localhost:3000";
const APP_CMD = args["app-cmd"] || "npm run dev:local";
const APP_CWD = args["app-cwd"] || join(__dirname, "..");
const CONFIG_PATH = args.config || join(__dirname, "pretext-check-config.json");
const OUT_PATH = args.out || join(__dirname, "artifacts", "text-fit-recommendations.json");
const HEADLESS = args.headed !== "true";
const VIEWPORT_HEIGHT = Number(args.height || 900);
const MIN_FONT_SIZE = Number(args["min-font-size"] || 8);
const managed = [];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  child.stdout.on("data", (data) => process.stdout.write(`[${label}] ${data}`));
  child.stderr.on("data", (data) => process.stderr.write(`[${label}] ${data}`));
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

function selectorTargetName(selector) {
  return selector?.match(/data-pretext=['"]([^'"]+)['"]/)?.[1] || null;
}

function validateConfigAgainstSource(config, sourceTargets) {
  const sourceTargetSet = new Set(sourceTargets);
  const staleTargets = [];

  for (const check of config.checks) {
    const targetName = check.target || selectorTargetName(check.selector);
    if (!targetName) continue;
    if (!sourceTargetSet.has(targetName)) {
      staleTargets.push({
        label: check.label,
        page: check.page,
        target: targetName,
      });
    }
  }

  return {
    sourceTargets,
    staleTargets,
  };
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

    if (metric.clippedAncestorX || exceedsExpectedContainer) {
      return {
        status: check.overflowStatus || "FAIL",
        reason: metric.clippedAncestorX
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

async function measureCheck(page, input) {
  return page.evaluate((payload) => {
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
            const selectedText = normalizeText(selected.innerText || selected.textContent || "");
            if (selectedText === normalizeText(text) || selectedText.includes(normalizeText(text))) {
              return selected;
            }
            const nested = findBestMatchElement(selected, text);
            return nested;
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
      return Array.from(range.getClientRects()).filter((rect) => rect.width > 0.5 && rect.height > 0.5);
    }

    function lineCountFor(el) {
      const rects = textRectsFor(el);
      if (!rects.length) return 0;
      const tops = [];

      for (const rect of rects) {
        const top = Math.round(rect.top * 2) / 2;
        if (!tops.some((value) => Math.abs(value - top) < 0.6)) {
          tops.push(top);
        }
      }

      return tops.length;
    }

    function unionRect(rects, fallbackRect) {
      if (!rects.length) return fallbackRect;
      const left = Math.min(...rects.map((rect) => rect.left));
      const right = Math.max(...rects.map((rect) => rect.right));
      const top = Math.min(...rects.map((rect) => rect.top));
      const bottom = Math.max(...rects.map((rect) => rect.bottom));
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
        const style = window.getComputedStyle(node);
        const clipsX = ["hidden", "clip", "scroll", "auto"].includes(style.overflowX);
        const clipsY = ["hidden", "clip", "scroll", "auto"].includes(style.overflowY);
        if (clipsX || clipsY) {
          const rect = node.getBoundingClientRect();
          if (clipsX && (elRect.left < rect.left - 0.5 || elRect.right > rect.right + 0.5)) clippedX = true;
          if (clipsY && (elRect.top < rect.top - 0.5 || elRect.bottom > rect.bottom + 0.5)) clippedY = true;
        }
        node = node.parentElement;
      }

      return { clippedX, clippedY };
    }

    const target = findTarget(payload.selector, payload.text);
    if (!target || !(target instanceof HTMLElement)) {
      return {
        found: false,
        lineCount: 0,
        clippedViewportX: false,
        clippedViewportY: false,
        clippedAncestorX: false,
        clippedAncestorY: false,
        computedFontSizePx: null,
      };
    }

    target.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
    const computedFontSizePx = parseFloat(window.getComputedStyle(target).fontSize);
    const originalInlineFontSize = target.style.fontSize;

    function measureAt(fontSizePx) {
      if (Number.isFinite(fontSizePx)) {
        target.style.fontSize = `${fontSizePx}px`;
      }

      target.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
      const elementRect = target.getBoundingClientRect();
      const textRects = textRectsFor(target);
      const rect = unionRect(textRects, elementRect);
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const clip = clippingAgainstAncestors(rect, target);

      return {
        found: true,
        lineCount: lineCountFor(target),
        clippedViewportX: rect.left < -0.5 || rect.right > viewportWidth + 0.5,
        clippedViewportY: rect.top < -0.5 || rect.bottom > viewportHeight + 0.5,
        clippedAncestorX: clip.clippedX,
        clippedAncestorY: clip.clippedY,
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
        computedFontSizePx: Math.round(parseFloat(window.getComputedStyle(target).fontSize) * 100) / 100,
      };
    }

    function fits(metric) {
      const clippedX = metric.clippedViewportX || metric.clippedAncestorX;
      const exceedsExpectedContainer = !!(
        payload.noWrap &&
        metric?.rect &&
        typeof payload.expectedContainerWidth === "number" &&
        payload.expectedContainerWidth > 0 &&
        metric.rect.width > payload.expectedContainerWidth + 1
      );

      if (payload.noWrap) {
        return !metric.clippedViewportX && !metric.clippedAncestorX && !exceedsExpectedContainer;
      }

      return !clippedX && metric.lineCount <= payload.baselineLines;
    }

    try {
      const current = measureAt(computedFontSizePx);
      const floor = Math.min(payload.minFontSizePx, computedFontSizePx);

      if (fits(current)) {
        return {
          ...current,
          recommendedFontSizePx: null,
          recommendedScale: null,
          resolvedByRecommendation: false,
          floorFontSizePx: floor,
        };
      }

      const floorMetric = measureAt(floor);
      if (!fits(floorMetric)) {
        return {
          ...current,
          recommendedFontSizePx: floor,
          recommendedScale: Math.round((floor / computedFontSizePx) * 1000) / 1000,
          resolvedByRecommendation: false,
          floorFontSizePx: floor,
          recommendationMetric: floorMetric,
        };
      }

      let low = floor;
      let high = computedFontSizePx;
      let bestPx = floor;
      let bestMetric = floorMetric;

      for (let index = 0; index < 14; index += 1) {
        const mid = (low + high) / 2;
        const metric = measureAt(mid);
        if (fits(metric)) {
          bestPx = mid;
          bestMetric = metric;
          low = mid;
        } else {
          high = mid;
        }
      }

      return {
        ...current,
        recommendedFontSizePx: Math.round(bestPx * 100) / 100,
        recommendedScale: Math.round((bestPx / computedFontSizePx) * 1000) / 1000,
        resolvedByRecommendation: true,
        floorFontSizePx: floor,
        recommendationMetric: bestMetric,
      };
    } finally {
      target.style.fontSize = originalInlineFontSize;
    }
  }, input);
}

async function collectBaselineMetrics(config, baselineBreakpoint) {
  const browser = await chromium.launch({ headless: HEADLESS });
  const page = await browser.newPage({ viewport: { width: baselineBreakpoint.width, height: VIEWPORT_HEIGHT } });
  const baselines = new Map();

  try {
    const checksByPage = new Map();
    for (const check of config.checks) {
      const pagePath = normalizePagePath(check.page || "/");
      if (!checksByPage.has(pagePath)) checksByPage.set(pagePath, []);
      checksByPage.get(pagePath).push(check);
    }

    for (const [pagePath, checks] of checksByPage) {
      await page.goto(`${APP_URL}${pagePath}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(600);
      await page.evaluate(async () => {
        if (document.fonts?.ready) await document.fonts.ready;
      });

      for (const check of checks) {
        const resolved = check.resolved.find((item) => item.breakpoint === baselineBreakpoint.name) || check.desktopResolved;
        const metric = await measureCheck(page, {
          selector: resolved.selector || check.selector || null,
          text: resolved.text || check.text || "",
          noWrap: !!check.noWrap,
          baselineLines: check.noWrap ? 1 : 0,
          expectedContainerWidth: resolved.containerWidth ?? null,
          minFontSizePx: MIN_FONT_SIZE,
        });

        baselines.set(check.label, {
          lineCount: check.noWrap ? 1 : metric.lineCount || 0,
          page: pagePath,
        });
      }
    }
  } finally {
    await browser.close();
  }

  return baselines;
}

async function collectRecommendations(config, baselineBreakpoint, baselineMetrics) {
  const browser = await chromium.launch({ headless: HEADLESS });
  const page = await browser.newPage({ viewport: { width: 1280, height: VIEWPORT_HEIGHT } });
  const perCheck = new Map();

  try {
    const checksByPage = new Map();
    for (const check of config.checks) {
      const pagePath = normalizePagePath(check.page || "/");
      if (!checksByPage.has(pagePath)) checksByPage.set(pagePath, []);
      checksByPage.get(pagePath).push(check);
    }

    for (const breakpoint of config.breakpoints) {
      await page.setViewportSize({ width: breakpoint.width, height: VIEWPORT_HEIGHT });

      for (const [pagePath, checks] of checksByPage) {
        await page.goto(`${APP_URL}${pagePath}`, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(600);
        await page.evaluate(async () => {
          if (document.fonts?.ready) await document.fonts.ready;
        });

        for (const check of checks) {
          const resolved = check.resolved.find((item) => item.breakpoint === breakpoint.name);
          const baseline = baselineMetrics.get(check.label) || { lineCount: check.noWrap ? 1 : 0 };
          const metric = await measureCheck(page, {
            selector: resolved?.selector || check.selector || null,
            text: resolved?.text || check.text || "",
            noWrap: !!check.noWrap,
            baselineLines: baseline.lineCount,
            expectedContainerWidth: resolved?.containerWidth ?? null,
            minFontSizePx: check.fitMinFontSize ?? MIN_FONT_SIZE,
          });

          const actual = classifyActual(check, {
            ...metric,
            expectedContainerWidth: resolved?.containerWidth ?? null,
            hasText: !!(resolved?.text || check.text || ""),
          }, baseline.lineCount);

          if (!perCheck.has(check.label)) {
            perCheck.set(check.label, {
              label: check.label,
              page: pagePath,
              target: check.target || null,
              baselineBreakpoint: baselineBreakpoint.name,
              baselineLines: baseline.lineCount,
              currentFitMinFontSize: check.fitMinFontSize ?? null,
              devices: [],
            });
          }

          perCheck.get(check.label).devices.push({
            device: breakpoint.name,
            width: breakpoint.width,
            status: actual.status,
            reason: actual.reason,
            currentFontSizePx: metric.computedFontSizePx,
            currentLineCount: metric.lineCount,
            recommendedFontSizePx: metric.recommendedFontSizePx,
            recommendedScale: metric.recommendedScale,
            resolvedByRecommendation: metric.resolvedByRecommendation,
          });
        }
      }
    }
  } finally {
    await browser.close();
  }

  const recommendations = [];
  for (const item of perCheck.values()) {
    const devicesNeedingChange = item.devices.filter((device) => device.recommendedFontSizePx !== null);
    if (!devicesNeedingChange.length) continue;

    const recommendedFitMinFontSize = Math.round(
      Math.min(...devicesNeedingChange.map((device) => device.recommendedFontSizePx)) * 100
    ) / 100;

    recommendations.push({
      ...item,
      recommendedFitMinFontSize,
      devicesNeedingChange,
      suggestedConfigFields: {
        fitToBaseline: true,
        fitMinFontSize: recommendedFitMinFontSize,
      },
    });
  }

  recommendations.sort((a, b) => a.page.localeCompare(b.page) || a.label.localeCompare(b.label));
  return recommendations;
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

  const config = buildResolvedConfig(loadConfig(CONFIG_PATH));
  const sourceTargets = listSourceTargets(join(__dirname, "..", "src"));
  const configValidation = validateConfigAgainstSource(config, sourceTargets);
  if (configValidation.staleTargets.length) {
    console.error("Config references stale data-pretext targets:");
    for (const item of configValidation.staleTargets) {
      console.error(`- ${item.label} (${item.page}) -> ${item.target}`);
    }
    process.exitCode = 1;
    return;
  }

  const baselineBreakpoint = config.breakpoints.find((bp) => bp.name === (args.baseline || 'Laptop 16"'))
    || config.breakpoints[config.breakpoints.length - 1];

  console.log(`Using baseline breakpoint: ${baselineBreakpoint.name} (${baselineBreakpoint.width}px)`);
  console.log("Collecting baseline metrics...");
  const baselineMetrics = await collectBaselineMetrics(config, baselineBreakpoint);

  console.log("Collecting font-fit recommendations...");
  const recommendations = await collectRecommendations(config, baselineBreakpoint, baselineMetrics);

  const output = {
    createdAt: new Date().toISOString(),
    appUrl: APP_URL,
    configPath: CONFIG_PATH,
    baselineBreakpoint,
    minFontSize: MIN_FONT_SIZE,
    summary: {
      checks: config.checks.length,
      recommendedChecks: recommendations.length,
      breakpoints: config.breakpoints.length,
    },
    timingsMs: {
      total: nowMs() - totalStartMs,
      appStartup: appService.startupMs,
    },
    configValidation,
    recommendations,
  };

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));

  console.log("\n=== Text Fit Recommendations ===");
  console.log(`baseline:      ${baselineBreakpoint.name} (${baselineBreakpoint.width}px)`);
  console.log(`checks:        ${config.checks.length}`);
  console.log(`recommend:     ${recommendations.length}`);
  console.log(`output:        ${OUT_PATH}`);

  const sample = recommendations.slice(0, 20);
  if (sample.length) {
    console.log("\nTop recommendations:");
    for (const item of sample) {
      console.log(`- ${item.label} | fitMinFontSize -> ${item.recommendedFitMinFontSize}px`);
    }
  }
}

try {
  await main();
} catch (err) {
  console.error("recommend-text-fit-playwright failed:", err);
  process.exitCode = 1;
} finally {
  for (const child of managed) {
    try {
      if (!child.killed) child.kill("SIGTERM");
    } catch {}
  }
}
