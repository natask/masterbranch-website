#!/usr/bin/env node
/**
 * viewport-preview.mjs
 *
 * Test results viewer. Fetches results from pretext-check, shows failures
 * as cards with device preview canvas. Can trigger re-measurement.
 *
 * Usage:
 *   node viewport-preview.mjs                              # serve on :4445
 *   node viewport-preview.mjs --check-runner=localhost:4444 # custom runner
 *   node viewport-preview.mjs --target=localhost:3000       # custom app target
 */

import { createServer } from "http";
import { execSync } from "child_process";

const args = Object.fromEntries(
  process.argv.slice(2).filter(a => a.startsWith("--")).map(a => {
    const [k, v] = a.slice(2).split("=");
    return [k, v || "true"];
  })
);

const TARGET = args.target || "http://localhost:3000";
const PORT = parseInt(args.port || "4445");
const RUNNER = args["check-runner"] || "localhost:4444";

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Viewport Preview</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
<style>
:root {
  --bg: #09090b;
  --surface: #111113;
  --surface-raised: #161619;
  --border: #1e1e22;
  --border-subtle: #16161c;
  --text: #e4e4e7;
  --text-secondary: #a1a1aa;
  --text-muted: #71717a;
  --text-faint: #3f3f50;
  --pass: #4ade80;
  --warn: #facc15;
  --fail: #f87171;
  --gold: #c9a84c;
  --gold-dim: rgba(201,168,76,0.15);
}
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { height: 100%; font-family: "Inter", system-ui, sans-serif; background: var(--bg); color: var(--text); -webkit-font-smoothing: antialiased; }
body { display: flex; flex-direction: column; overflow: hidden; }

/* TOPBAR */
.topbar {
  position: sticky; top: 0; z-index: 200;
  background: rgba(9,9,11,0.92); backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
  padding: 0.5rem 1.25rem;
  display: flex; align-items: center; gap: 1rem;
  min-height: 44px;
}
.topbar h1 { font-size: 0.75rem; font-weight: 600; white-space: nowrap; }
.topbar-right { display: flex; align-items: center; gap: 0.75rem; margin-left: auto; }
.counts { display: flex; gap: 0.5rem; font-size: 0.6875rem; }
.counts span { display: flex; align-items: center; gap: 0.25rem; }
.dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.dot.fail { background: var(--fail); } .dot.warn { background: var(--warn); } .dot.pass { background: var(--pass); }
.btn {
  padding: 0.3rem 0.65rem; font-size: 0.625rem; font-weight: 500;
  border: 1px solid var(--border-subtle); background: var(--surface);
  color: var(--text-secondary); border-radius: 5px; cursor: pointer;
  transition: all 0.12s; white-space: nowrap; font-family: inherit;
}
.btn:hover { border-color: var(--border); color: var(--text); }
.btn.running { color: var(--gold); border-color: var(--gold); opacity: 0.7; pointer-events: none; }

/* FILTER TABS */
.filters {
  display: flex; gap: 1px; padding: 0.375rem 1.25rem;
  background: var(--surface); border-bottom: 1px solid var(--border-subtle);
}
.filters button {
  font-family: inherit; font-size: 0.625rem; font-weight: 500;
  padding: 0.25rem 0.5rem; border-radius: 4px; border: none;
  background: none; color: var(--text-faint); cursor: pointer; transition: all 0.12s;
}
.filters button:hover { color: var(--text-secondary); }
.filters button.on { color: var(--gold); background: var(--gold-dim); }

/* LAYOUT */
.main { display: flex; flex: 1; overflow: hidden; }

