import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.faselhdx.best' },
      { protocol: 'https', hostname: '**.faselhd.pro' },
      { protocol: 'https', hostname: '**.faselhd.com' },
    ],
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  }
};

export default nextConfig;
