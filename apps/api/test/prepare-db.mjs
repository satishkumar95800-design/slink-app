// Rebuilds the integration-test database from every migration (jest globalSetup).
// Refuses any database whose name does not end in _e2e, so it can never touch dev or prod.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const { e2eUrl } = createRequire(import.meta.url)('./e2e-db-url.cjs');

export default function prepareDb() {
  const url = e2eUrl();
  const db = new URL(url).pathname.slice(1);
  if (!db.endsWith('_e2e')) throw new Error(`Refusing to reset "${db}": the test database name must end in _e2e`);
  execFileSync(
    new URL('../node_modules/.bin/prisma', import.meta.url).pathname,
    ['migrate', 'reset', '--force', '--skip-seed', '--skip-generate'],
    { stdio: 'ignore', env: { ...process.env, DATABASE_URL: url } },
  );
}
