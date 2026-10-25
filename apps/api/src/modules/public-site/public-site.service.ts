import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { todayIn } from '../attendance/attendance-dates';
import { MailerService } from './mailer.service';
import {
  ContactRequestDto,
  PricingRequestDto,
  SiteEventDto,
} from './dto/contact-request.dto';
import { buildPricingPdf } from './pricing-pdf';
import { PRICING_FILENAME, PRICING_YEAR } from './pricing-plans';

const SITE_TIMEZONE = 'Asia/Kolkata';
const CONTACT_LIST_LIMIT = 200;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Price list emails to one address per 24 hours. */
export const PRICING_EMAILS_PER_DAY = 3;

/** Keep only a clean site path: no query string, fragment or host, bounded length. */
export function cleanPath(path: string | undefined): string {
  if (!path) return '/';
  const p = path.split(/[?#]/)[0].trim();
  return p.startsWith('/') ? p.slice(0, 120) : '/';
}

@Injectable()
export class PublicSiteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
    private readonly config: ConfigService,
  ) {}

  /** Stores a demo request, then emails it to the team if SMTP is configured. */
  async createContactRequest(dto: ContactRequestDto) {
    // Bots fill the hidden honeypot field; pretend success so they don't adapt.
    if (dto.website) return { received: true };

    const request = await this.prisma.contactRequest.create({
      data: {
        name: dto.name,
        schoolName: dto.schoolName,
        city: dto.city,
        studentCount: dto.studentCount,
        phone: dto.phone,
        preferredTime: dto.preferredTime?.trim() || null,
        interestedPlan: dto.interestedPlan ?? null,
      },
    });
    await this.recordEvent({ event: 'contact_submit', path: '/contact' });

    const to = this.notifyEmail();
    if (to) {
      const sent = await this.mailer.send(
        to,
        `Demo request: ${dto.schoolName} (${dto.city})`,
        [
          `New demo request from schoolinkd.in`,
          ``,
          `Name: ${dto.name}`,
          `School: ${dto.schoolName}`,
          `City: ${dto.city}`,
          `Students: ${dto.studentCount}`,
          `Phone: ${dto.phone}`,
          `Preferred time: ${dto.preferredTime?.trim() || '—'}`,
          `Interested plan: ${dto.interestedPlan ?? '—'}`,
          ``,
          `WhatsApp: https://wa.me/${dto.phone.replace(/^\+/, '')}`,
        ].join('\n'),
      );
      if (sent)
        await this.prisma.contactRequest.update({
          where: { id: request.id },
          data: { emailedAt: new Date() },
        });
    }
    return { received: true };
  }

  /**
   * Emails the price list PDF to the visitor (from SMTP_FROM, e.g.
   * noreply@schoolinkd.in, replies going to the team) and tells the team.
   * Nothing is downloaded on the site. The lead is kept even when the email
   * fails; the visitor then gets PRICING_EMAIL_FAILED.
   */
  async createPricingRequest(
    dto: PricingRequestDto,
  ): Promise<{ sent: true; to: string }> {
    const done = { sent: true as const, to: dto.email };
    // Bots fill the honeypot: they are told it was sent; nothing is.
    if (dto.website) return done;

    // The form must not become a way to flood someone's inbox: the same
    // address gets the price list at most a few times a day (said "sent").
    const recent = await this.prisma.pricingRequest.count({
      where: {
        email: dto.email,
        createdAt: { gte: new Date(Date.now() - DAY_MS) },
      },
    });
    if (recent >= PRICING_EMAILS_PER_DAY) return done;

    const request = await this.prisma.pricingRequest.create({
      data: { schoolName: dto.schoolName, email: dto.email, phone: dto.phone },
    });
    await this.recordEvent({ event: 'pricing_download', path: '/' });

    const team = this.notifyEmail();
    const sent = await this.mailer.send(
      dto.email,
      `Schoolinkd plans and prices ${PRICING_YEAR}`,
      [
        `Hello,`,
        ``,
        `Thank you for your interest in Schoolinkd. The price list for ${dto.schoolName} is attached: the price of each plan, a feature-by-feature comparison and our terms.`,
        ``,
        `To see Schoolinkd with your own school's numbers, book a free demo: https://schoolinkd.in/contact`,
        ``,
        `Team Schoolinkd`,
      ].join('\n'),
      {
        replyTo: team,
        attachments: [
          {
            filename: PRICING_FILENAME,
            content: await buildPricingPdf(dto.schoolName),
            contentType: 'application/pdf',
          },
        ],
      },
    );
    if (sent)
      await this.prisma.pricingRequest.update({
        where: { id: request.id },
        data: { emailedAt: new Date() },
      });

    if (team)
      await this.mailer.send(
        team,
        sent
          ? `Price list sent: ${dto.schoolName}`
          : `Price list NOT sent (email failed): ${dto.schoolName}`,
        [
          sent
            ? `The price list was emailed from schoolinkd.in to:`
            : `Someone asked for the price list on schoolinkd.in, but emailing it failed. Send it by hand:`,
          ``,
          `School: ${dto.schoolName}`,
          `Email: ${dto.email}`,
          `Phone: ${dto.phone}`,
          ``,
          `WhatsApp: https://wa.me/${dto.phone.replace(/^\+/, '')}`,
        ].join('\n'),
      );

    if (!sent)
      throw new ServiceUnavailableException({
        code: 'PRICING_EMAIL_FAILED',
        message: 'The price list could not be emailed just now',
      });
    return done;
  }

  listPricingRequests() {
    return this.prisma.pricingRequest.findMany({
      orderBy: { createdAt: 'desc' },
      take: CONTACT_LIST_LIMIT,
    });
  }

  private notifyEmail(): string | undefined {
    return (
      this.config.get<string>('CONTACT_NOTIFY_EMAIL') ??
      this.config.get<string>('SMTP_USER')
    );
  }

  /** One atomic upsert per event into today's (IST) aggregate row. */
  async recordEvent(dto: SiteEventDto) {
    const day = todayIn(SITE_TIMEZONE);
    await this.prisma.$executeRaw`
      INSERT INTO site_event_counts (day, event, path, count)
      VALUES (${day}::date, ${dto.event}, ${cleanPath(dto.path)}, 1)
      ON CONFLICT (day, event, path) DO UPDATE SET count = site_event_counts.count + 1
    `;
    return { ok: true };
  }

  listContactRequests() {
    return this.prisma.contactRequest.findMany({
      orderBy: { createdAt: 'desc' },
      take: CONTACT_LIST_LIMIT,
    });
  }

  /** Daily totals per event, plus the most-visited pages, for the last [days] days. */
  async siteStats(days: number) {
    const since = new Date(`${todayIn(SITE_TIMEZONE)}T00:00:00.000Z`);
    since.setUTCDate(since.getUTCDate() - (days - 1));

    const [daily, pages] = await Promise.all([
      this.prisma.$queryRaw<{ day: Date; event: string; total: bigint }[]>`
        SELECT day, event, SUM(count)::bigint AS total
        FROM site_event_counts WHERE day >= ${since}
        GROUP BY day, event ORDER BY day DESC
      `,
      this.prisma.$queryRaw<{ path: string; total: bigint }[]>`
        SELECT path, SUM(count)::bigint AS total
        FROM site_event_counts WHERE day >= ${since} AND event = 'page_view'
        GROUP BY path ORDER BY total DESC LIMIT 10
      `,
    ]);

    const byDay = new Map<string, Record<string, number>>();
    for (const row of daily) {
      const key = row.day.toISOString().slice(0, 10);
      byDay.set(key, {
        ...(byDay.get(key) ?? {}),
        [row.event]: Number(row.total),
      });
    }
    return {
      days,
      daily: [...byDay.entries()].map(([day, events]) => ({ day, ...events })),
      topPages: pages.map((p) => ({ path: p.path, views: Number(p.total) })),
      emailEnabled: this.mailer.enabled,
    };
  }
}