/* CARDS PANEL */
.cards-panel {
  width: 260px; min-width: 220px;
  border-right: 1px solid var(--border);
  overflow-y: auto; background: var(--surface);
  display: flex; flex-direction: column;
}
.cards-panel::-webkit-scrollbar { width: 5px; }
.cards-panel::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
.card {
  padding: 0.625rem 0.75rem;
  border-bottom: 1px solid var(--border-subtle);
  cursor: pointer; transition: all 0.1s;
  display: flex; align-items: flex-start; gap: 0.5rem;
}
.card:hover { background: rgba(255,255,255,0.015); }
.card.selected { background: var(--gold-dim); }
.card-badge {
  font-size: 0.5rem; font-weight: 700; text-transform: uppercase;
  padding: 0.1rem 0.3rem; border-radius: 3px; flex-shrink: 0; margin-top: 0.1rem;
  letter-spacing: 0.03em;
}
.card-badge.fail { background: rgba(248,113,113,0.12); color: var(--fail); }
.card-badge.warn { background: rgba(250,204,21,0.12); color: var(--warn); }
.card-badge.pass { background: rgba(74,222,128,0.12); color: var(--pass); }
.card-info { flex: 1; min-width: 0; }
.card-label { font-size: 0.6875rem; font-weight: 500; color: var(--text-secondary); line-height: 1.3; }
.card-text { font-size: 0.5625rem; color: var(--text-faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 0.15rem; }
.card-meta { font-size: 0.5rem; color: var(--text-faint); margin-top: 0.2rem; }

/* CANVAS PANEL */
.canvas-panel { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
.canvas-header {
  padding: 0.625rem 1rem;
  border-bottom: 1px solid var(--border);
  display: flex; align-items: center; gap: 0.75rem;
  background: var(--surface);
  min-height: 40px;
}
.canvas-title { font-size: 0.75rem; font-weight: 600; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.canvas-nav { display: flex; align-items: center; gap: 0.375rem; font-size: 0.625rem; color: var(--text-muted); }
.canvas-nav button {
  width: 26px; height: 26px; padding: 0;
  background: var(--surface); border: 1px solid var(--border);
  color: var(--text-secondary); border-radius: 4px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.12s; font-size: 0.8125rem; font-family: inherit;
}
.canvas-nav button:hover { border-color: var(--border-subtle); color: var(--text); }
.canvas-nav button:disabled { opacity: 0.25; cursor: not-allowed; }

/* VIEWPORT */
.canvas-viewport { flex: 1; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #000; position: relative; }
.viewport-empty { color: var(--text-faint); font-size: 0.75rem; text-align: center; line-height: 1.6; }
.viewport-frame { position: relative; background: var(--bg); overflow: hidden; border-radius: 4px; box-shadow: 0 0 0 1px var(--border); }
.viewport-frame iframe { border: none; display: block; transform-origin: top left; }

/* DEVICE BAR */
.device-bar {
  display: flex; gap: 0.25rem; padding: 0.5rem 1rem;
  border-top: 1px solid var(--border); background: var(--surface);
  overflow-x: auto;
}
.device-bar::-webkit-scrollbar { height: 4px; }
.device-bar::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
.device-btn {
  padding: 0.3rem 0.5rem; font-family: inherit;
  font-size: 0.5625rem; font-weight: 500; white-space: nowrap;
  border: 1px solid var(--border-subtle); background: none;
  color: var(--text-faint); border-radius: 4px; cursor: pointer;
  transition: all 0.12s; flex-shrink: 0;
}
.device-btn:hover { color: var(--text-secondary); border-color: var(--border); }
.device-btn.active { color: var(--bg); background: var(--gold); border-color: var(--gold); }
.device-btn .status-dot {
  display: inline-block; width: 5px; height: 5px; border-radius: 50%; margin-right: 0.25rem; vertical-align: middle;
}

/* HIDDEN IFRAME for triggering measurement */
#measure-frame { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
</style>
</head>
<body>

<div class="topbar">
  <h1>Viewport Preview</h1>
  <div class="topbar-right">
    <div class="counts" id="counts"></div>
    <button class="btn" id="runBtn">Generate Report</button>
  </div>
</div>

<div class="filters" id="filters">
  <button class="on" data-filter="fail">Fail</button>
  <button data-filter="warn">Warn</button>
  <button data-filter="pass">Pass</button>
  <button data-filter="all">All</button>
</div>

<div class="main">
  <div class="cards-panel" id="cardsList"></div>

  <div class="canvas-panel">
    <div class="canvas-header">
      <div class="canvas-title" id="canvasTitle">Click a check to preview</div>
      <div class="canvas-nav">
        <button id="prevDevice" disabled>&larr;</button>
        <span id="deviceLabel"></span>
        <button id="nextDevice" disabled>&rarr;</button>
      </div>
    </div>
    <div class="canvas-viewport" id="viewport">
      <div class="viewport-empty">Select a check to see<br/>how it renders on each device</div>
    </div>
    <div class="device-bar" id="deviceBar"></div>
  </div>
</div>

<script type="module">
import { prepare, layout } from "https://esm.sh/@chenglou/pretext@0.0.4";

const RUNNER = "RUNNER_URL";
const TARGET = "TARGET_URL";

let data = null;
let activeFilter = "fail";
let selectedIdx = null;
let deviceIdx = 0;
let fontsLoaded = false;

const countsEl = document.getElementById("counts");
const cardsEl = document.getElementById("cardsList");
const titleEl = document.getElementById("canvasTitle");
const viewportEl = document.getElementById("viewport");
const deviceBarEl = document.getElementById("deviceBar");
const deviceLabelEl = document.getElementById("deviceLabel");
const prevBtn = document.getElementById("prevDevice");
const nextBtn = document.getElementById("nextDevice");
const runBtn = document.getElementById("runBtn");

// --- Load fonts + Google Fonts link on first config fetch ---
async function ensureFonts(config) {
  if (fontsLoaded) return;
  if (config.googleFontsUrl) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = config.googleFontsUrl;
    document.head.appendChild(link);
  }
  const fontFaces = new Set();
  for (const ck of config.checks) {
    fontFaces.add(ck.fontWeight + ' 16px "' + ck.fontFamily + '"');
  }
  await Promise.all([...fontFaces].map(f => document.fonts.load(f)));
  fontsLoaded = true;
}

// --- Run pretext measurement locally in the browser ---
function runMeasurement(config) {
  const { breakpoints, checks } = config;
  const results = [];

  for (const ck of checks) {
    const lh = ck.lineHeight || 1.4;
    const dsk = ck.desktopResolved;
    const dskFontStr = ck.fontWeight + " " + dsk.fontSize + " " + ck.fontFamily;
    const dskLh = parseFloat(dsk.fontSize) * lh;
    const dskPrep = prepare(ck.text, dskFontStr);

    let baselineLines;
    if (ck.noWrap) {
      baselineLines = 1;
    } else {
      const dskResult = layout(dskPrep, dsk.containerWidth, dskLh);
      baselineLines = dskResult.lineCount;
    }

    const devices = [];
    for (let i = 0; i < breakpoints.length; i++) {
      const bp = breakpoints[i];
      const r = ck.resolved[i];
      const fontStr = ck.fontWeight + " " + r.fontSize + " " + ck.fontFamily;
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
      } catch (e) { st = "FAIL"; lc = -1; }

      devices.push({
        name: bp.name, width: bp.width, fontSize: r.fontSize,
        containerWidth: r.containerWidth, lineCount: lc,
        baselineLines, status: st, textWidth: tw, noWrap: !!ck.noWrap,
      });
    }

    const worst = devices.some(d => d.status === "FAIL") ? "FAIL"
      : devices.some(d => d.status === "WARN") ? "WARN" : "PASS";

    results.push({
      label: ck.label, text: ck.text, page: ck.page || "/",
      fontFamily: ck.fontFamily, baselineLines, worst, devices,
    });
  }

  results.sort((a, b) => ({ FAIL: 0, WARN: 1, PASS: 2 }[a.worst]) - ({ FAIL: 0, WARN: 1, PASS: 2 }[b.worst]));

  const fc = results.filter(r => r.worst === "FAIL").length;
  const wc = results.filter(r => r.worst === "WARN").length;
  const pc = results.filter(r => r.worst === "PASS").length;

  return {
    summary: { fail: fc, warn: wc, pass: pc, total: results.length, breakpoints: breakpoints.length },
    results,
  };
}

// --- Generate Report ---
runBtn.addEventListener("click", async () => {
  runBtn.textContent = "Measuring...";
  runBtn.classList.add("running");

  try {
    const resp = await fetch("http://" + RUNNER + "/api/config");
    const config = await resp.json();
    await ensureFonts(config);
    data = runMeasurement(config);

    // Cache results on server too
    fetch("http://" + RUNNER + "/api/results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).catch(() => {});

    render();
  } catch (e) {
    countsEl.innerHTML = '<span style="color:var(--fail)">Error: ' + e.message + '</span>';
  }

  runBtn.textContent = "Generate Report";
  runBtn.classList.remove("running");
});

// --- Filters ---
document.getElementById("filters").addEventListener("click", (e) => {
  if (!e.target.dataset.filter) return;
  activeFilter = e.target.dataset.filter;
  document.querySelectorAll(".filters button").forEach(b => b.classList.toggle("on", b.dataset.filter === activeFilter));
  selectedIdx = null;
  deviceIdx = 0;
  render();
});

// --- Render ---
function filtered() {
  if (!data) return [];
  if (activeFilter === "all") return data.results;
  return data.results.filter(r => r.worst === activeFilter.toUpperCase());
}

function render() {
  if (!data) return;
  const { summary } = data;

  countsEl.innerHTML =
    '<span><span class="dot fail"></span>' + summary.fail + '</span>' +
    '<span><span class="dot warn"></span>' + summary.warn + '</span>' +
    '<span><span class="dot pass"></span>' + summary.pass + '</span>';

  const list = filtered();
  cardsEl.innerHTML = list.map((r, i) => {
    const failDevices = r.devices.filter(d => d.status !== "PASS").length;
    return '<div class="card' + (i === selectedIdx ? ' selected' : '') + '" data-idx="' + i + '">' +
      '<span class="card-badge ' + r.worst.toLowerCase() + '">' + r.worst + '</span>' +
      '<div class="card-info">' +
        '<div class="card-label">' + r.label + '</div>' +
        '<div class="card-text">' + r.text + '</div>' +
        '<div class="card-meta">' + r.page + ' &middot; ' + failDevices + '/' + r.devices.length + ' devices</div>' +
      '</div>' +
    '</div>';
  }).join("");

  cardsEl.querySelectorAll(".card").forEach(card => {
    card.addEventListener("click", () => {
      selectedIdx = parseInt(card.dataset.idx);
      deviceIdx = 0;
      render();
      renderDetail();
    });
  });

  if (selectedIdx !== null) renderDetail();
  else {
    viewportEl.innerHTML = '<div class="viewport-empty">Select a check to see<br/>how it renders on each device</div>';
    deviceBarEl.innerHTML = "";
    titleEl.textContent = "Click a check to preview";
    deviceLabelEl.textContent = "";
    prevBtn.disabled = true;
    nextBtn.disabled = true;
  }
}

function renderDetail() {
  const list = filtered();
  const check = list[selectedIdx];
  if (!check) return;

  titleEl.textContent = check.label;

  const dev = check.devices[deviceIdx];
  prevBtn.disabled = deviceIdx === 0;
  nextBtn.disabled = deviceIdx === check.devices.length - 1;
  deviceLabelEl.textContent = dev.name + " (" + dev.width + "px)";

  // Compute scale to fit viewport panel
  const vpRect = viewportEl.getBoundingClientRect();
  const maxW = vpRect.width - 32;
  const maxH = vpRect.height - 32;
  const scale = Math.min(1, maxW / dev.width, maxH / 900);
  const scaledW = Math.round(dev.width * scale);
  const scaledH = Math.round(900 * scale);

  viewportEl.innerHTML =
    '<div class="viewport-frame" style="width:' + scaledW + 'px;height:' + scaledH + 'px;">' +
      '<iframe src="' + TARGET + check.page + '" ' +
        'style="width:' + dev.width + 'px;height:900px;transform:scale(' + scale + ');" ' +
        'loading="lazy"></iframe>' +
    '</div>';

  // Device bar
  deviceBarEl.innerHTML = check.devices.map((d, i) => {
    const color = d.status === "FAIL" ? "var(--fail)" : d.status === "WARN" ? "var(--warn)" : "var(--pass)";
    return '<button class="device-btn' + (i === deviceIdx ? ' active' : '') + '" data-i="' + i + '">' +
      '<span class="status-dot" style="background:' + color + '"></span>' +
      d.name +
    '</button>';
  }).join("");

  deviceBarEl.querySelectorAll(".device-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      deviceIdx = parseInt(btn.dataset.i);
      renderDetail();
    });
  });
}

