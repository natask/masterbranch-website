#!/usr/bin/env node

import { spawn } from "child_process";
import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";
import { discoverRoutes, loadProjectConfig } from "./project-config.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

const args = Object.fromEntries(
  process.argv.slice(2).filter(arg => arg.startsWith("--")).map(arg => {
    const [key, value] = arg.slice(2).split("=");
    return [key, value ?? "true"];
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

  child.stdout.on("data", data => process.stdout.write(`[${label}] ${data}`));
  child.stderr.on("data", data => process.stderr.write(`[${label}] ${data}`));
  managed.push(child);
  return child;
}

function cleanup() {
  for (const child of managed) {
    if (!child.killed) child.kill();
  }
}

process.on("exit", cleanup);
process.on("SIGINT", () => {
  cleanup();
  process.exit(130);
});
process.on("SIGTERM", () => {
  cleanup();
  process.exit(143);
});

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

function routeVisitKey(pagePath, deviceName) {
  return `${pagePath}@@${deviceName}`;
}

function breakpointByName(projectConfig, breakpointName) {
  return projectConfig.breakpoints.find(bp => bp.name === breakpointName) || null;
}

function inventoryBreakpointFor(projectConfig) {
  return breakpointByName(projectConfig, projectConfig.inventoryBreakpoint)
    || breakpointByName(projectConfig, "Laptop 16\"")
    || projectConfig.breakpoints[projectConfig.breakpoints.length - 1];
}

function classifyActual(metric, baselineLines) {
  if (!metric?.hasText) return { status: "ABSENT", reason: "missing-at-breakpoint" };

  if (metric.clippedViewportX) return { status: "FAIL", reason: "actual-viewport-clip-x" };
  if (metric.clippedAncestorX) return { status: "FAIL", reason: "actual-ancestor-clip-x" };
  if (metric.clippedViewportY) return { status: "FAIL", reason: "actual-viewport-clip-y" };
  if (metric.clippedAncestorY) return { status: "FAIL", reason: "actual-ancestor-clip-y" };

  const drift = (metric.lineCount || 0) - (baselineLines || 0);
  if (drift > 0) {
    return {
      status: "WARN",
      reason: `actual-line-drift+${drift}`,
    };
  }

  return { status: "PASS", reason: "baseline-or-better" };
}

async function waitForRenderablePage(page) {
  await page.waitForTimeout(250);
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
  });
}

