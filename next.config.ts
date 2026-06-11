import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server mode (no static export): photo uploads use server actions + Vercel Blob/KV.
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
