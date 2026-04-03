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
      horizontalPadding = check.horizontalPadding || 48;
    }

    const containerWidth = bp.width - horizontalPadding;

    return {
      breakpoint: bp.name,
      width: bp.width,
      fontSize: fontSize + "px",
      containerWidth,
      horizontalPadding,
    };
  });
}

function buildMeasurementPage(config) {
  const breakpoints = config.breakpoints;
  const desktopBp = breakpoints[breakpoints.length - 1];

  // Pre-resolve all checks to pixel values at each breakpoint
  const resolvedChecks = config.checks.map(check => ({
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
  const dskFontStr = (ck.fontWeight || "400") + " " + dsk.fontSize + " " + ck.fontFamily;
  const dskLh = parseFloat(dsk.fontSize) * lh;
  const dskPrep = prepare(ck.text, dskFontStr);

  let baselineLines;
  if (ck.noWrap) {
    baselineLines = 1;
  } else {
    const dskLayout = layout(dskPrep, dsk.containerWidth, dskLh);
    baselineLines = dskLayout.lineCount;
  }

  const devices = [];

  for (let i = 0; i < breakpoints.length; i++) {
    const bp = breakpoints[i];
    const r = ck.resolved[i];
    const fontStr = (ck.fontWeight || "400") + " " + r.fontSize + " " + ck.fontFamily;
    const bpLh = parseFloat(r.fontSize) * lh;

    let lc = 0, tw = 0, st = "PASS";

    try {
      const p = prepare(ck.text, fontStr);

      if (ck.noWrap) {
        const singleLine = layout(p, 99999, bpLh);
        tw = Math.round(singleLine.width || 0);
        lc = 1;
        st = tw > r.containerWidth ? "FAIL" : tw > r.containerWidth * 0.9 ? "WARN" : "PASS";
      } else {
        const result = layout(p, r.containerWidth, bpLh);
        lc = result.lineCount;
        const drift = lc - baselineLines;
        st = drift <= 0 ? "PASS" : drift === 1 ? "WARN" : "FAIL";
      }
    } catch (e) {
      st = "FAIL";
      lc = -1;
    }

    devices.push({
      name: bp.name,
      width: bp.width,
      fontSize: r.fontSize,
      containerWidth: r.containerWidth,
      lineCount: lc,
      baselineLines,
      status: st,
      textWidth: tw,
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

const server = createServer((req, res) => {
  const config = loadConfig();

  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(buildMeasurementPage(config));
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
  } else if (req.method === "GET" && req.url === "/api/results") {
    if (latestResults) {
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      });
      res.end(JSON.stringify(latestResults));
    } else {
      res.writeHead(404, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      });
      res.end('{"error":"no results yet — open http://localhost:' + PORT + '/ to run measurements"}');
    }
  } else if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
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
