/**
 * Integration tests: the whole API (every module, the real guards, middleware,
 * validation and CORS from configureApp) against a real Postgres database built
 * from the migrations (prepare-db.mjs). They cover the access rules that unit
 * tests with a mocked database cannot see, such as a token used at another school.
 */
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ExpressAdapter } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import express from 'express';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { MailerService } from '../src/modules/public-site/mailer.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/server';

const PASSWORD = 'Correct-Horse-9';

/** Emails "sent" during the tests, newest last. */
const outbox: { to: string; text: string; attachment?: string }[] = [];
const mailer = {
  enabled: true,
  send: (
    to: string,
    _subject: string,
    text: string,
    extras?: { attachments?: { filename: string }[] },
  ) => {
    outbox.push({ to, text, attachment: extras?.attachments?.[0]?.filename });
    return Promise.resolve(true);
  },
};
const lastCode = () => outbox.at(-1)!.text.match(/\d{6}/)![0];

let app: INestApplication;
let prisma: PrismaService;
let jwt: JwtService;
const f = {} as Record<string, string>;

async function school(slug: string, features: Record<string, boolean>) {
  const t = await prisma.tenant.create({
    data: {
      slug,
      name: slug,
      features,
      subscriptionPlan: 'premium_max',
      subscriptionEndsOn: new Date('2030-03-31'),
    },
  });
  const cls = await prisma.class.create({
    data: { tenantId: t.id, name: 'Class 5', academicYear: '2026-27' },
  });
  return { t, cls };
}

const token = (id: string, tenantId: string, role: Role) =>
  jwt.sign({ sub: id, tenantId, role });

const as = (tok: string, tenant: string) => ({
  Authorization: `Bearer ${tok}`,
  'X-Tenant-ID': tenant,
});

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MailerService)
    .useValue(mailer)
    .compile();
  const server = express();
  app = moduleRef.createNestApplication(new ExpressAdapter(server), {
    rawBody: true,
  });
  configureApp(app, server);
  await app.init();
  prisma = app.get(PrismaService);
  jwt = app.get(JwtService);

  const hash = await bcrypt.hash(PASSWORD, 4);
  const a = await school('school-a', { loginCodes: true });
  const b = await school('school-b', {});
  const platform = await prisma.tenant.create({
    data: { slug: 'platform', name: 'Platform', isActive: false },
  });
  const user = (tenantId: string, role: Role, name: string, extra = {}) =>
    prisma.user.create({
      data: { tenantId, role, name, isVerified: true, ...extra },
    });

  const adminA = await user(a.t.id, Role.admin, 'Admin A', {
    email: 'admin@a.test',
    passwordHash: hash,
  });
  const teacherA = await user(a.t.id, Role.teacher, 'Teacher A', {
    email: 'teacher@a.test',
    passwordHash: hash,
  });
  const parentA = await user(a.t.id, Role.parent, 'Parent A', {
    phone: '+919000000001',
  });
  const adminB = await user(b.t.id, Role.admin, 'Admin B', {
    email: 'admin@b.test',
    passwordHash: hash,
  });
  const superAdmin = await user(platform.id, Role.super_admin, 'Super', {
    email: 'super@platform.test',
    passwordHash: hash,
  });
  const student = (tenantId: string, classId: string, name: string) =>
    prisma.student.create({
      data: { tenantId, classId, name, admissionNo: name },
    });
  const ownChild = await student(a.t.id, a.cls.id, 'A-1');
  const otherChild = await student(a.t.id, a.cls.id, 'A-2');
  const childB = await student(b.t.id, b.cls.id, 'B-1');
  await prisma.studentParent.create({
    data: { studentId: ownChild.id, parentId: parentA.id },
  });

  Object.assign(f, {
    A: a.t.id,
    B: b.t.id,
    ownChild: ownChild.id,
    otherChild: otherChild.id,
    childB: childB.id,
    adminA: token(adminA.id, a.t.id, Role.admin),
    teacherA: token(teacherA.id, a.t.id, Role.teacher),
    parentA: token(parentA.id, a.t.id, Role.parent),
    adminB: token(adminB.id, b.t.id, Role.admin),
    superAdmin: token(superAdmin.id, platform.id, Role.super_admin),
  });
});

afterAll(async () => {
  await app?.close();
});

const http = () => request(app.getHttpServer());

