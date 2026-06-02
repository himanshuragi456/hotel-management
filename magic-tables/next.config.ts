import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Menu media (images + video posters) is served by the Laravel backend, which runs on
    // a local IP in dev (localhost:8000) and a bare-IP host over http in prod (103.191.209.34).
    // Next 16's image optimizer refuses local IPs by default (dangerouslyAllowLocalIP=false)
    // and would 400 with "url parameter is not allowed" — so menu images silently failed.
    // We don't need Next to re-encode already-reasonable backend images, so serve them as-is.
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**.amazonaws.com" },
      // Backend local dev — storage images served from Laravel
      { protocol: "http", hostname: "localhost", port: "8000" },
      { protocol: "http", hostname: "127.0.0.1", port: "8000" },
      // Production server
      { protocol: "http", hostname: "103.191.209.34" },
      { protocol: "https", hostname: "103.191.209.34" },
    ],
  },
};

export default nextConfig;
