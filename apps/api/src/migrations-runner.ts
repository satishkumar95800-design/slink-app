import { Logger } from '@nestjs/common';
import { execFile } from 'child_process';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * Applies pending Prisma migrations on boot, then checks the database against
 * the migrations shipped in this build and reports any gap.
 *
 * Why it's shaped like this (two migrations once silently never ran in
 * production and had to be applied by hand):
 * - Hostinger runs dist/src/main.js directly, so `prisma migrate deploy` has
 *   to be triggered from here, not from an npm script.
 * - It runs AFTER app.listen(), asynchronously, with a generous timeout:
 *   Hostinger kills an app that doesn't listen within ~3 s, and the old
 *   synchronous 8 s run was killed whenever the database was slow.
 * - Migrations can't run through Supabase's transaction pooler (port 6543,
 *   pgbouncer=true): Prisma needs a session for its advisory lock. We use
 *   DIRECT_URL when set, else switch a Supabase pooler URL to session mode
 *   (same host, port 5432).
 * - The result is logged loudly and exposed on GET /v1/health, so a missing
 *   or failed migration is visible instead of surfacing later as HTTP 500s.
 */

export interface MigrationStatus {
  state: 'pending' | 'running' | 'ok' | 'behind' | 'error';
  /** Migrations in this build that the database hasn't recorded as applied. */
  missing: string[];
  /** Recorded as started but never finished (blocks every later migration). */
  failed: string[];
  error?: string;
  checkedAt?: string;
}

export const migrationStatus: MigrationStatus = {
  state: 'pending',
  missing: [],
  failed: [],
};

const MIGRATE_TIMEOUT_MS = 3 * 60 * 1000;

/** The URL `prisma migrate deploy` should use (never the transaction pooler). */
export function migrationDatabaseUrl(
  env: NodeJS.ProcessEnv,
): string | undefined {
  if (env.DIRECT_URL) return env.DIRECT_URL;
  const url = env.DATABASE_URL;
  if (!url) return undefined;
  try {
    const u = new URL(url);
    if (u.hostname.endsWith('pooler.supabase.com') && u.port === '6543') {
      u.port = '5432';
      u.searchParams.delete('pgbouncer');
      return u.toString();
    }
    return url;
  } catch {
    return url;
  }
}

/** Migration folder names shipped in this build, oldest first. */
export function shippedMigrations(migrationsDir: string): string[] {
  if (!existsSync(migrationsDir)) return [];
  return readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d{14}_/.test(d.name))
    .map((d) => d.name)
    .sort();
}

export interface MigrationRow {
  migration_name: string;
  finished_at: Date | null;
  rolled_back_at: Date | null;
}

/** Compares shipped migrations with _prisma_migrations rows. */
export function compareMigrations(shipped: string[], rows: MigrationRow[]) {
  const applied = new Set(
    rows.filter((r) => r.finished_at).map((r) => r.migration_name),
  );
  const failed = rows
    .filter(
      (r) =>
        !r.finished_at && !r.rolled_back_at && !applied.has(r.migration_name),
    )
    .map((r) => r.migration_name);
  return {
    missing: shipped.filter((m) => !applied.has(m)),
    failed: [...new Set(failed)],
  };
}

function runMigrateDeploy(
  apiDistDir: string,
  databaseUrl: string,
): Promise<void> {
  const schemaPath = join(apiDistDir, 'prisma', 'schema.prisma');
  const prismaCli = join(
    apiDistDir,
    'node_modules',
    'prisma',
    'build',
    'index.js',
  );
  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      [prismaCli, 'migrate', 'deploy', '--schema', schemaPath],
      {
        timeout: MIGRATE_TIMEOUT_MS,
        env: { ...process.env, DATABASE_URL: databaseUrl },
        maxBuffer: 10 * 1024 * 1024,
      },
      (err, stdout, stderr) => {
        const out = `${stdout ?? ''}${stderr ?? ''}`.trim();
        if (out) new Logger('Migrations').log(out);
        if (err) reject(new Error(`${err.message}\n${out}`.trim()));
        else resolve();
      },
    );
  });
}

/**
 * Run after app.listen(). Never throws: the outcome is in migrationStatus,
 * the logs and GET /v1/health.
 */
export async function runPendingMigrations(
  apiDistDir: string,
  queryRows: () => Promise<MigrationRow[]>,
): Promise<void> {
  const logger = new Logger('Migrations');
  const url = migrationDatabaseUrl(process.env);
  migrationStatus.state = 'running';
  if (!url) {
    Object.assign(migrationStatus, {
      state: 'error',
      error: 'DATABASE_URL is not set',
    });
    logger.error('DATABASE_URL is not set — migrations not run.');
    return;
  }

  try {
    logger.log('Applying pending migrations…');
    await runMigrateDeploy(apiDistDir, url);
  } catch (err) {
    migrationStatus.error = (err as Error).message.slice(0, 2000);
    logger.error(`prisma migrate deploy failed: ${migrationStatus.error}`);
  }

  try {
    const { missing, failed } = compareMigrations(
      shippedMigrations(join(apiDistDir, 'prisma', 'migrations')),
      await queryRows(),
    );
    Object.assign(migrationStatus, {
      missing,
      failed,
      checkedAt: new Date().toISOString(),
      state:
        missing.length || failed.length
          ? 'behind'
          : migrationStatus.error
            ? 'error'
            : 'ok',
    });
    if (missing.length || failed.length) {
      logger.error(
        `DATABASE IS BEHIND THE CODE. Missing: ${missing.join(', ') || 'none'}. Failed (must be resolved before later ones can run): ${failed.join(', ') || 'none'}.`,
      );
    } else {
      logger.log('Database schema is up to date.');
    }
  } catch (err) {
    Object.assign(migrationStatus, {
      state: 'error',
      error: `Could not read _prisma_migrations: ${(err as Error).message}`,
    });
    logger.error(migrationStatus.error);
  }
}
