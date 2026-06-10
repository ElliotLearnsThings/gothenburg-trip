import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  // folder/index.html output so the secret route resolves on any static host
  trailingSlash: true,
};

export default nextConfig;
