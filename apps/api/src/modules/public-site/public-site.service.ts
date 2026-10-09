import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { todayIn } from '../attendance/attendance-dates';
import { MailerService } from './mailer.service';
import { ContactRequestDto, SiteEventDto } from './dto/contact-request.dto';

const SITE_TIMEZONE = 'Asia/Kolkata';
const CONTACT_LIST_LIMIT = 200;

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
      },
    });
    await this.recordEvent({ event: 'contact_submit', path: '/contact' });

    const to =
      this.config.get<string>('CONTACT_NOTIFY_EMAIL') ??
      this.config.get<string>('SMTP_USER');
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
