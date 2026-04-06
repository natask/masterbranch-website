#!/usr/bin/env node
/**
 * viewport-preview.mjs
 *
 * Test results viewer. Serves viewport-preview.html with live reload on
 * every browser refresh — edit the HTML, hit refresh, see changes.
 *
 * Auto-launches pretext-check if it isn't already running.
 * Also auto-launches target app if it isn't already running.
 *
 * Usage:
 *   node viewport-preview.mjs                              # serve on :4445
 *   node viewport-preview.mjs --check-runner=localhost:4444 # custom runner
 *   node viewport-preview.mjs --target=localhost:3000       # custom app target
 *   node viewport-preview.mjs --no-runner                   # skip auto-launching runner
 *   node viewport-preview.mjs --no-app                      # skip auto-launching app
 */

import { createServer, request as httpRequest } from "http";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { execSync, spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { loadProjectConfig } from "./project-config.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HTML_PATH = join(__dirname, "viewport-preview.html");
const VIEWER_PATH = "/preview";
const CONFIG_PATH = join(__dirname, "pretext-check-config.json");
const ARTIFACT_PATH = join(__dirname, "artifacts", "text-playwright-verify.json");

const args = Object.fromEntries(
  process.argv.slice(2).filter(a => a.startsWith("--")).map(a => {
    const [k, v] = a.slice(2).split("=");
    return [k, v || "true"];
  })
);

const TARGET = args.target || "http://localhost:3000";
const PORT = parseInt(args.port || "4445");
const NO_APP = args["no-app"] === "true";
const APP_CMD = args["app-cmd"] || "npm run dev:local";
const APP_CWD = args["app-cwd"] || join(__dirname, "..");
const VERIFY_CMD = args["verify-cmd"] || "node pretest-report-viewer/verify-text-playwright.mjs";

let appProc = null;

async function isHttpAlive(url) {
  try {
    const res = await fetch(url, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}

async function ensureApp() {
  if (NO_APP) return;
  if (await isHttpAlive(TARGET)) {
    console.log(`  app: ${TARGET} (already running)`);
    return;
  }

  appProc = spawn(APP_CMD, {
    cwd: APP_CWD,
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  appProc.stdout.on("data", (d) => process.stdout.write(`  [app] ${d}`));
  appProc.stderr.on("data", (d) => process.stderr.write(`  [app] ${d}`));
  appProc.on("exit", (code) => {
    if (code !== null && code !== 0) console.error(`  [app] exited with code ${code}`);
    appProc = null;
  });

  for (let i = 0; i < 240; i++) {
    await new Promise(r => setTimeout(r, 500));
    if (await isHttpAlive(TARGET)) {
      console.log(`  app: ${TARGET} (launched)`);
      return;
    }
  }
  console.warn(`  app: ${TARGET} (launch timed out — may still be starting)`);
}

// Clean up runner on exit
function cleanup() {
  if (appProc) { appProc.kill(); appProc = null; }
}
process.on("exit", cleanup);
process.on("SIGINT", () => { cleanup(); process.exit(0); });
process.on("SIGTERM", () => { cleanup(); process.exit(0); });

function readArtifact() {
  if (!existsSync(ARTIFACT_PATH)) return null;
  return JSON.parse(readFileSync(ARTIFACT_PATH, "utf-8"));
}

function buildViewData() {
  const config = loadProjectConfig(CONFIG_PATH);
  const artifact = readArtifact();
  if (!artifact?.results) {
    return {
      summary: { fail: 0, warn: 0, pass: 0, total: 0, breakpoints: config.breakpoints.length },
      timingsMs: artifact?.timingsMs || null,
      results: [],
    };
  }

  const checksByKey = new Map((artifact.checks || []).map(check => [check.key, check]));
  const byKey = new Map();
  for (const item of artifact.results) {
    const check = checksByKey.get(item.checkKey);
    const mapKey = item.checkKey || item.label;
    let entry = byKey.get(mapKey);
    if (!entry) {
      entry = {
        key: mapKey,
        label: item.label,
        text: check?.text || "",
        page: item.page || "/",
        selector: check?.selector || null,
        target: check?.target || null,
        worst: "PASS",
        devices: [],
      };
      byKey.set(mapKey, entry);
    }

    entry.devices.push({
      name: item.device,
      width: item.width,
      status: item.status,
      reason: item.reason,
      text: check?.text || "",
      selector: check?.selector || null,
      noWrap: false,
      containerWidth: item.metric?.elementRect?.width ?? null,
      textWidth: item.metric?.rect?.width ?? null,
      lineCount: item.metric?.lineCount ?? 0,
      baselineLines: item.baselineLines ?? 0,
    });
  }

  const results = [...byKey.values()].map(entry => {
    entry.devices.sort((a, b) => a.width - b.width);
    entry.worst = entry.devices.some(d => d.status === "FAIL")
      ? "FAIL"
      : entry.devices.some(d => d.status === "WARN")
        ? "WARN"
        : "PASS";
    return entry;
  }).sort((a, b) => ({ FAIL: 0, WARN: 1, PASS: 2 }[a.worst]) - ({ FAIL: 0, WARN: 1, PASS: 2 }[b.worst]));

  return {
    summary: {
      fail: results.filter(r => r.worst === "FAIL").length,
      warn: results.filter(r => r.worst === "WARN").length,
      pass: results.filter(r => r.worst === "PASS").length,
      total: results.length,
      breakpoints: artifact?.breakpoints?.length || config.breakpoints.length,
    },
    timingsMs: artifact.timingsMs || null,
    results,
  };
}

async function runVerification() {
  return new Promise((resolve, reject) => {
    const child = spawn(VERIFY_CMD, {
      cwd: APP_CWD,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
    });

    let stderr = "";
    child.stdout.on("data", d => process.stdout.write(`  [verify] ${d}`));
    child.stderr.on("data", d => {
      const text = String(d);
      stderr += text;
      process.stderr.write(`  [verify] ${text}`);
    });
    child.on("exit", code => {
      if (code === 0 || code === 1) {
        resolve(buildViewData());
        return;
      }
      reject(new Error(stderr.trim() || `Verifier exited with code ${code}`));
    });
  });
}

// --- HTTP server ---
// The viewer UI is namespaced so the proxied app can own `/` and still load
// root-relative assets such as `/_next/*` through the same-origin proxy.
const targetUrl = new URL(TARGET);

const server = createServer((req, res) => {
  const url = req.url || "/";

  if (url === VIEWER_PATH) {
    const html = readFileSync(HTML_PATH, "utf-8");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html.replace(/TARGET_URL/g, ""));
    return;
  }

  if (url === "/api/view-data") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(buildViewData()));
    return;
  }

  if (url === "/api/run" && req.method === "POST") {
    runVerification()
      .then(data => {
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify(data));
      })
      .catch(err => {
        res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: err.message }));
      });
    return;
  }

  const proxyReq = httpRequest(
    {
      hostname: targetUrl.hostname,
      port: targetUrl.port,
      path: url,
      method: req.method,
      headers: { ...req.headers, host: targetUrl.host },
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );
  proxyReq.on("error", () => { res.writeHead(502); res.end("proxy error"); });
  req.pipe(proxyReq);
});

// --- Start ---
(async () => {
  await ensureApp();

  server.listen(PORT, () => {
    const url = `http://localhost:${PORT}${VIEWER_PATH}`;
    console.log(`Viewport Preview: ${url}`);
    console.log(`  target: ${TARGET}`);
    console.log(`  html:   ${HTML_PATH} (live — edit & refresh)`);
    try { execSync(`open "${url}"`); } catch {}
  });
})();
