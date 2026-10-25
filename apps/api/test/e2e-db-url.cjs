// The integration-test database: E2E_DATABASE_URL, or DATABASE_URL (env or .env)
// with the database renamed to slink_e2e. Shared by prepare-db.mjs and the tests.
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

function fromEnvFile() {
  try {
    return readFileSync(join(__dirname, '..', '.env'), 'utf8').match(/^DATABASE_URL="?([^"\n]+)"?/m)?.[1];
  } catch {
    return undefined;
  }
}

function e2eUrl() {
  if (process.env.E2E_DATABASE_URL) return process.env.E2E_DATABASE_URL;
  const base = process.env.DATABASE_URL ?? fromEnvFile();
  if (!base) throw new Error('Set E2E_DATABASE_URL (or DATABASE_URL to derive it from)');
  const u = new URL(base);
  u.pathname = '/slink_e2e';
  return u.toString();
}

module.exports = { e2eUrl };
