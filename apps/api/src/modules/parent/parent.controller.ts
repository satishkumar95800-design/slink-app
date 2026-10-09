import { Controller, Get, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import type { ActiveUser } from '../../common/types/active-user.type';
import { ParentService } from './parent.service';
import { ParentStudentQueryDto } from './dto/parent-query.dto';

/** Parent-app screens that combine several modules' data for one child. */
@Controller('parent')
export class ParentController {
  constructor(private readonly parentService: ParentService) {}

  @Get('home')
  @Roles(Role.parent)
  home(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Query() query: ParentStudentQueryDto,
  ) {
    return this.parentService.getHome(tenantId, query.studentId, user);
  }

  @Get('notices')
  @Roles(Role.parent)
  notices(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Query() query: ParentStudentQueryDto,
  ) {
    return this.parentService.getNotices(tenantId, query.studentId, user);
  }
}
