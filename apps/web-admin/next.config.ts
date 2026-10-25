import path from "node:path";
import type { NextConfig } from "next";

// Avoid __dirname / import.meta.url here — some hosts (e.g. Hostinger's
// Node.js Web Apps) load this config file as an ES module, where __dirname
// is undefined; process.cwd() works identically under CJS and ESM, and
// Next always evaluates this file with cwd set to this app's directory.
const appDir = process.cwd();

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.1.15'],
  // Self-contained server.js for plain Node.js hosts (e.g. Hostinger Node.js
  // Web Apps) that run `node <entry-file>` rather than `next start`.
  output: 'standalone',
  // Monorepo: trace file dependencies from the repo root, not this app's
  // folder, so workspace packages (@slink/types, @slink/config) are included.
  outputFileTracingRoot: path.join(appDir, '../../'),
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // No other site may frame the console (clickjacking).
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self'; object-src 'none'; base-uri 'self'" },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
