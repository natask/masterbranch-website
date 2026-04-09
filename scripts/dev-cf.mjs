#!/usr/bin/env node
/**
 * dev-cf.mjs — Cloudflare-accurate dev with auto-rebuild.
 *
 * Runs on the real workerd runtime. Watches src/ for changes and rebuilds
 * automatically. Uses turbopack + skips minification for speed.
 *
 * Pipeline per rebuild:
 *   1. next build --turbopack --no-mangling  (~12s)
 *   2. opennextjs-cloudflare build --skipNextBuild  (~5s)
 *   3. wrangler picks up new worker.js (live-reload)
 *
 * Total: ~17s per full rebuild. For faster iteration with content-only changes,
 * use dev-cf-smart.mjs which skips step 1 for non-import files (~5s).
 *
 * Usage:
 *   node scripts/dev-cf.mjs
 *   node scripts/dev-cf-smart.mjs          # intelligent rebuild skipping
 *   node scripts/dev-cf.mjs --debounce=2000
 *   node scripts/dev-cf.mjs --no-turbo     # use webpack instead of turbopack
 */

import { spawn, execSync } from "child_process";
import { watch } from "fs";
import { resolve, join, relative } from "path";

const ROOT = resolve(import.meta.dirname, "..");
const SRC = join(ROOT, "src");
const DEBOUNCE_MS = parseInt(
  process.argv.find((a) => a.startsWith("--debounce="))?.split("=")[1] || "1500"
);
const USE_TURBO = !process.argv.includes("--no-turbo");

let building = false;
let pendingRebuild = false;
let wranglerProc = null;

function log(msg) {
  const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
  console.log(`\x1b[36m[dev:cf ${ts}]\x1b[0m ${msg}`);
}

function logErr(msg) {
  const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
  console.error(`\x1b[31m[dev:cf ${ts}]\x1b[0m ${msg}`);
}

function timeCmd(label, cmd) {
  const start = Date.now();
  try {
    execSync(cmd, { cwd: ROOT, stdio: "inherit" });
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    log(`${label} done (${elapsed}s)`);
    return true;
  } catch {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    logErr(`${label} failed (${elapsed}s)`);
    return false;
  }
}

function build() {
  if (building) {
    pendingRebuild = true;
    return;
  }
  building = true;
  const start = Date.now();
  log("rebuilding...");

  // Step 1: next build (turbopack + no mangling = fast, no minification)
  const turboFlag = USE_TURBO ? " --turbopack" : "";
  const ok = timeCmd(
    "next build",
    `npx next build${turboFlag} --no-mangling`
  );

  if (ok) {
    // Step 2: OpenNext bundle only (skip the next build we just did)
    timeCmd("opennext bundle", "npx opennextjs-cloudflare build --skipNextBuild");
  }

  const total = ((Date.now() - start) / 1000).toFixed(1);
  log(ok ? `rebuild complete (${total}s total)` : `rebuild failed (${total}s)`);

  building = false;
  if (pendingRebuild) {
    pendingRebuild = false;
    build();
  }
}

function startWrangler() {
  log("starting wrangler dev --live-reload ...");
  wranglerProc = spawn("npx", ["wrangler", "dev", "--live-reload"], {
    cwd: ROOT,
    stdio: "inherit",
    shell: true,
  });
  wranglerProc.on("exit", (code) => {
    if (code !== null && code !== 0) logErr(`wrangler exited with code ${code}`);
    wranglerProc = null;
  });
}

function cleanup() {
  if (wranglerProc) {
    wranglerProc.kill();
    wranglerProc = null;
  }
}
process.on("exit", cleanup);
process.on("SIGINT", () => { cleanup(); process.exit(0); });
process.on("SIGTERM", () => { cleanup(); process.exit(0); });

// --- Initial build + start wrangler ---
log(`initial build (turbopack: ${USE_TURBO})...`);
build();
startWrangler();

// --- Watch src/ for changes ---
let debounceTimer = null;

watch(SRC, { recursive: true }, (_eventType, filename) => {
  if (!filename) return;
  if (filename.endsWith(".test.ts") || filename.endsWith(".test.tsx")) return;

  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    log(`change: ${filename}`);
    build();
  }, DEBOUNCE_MS);
});

log(`watching ${relative(ROOT, SRC)}/ (debounce: ${DEBOUNCE_MS}ms)`);
