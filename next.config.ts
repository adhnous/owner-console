<<<<<<< HEAD
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Turbopack is stable in Next.js 15+
  turbopack: {},
=======
import type {NextConfig} from 'next';

const isCIOrProd = process.env.CI === 'true' || process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  /* config options here */
  // Disable React Strict Mode to avoid double-mount issues with Leaflet in dev
  // (Strict Mode has no effect in production builds.)
  reactStrictMode: false,
  // Re-enable type and lint checks for CI/prod; keep relaxed in dev for velocity
  typescript: {
    ignoreBuildErrors: !isCIOrProd,
  },
  eslint: {
    ignoreDuringBuilds: !isCIOrProd,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
>>>>>>> origin/main
};

export default nextConfig;
