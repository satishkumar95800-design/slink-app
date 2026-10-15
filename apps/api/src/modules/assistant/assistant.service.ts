import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { ActiveUser } from '../../common/types/active-user.type';
import { todayIn } from '../attendance/attendance-dates';
import { AiService } from '../ai/ai.service';
import { ToolContext, ToolResult, toolsFor } from './tools';

const SYSTEM = (tools: string, context: string, today: string) =>
  `You route a question from an Indian school app (any language: English, Kannada, Hindi) to exactly one tool.
Today is ${today}. Resolve relative dates ("yesterday", "this month", "last week") to YYYY-MM-DD.

Tools:
${tools}

${context}

Reply with one JSON object only: {"tool": "<tool name>" or "none", "args": {...}}.
Use only ids from the lists above. Leave out args you are not sure of. If there are several children and the question doesn't name one, leave childId out. Use "none" if no tool fits.`;

export interface AssistantAnswer extends ToolResult {
  /** What the question was understood as, for transparency. */
  understood: { tool: string; args: Record<string, unknown> };
}

/**
 * Plain-language questions (docs/SPEC-ai.md 3.1 admin, 3.2 parent). The model
 * only chooses a fixed, read-only, school-scoped query and its arguments; the
 * answer is built from real data by that query. Student names and data are
 * never sent to the model — only class names / children's first names and ids.
 */
@Injectable()
export class AssistantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  async ask(
    tenantId: string,
    user: ActiveUser,
    question: string,
  ): Promise<AssistantAnswer> {
    const ctx = await this.context(tenantId, user);
    const tools = toolsFor(user.role);
    const context =
      user.role === Role.parent
        ? `The parent's children (JSON): ${JSON.stringify(ctx.children.map((c) => ({ id: c.id, name: c.firstName })))}`
        : `Classes (JSON): ${JSON.stringify(ctx.classes)}`;

    const pick = await this.ai.completeJson<{
      tool?: string;
      args?: Record<string, unknown>;
    }>({
      tenantId,
      feature:
        user.role === Role.parent ? 'assistant_parent' : 'assistant_staff',
      tier: 'fast',
      system: SYSTEM(
        tools.map((t) => `- ${t.name}: ${t.describe}`).join('\n'),
        context,
        ctx.today,
      ),
      content: question.trim(),
      maxTokens: 300,
    });

    const tool = tools.find((t) => t.name === pick.tool);
    const args = pick.args && typeof pick.args === 'object' ? pick.args : {};
    if (!tool) {
      return {
        tool: 'none',
        headline: { key: 'cant_answer', params: {} },
        columns: [],
        rows: [],
        understood: { tool: 'none', args: {} },
      };
    }
    const result = await tool.run(ctx, args);
    return { ...result, understood: { tool: tool.name, args } };
  }

  private async context(
    tenantId: string,
    user: ActiveUser,
  ): Promise<ToolContext> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { timezone: true },
    });
    const today = todayIn(tenant?.timezone || 'Asia/Kolkata');
    const [classes, links] = await Promise.all([
      user.role === Role.parent
        ? Promise.resolve([])
        : this.prisma.class.findMany({
            where: { tenantId },
            select: { id: true, name: true, section: true },
            orderBy: { name: 'asc' },
          }),
      user.role === Role.parent
        ? this.prisma.studentParent.findMany({
            where: { parentId: user.id, student: { tenantId } },
            select: {
              student: { select: { id: true, name: true, classId: true } },
            },
          })
        : Promise.resolve([]),
    ]);
    return {
      prisma: this.prisma,
      tenantId,
      userId: user.id,
      role: user.role,
      today,
      classes: classes.map((c) => ({
        id: c.id,
        name: [c.name, c.section].filter(Boolean).join(' '),
      })),
      children: links.map((l) => ({
        id: l.student.id,
        firstName: l.student.name.trim().split(/\s+/)[0],
        classId: l.student.classId,
      })),
    };
  }
}
