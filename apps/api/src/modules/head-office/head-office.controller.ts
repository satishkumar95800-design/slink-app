import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { ActiveUser } from '../../common/types/active-user.type';
import {
  CreateCircularDto,
  GroupNameDto,
  GroupSchoolsDto,
  GroupSettingsDto,
  HeadOfficeUserDto,
  PasswordDto,
  RoyaltyPaymentDto,
  RoyaltyTermsDto,
  VoidRoyaltyPaymentDto,
} from './dto/groups.dto';
import { GroupInsightsService } from './group-insights.service';
import { RoyaltiesService } from './royalties.service';
import { GroupsService } from './groups.service';
import { CircularsService } from './circulars.service';
import { HeadOfficeService } from './head-office.service';

/**
 * Head office (franchise) view. Branch data is read-only; the head office
 * writes only circulars, its own royalty records and its weekly brief. The
 * group is resolved from the signed-in user. Excluded from TenantMiddleware.
 */
@Controller('head-office')
@Roles(Role.head_office)
export class HeadOfficeController {
  constructor(
    private readonly headOffice: HeadOfficeService,
    private readonly insights: GroupInsightsService,
    private readonly royalties: RoyaltiesService,
  ) {}

  /** Branch health scores, rule findings and this week's brief (docs/SPEC-franchise.md §8). */
  @Get('insights')
  getInsights(@CurrentUser() user: ActiveUser) {
    return this.insights.insights(user);
  }

  /** Has the model write this week's brief from the findings (a few a day). */
  @Post('insights/brief')
  @HttpCode(200)
  writeBrief(@CurrentUser() user: ActiveUser) {
    return this.insights.writeBrief(user);
  }

  /** Royalty from each branch (docs/SPEC-franchise.md §7). */
  @Get('royalties')
  royaltySummary(@CurrentUser() user: ActiveUser) {
    return this.royalties.summary(user);
  }

  @Get('royalties/:tenantId')
  royaltyBranch(
    @CurrentUser() user: ActiveUser,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
  ) {
    return this.royalties.branch(user, tenantId);
  }

  @Put('royalties/:tenantId/terms')
  royaltyTerms(
    @CurrentUser() user: ActiveUser,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: RoyaltyTermsDto,
  ) {
    return this.royalties.setTerms(user, tenantId, dto);
  }

  @Post('royalties/:tenantId/payments')
  royaltyPayment(
    @CurrentUser() user: ActiveUser,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: RoyaltyPaymentDto,
  ) {
    return this.royalties.recordPayment(user, tenantId, dto);
  }

  @Post('royalty-payments/:id/void')
  @HttpCode(200)
  voidRoyaltyPayment(
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VoidRoyaltyPaymentDto,
  ) {
    return this.royalties.voidPayment(user, id, dto);
  }

  @Get('overview')
  overview(@CurrentUser() user: ActiveUser) {
    return this.headOffice.overview(user);
  }

  @Get('circulars')
  circulars(@CurrentUser() user: ActiveUser) {
    return this.headOffice.listCirculars(user);
  }

  /** The one write route a head office has (docs/SPEC-franchise.md §3). */
  @Post('circulars')
  sendCircular(
    @CurrentUser() user: ActiveUser,
    @Body() dto: CreateCircularDto,
  ) {
    return this.headOffice.createCircular(user, dto);
  }

  @Get('branches/:tenantId')
  branch(
    @CurrentUser() user: ActiveUser,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
  ) {
    return this.headOffice.branch(user, tenantId);
  }
}

/** Groups, their schools and head office logins (platform console). */
@Controller('platform/groups')
@Roles(Role.super_admin)
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Get()
  list() {
    return this.groups.list();
  }

  @Post()
  create(@Body() dto: GroupNameDto, @CurrentUser() user: ActiveUser) {
    return this.groups.create(dto, user);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GroupSettingsDto,
    @CurrentUser() user: ActiveUser,
  ) {
    return this.groups.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: ActiveUser,
  ) {
    await this.groups.remove(id, user);
  }

  @Put(':id/schools')
  setSchools(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GroupSchoolsDto,
    @CurrentUser() user: ActiveUser,
  ) {
    return this.groups.setSchools(id, dto, user);
  }

  @Post(':id/users')
  createUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: HeadOfficeUserDto,
    @CurrentUser() user: ActiveUser,
  ) {
    return this.groups.createUser(id, dto, user);
  }

  @Post(':id/users/:userId/password')
  @HttpCode(204)
  async resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: PasswordDto,
    @CurrentUser() user: ActiveUser,
  ) {
    await this.groups.resetPassword(id, userId, dto.password, user);
  }

  @Delete(':id/users/:userId')
  @HttpCode(204)
  async removeUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: ActiveUser,
  ) {
    await this.groups.removeUser(id, userId, user);
  }
}

/** Head office circulars a school's staff received (tenant-scoped). */
@Controller('circulars')
@Roles(Role.admin, Role.accounts, Role.teacher)
export class SchoolCircularsController {
  constructor(private readonly circulars: CircularsService) {}

  @Get()
  list(@TenantId() tenantId: string) {
    return this.circulars.forSchool(tenantId);
  }
}
