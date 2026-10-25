import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PublicSiteService } from './public-site.service';
import { PublicThrottlerGuard } from './public-throttler.guard';
import {
  ContactRequestDto,
  PricingRequestDto,
  SiteEventDto,
  SiteStatsQueryDto,
} from './dto/contact-request.dto';

/** Unauthenticated endpoints for the marketing site (no tenant, rate-limited per IP). */
@Controller('public')
@Public()
@UseGuards(PublicThrottlerGuard)
export class PublicSiteController {
  constructor(private readonly service: PublicSiteService) {}

  @Post('contact')
  @HttpCode(201)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  contact(@Body() dto: ContactRequestDto) {
    return this.service.createContactRequest(dto);
  }

  /** Emails the price list PDF to the visitor's address (never a download). */
  @Post('pricing')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  pricing(@Body() dto: PricingRequestDto) {
    return this.service.createPricingRequest(dto);
  }

  @Post('events')
  @HttpCode(204)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async event(@Body() dto: SiteEventDto) {
    await this.service.recordEvent(dto);
  }
}

/** Super-admin views of demo requests and site analytics (Platform console). */
@Controller('platform')
@Roles(Role.super_admin)
export class PlatformSiteController {
  constructor(private readonly service: PublicSiteService) {}

  @Get('contact-requests')
  contactRequests() {
    return this.service.listContactRequests();
  }

  @Get('pricing-requests')
  pricingRequests() {
    return this.service.listPricingRequests();
  }

  @Get('site-stats')
  siteStats(@Query() query: SiteStatsQueryDto) {
    return this.service.siteStats(query.days ?? 30);
  }
}
