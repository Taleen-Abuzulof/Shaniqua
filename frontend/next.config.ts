import type { NextConfig } from "next";

// Where the Next server proxies `/api/*` to. Server-side only: the browser
// always talks to this app's own origin, so the backend's SameSite=Lax
// session cookies work even behind an https tunnel.
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  // Dev server blocks requests from origins other than localhost; allow
  // Cloudflare quick tunnels plus any extra hosts (comma-separated, no scheme
  // or port), e.g. ALLOWED_DEV_ORIGINS=dev.example.com
  allowedDevOrigins: [
    "*.trycloudflare.com",
    ...(process.env.ALLOWED_DEV_ORIGINS ?? "")
      .split(",")
      .map((host) => host.trim())
      .filter(Boolean),
  ],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        // Account-connection pages: OAuth codes pass through these URLs.
        source: "/connect/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "no-store" },
          // Can't be framed (clickjacking).
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
