import { Module } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { TenantsAdminController } from './tenants-admin.controller';
import { TenantSelfController } from './tenant-self.controller';
import { FilesModule } from '../files/files.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [FilesModule, UsersModule],
  controllers: [TenantsAdminController, TenantSelfController],
  providers: [TenantsService],
  exports: [TenantsService],
})
export class TenantsModule {}
