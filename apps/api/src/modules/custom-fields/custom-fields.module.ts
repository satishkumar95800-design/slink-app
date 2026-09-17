import { Module } from '@nestjs/common';
import { CustomFieldDefinitionsService } from './custom-field-definitions.service';
import { CustomFieldDefinitionsController } from './custom-field-definitions.controller';

@Module({
  controllers: [CustomFieldDefinitionsController],
  providers: [CustomFieldDefinitionsService],
  exports: [CustomFieldDefinitionsService],
})
export class CustomFieldsModule {}
