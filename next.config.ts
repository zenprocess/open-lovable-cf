import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.google.com',
      },
    ],
  },
  // NOTE: Do NOT set output: 'standalone' for Cloudflare Pages.
  // @cloudflare/next-on-pages handles the output transformation via Vercel build adapter.
  // 'standalone' is for Node.js server deployments only.
};

export default nextConfig;
