#!/usr/bin/env node
/**
 * viewport-preview.mjs
 *
 * Test results viewer. Shows failures as cards, drill into each failure to see
 * how it renders across all devices. Touch-friendly, left/right navigation.
 *
 * Usage:
 *   node viewport-preview.mjs                    # serve on :4445
 *   node viewport-preview.mjs --check-runner=localhost:4444  # custom results server
 *   node viewport-preview.mjs --target=localhost:3000        # custom app target
 */

import { createServer } from "http";
import { readFileSync } from "fs";
import { execSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = resolve(__dirname, "pretext-check-config.json");

const args = Object.fromEntries(
  process.argv.slice(2).filter(a => a.startsWith("--")).map(a => {
    const [k, v] = a.slice(2).split("=");
    return [k, v || "true"];
  })
);

const TARGET = args.target || "http://localhost:3000";
const PORT = parseInt(args.port || "4445");
const RUNNER = args["check-runner"] || "localhost:4444";
const config = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Test Failure Viewer</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
  \${CONFIG.googleFontsUrl ? '<link href="' + CONFIG.googleFontsUrl + '" rel="stylesheet"/>' : ''}
  <style>
    :root {
      --bg: #09090b;
      --surface: #111113;
      --surface-alt: #0f0f12;
      --border: #1e1e22;
      --border-subtle: #16161c;
      --text: #e4e4e7;
      --text-secondary: #a1a1aa;
      --text-muted: #71717a;
      --pass: #4ade80;
      --pass-bg: #052e16;
      --warn: #facc15;
      --warn-bg: #422006;
      --fail: #f87171;
      --fail-bg: #450a0a;
      --gold: #c9a84c;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    html, body {
      height: 100%;
      font-family: "Inter", system-ui, -apple-system, sans-serif;
      background: var(--bg);
      color: var(--text);
      -webkit-font-smoothing: antialiased;
    }

    body { display: flex; flex-direction: column; overflow: hidden; }

    /* --- TOPBAR --- */
    .topbar {
      position: sticky;
      top: 0;
      z-index: 200;
      background: rgba(9, 9, 11, 0.92);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
      padding: 0.6rem 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      min-height: 48px;
      flex-wrap: wrap;
    }

    .topbar h1 {
      font-size: 0.8125rem;
      font-weight: 600;
      white-space: nowrap;
    }

    .topbar-right {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-left: auto;
    }

    .counts {
      display: flex;
      gap: 0.75rem;
      font-size: 0.75rem;
    }

    .counts span {
      display: flex;
      align-items: center;
      gap: 0.3rem;
      padding: 0.25rem 0.5rem;
      background: var(--surface);
      border-radius: 4px;
      border: 1px solid var(--border-subtle);
    }

    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .dot.fail { background: var(--fail); }
    .dot.warn { background: var(--warn); }
    .dot.pass { background: var(--pass); }

    .topbar button {
      padding: 0.4rem 0.8rem;
      font-size: 0.6875rem;
      font-weight: 500;
      border: 1px solid var(--border-subtle);
      background: var(--surface);
      color: var(--text-secondary);
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s;
      white-space: nowrap;
    }

    .topbar button:hover {
      border-color: var(--border);
      background: var(--surface-alt);
      color: var(--text);
    }

    .topbar button.active {
      background: var(--gold);
      color: var(--bg);
      border-color: var(--gold);
    }

    /* --- MAIN LAYOUT --- */
    .container {
      display: flex;
      flex: 1;
      overflow: hidden;
      gap: 0;
    }

    .cards-panel {
      display: flex;
      flex-direction: column;
      width: 25%;
      min-width: 280px;
      border-right: 1px solid var(--border);
      overflow-y: auto;
      background: var(--surface);
    }

    .cards-header {
      padding: 1rem;
      border-bottom: 1px solid var(--border);
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--text-muted);
      sticky: top;
    }

    .cards-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 0.75rem;
      overflow-y: auto;
      flex: 1;
    }

    .card {
      padding: 0.75rem;
      background: var(--surface-alt);
      border: 1px solid var(--border);
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s;
      font-size: 0.75rem;
    }

    .card:hover {
      border-color: var(--border-subtle);
      background: rgba(255, 255, 255, 0.02);
    }

    .card.selected {
      border-color: var(--gold);
      background: rgba(201, 168, 76, 0.08);
      box-shadow: 0 0 0 1px var(--gold);
    }

    .card-label {
      font-weight: 500;
      color: var(--text);
      margin-bottom: 0.25rem;
      line-height: 1.3;
      word-break: break-word;
    }

    .card-status {
      display: inline-block;
      padding: 0.15rem 0.35rem;
      border-radius: 3px;
      font-size: 0.625rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .card-status.fail {
      background: var(--fail-bg);
      color: var(--fail);
    }
    .card-status.warn {
      background: var(--warn-bg);
      color: var(--warn);
    }
    .card-status.pass {
      background: var(--pass-bg);
      color: var(--pass);
    }

    /* --- CANVAS/DETAIL PANEL --- */
    .canvas-panel {
      display: flex;
      flex-direction: column;
      flex: 1;
      overflow: hidden;
    }

    .canvas-header {
      padding: 1rem;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      font-size: 0.8125rem;
      background: var(--surface-alt);
    }

    .canvas-title {
      font-weight: 600;
      color: var(--text);
      flex: 1;
    }

    .canvas-nav {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.6875rem;
      color: var(--text-muted);
    }

    .canvas-nav button {
      width: 28px;
      height: 28px;
      padding: 0;
      background: var(--surface);
      border: 1px solid var(--border);
      color: var(--text-secondary);
      border-radius: 4px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
      font-size: 0.875rem;
    }

    .canvas-nav button:hover {
      border-color: var(--border-subtle);
      background: var(--surface-alt);
      color: var(--text);
    }

    .canvas-nav button:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }

    .canvas-viewport {
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #000;
      position: relative;
    }

    .viewport-frame {
      position: relative;
      background: var(--bg);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      overflow: auto;
    }

    .viewport-frame iframe {
      border: none;
      display: block;
      width: 100%;
      height: 100%;
      background: var(--bg);
      transform-origin: top center;
    }

    .viewport-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      color: var(--text-muted);
      font-size: 0.875rem;
    }

    /* --- DEVICE LIST --- */
    .device-list {
      display: flex;
      gap: 0.5rem;
      padding: 1rem;
      border-top: 1px solid var(--border);
      overflow-x: auto;
      background: var(--surface);
    }

    .device-btn {
      padding: 0.5rem 0.75rem;
      background: var(--surface-alt);
      border: 1px solid var(--border);
      color: var(--text-secondary);
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.6875rem;
      font-weight: 500;
      white-space: nowrap;
      transition: all 0.15s;
      flex-shrink: 0;
    }

    .device-btn:hover {
      border-color: var(--border-subtle);
      background: var(--bg);
      color: var(--text);
    }

    .device-btn.active {
      background: var(--gold);
      color: var(--bg);
      border-color: var(--gold);
    }

    /* --- RESPONSIVE --- */
    @media (max-width: 768px) {
      .container {
        flex-direction: column;
      }

      .cards-panel {
        width: 100%;
        border-right: none;
        border-bottom: 1px solid var(--border);
        max-height: 300px;
      }

      .topbar {
        flex-direction: column;
        align-items: flex-start;
      }

      .topbar-right {
        width: 100%;
        flex-wrap: wrap;
      }
    }

    /* --- SCROLLBAR --- */
    .cards-list::-webkit-scrollbar,
    .device-list::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }

    .cards-list::-webkit-scrollbar-track,
    .device-list::-webkit-scrollbar-track {
      background: transparent;
    }

    .cards-list::-webkit-scrollbar-thumb,
    .device-list::-webkit-scrollbar-thumb {
      background: var(--border);
      border-radius: 3px;
    }

    .cards-list::-webkit-scrollbar-thumb:hover,
    .device-list::-webkit-scrollbar-thumb:hover {
      background: var(--border-subtle);
    }
  </style>
