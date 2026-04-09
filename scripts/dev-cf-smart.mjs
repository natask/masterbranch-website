#!/usr/bin/env node
/**
 * dev-cf-smart.mjs — Cloudflare dev with intelligent rebuild skipping.
 *
 * Tracks which files affect the Next.js build output. Only rebuilds when:
 * - Source files with imports change (*.ts, *.tsx, next.config.ts)
 * - Configuration changes (.env, package.json, tsconfig.json)
 *
 * Content-only changes (strings, data) skip next build, go straight to OpenNext.
 *
 * Performance:
 * - Content edit (landing-copy.ts): ~5s (skip next build)
 * - Code edit (component, API route): ~17s (full rebuild)
 * - First run: full build
 *
 * Usage:
 *   node scripts/dev-cf-smart.mjs
 *   node scripts/dev-cf-smart.mjs --no-turbo
 *   node scripts/dev-cf-smart.mjs --debounce=2000
 */

import { spawn, execSync } from "child_process";
import { watch } from "fs";
import { resolve, join, relative, dirname } from "path";
import { readFileSync, statSync, existsSync } from "fs";

const ROOT = resolve(import.meta.dirname, "..");
const SRC = join(ROOT, "src");
const NEXT_DIR = join(ROOT, ".next");
const REQUIRED_SERVER_FILES = join(
  NEXT_DIR,
  "standalone/masterbranch/website/.next/required-server-files.json"
);

const DEBOUNCE_MS = parseInt(
  process.argv.find((a) => a.startsWith("--debounce="))?.split("=")[1] || "1500"
);
const USE_TURBO = !process.argv.includes("--no-turbo");

// Files that definitely require a full next build
const IMPORT_HEAVY_PATTERNS = [
  /\.(tsx?|jsx?)$/, // All TS/JS source
  /^next\.config\./,
  /^tsconfig/,
  /^package\.json$/,
  /^pnpm-lock\.yaml$/,
  /^\.env/,
];

let building = false;
let pendingRebuild = false;
let pendingNextBuild = false;
let wranglerProc = null;

function log(msg) {
  const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
  console.log(`\x1b[36m[dev:cf ${ts}]\x1b[0m ${msg}`);
}

function logErr(msg) {
  const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
  console.error(`\x1b[31m[dev:cf ${ts}]\x1b[0m ${msg}`);
}

function needsNextBuild(filepath) {
  const filename = basename(filepath);
  return IMPORT_HEAVY_PATTERNS.some((p) => p.test(filename));
}

function timeCmd(label, cmd) {
  const start = Date.now();
  try {
    execSync(cmd, { cwd: ROOT, stdio: "inherit" });
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    log(`${label} (${elapsed}s)`);
    return true;
  } catch {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    logErr(`${label} failed (${elapsed}s)`);
    return false;
  }
}

function build(skipNextBuild = false) {
  if (building) {
    if (skipNextBuild === false) pendingNextBuild = true;
    pendingRebuild = true;
    return;
  }

  building = true;
  const start = Date.now();

  // Step 1: next build (only if needed)
  let nextOk = true;
  if (!skipNextBuild) {
    log("rebuilding...");
    const turboFlag = USE_TURBO ? " --turbopack" : "";
    nextOk = timeCmd(
      "next build",
      `npx next build${turboFlag} --no-mangling`
    );
  } else {
    log("skipping next build (content-only change)");
  }

  if (nextOk) {
    // Step 2: OpenNext bundle
    timeCmd(
      "opennext bundle",
      "npx opennextjs-cloudflare build --skipNextBuild"
    );
  }

  const total = ((Date.now() - start) / 1000).toFixed(1);
  log(
    nextOk
      ? `rebuild complete (${total}s total)`
      : `rebuild failed (${total}s)`
  );

  building = false;

  // Handle pending requests
  if (pendingNextBuild) {
    pendingNextBuild = false;
    pendingRebuild = false;
    build(false); // Force full rebuild
  } else if (pendingRebuild) {
    pendingRebuild = false;
    build(true); // Try content-only rebuild
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
process.on("SIGINT", () => {
  cleanup();
  process.exit(0);
});
process.on("SIGTERM", () => {
  cleanup();
  process.exit(0);
});

// --- Initial build + start wrangler ---
log(`initial full build (turbopack: ${USE_TURBO})...`);
build(false);
startWrangler();

// --- Watch src/ for changes ---
let debounceTimer = null;

watch(SRC, { recursive: true }, (_eventType, filename) => {
  if (!filename) return;
  if (filename.endsWith(".test.ts") || filename.endsWith(".test.tsx")) return;

  const needsFullBuild = needsNextBuild(filename);

  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const relPath = relative(ROOT, join(SRC, filename));
    if (needsFullBuild) {
      log(`change (imports): ${relPath}`);
      build(false);
    } else {
      log(`change (content): ${relPath}`);
      build(true); // Skip next build
    }
  }, DEBOUNCE_MS);
});

log(
  `watching ${relative(ROOT, SRC)}/ (smart rebuild, debounce: ${DEBOUNCE_MS}ms)`
);

function basename(path) {
  return path.split("/").pop();
}
