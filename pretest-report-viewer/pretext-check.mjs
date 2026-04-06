#!/usr/bin/env node
/**
 * pretext-check.mjs
 *
 * Test runner server. Resolves Tailwind classes to pixel values at each
 * breakpoint using pure math, then serves a measurement page that uses
 * @chenglou/pretext for accurate glyph-level layout.
 *
 * Desktop breakpoint is the baseline — other viewports compared against it.
 *
 * Usage:
 *   node pretext-check.mjs                    # serve on :4444
 *   node pretext-check.mjs --config=path.json # custom config
 *   node pretext-check.mjs --port=5555        # custom port
 */

import { createServer } from "http";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { resolveTextSize, resolvePadding } from "./tailwind-resolver.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

const args = Object.fromEntries(
  process.argv.slice(2).filter(a => a.startsWith("--")).map(a => {
    const [k, v] = a.slice(2).split("=");
    return [k, v || "true"];
  })
);

const configPath = args.config
  ? resolve(args.config)
  : resolve(__dirname, "pretext-check-config.json");
const PORT = parseInt(args.port || "4444");

let latestResults = null;

function loadConfig() {
  return JSON.parse(readFileSync(configPath, "utf-8"));
}

function resolveContainerWidth(check, bp, horizontalPadding) {
  let containerWidth = bp.width - horizontalPadding;

  if (typeof check.maxViewportWidth === "number") {
    containerWidth = Math.min(containerWidth, check.maxViewportWidth - horizontalPadding);
  }

  if (typeof check.maxContainerWidth === "number") {
    containerWidth = Math.min(containerWidth, check.maxContainerWidth);
  }

  if (typeof check.containerFraction === "number") {
    containerWidth *= check.containerFraction;
  }

  if (typeof check.reservedWidth === "number") {
    containerWidth -= check.reservedWidth;
  }

  // Container can never exceed the viewport — anything wider clips.
  containerWidth = Math.min(containerWidth, bp.width);

  return Math.max(0, Math.round(containerWidth));
}

function resolveEffectiveText(check, bp) {
  if (typeof check.hiddenBelowWidth === "number" && bp.width < check.hiddenBelowWidth) {
    return "";
  }
  if (typeof check.hiddenAtOrBelowWidth === "number" && bp.width <= check.hiddenAtOrBelowWidth) {
    return "";
  }
  if (typeof check.hiddenAboveWidth === "number" && bp.width > check.hiddenAboveWidth) {
    return "";
  }
  if (typeof check.hiddenAtOrAboveWidth === "number" && bp.width >= check.hiddenAtOrAboveWidth) {
    return "";
  }

  if (check.textByBreakpoint && typeof check.textByBreakpoint === "object") {
    if (Object.hasOwn(check.textByBreakpoint, bp.name)) {
      return check.textByBreakpoint[bp.name] ?? "";
    }
  }

  if (Array.isArray(check.textRules)) {
    for (const rule of check.textRules) {
      const nameOk = !rule.breakpoint || rule.breakpoint === bp.name;
      const minOk = typeof rule.minWidth !== "number" || bp.width >= rule.minWidth;
      const maxOk = typeof rule.maxWidth !== "number" || bp.width <= rule.maxWidth;
      if (nameOk && minOk && maxOk) {
        return rule.text ?? "";
      }
    }
  }

  return check.text || "";
}

function resolveEffectiveSelector(check, bp) {
  if (check.selectorByBreakpoint && typeof check.selectorByBreakpoint === "object") {
    if (Object.hasOwn(check.selectorByBreakpoint, bp.name)) {
      return check.selectorByBreakpoint[bp.name] || null;
    }
  }

  if (Array.isArray(check.selectorRules)) {
    for (const rule of check.selectorRules) {
      const nameOk = !rule.breakpoint || rule.breakpoint === bp.name;
      const minOk = typeof rule.minWidth !== "number" || bp.width >= rule.minWidth;
      const maxOk = typeof rule.maxWidth !== "number" || bp.width <= rule.maxWidth;
      if (nameOk && minOk && maxOk) {
        return rule.selector || null;
      }
    }
  }

  return check.selector || null;
}

