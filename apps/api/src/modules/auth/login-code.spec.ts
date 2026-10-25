import { Role } from '@prisma/client';
import {
  codeEmail,
  codeMatches,
  hashCode,
  maskEmail,
  needsLoginCode,
  newCode,
} from './login-code';

describe('needsLoginCode', () => {
  const on = { features: { loginCodes: true }, loginCodes: true };

  it('always asks platform logins, unless the emergency switch is off', () => {
    for (const role of [Role.super_admin, Role.head_office]) {
      expect(needsLoginCode(role, null, true)).toBe(true);
      expect(needsLoginCode(role, null, false)).toBe(false);
    }
  });

  it('asks school logins only with the Premium Max flag and the admin switch both on', () => {
    expect(needsLoginCode(Role.admin, on, true)).toBe(true);
    expect(needsLoginCode(Role.teacher, on, true)).toBe(true);
    expect(
      needsLoginCode(
        Role.admin,
        { features: { loginCodes: true }, loginCodes: false },
        true,
      ),
    ).toBe(false);
    // Plan dropped below Premium Max: the switch alone does nothing.
    expect(
      needsLoginCode(Role.admin, { features: {}, loginCodes: true }, true),
    ).toBe(false);
  });
});

describe('codes', () => {
  it('are 6 digits', () => {
    for (let i = 0; i < 200; i++) expect(newCode()).toMatch(/^\d{6}$/);
  });

  it('match only for the same challenge and code', () => {
    const h = hashCode('s', 'c1', '123456');
    expect(codeMatches('s', 'c1', '123456', h)).toBe(true);
    expect(codeMatches('s', 'c1', '123457', h)).toBe(false);
    expect(codeMatches('s', 'c2', '123456', h)).toBe(false);
    expect(codeMatches('other', 'c1', '123456', h)).toBe(false);
    expect(codeMatches('s', 'c1', '123456', '')).toBe(false);
  });
});

it('masks the email', () => {
  expect(maskEmail('admin@gvps-demo.in')).toBe('ad•••@gvps-demo.in');
  expect(maskEmail('a@x.in')).toBe('a•••@x.in');
});

it('puts the code in the email in each language', () => {
  for (const lang of ['en', 'kn', 'hi'] as const) {
    const { subject, body } = codeEmail(lang, '042137');
    expect(subject).toContain('042137');
    expect(body).toContain('042137');
  }
});
