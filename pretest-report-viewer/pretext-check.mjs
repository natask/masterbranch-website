#!/usr/bin/env node
/**
 * pretext-check.mjs
 *
 * Severity-sorted, keyboard-navigable viewport checker.
 *
 * Overview:  Left/Right arrows cycle through findings (fail → warn → pass).
 * Drill-down: Enter zooms into a finding; Left/Right cycles device breakpoints.
 * Escape:    Exits drill-down back to overview.
 *
 * Usage:
 *   node scripts/pretext-check.mjs                    # opens in browser
 *   node scripts/pretext-check.mjs --config=path.json  # custom config
 */

import { readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import { createServer } from "http";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = resolve(__dirname, "pretext-check-config.json");

const configArg = process.argv.find((a) => a.startsWith("--config="));
const configPath = configArg ? configArg.split("=")[1] : CONFIG_PATH;
const config = JSON.parse(readFileSync(configPath, "utf-8"));

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Pretext — ${config.project || "project"}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
${config.googleFontsUrl ? `<link href="${config.googleFontsUrl}" rel="stylesheet" />` : ""}
<style>
  :root {
    --bg: #09090b;
    --surface: #111113;
    --border: #1e1e22;
    --text: #e4e4e7;
    --muted: #71717a;
    --pass: #4ade80;
    --pass-bg: #052e16;
    --warn: #facc15;
    --warn-bg: #422006;
    --fail: #f87171;
    --fail-bg: #450a0a;
    --gold: #c9a84c;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: "Inter", system-ui, -apple-system, sans-serif;
    background: var(--bg); color: var(--text);
    min-height: 100vh; overflow-x: hidden;
  }

  /* ---- Top bar ---- */
  .topbar {
    position: sticky; top: 0; z-index: 200;
    background: rgba(9,9,11,0.92); backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border);
    padding: 0.6rem 1.5rem;
    display: flex; align-items: center; justify-content: space-between; gap: 1rem;
  }
  .topbar h1 { font-size: 0.8125rem; font-weight: 600; white-space: nowrap; }
  .counts { display: flex; gap: 0.75rem; font-size: 0.75rem; }
  .counts span { display: flex; align-items: center; gap: 0.3rem; }
  .dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .dot.fail { background: var(--fail); } .dot.warn { background: var(--warn); } .dot.pass { background: var(--pass); }
  .hint {
    font-size: 0.6875rem; color: var(--muted);
    display: flex; gap: 0.75rem; align-items: center;
  }
  .hint kbd {
    display: inline-block; padding: 0.1rem 0.35rem; border-radius: 3px;
    border: 1px solid #333; background: #1a1a1e; font-family: inherit;
    font-size: 0.625rem; color: var(--text); line-height: 1.2;
  }

  /* ---- Loading ---- */
  #loading {
    display: flex; align-items: center; justify-content: center;
    height: 60vh; color: var(--muted); font-size: 0.875rem;
  }
  .spinner {
    width: 16px; height: 16px; border: 2px solid var(--border);
    border-top-color: var(--gold); border-radius: 50%;
    animation: spin 0.8s linear infinite; margin-right: 0.75rem;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ---- Overview: finding rows ---- */
  #overview { display: none; }
  .finding {
    border-bottom: 1px solid var(--border);
    padding: 1rem 1.5rem;
    cursor: pointer;
    transition: background 0.12s;
    outline: none;
  }
  .finding:hover { background: #0d0d0f; }
  .finding.active {
    background: #0f1014;
    box-shadow: inset 3px 0 0 var(--gold);
  }
  .finding-head {
    display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.6rem;
  }
  .finding-idx {
    font-size: 0.625rem; color: var(--muted); font-variant-numeric: tabular-nums;
    min-width: 1.5rem;
  }
  .badge {
    display: inline-block; padding: 0.1rem 0.45rem; border-radius: 9999px;
    font-size: 0.5625rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
  }
  .badge.pass { background: var(--pass-bg); color: var(--pass); }
  .badge.warn { background: var(--warn-bg); color: var(--warn); }
  .badge.fail { background: var(--fail-bg); color: var(--fail); }
  .finding-label { font-size: 0.8125rem; font-weight: 600; }
  .finding-text { font-size: 0.6875rem; color: var(--muted); margin-left: auto; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .finding-page { font-size: 0.5625rem; color: #444; font-family: monospace; }

  /* Device thumbnail strip */
  .thumb-strip {
    display: flex; gap: 0.5rem; overflow-x: auto; padding-bottom: 0.25rem;
  }
  .thumb-strip::-webkit-scrollbar { height: 3px; }
  .thumb-strip::-webkit-scrollbar-thumb { background: #222; border-radius: 2px; }
  .thumb {
    flex-shrink: 0; border: 1px solid var(--border); border-radius: 6px;
    overflow: hidden; background: var(--surface);
  }
  .thumb.fail { border-color: rgba(248,113,113,0.35); }
  .thumb.warn { border-color: rgba(250,204,21,0.35); }
  .thumb-label {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0.25rem 0.4rem; font-size: 0.5625rem;
    background: rgba(0,0,0,0.3); border-bottom: 1px solid var(--border);
  }
  .thumb-label .tn { color: var(--muted); }
  .thumb-label .ti { font-weight: 600; }
  .thumb-render {
    padding: 8px; min-height: 32px; background: #09090b; position: relative;
    overflow: hidden;
  }
  .thumb-render .render-text {
    word-wrap: break-word; overflow-wrap: break-word;
  }

  /* ---- Drill-down overlay ---- */
  #drilldown {
    display: none; position: fixed; inset: 0; z-index: 300;
    background: rgba(0,0,0,0.85); backdrop-filter: blur(8px);
    flex-direction: column;
  }
  #drilldown.open { display: flex; }
  .dd-topbar {
    padding: 0.75rem 1.5rem; border-bottom: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between;
    background: rgba(9,9,11,0.95);
  }
  .dd-topbar .dd-title { font-size: 0.8125rem; font-weight: 600; }
  .dd-topbar .dd-hint { font-size: 0.6875rem; color: var(--muted); }
  .dd-counter {
    font-size: 0.75rem; color: var(--muted); font-variant-numeric: tabular-nums;
    padding: 0.5rem 1.5rem; border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 0.75rem;
    background: var(--bg);
  }
  .dd-device-name { font-weight: 600; color: var(--text); }
  .dd-device-dims { color: #555; }
  .dd-body {
    flex: 1; overflow: auto; display: flex; align-items: flex-start;
    justify-content: center; padding: 2rem;
  }
  .dd-render-wrap {
    background: #09090b; border: 1px solid var(--border); border-radius: 8px;
    overflow: hidden; position: relative;
  }
  .dd-render-area {
    padding: 24px; position: relative; transform-origin: top left;
  }
  .dd-render-area .render-text {
    word-wrap: break-word; overflow-wrap: break-word;
  }
  .dd-overflow {
    position: absolute; top: 0.5rem; right: 0.5rem;
    font-size: 0.625rem; padding: 0.15rem 0.5rem; border-radius: 4px; font-weight: 700;
  }
  .dd-overflow.fail { background: var(--fail-bg); color: var(--fail); }
  .dd-overflow.warn { background: var(--warn-bg); color: var(--warn); }
  .dd-overflow.pass { background: var(--pass-bg); color: var(--pass); }

  /* Progress dots in drill-down */
  .dd-dots {
    display: flex; gap: 0.35rem; justify-content: center;
    padding: 0.75rem; border-top: 1px solid var(--border);
    background: var(--bg);
  }
  .dd-dot {
    width: 6px; height: 6px; border-radius: 50%; background: #333;
    transition: all 0.15s;
  }
  .dd-dot.active { background: var(--gold); transform: scale(1.4); }
  .dd-dot.fail { background: rgba(248,113,113,0.5); }
  .dd-dot.warn { background: rgba(250,204,21,0.5); }
  .dd-dot.fail.active { background: var(--fail); }
  .dd-dot.warn.active { background: var(--warn); }
</style>
</head>
<body>

<div class="topbar">
  <div style="display:flex;align-items:center;gap:1rem">
    <h1>Pretext</h1>
    <div class="counts" id="counts"></div>
  </div>
  <div class="hint" id="hint-bar">
    <span><kbd>&larr;</kbd><kbd>&rarr;</kbd> navigate</span>
    <span><kbd>Enter</kbd> drill down</span>
    <span><kbd>Esc</kbd> back</span>
  </div>
</div>

<div id="loading"><div class="spinner"></div>Loading fonts &amp; measuring...</div>
<div id="overview"></div>

<div id="drilldown">
  <div class="dd-topbar">
    <span class="dd-title" id="dd-title"></span>
    <span class="dd-hint"><kbd>Esc</kbd> close &nbsp; <kbd>&larr;</kbd><kbd>&rarr;</kbd> devices</span>
  </div>
  <div class="dd-counter" id="dd-counter"></div>
  <div class="dd-body" id="dd-body"></div>
  <div class="dd-dots" id="dd-dots"></div>
</div>

<script>
window.onerror = function(msg, src, line, col, err) {
  document.getElementById("loading").innerHTML =
    '<div style="color:#f87171;max-width:600px;text-align:left;font-size:13px">' +
    '<b>Error:</b> ' + msg + '<br><span style="color:#71717a">Line ' + line + ' col ' + col + '</span>' +
    (err && err.stack ? '<pre style="margin-top:8px;font-size:11px;color:#555;white-space:pre-wrap">' + err.stack + '</pre>' : '') +
    '</div>';
};
window.addEventListener("unhandledrejection", function(e) {
  document.getElementById("loading").innerHTML =
    '<div style="color:#f87171;max-width:600px;text-align:left;font-size:13px">' +
    '<b>Unhandled rejection:</b> ' + (e.reason && e.reason.message || e.reason) +
    (e.reason && e.reason.stack ? '<pre style="margin-top:8px;font-size:11px;color:#555;white-space:pre-wrap">' + e.reason.stack + '</pre>' : '') +
    '</div>';
});
</script>

<script type="module">
import { prepare, layout } from "https://esm.sh/@chenglou/pretext@0.0.4";

const config = ${JSON.stringify(config, null, 2)};

function categorize(w) {
  if (w <= 430) return "mobile";
  if (w <= 1024) return "tablet";
  return "desktop";
}

// Wait for fonts
await document.fonts.ready;
await new Promise(r => setTimeout(r, 500));

// ---- Measure all checks ----
const findings = [];

for (const check of config.checks) {
  const lineHeight = check.lineHeight || parseFloat(check.fontSize) * 1.4;
  const maxLines = check.maxLines || 1;
  const devices = [];
  let worst = "pass";

  for (const bp of config.breakpoints) {
    let fs = check.fontSize;
    if (check.responsive) {
      for (const o of check.responsive) {
        if (bp.width >= o.minWidth) fs = o.fontSize;
      }
    }
    const fontStr = (check.fontWeight || "400") + " " + fs + " " + check.fontFamily;
    const cw = bp.width - (check.horizontalPadding || 48);

    let lc = 0, h = 0, st = "pass", tw = 0, err = null;
    try {
      const p = prepare(check.text, fontStr);
      if (check.noWrap) {
        const sl = layout(p, 99999, lineHeight);
        tw = Math.round(sl.width || (parseFloat(fs) * check.text.length * 0.65));
        lc = 1; h = Math.round(lineHeight);
        st = tw > cw ? "fail" : tw > cw * 0.9 ? "warn" : "pass";
      } else {
        const r = layout(p, cw, lineHeight);
        lc = r.lineCount; h = Math.round(r.height);
        st = lc <= maxLines ? "pass" : lc <= maxLines + 1 ? "warn" : "fail";
      }
    } catch (e) { err = e.message; st = "fail"; }

    if (st === "fail") worst = "fail";
    else if (st === "warn" && worst !== "fail") worst = "warn";

    devices.push({
      name: bp.name, width: bp.width, category: categorize(bp.width),
      fontSize: fs, containerWidth: cw, lineCount: lc, height: h,
      textWidth: tw, maxLines, status: st, error: err,
    });
  }

  findings.push({
    label: check.label, text: check.text, page: check.page || "/",
    fontFamily: check.fontFamily, fontWeight: check.fontWeight || "400",
    lineHeight, noWrap: !!check.noWrap, worst, devices,
  });
}

// ---- Sort: fail first, warn second, pass last ----
const order = { fail: 0, warn: 1, pass: 2 };
findings.sort((a, b) => order[a.worst] - order[b.worst]);

// ---- Counts ----
const fc = findings.filter(f => f.worst === "fail").length;
const wc = findings.filter(f => f.worst === "warn").length;
const pc = findings.filter(f => f.worst === "pass").length;
document.getElementById("counts").innerHTML =
  '<span><span class="dot fail"></span>' + fc + ' fail</span>' +
  '<span><span class="dot warn"></span>' + wc + ' warn</span>' +
  '<span><span class="dot pass"></span>' + pc + ' pass</span>';

// ---- Render overview ----
const overviewEl = document.getElementById("overview");
let oh = "";
findings.forEach((f, i) => {
  let thumbs = "";
  f.devices.forEach((d, di) => {
    const scale = Math.min(1, 200 / d.containerWidth);
    const metric = f.noWrap
      ? d.textWidth + "/" + d.containerWidth + "px"
      : d.lineCount + "/" + d.maxLines;
    thumbs += '<div class="thumb ' + d.status + '" data-di="' + di + '">' +
      '<div class="thumb-label"><span class="tn">' + d.name + '</span><span class="ti ' + d.status + '">' + metric + '</span></div>' +
      '<div class="thumb-render" style="width:' + d.containerWidth + 'px;transform:scale(' + scale + ');transform-origin:top left;height:' + Math.ceil(Math.max(d.height, 24) * scale) + 'px;">' +
      '<div class="render-text" style="font-family:\\'' + f.fontFamily + '\\',serif;font-weight:' + f.fontWeight + ';font-size:' + d.fontSize + ';line-height:' + f.lineHeight + 'px;color:' + (f.fontFamily === "Cinzel" ? "#c9a84c" : "#e4e4e7") + ';width:' + d.containerWidth + 'px;' + (f.noWrap ? 'white-space:nowrap;' : '') + '">' + f.text + '</div>' +
      '</div></div>';
  });

  oh += '<div class="finding" data-idx="' + i + '" tabindex="-1">' +
    '<div class="finding-head">' +
    '<span class="finding-idx">' + (i + 1) + '</span>' +
    '<span class="badge ' + f.worst + '">' + f.worst.toUpperCase() + '</span>' +
    '<span class="finding-label">' + f.label + '</span>' +
    '<span class="finding-page">' + f.page + '</span>' +
    '<span class="finding-text">&ldquo;' + f.text + '&rdquo;</span>' +
    '</div>' +
    '<div class="thumb-strip">' + thumbs + '</div>' +
    '</div>';
});
overviewEl.innerHTML = oh;

document.getElementById("loading").style.display = "none";
overviewEl.style.display = "block";

// ---- State ----
let activeIdx = 0;
let drillOpen = false;
let drillDevIdx = 0;

function setActive(idx) {
  if (idx < 0 || idx >= findings.length) return;
  activeIdx = idx;
  document.querySelectorAll(".finding").forEach((el, i) => {
    el.classList.toggle("active", i === idx);
  });
  const el = document.querySelector('.finding[data-idx="' + idx + '"]');
  if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function openDrill(findingIdx, deviceIdx) {
  drillOpen = true;
  drillDevIdx = deviceIdx || 0;
  const f = findings[findingIdx];
  document.getElementById("dd-title").innerHTML =
    '<span class="badge ' + f.worst + '" style="margin-right:0.5rem">' + f.worst.toUpperCase() + '</span>' + f.label;
  renderDrillDevice(findingIdx, drillDevIdx);
  renderDrillDots(findingIdx, drillDevIdx);
  document.getElementById("drilldown").classList.add("open");
}

function closeDrill() {
  drillOpen = false;
  document.getElementById("drilldown").classList.remove("open");
}

function renderDrillDevice(fi, di) {
  const f = findings[fi];
  const d = f.devices[di];
  const maxRenderWidth = Math.min(d.containerWidth, window.innerWidth - 80);
  const scale = maxRenderWidth / d.containerWidth;

  const metric = f.noWrap
    ? d.textWidth + " / " + d.containerWidth + "px"
    : d.lineCount + " / " + d.maxLines + " lines";

  document.getElementById("dd-counter").innerHTML =
    '<span class="dd-device-name">' + d.name + '</span>' +
    '<span class="dd-device-dims">' + d.width + 'px viewport &rarr; ' + d.containerWidth + 'px container</span>' +
    '<span class="badge ' + d.status + '">' + metric + '</span>' +
    '<span style="margin-left:auto;color:var(--muted);font-size:0.6875rem">' + (di + 1) + ' / ' + f.devices.length + '</span>';

  const rh = Math.max(d.height, 40);
  document.getElementById("dd-body").innerHTML =
    '<div class="dd-render-wrap" style="width:' + Math.round(d.containerWidth * scale) + 'px">' +
    '<div class="dd-render-area" style="width:' + d.containerWidth + 'px;transform:scale(' + scale + ');height:' + rh + 'px;">' +
    '<div class="render-text" style="font-family:\\'' + f.fontFamily + '\\',serif;font-weight:' + f.fontWeight + ';font-size:' + d.fontSize + ';line-height:' + f.lineHeight + 'px;color:' + (f.fontFamily === "Cinzel" ? "#c9a84c" : "#e4e4e7") + ';width:' + d.containerWidth + 'px;' + (f.noWrap ? 'white-space:nowrap;' : '') + '">' + f.text + '</div>' +
    '</div>' +
    '<div class="dd-overflow ' + d.status + '">' + (d.status === "pass" ? "OK" : d.status === "warn" ? "TIGHT" : "OVERFLOW") + '</div>' +
    '</div>';
}

function renderDrillDots(fi, di) {
  const f = findings[fi];
  let dots = "";
  f.devices.forEach((d, i) => {
    dots += '<div class="dd-dot ' + d.status + (i === di ? ' active' : '') + '"></div>';
  });
  document.getElementById("dd-dots").innerHTML = dots;
}

// ---- Keyboard ----
document.addEventListener("keydown", (e) => {
  if (drillOpen) {
    if (e.key === "Escape") { closeDrill(); e.preventDefault(); }
    else if (e.key === "ArrowRight") {
      drillDevIdx = (drillDevIdx + 1) % findings[activeIdx].devices.length;
      renderDrillDevice(activeIdx, drillDevIdx);
      renderDrillDots(activeIdx, drillDevIdx);
      e.preventDefault();
    } else if (e.key === "ArrowLeft") {
      drillDevIdx = (drillDevIdx - 1 + findings[activeIdx].devices.length) % findings[activeIdx].devices.length;
      renderDrillDevice(activeIdx, drillDevIdx);
      renderDrillDots(activeIdx, drillDevIdx);
      e.preventDefault();
    }
  } else {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      setActive(Math.min(activeIdx + 1, findings.length - 1));
      e.preventDefault();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      setActive(Math.max(activeIdx - 1, 0));
      e.preventDefault();
    } else if (e.key === "Enter") {
      openDrill(activeIdx, 0);
      e.preventDefault();
    }
  }
});

// ---- Click to drill ----
overviewEl.addEventListener("click", (e) => {
  const row = e.target.closest(".finding");
  if (!row) return;
  const idx = parseInt(row.dataset.idx);
  setActive(idx);
  // Check if they clicked a specific device thumb
  const thumb = e.target.closest(".thumb");
  const di = thumb ? parseInt(thumb.dataset.di) : 0;
  openDrill(idx, di);
});

// Start with first finding active
if (findings.length > 0) setActive(0);
</script>
</body>
</html>`;

const outPath = "/tmp/pretext-check.html";
writeFileSync(outPath, html);

// Serve over localhost so Google Fonts + ESM imports work
const PORT = 4445;
const server = createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(readFileSync(outPath, "utf-8"));
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`Serving at ${url}`);
  console.log("Press Ctrl+C to stop.\n");
  try {
    execSync(`open "${url}"`);
  } catch {
    console.log(`Open manually: ${url}`);
  }
});
