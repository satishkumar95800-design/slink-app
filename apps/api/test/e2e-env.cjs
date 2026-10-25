// Runs in each test worker before any module loads: point Prisma at the test
// database (process env wins over .env in ConfigModule), and no real email.
const { e2eUrl } = require('./e2e-db-url.cjs');
process.env.DATABASE_URL = e2eUrl();
process.env.NODE_ENV = 'test';
process.env.ADMIN_BASE_URL = 'http://console.test';
delete process.env.SMTP_HOST;
