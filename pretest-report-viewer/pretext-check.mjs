#!/usr/bin/env node
/**
 * pretext-check.mjs
 *
 * Test runner: loads config, runs all typography/layout checks across breakpoints.
 * Outputs results as JSON via HTTP or stdout.
 *
 * Usage:
 *   node pretext-check.mjs                    # serve on :4444, open in browser
 *   node pretext-check.mjs --cli              # print JSON to stdout
 *   node pretext-check.mjs --config=path.json # custom config
 */

import { createServer } from "http";
import { readFileSync } from "fs";
import { execSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Args & Config ---
const args = Object.fromEntries(
  process.argv.slice(2).filter(a => a.startsWith("--")).map(a => {
    const [k, v] = a.slice(2).split("=");
    return [k, v || "true"];
  })
);
const configPath = args.config ? resolve(args.config) : resolve(__dirname, "pretext-check-config.json");
let config = JSON.parse(readFileSync(configPath, "utf-8"));
const cliMode = args.cli === "true";

function reloadConfig() {
  config = JSON.parse(readFileSync(configPath, "utf-8"));
}

// --- Test logic ---
function estimateWidth(text, fontSize, fontFamily) {
  const size = parseFloat(fontSize);
  const ratio = /cinzel/i.test(fontFamily)
    ? 0.62
    : /cormorant/i.test(fontFamily)
      ? 0.48
      : 0.55;
  let w = 0;
  for (const ch of text) {
    w += ch === " " ? size * 0.25 : size * ratio;
  }
  return Math.round(w);
}

function resolveFont(check, bpWidth) {
  let fs = check.fontSize;
  if (check.responsive) {
    for (const o of check.responsive) {
      if (bpWidth >= o.minWidth) fs = o.fontSize;
    }
  }
  return fs;
}

function measureAtBreakpoint(check, bp) {
  const fs = resolveFont(check, bp.width);
  const cw = bp.width - (check.horizontalPadding || 48);
  const tw = estimateWidth(check.text, fs, check.fontFamily);
  const lc = check.noWrap ? 1 : Math.ceil(tw / cw);
  return { fs, cw, tw, lc };
}

function runTests() {
  const results = [];
  const desktopBp = config.breakpoints[config.breakpoints.length - 1];

  for (const check of config.checks) {
    // Desktop is the baseline — derive maxLines from it
    const desktop = measureAtBreakpoint(check, desktopBp);
    const baselineLines = check.maxLines || desktop.lc;

    const devs = [];

    for (const bp of config.breakpoints) {
      const m = measureAtBreakpoint(check, bp);
      let st;

      if (check.noWrap) {
        st = m.tw > m.cw ? "FAIL" : m.tw > m.cw * 0.9 ? "WARN" : "PASS";
      } else {
        const drift = m.lc - baselineLines;
        st = drift <= 0 ? "PASS" : drift === 1 ? "WARN" : "FAIL";
      }

      devs.push({
        name: bp.name,
        width: bp.width,
        fontSize: m.fs,
        containerWidth: m.cw,
        lineCount: m.lc,
        baselineLines,
        status: st,
        textWidth: m.tw,
        noWrap: !!check.noWrap,
      });
    }

    const worst = devs.some(d => d.status === "FAIL")
      ? "FAIL"
      : devs.some(d => d.status === "WARN")
        ? "WARN"
        : "PASS";

    results.push({
      label: check.label,
      text: check.text,
      page: check.page || "/",
      fontFamily: check.fontFamily,
      fontSize: check.fontSize,
      baselineLines,
      worst,
      devices: devs,
    });
  }

  // Sort: fail → warn → pass
  results.sort((a, b) => {
    const order = { FAIL: 0, WARN: 1, PASS: 2 };
    return order[a.worst] - order[b.worst];
  });

  return results;
}

// --- Output ---
function outputResults(results) {
  const fc = results.filter(r => r.worst === "FAIL").length;
  const wc = results.filter(r => r.worst === "WARN").length;
  const pc = results.filter(r => r.worst === "PASS").length;
  const total = results.length;
  const breakpoints = config.breakpoints.length;

  return {
    summary: {
      fail: fc,
      warn: wc,
      pass: pc,
      total,
      breakpoints,
      checksPerBreakpoint: total * breakpoints,
    },
    results,
  };
}

// --- CLI mode ---
if (cliMode) {
  const results = runTests();
  const output = outputResults(results);
  console.log(JSON.stringify(output, null, 2));
  process.exit(results.some(r => r.worst === "FAIL") ? 1 : 0);
}

// --- Server mode ---
const PORT = parseInt(args.port || "4444");
const server = createServer((req, res) => {
  if (req.url === "/api/results") {
    reloadConfig();
    const results = runTests();
    const output = outputResults(results);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(output));
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

server.listen(PORT, () => {
  console.log(`Pretext runner: http://localhost:${PORT}/api/results`);
});