describe('one school never reaches another', () => {
  it("an admin's token sent with another school's id is refused", async () => {
    const res = await http().get('/v1/students').set(as(f.adminA, f.B));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('WRONG_SCHOOL');
  });

  it('in its own school the admin sees only its own students', async () => {
    const res = await http()
      .get('/v1/students')
      .set(as(f.adminA, f.A))
      .expect(200);
    const ids = (res.body.data as { id: string }[]).map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining([f.ownChild, f.otherChild]));
    expect(ids).not.toContain(f.childB);
  });

  it('a student id from another school is not found', async () => {
    await http()
      .get(`/v1/students/${f.childB}`)
      .set(as(f.adminA, f.A))
      .expect(404);
  });

  it('the platform super admin may work in any school', async () => {
    await http().get('/v1/students').set(as(f.superAdmin, f.B)).expect(200);
  });
});

describe('parents see only their own children', () => {
  it("opens their own child's home", async () => {
    await http()
      .get(`/v1/parent/home?studentId=${f.ownChild}`)
      .set(as(f.parentA, f.A))
      .expect(200);
  });

  it("is refused another child's home in the same school", async () => {
    const res = await http()
      .get(`/v1/parent/home?studentId=${f.otherChild}`)
      .set(as(f.parentA, f.A));
    expect([403, 404]).toContain(res.status);
  });

  it('the student list holds only their own child', async () => {
    const res = await http()
      .get('/v1/students')
      .set(as(f.parentA, f.A))
      .expect(200);
    expect((res.body.data as { id: string }[]).map((s) => s.id)).toEqual([
      f.ownChild,
    ]);
  });

  it("cannot open another child's record by id", async () => {
    const res = await http()
      .get(`/v1/students/${f.otherChild}`)
      .set(as(f.parentA, f.A));
    expect([403, 404]).toContain(res.status);
  });
});

describe('tokens', () => {
  it('no token: 401', () =>
    http().get('/v1/students').set('X-Tenant-ID', f.A).expect(401));

  it('an unsigned token (alg none) claiming super admin: 401', () => {
    const part = (o: object) =>
      Buffer.from(JSON.stringify(o)).toString('base64url');
    const forged = `${part({ alg: 'none', typ: 'JWT' })}.${part({ sub: 'x', tenantId: f.A, role: 'super_admin' })}.`;
    return http().get('/v1/students').set(as(forged, f.A)).expect(401);
  });

  it('a token signed with another key: 401', () => {
    const other = new JwtService({ secret: 'not-the-secret' }).sign({
      sub: 'x',
      tenantId: f.A,
      role: 'admin',
    });
    return http().get('/v1/students').set(as(other, f.A)).expect(401);
  });

  it('an expired token: 401', () => {
    const old = jwt.sign(
      { sub: 'x', tenantId: f.A, role: 'admin' },
      { expiresIn: -10 },
    );
    return http().get('/v1/students').set(as(old, f.A)).expect(401);
  });
});

describe('roles', () => {
  it('a teacher cannot switch sign-in codes', () =>
    http()
      .put('/v1/security/login-codes')
      .set(as(f.teacherA, f.A))
      .send({ enabled: false })
      .expect(403));

  it('a school without the Premium Max flag gets FEATURE_DISABLED', async () => {
    const res = await http()
      .get('/v1/security/login-codes')
      .set(as(f.adminB, f.B));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FEATURE_DISABLED');
  });

  it('unknown fields in a body are refused', () =>
    http()
      .put('/v1/security/login-codes')
      .set(as(f.adminA, f.A))
      .send({ enabled: false, tenantId: f.B })
      .expect(400));
});

