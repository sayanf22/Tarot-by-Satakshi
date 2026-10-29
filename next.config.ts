import type { NextConfig } from "next";

// Static export: every page is built to plain HTML in ./out and served by
// Cloudflare as free static assets. The API lives in ./worker (Hono).
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
