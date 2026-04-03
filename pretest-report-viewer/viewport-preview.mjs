#!/usr/bin/env node
/**
 * viewport-preview.mjs
 *
 * Test results viewer. Serves viewport-preview.html with live reload on
 * every browser refresh — edit the HTML, hit refresh, see changes.
 *
 * Auto-launches pretext-check if it isn't already running.
 *
 * Usage:
 *   node viewport-preview.mjs                              # serve on :4445
 *   node viewport-preview.mjs --check-runner=localhost:4444 # custom runner
 *   node viewport-preview.mjs --target=localhost:3000       # custom app target
 *   node viewport-preview.mjs --no-runner                   # skip auto-launching runner
 */

import { createServer, request as httpRequest } from "http";
import { readFileSync } from "fs";
import { execSync, spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createConnection } from "net";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HTML_PATH = join(__dirname, "viewport-preview.html");
const VIEWER_PATH = "/preview";

const args = Object.fromEntries(
  process.argv.slice(2).filter(a => a.startsWith("--")).map(a => {
    const [k, v] = a.slice(2).split("=");
    return [k, v || "true"];
  })
);

const TARGET = args.target || "http://localhost:3000";
const PORT = parseInt(args.port || "4445");
const RUNNER = args["check-runner"] || "localhost:4444";
const RUNNER_PORT = parseInt(RUNNER.split(":")[1] || "4444");
const NO_RUNNER = args["no-runner"] === "true";

// --- Auto-launch pretext-check if not already running ---
let runnerProc = null;

function isPortOpen(port) {
  return new Promise((resolve) => {
    const sock = createConnection({ port, host: "127.0.0.1" });
    sock.once("connect", () => { sock.destroy(); resolve(true); });
    sock.once("error", () => { sock.destroy(); resolve(false); });
  });
}

async function ensureRunner() {
  if (NO_RUNNER) return;
  const alive = await isPortOpen(RUNNER_PORT);
  if (alive) {
    console.log(`  runner: http://${RUNNER} (already running)`);
    return;
  }

  const script = join(__dirname, "pretext-check.mjs");
  runnerProc = spawn(process.execPath, [script, `--port=${RUNNER_PORT}`], {
    cwd: __dirname,
    stdio: ["ignore", "pipe", "pipe"],
  });

  runnerProc.stdout.on("data", (d) => process.stdout.write(`  [runner] ${d}`));
  runnerProc.stderr.on("data", (d) => process.stderr.write(`  [runner] ${d}`));
  runnerProc.on("exit", (code) => {
    if (code !== null && code !== 0) console.error(`  [runner] exited with code ${code}`);
    runnerProc = null;
  });

  // Wait for it to be ready (up to 5s)
  for (let i = 0; i < 50; i++) {
    await new Promise(r => setTimeout(r, 100));
    if (await isPortOpen(RUNNER_PORT)) {
      console.log(`  runner: http://${RUNNER} (launched)`);
      return;
    }
  }
  console.warn(`  runner: http://${RUNNER} (launch timed out — may still be starting)`);
}

// Clean up runner on exit
function cleanup() {
  if (runnerProc) { runnerProc.kill(); runnerProc = null; }
}
process.on("exit", cleanup);
process.on("SIGINT", () => { cleanup(); process.exit(0); });
process.on("SIGTERM", () => { cleanup(); process.exit(0); });

// --- HTTP server ---
// The viewer UI is namespaced so the proxied app can own `/` and still load
// root-relative assets such as `/_next/*` through the same-origin proxy.
const targetUrl = new URL(TARGET);

const server = createServer((req, res) => {
  const url = req.url || "/";

  if (url === VIEWER_PATH) {
    const html = readFileSync(HTML_PATH, "utf-8");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html.replace(/RUNNER_URL/g, RUNNER).replace(/TARGET_URL/g, ""));
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
  await ensureRunner();

  server.listen(PORT, () => {
    const url = `http://localhost:${PORT}${VIEWER_PATH}`;
    console.log(`Viewport Preview: ${url}`);
    console.log(`  target: ${TARGET}`);
    console.log(`  html:   ${HTML_PATH} (live — edit & refresh)`);
    try { execSync(`open "${url}"`); } catch {}
  });
})();
