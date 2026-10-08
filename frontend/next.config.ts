import type { NextConfig } from "next";

/**
 * Two ways to reach the PHP API:
 *
 * 1. BACKEND_URL set (production, e.g. Vercel → Railway):
 *    the browser calls same-origin `/api/*` and `/uploads/*`, and Next.js proxies them to
 *    BACKEND_URL. The session cookie is then first-party on the frontend domain, so it isn't
 *    blocked as a third-party cookie (Safari / Chrome) and no cross-site CORS is needed.
 *
 * 2. BACKEND_URL unset (local dev): the browser calls NEXT_PUBLIC_API_URL
 *    (default http://localhost:8000) directly, using the API's CORS allow-list.
 */
const backendUrl = process.env.BACKEND_URL?.replace(/\/$/, "");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  env: {
    // "" = same origin (proxied). Inlined at build time; contains no secrets.
    API_BASE_URL: backendUrl ? "" : (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"),
  },
  async rewrites() {
    if (!backendUrl) return [];
    return [
      { source: "/api/:path*", destination: `${backendUrl}/api/:path*` },
      { source: "/uploads/:path*", destination: `${backendUrl}/uploads/:path*` },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
