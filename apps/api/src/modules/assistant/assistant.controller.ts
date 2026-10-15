import {
  Body,
  Controller,
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
import { AiUnavailableError } from '../ai/ai.service';
import { AssistantService } from './assistant.service';
import { AskDto } from './dto/ask.dto';

/** Premium plain-language questions (docs/SPEC-ai.md 3.1, 3.2). */
@Controller('assistant')
export class AssistantController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assistant: AssistantService,
  ) {}

  @Post('ask')
  @Roles(Role.admin, Role.accounts, Role.parent)
  async ask(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Body() dto: AskDto,
  ) {
    await assertFeatureEnabled(this.prisma, tenantId, 'aiInsights');
    try {
      return await this.assistant.ask(tenantId, user, dto.question);
    } catch (err) {
      if (err instanceof AiUnavailableError) {
        throw new ServiceUnavailableException({
          code: 'AI_UNAVAILABLE',
          message:
            'The AI assistant is not available right now. Please try again later.',
        });
      }
      throw err;
    }
  }
}
