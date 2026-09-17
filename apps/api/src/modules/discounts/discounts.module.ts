import { Module } from '@nestjs/common';
import { DiscountTypesService } from './discount-types.service';
import { StudentDiscountsService } from './student-discounts.service';
import { DiscountTypesController } from './discount-types.controller';
import { StudentDiscountsController } from './student-discounts.controller';

@Module({
  controllers: [DiscountTypesController, StudentDiscountsController],
  providers: [DiscountTypesService, StudentDiscountsService],
  exports: [DiscountTypesService, StudentDiscountsService],
})
export class DiscountsModule {}
