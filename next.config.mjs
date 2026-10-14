import { imageHosts } from './image-hosts.config.mjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  productionBrowserSourceMaps: true,
  distDir: process.env.DIST_DIR || '.next',
  allowedDevOrigins: [
    'direct-hub.net',
    '*.direct-hub.net',
    'rocket.new',
    '*.rocket.new',
    'builtwithrocket.new',
    '*.builtwithrocket.new',
    '*.vercel.app',
    '*.dhiwise.com',
  ],
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async redirects() {
    return [
      {
        source: '/suppliers/:id',
        destination: '/store/:id',
        permanent: true,
      },
      {
        source: '/storefront/:id',
        destination: '/store/:id',
        permanent: true,
      },
    ];
  },
  images: {
    remotePatterns: imageHosts,
    minimumCacheTTL: 86400,
    qualities: [75, 85, 100],
  },
  experimental: {
    optimisticClientCache: true,
  },
  webpack(
    config,
    {
      dev: dev
    }
  ) {
    if (dev) {
      config.module.rules.push({
        test: /\.(jsx|tsx)$/,
        exclude: [/node_modules/],
        use: [{
          loader: '@dhiwise/component-tagger/nextLoader',
        }],
      });
      const ignoredPaths = (process.env.WATCH_IGNORED_PATHS || '')
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
      config.watchOptions = {
        ignored: ignoredPaths.length
          ? ignoredPaths.map((p) => `**/${p.replace(/^\/+|\/+$/g, '')}/**`)
          : undefined,
      };
    }
    return config;
  },
};
export default nextConfig;