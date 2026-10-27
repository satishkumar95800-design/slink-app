import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { ActiveUser } from '../../common/types/active-user.type';
import { addDays } from '../../common/subscription';
import { todayIn, toDbDate } from '../attendance/attendance-dates';
import { AiService, AiUnavailableError } from '../ai/ai.service';
import { onlyRestatesGivenNumbers } from '../petty-cash/petty-cash-forecast.service';
import { MailerService } from '../public-site/mailer.service';
import { HeadOfficeService } from './head-office.service';
import {
  branchScore,
  Finding,
  findingText,
  groupFindings,
} from './group-insights';

const err = (code: string, message: string) => ({ code, message });
const TIMEZONE = 'Asia/Kolkata';
/** Briefs the head office may have the model write per group per day. */
export const BRIEFS_PER_DAY = 5;
const TICK_MS = 60 * 60 * 1000;
/** Monday email window, school time. */
const EMAIL_FROM_HOUR = 8;
const EMAIL_TO_HOUR = 12;

const LANGUAGE_NAME: Record<string, string> = {
  en: 'English',
  kn: 'Kannada',
  hi: 'Hindi',
};

const SYSTEM = (language: string) =>
  [
    'You write a short weekly brief for the owner of a group of schools (a franchise) from findings that have already been computed.',
    'Use ONLY the facts and numbers given. Never calculate a new number, never round, never invent names, causes or figures.',
    'Start with one sentence on the overall picture. Then 3 to 6 bullet points starting with "- ", most urgent first; each may end with one practical step the owner can take (call the branch head, review dues, and so on) without any new numbers.',
    `Write in ${language}, but keep branch names and all numbers exactly as given, using the digits 0-9. No headings, no markdown other than the "- " bullets.`,
  ].join(' ');

const EMAIL: Record<
  string,
  { subject: (group: string) => string; intro: string; open: string }
> = {
  en: {
    subject: (g) => `Weekly brief: ${g}`,
    intro: 'Here is this week’s brief for your schools.',
    open: 'See every branch in detail:',
  },
  kn: {
    subject: (g) => `ವಾರದ ಸಾರಾಂಶ: ${g}`,
    intro: 'ನಿಮ್ಮ ಶಾಲೆಗಳ ಈ ವಾರದ ಸಾರಾಂಶ ಇಲ್ಲಿದೆ.',
    open: 'ಪ್ರತಿ ಶಾಖೆಯ ವಿವರ ನೋಡಿ:',
  },
  hi: {
    subject: (g) => `साप्ताहिक सारांश: ${g}`,
    intro: 'आपके स्कूलों का इस सप्ताह का सारांश।',
    open: 'हर शाखा का विवरण देखें:',
  },
};

