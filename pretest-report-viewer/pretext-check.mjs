#!/usr/bin/env node
/**
 * pretext-check.mjs
 *
 * Test runner server. Serves a measurement page that loads real fonts,
 * uses @chenglou/pretext for accurate text layout, and exposes results
 * via GET /api/results.
 *
 * Desktop breakpoint is the baseline — other viewports are compared against it.
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

function buildMeasurementPage(config) {
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
<div id="status">Loading fonts &amp; measuring...</div>
<script type="module">
import { prepare, layout } from "https://esm.sh/@chenglou/pretext@0.0.4";

const config = ${JSON.stringify(config)};
const statusEl = document.getElementById("status");

// Load all font variants used in checks
const fontLoads = new Set();
for (const ck of config.checks) {
  fontLoads.add((ck.fontWeight || "400") + ' 16px "' + ck.fontFamily + '"');
}
await Promise.all([...fontLoads].map(f => document.fonts.load(f)));

const breakpoints = config.breakpoints;
const desktopBp = breakpoints[breakpoints.length - 1];

const results = [];

for (const ck of config.checks) {
  const lh = ck.lineHeight || parseFloat(ck.fontSize) * 1.4;

  // Measure at desktop to get baseline
  let desktopFs = ck.fontSize;
  if (ck.responsive) {
    for (const o of ck.responsive) {
      if (desktopBp.width >= o.minWidth) desktopFs = o.fontSize;
    }
  }
  const desktopFont = (ck.fontWeight || "400") + " " + desktopFs + " " + ck.fontFamily;
  const desktopCw = desktopBp.width - (ck.horizontalPadding || 48);
  const desktopPrep = prepare(ck.text, desktopFont);

  let baselineLines;
  if (ck.noWrap) {
    baselineLines = 1;
  } else if (ck.maxLines) {
    baselineLines = ck.maxLines;
  } else {
    const desktopLayout = layout(desktopPrep, desktopCw, lh);
    baselineLines = desktopLayout.lineCount;
  }

  const devices = [];

  for (const bp of breakpoints) {
    let fs = ck.fontSize;
    if (ck.responsive) {
      for (const o of ck.responsive) {
        if (bp.width >= o.minWidth) fs = o.fontSize;
      }
    }

    const font = (ck.fontWeight || "400") + " " + fs + " " + ck.fontFamily;
    const cw = bp.width - (ck.horizontalPadding || 48);

    let lc = 0, tw = 0, st = "PASS";

    try {
      const p = prepare(ck.text, font);

      if (ck.noWrap) {
        const singleLine = layout(p, 99999, lh);
        tw = Math.round(singleLine.width || 0);
        lc = 1;
        st = tw > cw ? "FAIL" : tw > cw * 0.9 ? "WARN" : "PASS";
      } else {
        const r = layout(p, cw, lh);
        lc = r.lineCount;
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
      fontSize: fs,
      containerWidth: cw,
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
    fontSize: ck.fontSize,
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

// Post results back to server
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

console.table(
  results
    .flatMap(r =>
      r.devices
        .filter(d => d.status !== "PASS")
        .map(d => ({
          check: r.label,
          page: r.page,
          device: d.name,
          width: d.width,
          fontSize: d.fontSize,
          container: d.containerWidth,
          lines: d.noWrap ? d.textWidth + "/" + d.containerWidth + "px" : d.lineCount + "/" + d.baselineLines + " lines",
          status: d.status,
        }))
    )
);
</script>
</body></html>`;
}

const server = createServer((req, res) => {
  const config = loadConfig();

  if (req.method === "GET" && req.url === "/") {
    // Serve measurement page — browser runs pretext, posts results back
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(buildMeasurementPage(config));
  } else if (req.method === "POST" && req.url === "/api/results") {
    // Receive results from measurement page
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        latestResults = JSON.parse(body);
        console.log(
          "Results received:",
          latestResults.summary.fail + " fail /",
          latestResults.summary.warn + " warn /",
          latestResults.summary.pass + " pass"
        );
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end('{"ok":true}');
      } catch (e) {
        res.writeHead(400);
        res.end('{"error":"invalid json"}');
      }
    });
  } else if (req.method === "GET" && req.url === "/api/results") {
    // Serve latest results to viewer
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
  console.log(`Open ${url} in a browser to run measurements with real fonts.`);
});