</head>
<body>
  <div class="topbar">
    <h1>Test Failure Viewer</h1>
    <div class="topbar-right">
      <div class="counts" id="counts"></div>
      <button id="runBtn">Generate Report</button>
    </div>
  </div>

  <div class="container">
    <div class="cards-panel">
      <div class="cards-header">Failures</div>
      <div class="cards-list" id="cardsList"></div>
    </div>

    <div class="canvas-panel">
      <div class="canvas-header">
        <div class="canvas-title" id="canvasTitle">Select a test to view details</div>
        <div class="canvas-nav">
          <button id="prevBtn" disabled>←</button>
          <span id="deviceInfo"></span>
          <button id="nextBtn" disabled>→</button>
        </div>
      </div>
      <div class="canvas-viewport" id="canvasViewport">
        <div class="viewport-empty">Select a failed test to see device previews</div>
      </div>
      <div class="device-list" id="deviceList"></div>
    </div>
  </div>

  <script>
    const TARGET = "${TARGET}";
    const RUNNER = "${RUNNER}";
    const CONFIG = ${JSON.stringify(config)};

    let results = null;
    let currentCheckIdx = null;
    let currentDeviceIdx = 0;

    const countEl = document.getElementById("counts");
    const cardsEl = document.getElementById("cardsList");
    const canvasTitleEl = document.getElementById("canvasTitle");
    const deviceInfoEl = document.getElementById("deviceInfo");
    const canvasViewportEl = document.getElementById("canvasViewport");
    const deviceListEl = document.getElementById("deviceList");
    const prevBtn = document.getElementById("prevBtn");
    const nextBtn = document.getElementById("nextBtn");
    const runBtn = document.getElementById("runBtn");

    // Fetch and render results
    async function loadResults() {
      try {
        const resp = await fetch(\`http://\${RUNNER}/api/results\`);
        results = await resp.json();
        render();
      } catch (e) {
        console.error("Failed to load results:", e);
        countEl.innerHTML = '<span style="color: var(--fail)">Error loading results</span>';
      }
    }

    function render() {
      if (!results) return;

      const { summary, results: checks } = results;
      const failures = checks.filter(c => c.worst === "FAIL");

      // Update counts
      countEl.innerHTML = \`
        <span><span class="dot fail"></span> \${summary.fail} fail</span>
        <span><span class="dot warn"></span> \${summary.warn} warn</span>
        <span><span class="dot pass"></span> \${summary.pass} pass</span>
      \`;

      // Render failure cards
      cardsEl.innerHTML = failures.map((c, i) => \`
        <div class="card" data-idx="\${i}">
          <div class="card-label">\${c.label}</div>
          <div class="card-status fail">\${c.worst}</div>
        </div>
      \`).join("");

      // Attach card listeners
      cardsEl.querySelectorAll(".card").forEach(card => {
        card.addEventListener("click", () => {
          const idx = parseInt(card.dataset.idx);
          selectCheck(idx);
        });
      });

      // Auto-select first failure
      if (failures.length > 0) {
        selectCheck(0);
      }
    }

    function selectCheck(idx) {
      const failures = results.results.filter(c => c.worst === "FAIL");
      if (!failures[idx]) return;

      currentCheckIdx = idx;
      currentDeviceIdx = 0;

      // Update card selection
      cardsEl.querySelectorAll(".card").forEach((c, i) => {
        c.classList.toggle("selected", i === idx);
      });

      renderDetail();
    }

    function renderDetail() {
      if (currentCheckIdx === null || !results) return;

      const failures = results.results.filter(c => c.worst === "FAIL");
      const check = failures[currentCheckIdx];

      canvasTitleEl.textContent = check.label;

      const devices = check.devices;
      const device = devices[currentDeviceIdx];

      // Update nav
      prevBtn.disabled = currentDeviceIdx === 0;
      nextBtn.disabled = currentDeviceIdx === devices.length - 1;
      deviceInfoEl.textContent = \`\${device.name} (\${device.width}px)\`;

      // Render iframe
      const width = device.width;
      const scale = Math.min(1, window.innerWidth * 0.7 / width);
      canvasViewportEl.innerHTML = \`
        <div class="viewport-frame">
          <iframe
            src="\${TARGET}\${check.page}"
            style="width: \${width}px; height: auto; transform: scale(\${scale});"
          ></iframe>
        </div>
      \`;

      // Render device tabs
      deviceListEl.innerHTML = devices.map((d, i) => \`
        <button class="device-btn \${i === currentDeviceIdx ? "active" : ""}" data-idx="\${i}">
          \${d.name}
        </button>
      \`).join("");

      deviceListEl.querySelectorAll(".device-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          currentDeviceIdx = parseInt(btn.dataset.idx);
          renderDetail();
        });
      });
    }

    // Keyboard nav
    document.addEventListener("keydown", (e) => {
      if (!results || currentCheckIdx === null) return;

      const failures = results.results.filter(c => c.worst === "FAIL");
      const check = failures[currentCheckIdx];
      const devices = check.devices;

      if (e.key === "ArrowLeft") {
        if (currentDeviceIdx > 0) {
          currentDeviceIdx--;
          renderDetail();
        }
      } else if (e.key === "ArrowRight") {
        if (currentDeviceIdx < devices.length - 1) {
          currentDeviceIdx++;
          renderDetail();
        }
      } else if (e.key === "Escape") {
        currentCheckIdx = null;
        cardsEl.querySelectorAll(".card").forEach(c => c.classList.remove("selected"));
        canvasViewportEl.innerHTML = '<div class="viewport-empty">Select a failed test to see device previews</div>';
      }
    });

    prevBtn.addEventListener("click", () => {
      if (currentDeviceIdx > 0) {
        currentDeviceIdx--;
        renderDetail();
      }
    });

    nextBtn.addEventListener("click", () => {
      const failures = results.results.filter(c => c.worst === "FAIL");
      const check = failures[currentCheckIdx];
      if (currentDeviceIdx < check.devices.length - 1) {
        currentDeviceIdx++;
        renderDetail();
      }
    });

    runBtn.addEventListener("click", loadResults);

    // Load on startup
    loadResults();
  </script>
</body>
</html>
`;

const server = createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html.replace("${TARGET}", TARGET).replace("${RUNNER}", RUNNER).replace("${CONFIG}", JSON.stringify(config)));
});

server.listen(PORT, () => {
  console.log(`Test Failure Viewer: http://localhost:${PORT}`);
  try {
    execSync(`open "http://localhost:${PORT}"`);
  } catch {}
});