function classifyDeviceResult(check, metrics) {
  const overflowRatio = metrics.containerWidth > 0
    ? metrics.textWidth / metrics.containerWidth
    : Number.POSITIVE_INFINITY;

  if (metrics.error) {
    return {
      status: "FAIL",
      reason: "measurement-error",
      details: `Layout measurement threw: ${metrics.errorMessage || "unknown error"}`,
    };
  }

  if (!metrics.hasText) {
    return {
      status: "ABSENT",
      reason: "empty-text",
      details: "No text configured for this breakpoint.",
    };
  }

  if (check.noWrap) {
    // Hard fail: text wider than the viewport — always clips regardless of container.
    if (metrics.viewportWidth && metrics.textWidth > metrics.viewportWidth) {
      return {
        status: "FAIL",
        reason: "viewport-clip",
        details: "Single-line text exceeds the viewport width.",
        overflowRatio: metrics.textWidth / metrics.viewportWidth,
      };
    }

    if (metrics.textWidth > metrics.containerWidth) {
      return {
        status: check.overflowStatus || "FAIL",
        reason: "truncation",
        details: "Single-line text exceeds its available width.",
        overflowRatio,
      };
    }

    if (overflowRatio > (check.warnOverflowRatio || 0.9)) {
      return {
        status: "WARN",
        reason: "near-truncation",
        details: "Single-line text is close to clipping.",
        overflowRatio,
      };
    }

    return {
      status: "PASS",
      reason: "fits",
      details: "Single-line text fits its available width.",
      overflowRatio,
    };
  }

  const drift = metrics.lineCount - metrics.baselineLines;
  if (drift > 0) {
    return {
      status: check.wrapStatus || "WARN",
      reason: "line-wrap-drift",
      details: `Text uses ${drift} more line${drift === 1 ? "" : "s"} than desktop.`,
      lineDrift: drift,
    };
  }

  return {
    status: "PASS",
    reason: "baseline-match",
    details: "Text matches or improves on the desktop line count.",
    lineDrift: drift,
  };
}

// Browser rendering (hinting, kerning, subpixel) consistently measures wider
// than pretext's glyph-table math. 5% compensates for observed ~4-8% drift.
const MEASUREMENT_SAFETY_MARGIN = 1.05;

function applyLetterSpacingToWidth(textWidth, text, fontSizePx, letterSpacingEm) {
  if (!text || !textWidth || !letterSpacingEm) return textWidth;
  const glyphs = [...String(text)].length;
  if (glyphs <= 1) return textWidth;
  return textWidth + (glyphs - 1) * fontSizePx * letterSpacingEm;
}

/**
 * Resolve a check's Tailwind classes to pixel font sizes and container widths
 * at each breakpoint. Pure math — no browser needed for this step.
 */
function resolveCheck(check, breakpoints) {
  return breakpoints.map(bp => {
    let fontSize;

    if (check.classes) {
      // Tailwind class resolution
      fontSize = resolveTextSize(check.classes, bp.width);
    } else if (check.inlineStyle) {
      // clamp() or raw pixel value
      fontSize = resolveTextSize(check.inlineStyle, bp.width);
    } else if (check.responsive) {
      // Legacy: explicit responsive array
      let fs = check.fontSize;
      for (const o of check.responsive) {
        if (bp.width >= o.minWidth) fs = o.fontSize;
      }
      fontSize = parseFloat(fs);
    } else {
      fontSize = parseFloat(check.fontSize);
    }

    let horizontalPadding;
    if (check.containerPadding) {
      horizontalPadding = resolvePadding(check.containerPadding, bp.width);
    } else {
      horizontalPadding = check.horizontalPadding ?? 48;
    }

    const containerWidth = resolveContainerWidth(check, bp, horizontalPadding);
    const text = resolveEffectiveText(check, bp);
    const selector = resolveEffectiveSelector(check, bp);

    return {
      breakpoint: bp.name,
      width: bp.width,
      fontSize: fontSize + "px",
      containerWidth,
      horizontalPadding,
      text,
      selector,
    };
  });
}

