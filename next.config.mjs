import os from 'node:os';
import { imageHosts } from './image-hosts.config.mjs';

const siteUrlHost = (() => {
  try {
    return process.env.NEXT_PUBLIC_SITE_URL
      ? new URL(process.env.NEXT_PUBLIC_SITE_URL).hostname
      : null;
  } catch {
    return null;
  }
})();

const extraDevOrigins = (process.env.ALLOWED_DEV_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)
  .map((o) => {
    try {
      return o.includes('://') ? new URL(o).hostname : o.replace(/:\d+$/, '');
    } catch {
      return o;
    }
  });

const envHostOrigins = [
  process.env.VERCEL_URL,
  process.env.VERCEL_BRANCH_URL,
  process.env.NEXT_PUBLIC_VERCEL_URL,
  process.env.HOSTNAME,
]
  .filter(Boolean)
  .map((o) => {
    try {
      return o.includes('://') ? new URL(o).hostname : o.replace(/:\d+$/, '');
    } catch {
      return o;
    }
  });

const localNetworkHosts = (() => {
  try {
    const nets = os.networkInterfaces();
    const hosts = [];
    for (const key of Object.keys(nets)) {
      for (const net of nets[key] || []) {
        if (net && net.address && !net.internal) hosts.push(net.address);
      }
    }
    return hosts;
  } catch {
    return [];
  }
})();

const previewEnvHosts = [
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.APP_URL,
  process.env.PUBLIC_URL,
  process.env.CODESPACE_NAME && process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN
    ? `${process.env.CODESPACE_NAME}-3000.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`
    : null,
  process.env.E2B_SANDBOX_ID ? `3000-${process.env.E2B_SANDBOX_ID}.e2b.app` : null,
]
  .filter(Boolean)
  .map((o) => {
    try {
      return o.includes('://') ? new URL(o).hostname : o.replace(/:\d+$/, '');
    } catch {
      return o;
    }
  });

/** @type {import('next').NextConfig} */
const nextConfig = {
  productionBrowserSourceMaps: true,
  distDir: process.env.DIST_DIR || '.next',
  allowedDevOrigins: Array.from(
    new Set([
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '[::1]',
      '::1',
      '*.localhost',
      'direct-hub.net',
      'www.direct-hub.net',
      '*.direct-hub.net',
      '**.direct-hub.net',
      'dhiwise.com',
      '*.dhiwise.com',
      '**.dhiwise.com',
      'dhiwise.dev',
      '**.dhiwise.dev',
      'dhiwise.net',
      '**.dhiwise.net',
      'rocket.new',
      '**.rocket.new',
      'builtwithrocket.new',
      '**.builtwithrocket.new',
      'rocketcdn.com',
      '**.rocketcdn.com',
      'rocketcdn.net',
      '**.rocketcdn.net',
      'rocket.dev',
      '**.rocket.dev',
      'rocketapp.dev',
      '**.rocketapp.dev',
      'rocketapp.io',
      '**.rocketapp.io',
      '*.vercel.app',
      '**.vercel.app',
      '*.vercel.run',
      '**.vercel.run',
      '*.vusercontent.net',
      '**.vusercontent.net',
      '*.e2b.dev',
      '**.e2b.dev',
      '*.e2b.app',
      '**.e2b.app',
      '**.app.github.dev',
      '**.githubpreview.dev',
      '**.gitpod.io',
      '**.codesandbox.io',
      '**.csb.app',
      '**.stackblitz.io',
      '**.webcontainer.io',
      '**.webcontainer-api.io',
      '**.ngrok-free.app',
      '**.ngrok.io',
      '**.trycloudflare.com',
      '**.loca.lt',
      '**.fly.dev',
      '**.netlify.app',
      '**.onrender.com',
      '**.railway.app',
      '**.replit.dev',
      '**.repl.co',
      '**.glitch.me',
      '**.local',
      '**.lan',
      '**.internal',
      ...localNetworkHosts,
      ...previewEnvHosts,
      ...(siteUrlHost ? [siteUrlHost, `**.${siteUrlHost}`] : []),
      ...envHostOrigins,
      ...extraDevOrigins,
    ])
  ),
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