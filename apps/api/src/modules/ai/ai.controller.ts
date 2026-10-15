import {
  Body,
  Controller,
  Get,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import type { ActiveUser } from '../../common/types/active-user.type';
import { assertFeatureEnabled } from '../../common/tenant-features';
import { PrismaService } from '../../prisma/prisma.service';
import { AiService, AiUnavailableError } from './ai.service';
import { RemarksService } from './remarks.service';
import { DraftRemarkDto } from './dto/draft-remark.dto';

/** Premium AI endpoints (docs/SPEC-ai.md); all need the aiInsights module. */
@Controller('ai')
export class AiController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly remarks: RemarksService,
  ) {}

  /** Whether this school's AI features can run right now (for showing AI buttons). */
  @Get('status')
  @Roles(Role.admin, Role.accounts, Role.teacher)
  async status(@TenantId() tenantId: string) {
    return { available: await this.ai.isAvailable(tenantId) };
  }

  @Post('report-remark')
  @Roles(Role.teacher, Role.admin)
  async draftRemark(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Body() dto: DraftRemarkDto,
  ) {
    await assertFeatureEnabled(this.prisma, tenantId, 'aiInsights');
    try {
      return await this.remarks.draft(tenantId, user, dto);
    } catch (err) {
      if (err instanceof AiUnavailableError) {
        throw new ServiceUnavailableException({
          code: 'AI_UNAVAILABLE',
          message:
            'The AI assistant is not available right now. Please write the remark yourself or try again later.',
        });
      }
      throw err;
    }
  }
}
