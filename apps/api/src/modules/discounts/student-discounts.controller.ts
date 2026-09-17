import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { StudentDiscountsService } from './student-discounts.service';
import { CreateStudentDiscountDto } from './dto/create-student-discount.dto';

@Controller('student-discounts')
export class StudentDiscountsController {
  constructor(private readonly studentDiscountsService: StudentDiscountsService) {}

  @Get()
  @Roles(Role.admin, Role.accounts)
  findForStudent(@TenantId() tenantId: string, @Query('studentId', ParseUUIDPipe) studentId: string) {
    return this.studentDiscountsService.findForStudent(tenantId, studentId);
  }

  @Get('sibling-suggestions')
  @Roles(Role.admin, Role.accounts)
  getSiblingSuggestions(@TenantId() tenantId: string) {
    return this.studentDiscountsService.getSiblingSuggestions(tenantId);
  }

  @Post()
  @Roles(Role.admin, Role.accounts)
  assign(@TenantId() tenantId: string, @Body() dto: CreateStudentDiscountDto) {
    return this.studentDiscountsService.assign(tenantId, dto);
  }

  @Delete(':id')
  @Roles(Role.admin, Role.accounts)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.studentDiscountsService.remove(tenantId, id);
  }
}
