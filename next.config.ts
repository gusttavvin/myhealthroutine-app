import type { NextConfig } from "next";

// Site estático (GitHub Pages). NEXT_PUBLIC_BASE_PATH = "/myhealthroutine" na publicação.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  trailingSlash: true,
  basePath,
  images: { unoptimized: true },
  devIndicators: false,
};

export default nextConfig;
