const fs = require("fs");
const path = require("path");

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
