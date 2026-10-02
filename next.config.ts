import type { NextConfig } from "next";

/**
 * Tauri ek static bundle serve karta hai — koi Node server nahi chalta.
 * Isliye `output: "export"` zaroori hai. Iska matlab: no SSR, no route
 * handlers, no next/image optimization. Sab kuch client-side.
 */
const nextConfig: NextConfig = {
  output: "export",
  reactStrictMode: true,
  images: { unoptimized: true },
  // Tauri ke custom protocol par trailing slash se routing saaf rehti hai
  trailingSlash: true,
};

export default nextConfig;
