import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
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
