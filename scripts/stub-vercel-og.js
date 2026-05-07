const fs = require("fs");
const path = require("path");

const sourceRoots = [
  path.join(__dirname, "..", "src"),
  path.join(__dirname, "..", "app"),
];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return [fullPath];
  });
}

function usesOgRuntime() {
  for (const root of sourceRoots) {
    for (const file of walk(root)) {
      if (!/\.(js|jsx|ts|tsx|mjs|cjs)$/.test(file)) continue;
      const content = fs.readFileSync(file, "utf8");
      if (
        content.includes('"next/og"') ||
        content.includes("'next/og'") ||
        content.includes('"@vercel/og"') ||
        content.includes("'@vercel/og'")
      ) {
        return file;
      }
    }
  }

  return null;
}

const ogDir = path.join(
  __dirname,
  "..",
  "node_modules",
  "next",
  "dist",
  "compiled",
  "@vercel",
  "og"
);

if (!fs.existsSync(ogDir)) process.exit(0);

const ogUsage = usesOgRuntime();
if (ogUsage && process.env.FORCE_STUB_VERCEL_OG !== "1") {
  console.error(
    `Refusing to stub @vercel/og because this app imports it in ${path.relative(
      path.join(__dirname, ".."),
      ogUsage
    )}. Set FORCE_STUB_VERCEL_OG=1 to override.`
  );
  process.exit(1);
}

const stubs = {
  "resvg.wasm": "",
  "yoga.wasm": "",
  "index.edge.js": "module.exports = {};",
};

for (const [file, content] of Object.entries(stubs)) {
  const fp = path.join(ogDir, file);
  if (fs.existsSync(fp)) {
    fs.writeFileSync(fp, content);
  }
}

console.log("Stubbed @vercel/og files (unused, saves ~2.2 MiB)");