async function collectRouteInventory(page, pagePath) {
  return page.evaluate((currentPagePath) => {
    const SKIP_TAGS = new Set([
      "SCRIPT",
      "STYLE",
      "NOSCRIPT",
      "SVG",
      "PATH",
      "META",
      "LINK",
      "HEAD",
      "TEMPLATE",
    ]);
    const TEXT_TAGS = new Set([
      "A",
      "BUTTON",
      "DD",
      "DT",
      "EM",
      "H1",
      "H2",
      "H3",
      "H4",
      "H5",
      "H6",
      "LABEL",
      "LEGEND",
      "LI",
      "P",
      "SMALL",
      "SPAN",
      "STRONG",
      "SUMMARY",
      "TD",
      "TH",
    ]);

    function normalizeText(value) {
      return (value || "").replace(/\s+/g, " ").trim();
    }

    function cssEscape(value) {
      if (globalThis.CSS?.escape) return globalThis.CSS.escape(value);
      return String(value).replace(/["\\]/g, "\\$&");
    }

    function isVisible(el) {
      if (!(el instanceof HTMLElement)) return false;
      if (SKIP_TAGS.has(el.tagName)) return false;
      if (el.closest("[hidden], [aria-hidden='true']")) return false;

      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return false;
      if (Number.parseFloat(style.opacity || "1") === 0) return false;

      return true;
    }

    function textRectsFor(el) {
      if (!(el instanceof HTMLElement)) return [];
      const range = document.createRange();
      range.selectNodeContents(el);
      return Array.from(range.getClientRects()).filter(rect => rect.width > 0.5 && rect.height > 0.5);
    }

    function lineCountFor(rects) {
      if (!rects.length) return 0;
      const tops = [];

      for (const rect of rects) {
        const top = Math.round(rect.top * 2) / 2;
        if (!tops.some(value => Math.abs(value - top) < 0.6)) tops.push(top);
      }

      return tops.length;
    }

    function unionRect(rects, fallbackRect) {
      if (!rects.length) return fallbackRect;

      const left = Math.min(...rects.map(rect => rect.left));
      const right = Math.max(...rects.map(rect => rect.right));
      const top = Math.min(...rects.map(rect => rect.top));
      const bottom = Math.max(...rects.map(rect => rect.bottom));

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

    function selectorFor(el) {
      if (!(el instanceof HTMLElement)) return null;

      if (el.dataset.pretext) {
        return `[data-pretext="${cssEscape(el.dataset.pretext)}"]`;
      }

      if (el.id) {
        return `#${cssEscape(el.id)}`;
      }

      const segments = [];
      let node = el;

      while (node && node !== document.body && node instanceof HTMLElement) {
        if (node.dataset.pretext) {
          segments.unshift(`[data-pretext="${cssEscape(node.dataset.pretext)}"]`);
          return `body > ${segments.join(" > ")}`;
        }

        if (node.id) {
          segments.unshift(`#${cssEscape(node.id)}`);
          return `body > ${segments.join(" > ")}`;
        }

        const tagName = node.tagName.toLowerCase();
        const siblings = node.parentElement
          ? Array.from(node.parentElement.children).filter(child => child.tagName === node.tagName)
          : [];

        const segment = siblings.length > 1
          ? `${tagName}:nth-of-type(${siblings.indexOf(node) + 1})`
          : tagName;

        segments.unshift(segment);
        node = node.parentElement;
      }

      return `body > ${segments.join(" > ")}`;
    }

    function labelText(selector, text, target) {
      if (target) return target;
      if (selector) return selector.replace(/^body > /, "");
      if (!text) return "text";
      return text.length > 80 ? `${text.slice(0, 77)}...` : text;
    }

    const candidates = [];
    const included = new Set();
    const elements = Array.from(document.body.querySelectorAll("*")).reverse();

    for (const el of elements) {
      if (!isVisible(el)) continue;

      const text = normalizeText(el.innerText || el.textContent || "");
      if (!text) continue;

      const textRects = textRectsFor(el);
      if (!textRects.length) continue;

      if (!el.dataset.pretext && !TEXT_TAGS.has(el.tagName)) continue;

      const ancestorPretext = el.parentElement?.closest("[data-pretext]") || null;
      if (
        !el.dataset.pretext &&
        ancestorPretext &&
        normalizeText(ancestorPretext.innerText || ancestorPretext.textContent || "") === text
      ) {
        continue;
      }

      const childIncluded = Array.from(el.children).some(child => included.has(child));
      const hasNestedPretextChild = !!el.querySelector("[data-pretext]");

      if (childIncluded) {
        if (!el.dataset.pretext) continue;
        if (hasNestedPretextChild) continue;
      }

      el.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });

      const target = el.dataset.pretext || null;
      const selector = selectorFor(el);
      const scrolledTextRects = textRectsFor(el);
      const elementRect = el.getBoundingClientRect();
      const rect = unionRect(scrolledTextRects, elementRect);
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const clipping = clippingAgainstAncestors(rect, el);
      const keyBase = target ? `target:${target}` : `selector:${selector}`;

      candidates.push({
        key: `${currentPagePath}@@${keyBase}`,
        label: `${currentPagePath} :: ${labelText(selector, text, target)}`,
        page: currentPagePath,
        target,
        selector,
        tagName: el.tagName.toLowerCase(),
        text,
        hasText: true,
        lineCount: lineCountFor(scrolledTextRects),
        clippedViewportX: rect.left < -0.5 || rect.right > viewportWidth + 0.5,
        clippedViewportY: rect.top < -0.5 || rect.bottom > viewportHeight + 0.5,
        clippedAncestorX: clipping.clippedX,
        clippedAncestorY: clipping.clippedY,
        viewportWidth,
        viewportHeight,
        rect: {
          left: Math.round(rect.left * 100) / 100,
          right: Math.round(rect.right * 100) / 100,
          width: Math.round(rect.width * 100) / 100,
          top: Math.round(rect.top * 100) / 100,
          bottom: Math.round(rect.bottom * 100) / 100,
          height: Math.round(rect.height * 100) / 100,
        },
        elementRect: {
          left: Math.round(elementRect.left * 100) / 100,
          right: Math.round(elementRect.right * 100) / 100,
          width: Math.round(elementRect.width * 100) / 100,
          top: Math.round(elementRect.top * 100) / 100,
          bottom: Math.round(elementRect.bottom * 100) / 100,
          height: Math.round(elementRect.height * 100) / 100,
        },
      });

      included.add(el);
    }

    return candidates.reverse();
  }, pagePath);
}

async function measureKnownChecks(page, checks) {
  return page.evaluate((knownChecks) => {
    function normalizeText(value) {
      return (value || "").replace(/\s+/g, " ").trim();
    }

    function textRectsFor(el) {
      if (!(el instanceof HTMLElement)) return [];
      const range = document.createRange();
      range.selectNodeContents(el);
      return Array.from(range.getClientRects()).filter(rect => rect.width > 0.5 && rect.height > 0.5);
    }

    function lineCountFor(rects) {
      if (!rects.length) return 0;
      const tops = [];

      for (const rect of rects) {
        const top = Math.round(rect.top * 2) / 2;
        if (!tops.some(value => Math.abs(value - top) < 0.6)) tops.push(top);
      }

      return tops.length;
    }

    function unionRect(rects, fallbackRect) {
      if (!rects.length) return fallbackRect;

      const left = Math.min(...rects.map(rect => rect.left));
      const right = Math.max(...rects.map(rect => rect.right));
      const top = Math.min(...rects.map(rect => rect.top));
      const bottom = Math.max(...rects.map(rect => rect.bottom));

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

    function findElement(check) {
      if (check.selector) {
        try {
          const selected = document.querySelector(check.selector);
          if (selected instanceof HTMLElement) return selected;
        } catch {}
      }

      if (check.target) {
        const selected = document.querySelector(`[data-pretext="${check.target.replace(/["\\]/g, "\\$&")}"]`);
        if (selected instanceof HTMLElement) return selected;
      }

      return null;
    }

    return knownChecks.map(check => {
      const el = findElement(check);
      if (!(el instanceof HTMLElement)) {
        return {
          key: check.key,
          found: false,
          hasText: false,
          lineCount: 0,
          clippedViewportX: false,
          clippedViewportY: false,
          clippedAncestorX: false,
          clippedAncestorY: false,
          rect: null,
          elementRect: null,
          text: "",
        };
      }

      el.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
      const text = normalizeText(el.innerText || el.textContent || "");
      const textRects = textRectsFor(el);
      const elementRect = el.getBoundingClientRect();
      const rect = unionRect(textRects, elementRect);
      const clipping = clippingAgainstAncestors(rect, el);

      return {
        key: check.key,
        found: true,
        hasText: !!text,
        text,
        lineCount: lineCountFor(textRects),
        clippedViewportX: rect.left < -0.5 || rect.right > window.innerWidth + 0.5,
        clippedViewportY: rect.top < -0.5 || rect.bottom > window.innerHeight + 0.5,
        clippedAncestorX: clipping.clippedX,
        clippedAncestorY: clipping.clippedY,
        rect: {
          left: Math.round(rect.left * 100) / 100,
          right: Math.round(rect.right * 100) / 100,
          width: Math.round(rect.width * 100) / 100,
          top: Math.round(rect.top * 100) / 100,
          bottom: Math.round(rect.bottom * 100) / 100,
          height: Math.round(rect.height * 100) / 100,
        },
        elementRect: {
          left: Math.round(elementRect.left * 100) / 100,
          right: Math.round(elementRect.right * 100) / 100,
          width: Math.round(elementRect.width * 100) / 100,
          top: Math.round(elementRect.top * 100) / 100,
          bottom: Math.round(elementRect.bottom * 100) / 100,
          height: Math.round(elementRect.height * 100) / 100,
        },
      };
    });
  }, checks);
}

async function navigateToRoute(page, pagePath, width, perf) {
  const navStartMs = nowMs();
  await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
  perf.viewportChanges++;
  await page.goto(`${APP_URL}${pagePath}`, { waitUntil: "domcontentloaded" });
  perf.totalNavigationMs += nowMs() - navStartMs;
  perf.navigations++;
  const landedPath = new URL(page.url()).pathname;
  if (landedPath !== pagePath) {
    return { redirected: true, landedPath };
  }

  const evalStartMs = nowMs();
  await waitForRenderablePage(page);
  perf.totalEvaluateMs += nowMs() - evalStartMs;
  return { redirected: false, landedPath };
}

async function collectDomMetrics(projectConfig, routes) {
  const browserStartMs = nowMs();
  const browser = await chromium.launch({ headless: HEADLESS });
  const page = await browser.newPage({ viewport: { width: 1280, height: VIEWPORT_HEIGHT } });
  const checks = new Map();
  const routeVisits = new Map();
  const perf = {
    browserLaunchMs: 0,
    totalNavigationMs: 0,
    totalEvaluateMs: 0,
    viewportChanges: 0,
    navigations: 0,
  };

  perf.browserLaunchMs = nowMs() - browserStartMs;
  const inventoryBreakpoint = inventoryBreakpointFor(projectConfig);
  const discoveredRouteChecks = new Map();
  const skippedRoutes = new Map();

  try {
    for (const pagePath of routes) {
      const visit = await navigateToRoute(page, pagePath, inventoryBreakpoint.width, perf);
      if (visit.redirected) {
        skippedRoutes.set(pagePath, `redirected:${pagePath}->${visit.landedPath}`);
        for (const bp of projectConfig.breakpoints) {
          routeVisits.set(routeVisitKey(pagePath, bp.name), {
            skipped: true,
            skipReason: `redirected:${pagePath}->${visit.landedPath}`,
          });
        }
        continue;
      }

      const inventoryStartMs = nowMs();
      const candidates = await collectRouteInventory(page, pagePath);
      perf.totalEvaluateMs += nowMs() - inventoryStartMs;
      routeVisits.set(routeVisitKey(pagePath, inventoryBreakpoint.name), {
        skipped: false,
        count: candidates.length,
      });
      discoveredRouteChecks.set(pagePath, candidates);

      for (const candidate of candidates) {
        checks.set(candidate.key, {
          key: candidate.key,
          label: candidate.label,
          page: candidate.page,
          target: candidate.target,
          selector: candidate.selector,
          text: candidate.text,
          tagName: candidate.tagName,
          metricsByBreakpoint: new Map([[inventoryBreakpoint.name, candidate]]),
        });
      }
    }

    const routesWithChecks = [...discoveredRouteChecks.entries()].filter(([, routeChecks]) => routeChecks.length > 0);

    for (const bp of projectConfig.breakpoints) {
      if (bp.name === inventoryBreakpoint.name) continue;

      for (const [pagePath, routeChecks] of routesWithChecks) {
        if (skippedRoutes.has(pagePath)) {
          routeVisits.set(routeVisitKey(pagePath, bp.name), {
            skipped: true,
            skipReason: skippedRoutes.get(pagePath),
          });
          continue;
        }

        const visit = await navigateToRoute(page, pagePath, bp.width, perf);
        if (visit.redirected) {
          routeVisits.set(routeVisitKey(pagePath, bp.name), {
            skipped: true,
            skipReason: `redirected:${pagePath}->${visit.landedPath}`,
          });
          continue;
        }

        const measureStartMs = nowMs();
        const metrics = await measureKnownChecks(page, routeChecks.map(check => ({
          key: check.key,
          selector: check.selector,
          target: check.target,
        })));
        perf.totalEvaluateMs += nowMs() - measureStartMs;

        routeVisits.set(routeVisitKey(pagePath, bp.name), {
          skipped: false,
          count: metrics.length,
        });

        for (const metric of metrics) {
          const check = checks.get(metric.key);
          if (!check) continue;
          check.metricsByBreakpoint.set(bp.name, {
            ...metric,
            key: check.key,
            label: check.label,
            page: check.page,
            target: check.target,
            selector: check.selector,
            tagName: check.tagName,
          });
          if (metric.text && (!check.text || check.text.length < metric.text.length)) {
            check.text = metric.text;
          }
        }
      }
    }
  } finally {
    await browser.close();
  }

  return { checks, routeVisits, perf, inventoryBreakpoint };
}

function summarizeResults(projectConfig, discoveredChecks, routeVisits, inventoryBreakpoint) {
  const counts = { FAIL: 0, WARN: 0, PASS: 0, ABSENT: 0 };
  const byReason = {};
  const results = [];
  let skipped = 0;

  const checks = [...discoveredChecks.values()].map(check => {
    const baselineMetric = check.metricsByBreakpoint.get(inventoryBreakpoint.name) || null;

    return {
      ...check,
      baselineBreakpoint: inventoryBreakpoint.name,
      baselineLines: baselineMetric?.lineCount || 0,
    };
  });

  for (const check of checks) {
    for (const bp of projectConfig.breakpoints) {
      const routeVisit = routeVisits.get(routeVisitKey(check.page, bp.name));
      if (routeVisit?.skipped) {
        skipped++;
        continue;
      }

      const metric = check.metricsByBreakpoint.get(bp.name) || null;
      const actual = classifyActual(metric, check.baselineLines);

      counts[actual.status] = (counts[actual.status] || 0) + 1;
      byReason[actual.reason] = (byReason[actual.reason] || 0) + 1;

      results.push({
        checkKey: check.key,
        label: check.label,
        page: check.page,
        device: bp.name,
        width: bp.width,
        status: actual.status,
        reason: actual.reason,
        baselineBreakpoint: check.baselineBreakpoint,
        baselineLines: check.baselineLines,
        metric,
      });
    }
  }

  results.sort((a, b) => {
    const statusOrder = { FAIL: 3, WARN: 2, ABSENT: 1, PASS: 0 };
    const statusDelta = statusOrder[b.status] - statusOrder[a.status];
    if (statusDelta !== 0) return statusDelta;
    return a.label.localeCompare(b.label) || a.width - b.width;
  });

  return {
    checks: checks.map(check => ({
      key: check.key,
      label: check.label,
      page: check.page,
      target: check.target,
      selector: check.selector,
      text: check.text,
      tagName: check.tagName,
      baselineBreakpoint: check.baselineBreakpoint,
      baselineLines: check.baselineLines,
    })),
    results,
    counts,
    byReason,
    skipped,
  };
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
  const projectConfig = loadProjectConfig(CONFIG_PATH);
  const routeDiscovery = discoverRoutes(join(__dirname, "..", "src", "app"), projectConfig.pages);
  const configLoadMs = nowMs() - configLoadStartMs;

  console.log(`Discovered ${routeDiscovery.routes.length} routable page${routeDiscovery.routes.length === 1 ? "" : "s"} from the project.`);
  if (routeDiscovery.skippedDynamicRoutes.length) {
    console.log(`Skipped dynamic routes: ${routeDiscovery.skippedDynamicRoutes.join(", ")}`);
  }

  console.log("Collecting browser DOM metrics...");
  const domStartMs = nowMs();
  const { checks: discoveredChecks, routeVisits, perf, inventoryBreakpoint } = await collectDomMetrics(projectConfig, routeDiscovery.routes);
  const domCollectionMs = nowMs() - domStartMs;

  const summarizeStartMs = nowMs();
  const { checks, results, counts, byReason, skipped } = summarizeResults(projectConfig, discoveredChecks, routeVisits, inventoryBreakpoint);
  const summarizeMs = nowMs() - summarizeStartMs;

  const skippedRoutes = [...routeVisits.entries()]
    .filter(([, visit]) => visit.skipped)
    .map(([key, visit]) => {
      const [page, device] = key.split("@@");
      return { page, device, reason: visit.skipReason };
    });

  const output = {
    createdAt: new Date().toISOString(),
    appUrl: APP_URL,
    configPath: CONFIG_PATH,
    inventoryBreakpoint,
    breakpoints: projectConfig.breakpoints,
    routes: {
      discovered: routeDiscovery.routes,
      skippedDynamic: routeDiscovery.skippedDynamicRoutes,
      skippedAtRuntime: skippedRoutes,
    },
    summary: {
      checks: checks.length,
      breakpoints: projectConfig.breakpoints.length,
      comparisons: checks.length * projectConfig.breakpoints.length,
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
    checks,
    results,
  };

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));

  console.log(`\nWrote ${OUT_PATH}`);
  console.log(`Inventory breakpoint: ${inventoryBreakpoint.name} (${inventoryBreakpoint.width}px)`);
  console.log(`Checks discovered: ${output.summary.checks}`);
  console.log(`Results: ${output.summary.fail} fail / ${output.summary.warn} warn / ${output.summary.pass} pass / ${output.summary.absent} absent`);
  if (output.summary.skipped) console.log(`Skipped comparisons: ${output.summary.skipped}`);

  if ((counts.FAIL || 0) > 0 || (FAIL_ON_WARN && (counts.WARN || 0) > 0)) {
    process.exitCode = 1;
  }
}

main().catch(err => {
  console.error("verify-text-playwright failed:", err);
  process.exit(1);
});