describe('sign-in with an emailed code', () => {
  const login = (email: string) =>
    http()
      .post('/v1/auth/email/login')
      .set('X-Tenant-ID', 'school-a')
      .send({ email, password: PASSWORD });

  it('signs in with the password alone while the school switch is off', async () => {
    const res = await login('admin@a.test').expect(200);
    expect(res.body.accessToken).toBeDefined();
  });

  it('after the admin switches it on, asks for the code and accepts it once', async () => {
    await http()
      .put('/v1/security/login-codes')
      .set(as(f.adminA, f.A))
      .send({ enabled: true })
      .expect(200);

    const first = await login('teacher@a.test').expect(200);
    expect(first.body).toMatchObject({
      codeRequired: true,
      sentTo: 'te•••@a.test',
    });
    expect(first.body.accessToken).toBeUndefined();
    expect(outbox.at(-1)!.to).toBe('teacher@a.test');

    const { challengeId } = first.body as { challengeId: string };
    const code = lastCode();
    const wrong = code === '000000' ? '111111' : '000000';
    const bad = await http()
      .post('/v1/auth/login-code/verify')
      .send({ challengeId, code: wrong })
      .expect(401);
    expect(bad.body.error).toMatchObject({
      code: 'LOGIN_CODE_WRONG',
      triesLeft: 4,
    });

    const ok = await http()
      .post('/v1/auth/login-code/verify')
      .send({ challengeId, code })
      .expect(200);
    expect(ok.body.accessToken).toBeDefined();
    await http()
      .post('/v1/auth/login-code/verify')
      .send({ challengeId, code })
      .expect(401);

    await http()
      .put('/v1/security/login-codes')
      .set(as(f.adminA, f.A))
      .send({ enabled: false })
      .expect(200);
  });

  it('platform logins always need the code', async () => {
    const res = await http()
      .post('/v1/auth/super-admin/login')
      .send({ email: 'super@platform.test', password: PASSWORD })
      .expect(200);
    expect(res.body.codeRequired).toBe(true);
  });

  it('stops password guessing on one account after 10 tries', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++)
      statuses.push(
        (
          await http()
            .post('/v1/auth/email/login')
            .set('X-Tenant-ID', 'school-b')
            .send({ email: 'admin@b.test', password: 'wrong-password' })
        ).status,
      );
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});

describe('browser and transport rules', () => {
  it('CORS answers only the console origin, exactly', async () => {
    const pre = (origin: string) =>
      http()
        .options('/v1/auth/email/login')
        .set('Origin', origin)
        .set('Access-Control-Request-Method', 'POST');
    expect(
      (await pre('http://console.test')).headers['access-control-allow-origin'],
    ).toBe('http://console.test');
    expect(
      (await pre('http://console.test.evil.com')).headers[
        'access-control-allow-origin'
      ],
    ).toBeUndefined();
  });

  it('sends the hardening headers and hides the framework', async () => {
    const res = await http().get('/v1/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('refuses an HTML page uploaded as a photo before storing anything', async () => {
    const res = await http()
      .post('/v1/files/upload')
      .set(as(f.adminA, f.A))
      .field('category', 'attachment')
      .attach('file', Buffer.from('<html><script>alert(1)</script></html>'), {
        filename: 'hw.png',
        contentType: 'image/png',
      });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('FILE_CONTENT_MISMATCH');
  });

  it('a payment webhook without a signature is refused', () =>
    http()
      .post('/v1/payments/webhook')
      .send({ event: 'payment.captured' })
      .expect(401));
});

describe('marketing site (no school)', () => {
  it('emails the price list PDF without a school id', async () => {
    const res = await http()
      .post('/v1/public/pricing')
      .send({
        schoolName: 'Test School',
        email: 'owner@school.test',
        phone: '+919876543210',
      })
      .expect(200);
    const body = res.body as { data?: unknown };
    expect(body.data ?? body).toEqual({ sent: true, to: 'owner@school.test' });
    expect(res.headers['content-type']).not.toContain('application/pdf');
    const mail = outbox.find((m) => m.to === 'owner@school.test');
    expect(mail?.attachment).toBe('Schoolinkd_Plans_and_Pricing_2026-27.pdf');
  });

  it('the super admin lists price list and contact requests without a school id', async () => {
    const auth = { Authorization: `Bearer ${f.superAdmin}` };
    await http().get('/v1/platform/pricing-requests').set(auth).expect(200);
    await http().get('/v1/platform/contact-requests').set(auth).expect(200);
  });
});

describe('free trial', () => {
  const day = (offset: number) => new Date(Date.now() + offset * 86_400_000);
  const trialSchool = async (slug: string, endsOn: Date) => {
    const t = await prisma.tenant.create({
      data: { slug, name: slug, onTrial: true, subscriptionEndsOn: endsOn },
    });
    const admin = await prisma.user.create({
      data: { tenantId: t.id, role: Role.admin, name: slug, isVerified: true },
    });
    return token(admin.id, t.id, Role.admin);
  };

  it('works while the trial runs', async () => {
    const tok = await trialSchool('trial-on', day(5));
    await http().get('/v1/students').set(as(tok, 'trial-on')).expect(200);
  });

  it('switches the school off the day after the trial, with no grace', async () => {
    const tok = await trialSchool('trial-over', day(-2));
    const res = await http()
      .get('/v1/students')
      .set(as(tok, 'trial-over'))
      .expect(403);
    expect((res.body as { error: { code: string } }).error.code).toBe(
      'SUBSCRIPTION_EXPIRED',
    );
  });
});