function buildMeasurementPage(config) {
  const breakpoints = config.breakpoints;
  const desktopBp = breakpoints[breakpoints.length - 1];
  const checks = Array.isArray(config.checks) ? config.checks : [];

  // Pre-resolve all checks to pixel values at each breakpoint
  const resolvedChecks = checks.map(check => ({
    ...check,
    resolved: resolveCheck(check, breakpoints),
    desktopResolved: resolveCheck(check, [desktopBp])[0],
  }));

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<title>pretext-check — measuring</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
${config.googleFontsUrl ? '<link href="' + config.googleFontsUrl + '" rel="stylesheet"/>' : ''}
<style>
  body { font-family: system-ui; background: #09090b; color: #e4e4e7; padding: 2rem; }
  #status { font-size: 0.875rem; color: #71717a; }
  .done { color: #4ade80; }
  .err { color: #f87171; }
</style>
</head><body>
<div id="status">Loading fonts & measuring...</div>
<script type="module">
import { prepare, layout } from "https://esm.sh/@chenglou/pretext@0.0.4";
${classifyDeviceResult.toString()}
${applyLetterSpacingToWidth.toString()}
const MEASUREMENT_SAFETY_MARGIN = ${MEASUREMENT_SAFETY_MARGIN};

function measureAtFontSize(check, text, fontSizePx, containerWidth, lineHeightMultiplier) {
  const fontSize = fontSizePx + "px";
  const fontStr = (check.fontWeight || "400") + " " + fontSize + " " + check.fontFamily;
  const lineHeightPx = fontSizePx * lineHeightMultiplier;
  const prepared = prepare(text, fontStr);

  if (check.noWrap) {
    const singleLine = layout(prepared, 99999, lineHeightPx);
    const rawWidth = singleLine.width || 0;
    return {
      fontSize,
      lineCount: text ? 1 : 0,
      textWidth: Math.round(
        applyLetterSpacingToWidth(
          rawWidth,
          text,
          fontSizePx,
          check.letterSpacingEm || 0
        ) * MEASUREMENT_SAFETY_MARGIN
      ),
    };
  }

  const result = layout(prepared, containerWidth, lineHeightPx);
  return {
    fontSize,
    lineCount: result.lineCount,
    textWidth: 0,
  };
}

function fitsAtBaseline(check, metrics, baselineLines, containerWidth, viewportWidth) {
  if (check.noWrap) {
    if (viewportWidth && metrics.textWidth > viewportWidth) return false;
    return metrics.textWidth <= containerWidth;
  }

  return metrics.lineCount <= baselineLines;
}

function findLargestFittingMeasurement(check, text, baseFontSizePx, minFontSizePx, containerWidth, lineHeightMultiplier, baselineLines, viewportWidth) {
  const baseMetrics = measureAtFontSize(check, text, baseFontSizePx, containerWidth, lineHeightMultiplier);
  if (!check.fitToBaseline || !text) {
    return { fontSizePx: baseFontSizePx, ...baseMetrics };
  }

  if (fitsAtBaseline(check, baseMetrics, baselineLines, containerWidth, viewportWidth)) {
    return { fontSizePx: baseFontSizePx, ...baseMetrics };
  }

  const lowFontSizePx = Math.min(minFontSizePx || baseFontSizePx, baseFontSizePx);
  const lowMetrics = measureAtFontSize(check, text, lowFontSizePx, containerWidth, lineHeightMultiplier);
  if (!fitsAtBaseline(check, lowMetrics, baselineLines, containerWidth, viewportWidth)) {
    return { fontSizePx: lowFontSizePx, ...lowMetrics };
  }

  let low = lowFontSizePx;
  let high = baseFontSizePx;
  let bestFontSizePx = lowFontSizePx;
  let bestMetrics = lowMetrics;

  for (let index = 0; index < 14; index += 1) {
    const mid = (low + high) / 2;
    const midMetrics = measureAtFontSize(check, text, mid, containerWidth, lineHeightMultiplier);
    if (fitsAtBaseline(check, midMetrics, baselineLines, containerWidth, viewportWidth)) {
      bestFontSizePx = mid;
      bestMetrics = midMetrics;
      low = mid;
    } else {
      high = mid;
    }
  }

  return { fontSizePx: bestFontSizePx, ...bestMetrics };
}

// Canvas-based text width — uses the browser's own font renderer.
// Matches real DOM rendering exactly, unlike pretext's glyph-table math.
const _measureCanvas = document.createElement("canvas").getContext("2d");
function canvasTextWidth(text, fontStr, letterSpacingEm, fontSizePx) {
  _measureCanvas.font = fontStr;
  if (letterSpacingEm) {
    _measureCanvas.letterSpacing = (fontSizePx * letterSpacingEm) + "px";
  } else {
    _measureCanvas.letterSpacing = "0px";
  }
  return _measureCanvas.measureText(text).width;
}

const checks = ${JSON.stringify(resolvedChecks)};
const breakpoints = ${JSON.stringify(breakpoints)};
const statusEl = document.getElementById("status");

// Load all font variants used in checks
const fontLoads = new Set();
for (const ck of checks) {
  fontLoads.add((ck.fontWeight || "400") + ' 16px "' + ck.fontFamily + '"');
}
await Promise.all([...fontLoads].map(f => document.fonts.load(f)));

const results = [];

for (const ck of checks) {
  const lh = ck.lineHeight || 1.4;

  // Get baseline from desktop
  const dsk = ck.desktopResolved;
  const baselineText = dsk.text || "";
  const dskFontStr = (ck.fontWeight || "400") + " " + dsk.fontSize + " " + ck.fontFamily;
  const dskLh = parseFloat(dsk.fontSize) * lh;

  let baselineLines;
  if (!baselineText) {
    baselineLines = 0;
  } else if (ck.noWrap) {
    baselineLines = 1;
  } else {
    const dskPrep = prepare(baselineText, dskFontStr);
    const dskLayout = layout(dskPrep, dsk.containerWidth, dskLh);
    baselineLines = dskLayout.lineCount;
  }

  const devices = [];

  for (let i = 0; i < breakpoints.length; i++) {
    const bp = breakpoints[i];
    const r = ck.resolved[i];
    const text = r.text || "";
    const baseFontSizePx = parseFloat(r.fontSize);

    let lc = 0, tw = 0;
    let classification;
    let appliedFontSize = r.fontSize;

    try {
      if (text) {
        const measurement = findLargestFittingMeasurement(
          ck,
          text,
          baseFontSizePx,
          ck.fitMinFontSize,
          r.containerWidth,
          lh,
          baselineLines,
          bp.width
        );
        lc = measurement.lineCount;
        tw = measurement.textWidth;
        appliedFontSize = measurement.fontSize;
      }

      classification = classifyDeviceResult(ck, {
        hasText: !!text,
        baselineLines,
        containerWidth: r.containerWidth,
        viewportWidth: bp.width,
        lineCount: lc,
        textWidth: tw,
      });
    } catch (e) {
      lc = -1;
      classification = classifyDeviceResult(ck, {
        hasText: !!text,
        baselineLines,
        containerWidth: r.containerWidth,
        viewportWidth: bp.width,
        lineCount: lc,
        textWidth: tw,
        error: e,
        errorMessage: e?.message || String(e),
      });
    }

    devices.push({
      name: bp.name,
      width: bp.width,
      fontSize: appliedFontSize,
      configuredFontSize: r.fontSize,
      containerWidth: r.containerWidth,
      lineCount: lc,
      baselineLines,
      status: classification.status,
      reason: classification.reason,
      details: classification.details,
      lineDrift: classification.lineDrift ?? null,
      overflowRatio: classification.overflowRatio ?? null,
      textWidth: tw,
      text,
      noWrap: !!ck.noWrap,
    });
  }

  const worst = devices.some(d => d.status === "FAIL")
    ? "FAIL"
    : devices.some(d => d.status === "WARN")
      ? "WARN"
      : "PASS";

    results.push({
      label: ck.label,
      text: ck.text,
      page: ck.page || "/",
      selector: ck.selector || null,
      fontFamily: ck.fontFamily,
      baselineLines,
      worst,
    devices,
  });
}

// Sort: fail → warn → pass
results.sort((a, b) => {
  const order = { FAIL: 0, WARN: 1, PASS: 2 };
  return order[a.worst] - order[b.worst];
});

const fc = results.filter(r => r.worst === "FAIL").length;
const wc = results.filter(r => r.worst === "WARN").length;
const pc = results.filter(r => r.worst === "PASS").length;

const output = {
  summary: {
    fail: fc,
    warn: wc,
    pass: pc,
    total: results.length,
    breakpoints: breakpoints.length,
    checksPerBreakpoint: results.length * breakpoints.length,
  },
  results,
};

try {
  await fetch("/api/results", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(output),
  });
  statusEl.textContent = fc + " fail / " + wc + " warn / " + pc + " pass — " + results.length + " checks × " + breakpoints.length + " breakpoints";
  statusEl.className = fc > 0 ? "err" : "done";
} catch (e) {
  statusEl.textContent = "Failed to post results: " + e.message;
  statusEl.className = "err";
}
</script>
</body></html>`;
}

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

const server = createServer((req, res) => {
  cors(res);
  const config = loadConfig();

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
  } else if (req.method === "GET" && req.url === "/api/config") {
    // Return resolved config — pixel values at each breakpoint, ready for pretext
    const breakpoints = config.breakpoints;
    const resolvedChecks = config.checks.map(check => {
      const resolved = resolveCheck(check, breakpoints);
      const desktopResolved = resolveCheck(check, [breakpoints[breakpoints.length - 1]])[0];
      return {
        label: check.label,
        text: check.text,
        page: check.page || "/",
        selector: check.selector || null,
        fontFamily: check.fontFamily,
        fontWeight: check.fontWeight || "400",
        lineHeight: check.lineHeight || 1.4,
        noWrap: !!check.noWrap,
        wrapStatus: check.wrapStatus || null,
        overflowStatus: check.overflowStatus || null,
        letterSpacingEm: check.letterSpacingEm || 0,
        fitToBaseline: !!check.fitToBaseline,
        fitMinFontSize: check.fitMinFontSize ?? null,
        textByBreakpoint: check.textByBreakpoint || null,
        textRules: check.textRules || null,
        selectorByBreakpoint: check.selectorByBreakpoint || null,
        selectorRules: check.selectorRules || null,
        hiddenBelowWidth: check.hiddenBelowWidth ?? null,
        hiddenAtOrBelowWidth: check.hiddenAtOrBelowWidth ?? null,
        hiddenAboveWidth: check.hiddenAboveWidth ?? null,
        hiddenAtOrAboveWidth: check.hiddenAtOrAboveWidth ?? null,
        resolved,
        desktopResolved,
      };
    });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      googleFontsUrl: config.googleFontsUrl || "",
      breakpoints,
      checks: resolvedChecks,
    }));
  } else if (req.method === "GET" && req.url === "/api/results") {
    if (latestResults) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(latestResults));
    } else {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end('{"error":"no results yet"}');
    }
  } else if (req.method === "POST" && req.url === "/api/results") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        latestResults = JSON.parse(body);
        console.log(
          "Results:",
          latestResults.summary.fail, "fail /",
          latestResults.summary.warn, "warn /",
          latestResults.summary.pass, "pass"
        );
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end('{"ok":true}');
      } catch (e) {
        res.writeHead(400);
        res.end('{"error":"invalid json"}');
      }
    });
  } else if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(buildMeasurementPage(config));
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`Pretext runner: ${url}`);
  console.log(`Results API:    ${url}/api/results`);
});
