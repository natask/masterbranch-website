import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Turbopack file system caching for faster incremental builds.
    // Enables ~5-14x faster rebuilds when only some files change.
    // Stable in Next.js 16.1+, safe to use for development.
    turbopackFileSystemCacheForBuild: true,
  },
};

export default (async () => {
  if (process.env.NODE_ENV === "development") {
    const { initOpenNextCloudflareForDev } = await import("@opennextjs/cloudflare");
    await initOpenNextCloudflareForDev();
  }
  return nextConfig;
})();
