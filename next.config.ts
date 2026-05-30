import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: appRoot,
  },
  experimental: {
    // Turbopack file system caching for faster incremental builds.
    // Enables ~5-14x faster rebuilds when only some files change.
    // Stable in Next.js 16.1+, safe to use for development.
    turbopackFileSystemCacheForBuild: true,
  },
};

export default (async () => {
  if (process.env.NODE_ENV === "development" && process.env.SKIP_CF_DEV !== "1") {
    const { initOpenNextCloudflareForDev } = await import("@opennextjs/cloudflare");
    await initOpenNextCloudflareForDev();
  }
  return nextConfig;
})();
