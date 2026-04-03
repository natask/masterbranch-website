#!/usr/bin/env node
/**
 * pretext-report.mjs
 *
 * Single pretext tool — two modes:
 *
 *   node scripts/pretext-report.mjs              # UI mode — serves visual report on :4445
 *   node scripts/pretext-report.mjs --cli        # CLI mode — prints all results to stdout
 *   node scripts/pretext-report.mjs --cli --fail # CLI mode — only failures
 *   node scripts/pretext-report.mjs --cli --warn # CLI mode — failures + warnings
 */

import { createServer } from "http";
import { execSync } from "child_process";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = resolve(__dirname, "pretext-check-config.json");
const htmlPath = resolve(__dirname, "pretext-report.html");

const args = process.argv.slice(2);
const cliMode = args.includes("--cli");
const failOnly = args.includes("--fail");
const warnAndFail = args.includes("--warn");

if (cliMode) {
  runCLI();
} else {
  runUI();
}

// ---- CLI mode ----
// Uses heuristic width estimates (no Canvas in node).
// Cinzel avg char width ≈ 0.62em, Cormorant ≈ 0.48em, fallback 0.55em.
function estimateWidth(text, fontSize, fontFamily) {
  const size = parseFloat(fontSize);
  const ratio = /cinzel/i.test(fontFamily) ? 0.62 : /cormorant/i.test(fontFamily) ? 0.48 : 0.55;
  // Count characters, spaces are narrower
  let w = 0;
  for (const ch of text) {
    w += ch === " " ? size * 0.25 : size * ratio;
  }
  return Math.round(w);
}

function runCLI() {
  const config = JSON.parse(readFileSync(configPath, "utf-8"));
  const results = [];

  for (const ck of config.checks) {
    const lh = ck.lineHeight || parseFloat(ck.fontSize) * 1.4;
    const ml = ck.maxLines || 1;
    const devs = [];

    for (const bp of config.breakpoints) {
      let fs = ck.fontSize;
      if (ck.responsive) {
        for (const o of ck.responsive) {
          if (bp.width >= o.minWidth) fs = o.fontSize;
        }
      }
      const cw = bp.width - (ck.horizontalPadding || 48);
      let st, lc, tw = 0;

      if (ck.noWrap) {
        tw = estimateWidth(ck.text, fs, ck.fontFamily);
        lc = 1;
        st = tw > cw ? "FAIL" : tw > cw * 0.9 ? "WARN" : "PASS";
      } else {
        const lineW = estimateWidth(ck.text, fs, ck.fontFamily);
        lc = Math.ceil(lineW / cw);
        st = lc <= ml ? "PASS" : lc <= ml + 1 ? "WARN" : "FAIL";
      }

      devs.push({ name: bp.name, width: bp.width, fs, cw, lc, ml, st, tw, noWrap: !!ck.noWrap });
    }

    const worst = devs.some(d => d.st === "FAIL") ? "FAIL" : devs.some(d => d.st === "WARN") ? "WARN" : "PASS";
    results.push({ label: ck.label, text: ck.text, page: ck.page || "/", worst, devs });
  }

  // Sort: fail → warn → pass
  results.sort((a, b) => ({ FAIL: 0, WARN: 1, PASS: 2 }[a.worst]) - ({ FAIL: 0, WARN: 1, PASS: 2 }[b.worst]));

  // Filter
  const filtered = results.filter(r => {
    if (failOnly) return r.worst === "FAIL";
    if (warnAndFail) return r.worst !== "PASS";
    return true;
  });

  if (filtered.length === 0) {
    console.log("All checks passed.");
    process.exit(0);
  }

  const fc = results.filter(r => r.worst === "FAIL").length;
  const wc = results.filter(r => r.worst === "WARN").length;
  const pc = results.filter(r => r.worst === "PASS").length;
  console.log(`${fc} fail / ${wc} warn / ${pc} pass  (${results.length} checks × ${config.breakpoints.length} breakpoints)\n`);

  for (const r of filtered) {
    console.log(`[${r.worst}] ${r.label}  "${r.text}"  (${r.page})`);
    const broken = r.devs.filter(d => d.st !== "PASS");
    for (const d of broken) {
      const metric = d.noWrap
        ? `${d.tw}/${d.cw}px`
        : `${d.lc}/${d.ml} lines`;
      console.log(`       ${d.name} (${d.width}px): ${metric}  [${d.fs} in ${d.cw}px]`);
    }
  }

  process.exit(fc > 0 ? 1 : 0);
}

// ---- UI mode ----
function runUI() {
  const PORT = 4445;
  const server = createServer((req, res) => {
    const config = readFileSync(configPath, "utf-8");
    let html = readFileSync(htmlPath, "utf-8");
    html = html.replace("CONFIGJSON", config);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  });
  server.listen(PORT, () => {
    const url = `http://localhost:${PORT}`;
    console.log(`Pretext: ${url}`);
    try { execSync(`open "${url}"`); } catch {}
  });
}
