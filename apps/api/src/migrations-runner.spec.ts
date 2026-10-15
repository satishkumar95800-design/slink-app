import { compareMigrations, migrationDatabaseUrl } from './migrations-runner';

describe('migrationDatabaseUrl', () => {
  it('prefers DIRECT_URL', () => {
    expect(
      migrationDatabaseUrl({
        DIRECT_URL: 'postgres://d',
        DATABASE_URL: 'postgres://p',
      }),
    ).toBe('postgres://d');
  });

  it('moves a Supabase transaction-pooler URL to session mode', () => {
    const url =
      'postgresql://postgres.abc:pw@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1';
    expect(migrationDatabaseUrl({ DATABASE_URL: url })).toBe(
      'postgresql://postgres.abc:pw@aws-0-ap-south-1.pooler.supabase.com:5432/postgres?connection_limit=1',
    );
  });

  it('leaves other URLs alone', () => {
    const url = 'postgresql://u:p@db.abc.supabase.co:5432/postgres';
    expect(migrationDatabaseUrl({ DATABASE_URL: url })).toBe(url);
    expect(migrationDatabaseUrl({})).toBeUndefined();
  });
});

describe('compareMigrations', () => {
  const row = (name: string, finished: boolean, rolledBack = false) => ({
    migration_name: name,
    finished_at: finished ? new Date() : null,
    rolled_back_at: rolledBack ? new Date() : null,
  });

  it('lists shipped migrations the database never finished, and failed ones', () => {
    expect(
      compareMigrations(
        ['20260101_a', '20260201_b', '20260301_c'],
        [
          row('20260101_a', true),
          row('20260201_b', false),
          row('20260201_b', false, true),
        ],
      ),
    ).toEqual({
      missing: ['20260201_b', '20260301_c'],
      failed: ['20260201_b'],
    });
  });

  it('ignores a failed attempt that was later applied', () => {
    expect(
      compareMigrations(
        ['20260101_a'],
        [row('20260101_a', false), row('20260101_a', true)],
      ),
    ).toEqual({ missing: [], failed: [] });
  });
});