/** Monday of the week containing `ymd`. */
export function weekStartOf(ymd: string): string {
  const day = new Date(`${ymd}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(ymd, day === 0 ? -6 : 1 - day);
}

/** The findings as plain bullets: the brief when the model is not available. */
export function plainBrief(findings: Finding[]): string {
  return findings.map((f) => `- ${findingText(f)}`).join('\n');
}

/**
 * Head office insights (docs/SPEC-franchise.md §8): branch health scores and
 * rule findings on demand, an AI-phrased weekly brief (numbers checked
 * against the findings), and a Monday email of it to the head office.
 */
@Injectable()
export class GroupInsightsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GroupInsightsService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly headOffice: HeadOfficeService,
    private readonly ai: AiService,
    private readonly mailer: MailerService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    if (
      process.env.NODE_ENV === 'test' ||
      process.env.GROUP_BRIEF_EMAILS_DISABLED === 'true'
    )
      return;
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async insights(user: ActiveUser) {
    const group = await this.headOffice.groupOf(user);
    if (!group)
      return {
        group: null,
        scores: [],
        findings: [],
        brief: null,
        aiAvailable: false,
      };
    const facts = await this.headOffice.insightFacts(group);
    const scores = facts
      .map(branchScore)
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    const language = await this.languageOf(user.id);
    const brief = await this.prisma.groupAiBrief.findUnique({
      where: {
        groupId_weekStart_language: {
          groupId: group.id,
          weekStart: toDbDate(weekStartOf(todayIn(TIMEZONE))),
          language,
        },
      },
      select: { text: true, createdAt: true },
    });
    return {
      group: { id: group.id, name: group.name },
      scores,
      findings: groupFindings(facts),
      brief,
      aiAvailable: await this.ai.groupHasAi(group.id),
    };
  }

  /** Has the model write this week's brief now (in the user's language). */
  async writeBrief(user: ActiveUser) {
    const group = await this.headOffice.groupOf(user);
    if (!group)
      throw new NotFoundException(
        err('GROUP_NOT_FOUND', 'Your login is not linked to a group'),
      );
    const since = new Date(`${todayIn(TIMEZONE)}T00:00:00+05:30`);
    const used = await this.prisma.aiUsage.count({
      where: {
        groupId: group.id,
        feature: 'group_brief',
        createdAt: { gte: since },
      },
    });
    if (used >= BRIEFS_PER_DAY)
      throw new HttpException(
        err('BRIEF_LIMIT', 'The brief can be rewritten a few times a day only'),
        HttpStatus.TOO_MANY_REQUESTS,
      );
    const findings = groupFindings(await this.headOffice.insightFacts(group));
    if (findings.length === 0)
      throw new BadRequestException(
        err('NO_FINDINGS', 'Nothing needs your attention this week'),
      );
    const language = await this.languageOf(user.id);
    const text = await this.compose(group.id, group.name, findings, language);
    if (!text)
      throw new ServiceUnavailableException(
        err('AI_UNAVAILABLE', 'The brief could not be written just now'),
      );
    return this.saveBrief(group.id, language, text, findings);
  }

  /** The model's brief, or null when AI is off, failed, or made up a number. */
  private async compose(
    groupId: string,
    groupName: string,
    findings: Finding[],
    language: string,
  ): Promise<string | null> {
    const facts = findings.map(findingText).join('\n');
    try {
      const reply = await this.ai.completeForGroup(groupId, {
        feature: 'group_brief',
        tier: 'smart',
        system: SYSTEM(LANGUAGE_NAME[language] ?? 'English'),
        content: `Group: ${groupName}\nFindings:\n${facts}`,
        maxTokens: 800,
      });
      if (!onlyRestatesGivenNumbers(reply, `${groupName}\n${facts}`)) {
        this.logger.warn(`Group brief for ${groupId} dropped: new numbers`);
        return null;
      }
      return reply.trim();
    } catch (e) {
      if (e instanceof AiUnavailableError) return null;
      throw e;
    }
  }

  private async saveBrief(
    groupId: string,
    language: string,
    text: string,
    findings: Finding[],
  ) {
    const weekStart = toDbDate(weekStartOf(todayIn(TIMEZONE)));
    const json = findings as unknown as object[];
    return this.prisma.groupAiBrief.upsert({
      where: { groupId_weekStart_language: { groupId, weekStart, language } },
      create: { groupId, weekStart, language, text, findings: json },
      update: { text, findings: json },
      select: { text: true, createdAt: true, emailedAt: true },
    });
  }

  private async languageOf(userId: string) {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { preferredLanguage: true },
    });
    const l = u?.preferredLanguage ?? 'en';
    return l in LANGUAGE_NAME ? l : 'en';
  }

  // ── Monday email ──────────────────────────────────────────────────────────

  /** Monday morning: each group's head office gets the week's brief by email, once. */
  async tick(now: Date = new Date()) {
    if (this.running || !this.mailer.enabled) return;
    const today = todayIn(TIMEZONE);
    const hour = Number(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: TIMEZONE,
        hour: '2-digit',
        hourCycle: 'h23',
      }).format(now),
    );
    if (
      weekStartOf(today) !== today ||
      hour < EMAIL_FROM_HOUR ||
      hour >= EMAIL_TO_HOUR
    )
      return;
    this.running = true;
    try {
      const groups = await this.prisma.schoolGroup.findMany({
        where: {
          users: { some: { role: Role.head_office, email: { not: null } } },
        },
        select: { id: true, name: true, attendanceCutoff: true },
      });
      for (const g of groups) {
        try {
          await this.emailGroup(g, today);
        } catch (e) {
          this.logger.error(
            `Weekly brief for group ${g.id} failed`,
            e as Error,
          );
        }
      }
    } finally {
      this.running = false;
    }
  }

  async emailGroup(
    group: { id: string; name: string; attendanceCutoff: string },
    today: string,
  ) {
    const weekStart = toDbDate(weekStartOf(today));
    const sent = await this.prisma.groupAiBrief.count({
      where: { groupId: group.id, weekStart, emailedAt: { not: null } },
    });
    if (sent > 0) return;
    const findings = groupFindings(await this.headOffice.insightFacts(group));
    if (findings.length === 0) return;
    const users = await this.prisma.user.findMany({
      where: {
        groupId: group.id,
        role: Role.head_office,
        email: { not: null },
      },
      select: { email: true, preferredLanguage: true },
    });
    const link = `${this.config.get<string>('ADMIN_BASE_URL') ?? 'https://schoolinkd.in'}/head-office/insights`;
    const byLanguage = new Map<string, string[]>();
    for (const u of users) {
      const l =
        u.preferredLanguage && u.preferredLanguage in EMAIL
          ? u.preferredLanguage
          : 'en';
      byLanguage.set(l, [...(byLanguage.get(l) ?? []), u.email!]);
    }
    for (const [language, emails] of byLanguage) {
      const existing = await this.prisma.groupAiBrief.findUnique({
        where: {
          groupId_weekStart_language: {
            groupId: group.id,
            weekStart,
            language,
          },
        },
        select: { text: true },
      });
      const text =
        existing?.text ??
        (await this.compose(group.id, group.name, findings, language)) ??
        plainBrief(findings);
      const e = EMAIL[language];
      let ok = false;
      for (const to of emails)
        ok =
          (await this.mailer.send(
            to,
            e.subject(group.name),
            [e.intro, '', text, '', `${e.open} ${link}`].join('\n'),
          )) || ok;
      await this.saveBrief(group.id, language, text, findings);
      if (ok)
        await this.prisma.groupAiBrief.update({
          where: {
            groupId_weekStart_language: {
              groupId: group.id,
              weekStart,
              language,
            },
          },
          data: { emailedAt: new Date() },
        });
    }
  }
}
