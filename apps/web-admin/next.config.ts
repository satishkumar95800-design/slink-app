import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.1.15'],
  // Self-contained server.js for plain Node.js hosts (e.g. Hostinger Node.js
  // Web Apps) that run `node <entry-file>` rather than `next start`.
  output: 'standalone',
  // Monorepo: trace file dependencies from the repo root, not this app's
  // folder, so workspace packages (@slink/types, @slink/config) are included.
  outputFileTracingRoot: path.join(__dirname, '../../'),
};

export default nextConfig;
