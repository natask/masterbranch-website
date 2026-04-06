import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { dirname, join, relative, resolve } from "path";

export const DEFAULT_BREAKPOINTS = [
  { name: "iPhone SE", width: 375 },
  { name: "Android mid", width: 412 },
  { name: "iPhone Pro Max", width: 430 },
  { name: "Tablet portrait", width: 768 },
  { name: "Tablet landscape", width: 1024 },
  { name: "Laptop 13\"", width: 1280 },
  { name: "Laptop 14\"", width: 1440 },
  { name: "Laptop 16\"", width: 1536 },
  { name: "Desktop", width: 1920 },
];
export const DEFAULT_INVENTORY_BREAKPOINT = "Laptop 16\"";

export function normalizePagePath(pagePath) {
  if (!pagePath) return "/";
  return pagePath.startsWith("/") ? pagePath : `/${pagePath}`;
}

export function loadProjectConfig(configPath) {
  const resolvedPath = resolve(configPath);
  const raw = existsSync(resolvedPath)
    ? JSON.parse(readFileSync(resolvedPath, "utf-8"))
    : {};

  return {
    ...raw,
    project: raw.project || null,
    inventoryBreakpoint: raw.inventoryBreakpoint || DEFAULT_INVENTORY_BREAKPOINT,
    pages: Array.isArray(raw.pages) && raw.pages.length
      ? [...new Set(raw.pages.map(normalizePagePath))].sort()
      : null,
    breakpoints: Array.isArray(raw.breakpoints) && raw.breakpoints.length
      ? raw.breakpoints
      : DEFAULT_BREAKPOINTS,
  };
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      walk(fullPath, out);
      continue;
    }

    if (/\/page\.(t|j)sx?$/.test(fullPath)) out.push(fullPath);
  }

  return out;
}

function routeFromPageFile(filePath, appDir) {
  const routeDir = dirname(relative(appDir, filePath));
  if (!routeDir || routeDir === ".") return { route: "/" };

  const rawParts = routeDir.split("/").filter(Boolean);
  const urlParts = [];

  for (const part of rawParts) {
    if (part === "api") return { route: null, ignored: "api" };
    if (part.startsWith("@")) return { route: null, ignored: "parallel-route" };
    if (part.startsWith("[") && part.endsWith("]")) {
      return { route: null, dynamic: true };
    }
    if (part.startsWith("(") && part.endsWith(")")) continue;
    urlParts.push(part);
  }

  return { route: normalizePagePath(urlParts.join("/")) };
}

export function discoverRoutes(appDir, explicitPages = null) {
  if (Array.isArray(explicitPages) && explicitPages.length) {
    return {
      routes: [...new Set(explicitPages.map(normalizePagePath))].sort(),
      skippedDynamicRoutes: [],
    };
  }

  const routes = new Set();
  const skippedDynamicRoutes = [];

  for (const filePath of walk(resolve(appDir))) {
    const mapped = routeFromPageFile(filePath, resolve(appDir));
    if (mapped.dynamic) {
      skippedDynamicRoutes.push(normalizePagePath(dirname(relative(resolve(appDir), filePath))));
      continue;
    }
    if (!mapped.route) continue;
    routes.add(mapped.route);
  }

  return {
    routes: [...routes].sort(),
    skippedDynamicRoutes: [...new Set(skippedDynamicRoutes)].sort(),
  };
}