// --- Keyboard nav ---
document.addEventListener("keydown", (e) => {
  const list = filtered();
  if (!list.length) return;

  if (e.key === "ArrowLeft" && selectedIdx !== null) {
    if (deviceIdx > 0) { deviceIdx--; renderDetail(); }
  } else if (e.key === "ArrowRight" && selectedIdx !== null) {
    const check = list[selectedIdx];
    if (deviceIdx < check.devices.length - 1) { deviceIdx++; renderDetail(); }
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    if (selectedIdx === null) { selectedIdx = 0; } else if (selectedIdx > 0) { selectedIdx--; }
    deviceIdx = 0; render(); renderDetail();
  } else if (e.key === "ArrowDown") {
    e.preventDefault();
    if (selectedIdx === null) { selectedIdx = 0; } else if (selectedIdx < list.length - 1) { selectedIdx++; }
    deviceIdx = 0; render(); renderDetail();
  } else if (e.key === "Escape") {
    selectedIdx = null; deviceIdx = 0; render();
  }
});

prevBtn.addEventListener("click", () => { if (deviceIdx > 0) { deviceIdx--; renderDetail(); } });
nextBtn.addEventListener("click", () => {
  const list = filtered();
  if (selectedIdx !== null && deviceIdx < list[selectedIdx].devices.length - 1) { deviceIdx++; renderDetail(); }
});

// --- Initial load: run measurement immediately ---
(async () => {
  try {
    runBtn.textContent = "Measuring...";
    runBtn.classList.add("running");
    const resp = await fetch("http://" + RUNNER + "/api/config");
    const config = await resp.json();
    await ensureFonts(config);
    data = runMeasurement(config);
    render();
  } catch (e) {
    countsEl.innerHTML = '<span style="color:var(--fail)">Start pretext-check first (port ' + RUNNER.split(":")[1] + ')</span>';
  }
  runBtn.textContent = "Generate Report";
  runBtn.classList.remove("running");
})();
</script>
</body>
</html>`;

const server = createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html.replace(/RUNNER_URL/g, RUNNER).replace(/TARGET_URL/g, TARGET));
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`Viewport Preview: ${url}`);
  console.log(`  runner: http://${RUNNER}`);
  console.log(`  target: ${TARGET}`);
  try { execSync(`open "${url}"`); } catch {}
});
