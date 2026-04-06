import { readdirSync, readFileSync, statSync } from "fs";
import { extname, join } from "path";
import ts from "typescript";

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, out);
      continue;
    }

    const ext = extname(full);
    if (ext === ".ts" || ext === ".tsx" || ext === ".js" || ext === ".jsx") out.push(full);
  }
  return out;
}

function collectStringLiterals(node, out, bindings) {
  if (!node) return;

  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    out.add(node.text);
  }

  if (ts.isIdentifier(node) && bindings.has(node.text)) {
    collectStringLiterals(bindings.get(node.text), out, bindings);
    return;
  }

  ts.forEachChild(node, child => collectStringLiterals(child, out, bindings));
}

export function listSourceTargets(srcDir) {
  const targets = new Set();
  const files = walk(srcDir);

  for (const file of files) {
    const source = readFileSync(file, "utf-8");
    const scriptKind = file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, scriptKind);
    const bindings = new Map();

    function collectBindings(node) {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer
      ) {
        bindings.set(node.name.text, node.initializer);
      }

      ts.forEachChild(node, collectBindings);
    }

    collectBindings(sourceFile);

    function visit(node) {
      if (ts.isJsxAttribute(node) && node.name.text === "data-pretext" && node.initializer) {
        if (ts.isStringLiteral(node.initializer)) {
          targets.add(node.initializer.text);
        } else if (ts.isJsxExpression(node.initializer)) {
          collectStringLiterals(node.initializer.expression, targets, bindings);
        }
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  }

  return [...targets].sort();
}
