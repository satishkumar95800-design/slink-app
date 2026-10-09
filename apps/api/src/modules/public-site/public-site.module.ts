import { Module } from '@nestjs/common';
import { MailerService } from './mailer.service';
import { PublicSiteService } from './public-site.service';
import {
  PlatformSiteController,
  PublicSiteController,
} from './public-site.controller';

@Module({
  controllers: [PublicSiteController, PlatformSiteController],
  providers: [PublicSiteService, MailerService],
})
export class PublicSiteModule {}
