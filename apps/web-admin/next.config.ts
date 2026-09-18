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
};

export default nextConfig;
