import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaClient } from '@prisma/client';
import {
  ContactRequestDto,
  normalizeIndianMobile,
} from './dto/contact-request.dto';
import { cleanPath, PublicSiteService } from './public-site.service';

describe('contact form validation', () => {
  it.each([
    ['98765 43210', '+919876543210'],
    ['+91-98765-43210', '+919876543210'],
    ['098765 43210', '+919876543210'],
    ['919876543210', '+919876543210'],
  ])('normalises %p', (input, expected) =>
    expect(normalizeIndianMobile(input)).toBe(expected),
  );

  it.each(['12345 67890', '98765', '+1 415 555 0100', 'call me'])(
    'rejects %p',
    async (phone) => {
      const dto = plainToInstance(ContactRequestDto, {
        name: 'Ravi',
        schoolName: 'GVPS',
        city: 'Mysuru',
        studentCount: 300,
        phone,
      });
      const errors = await validate(dto);
      expect(errors.map((e) => e.property)).toContain('phone');
    },
  );

  it('accepts a complete submission and trims names', async () => {
    const dto = plainToInstance(ContactRequestDto, {
      name: '  Ravi   Kumar ',
      schoolName: 'Green Valley',
      city: 'Mysuru',
      studentCount: '320',
      phone: '98765 43210',
      preferredTime: 'After 4 pm',
    });
    expect(await validate(dto)).toEqual([]);
    expect(dto).toMatchObject({
      name: 'Ravi Kumar',
      studentCount: 320,
      phone: '+919876543210',
    });
  });
});

describe('PublicSiteService', () => {
  const make = (smtp = true) => {
    const prisma = {
      contactRequest: {
        create: jest.fn().mockResolvedValue({ id: 'c1' }),
        update: jest.fn(),
      },
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    const mailer = { send: jest.fn().mockResolvedValue(smtp), enabled: smtp };
    const config = {
      get: (k: string) => ({ CONTACT_NOTIFY_EMAIL: 'team@schoolinkd.in' })[k],
    };
    return {
      prisma,
      mailer,
      service: new PublicSiteService(
        prisma as never,
        mailer as never,
        config as never,
      ),
    };
  };
  const dto = {
    name: 'Ravi',
    schoolName: 'GVPS',
    city: 'Mysuru',
    studentCount: 300,
    phone: '+919876543210',
  };

  it('stores the request, emails the team and records when it was emailed', async () => {
    const { prisma, mailer, service } = make();
    await service.createContactRequest(dto);
    expect(prisma.contactRequest.create).toHaveBeenCalled();
    expect(mailer.send).toHaveBeenCalledWith(
      'team@schoolinkd.in',
      'Demo request: GVPS (Mysuru)',
      expect.stringContaining('+919876543210'),
    );
    expect(prisma.contactRequest.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { emailedAt: expect.any(Date) },
    });
  });

  it('still stores the request when email fails or is not configured', async () => {
    const { prisma, service } = make(false);
    await expect(service.createContactRequest(dto)).resolves.toEqual({
      received: true,
    });
    expect(prisma.contactRequest.create).toHaveBeenCalled();
    expect(prisma.contactRequest.update).not.toHaveBeenCalled();
  });

  it('silently drops honeypot submissions', async () => {
    const { prisma, service } = make();
    await expect(
      service.createContactRequest({ ...dto, website: 'http://spam' }),
    ).resolves.toEqual({ received: true });
    expect(prisma.contactRequest.create).not.toHaveBeenCalled();
  });

  it('keeps only a clean path for analytics', () => {
    expect(cleanPath('/contact?utm_source=wa#form')).toBe('/contact');
    expect(cleanPath('https://evil.example/x')).toBe('/');
    expect(cleanPath(undefined)).toBe('/');
  });
});

/** Runs the real SQL against a database when TEST_DATABASE_URL is set (skipped otherwise). */
const dbUrl = process.env.TEST_DATABASE_URL;
(dbUrl ? describe : describe.skip)('PublicSiteService against Postgres', () => {
  let prisma: PrismaClient;
  beforeAll(async () => {
    prisma = new PrismaClient({ datasourceUrl: dbUrl });
    await prisma.siteEventCount.deleteMany();
  });
  afterAll(() => prisma.$disconnect());

  it('increments one daily row per event+path and reports totals', async () => {
    const service = new PublicSiteService(
      prisma as never,
      { enabled: false } as never,
      { get: () => undefined } as never,
    );
    await Promise.all([
      service.recordEvent({ event: 'page_view', path: '/' }),
      service.recordEvent({ event: 'page_view', path: '/' }),
      service.recordEvent({ event: 'page_view', path: '/contact' }),
      service.recordEvent({ event: 'whatsapp_click', path: '/' }),
    ]);

    expect(await prisma.siteEventCount.count()).toBe(3);
    const stats = await service.siteStats(7);
    expect(stats.daily[0]).toMatchObject({ page_view: 3, whatsapp_click: 1 });
    expect(stats.topPages[0]).toEqual({ path: '/', views: 2 });
  });
});
