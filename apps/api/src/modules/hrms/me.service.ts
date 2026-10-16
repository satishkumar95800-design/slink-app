import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { ActiveUser } from '../../common/types/active-user.type';
import { fromDbDate } from '../attendance/attendance-dates';
import { ApplyLeaveDto } from './dto/hrms.dto';
import { LeaveService } from './leave.service';
import { PayrollService } from './payroll.service';
import { hrmsStrings as t } from './hrms.strings';

/**
 * Own-data access for any staff login (teacher, admin, accounts). The employee
 * is ALWAYS resolved from the authenticated user (employees.user_id), never
 * from a request parameter, so one person can never reach another's data.
 */
@Injectable()
export class MeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly leave: LeaveService,
    private readonly payroll: PayrollService,
  ) {}

  async employeeOf(user: ActiveUser) {
    const e = await this.prisma.employee.findFirst({
      where: { userId: user.id, tenantId: user.tenantId },
      select: {
        id: true,
        employeeCode: true,
        name: true,
        designation: true,
        department: true,
        joinDate: true,
        status: true,
      },
    });
    if (!e)
      throw new NotFoundException({
        code: 'NO_EMPLOYEE_RECORD',
        message: t.noEmployeeRecord,
      });
    return e;
  }

  async profile(user: ActiveUser) {
    const e = await this.employeeOf(user);
    return {
      employeeCode: e.employeeCode,
      name: e.name,
      designation: e.designation,
      department: e.department,
      joinDate: fromDbDate(e.joinDate),
      status: e.status,
    };
  }

  async payslips(user: ActiveUser) {
    const e = await this.employeeOf(user);
    return this.payroll.ownPayslips(user.tenantId, e.id);
  }

  async payslipPdf(user: ActiveUser, lineId: string) {
    const e = await this.employeeOf(user);
    return this.payroll.ownPayslipPdf(user.tenantId, e.id, lineId);
  }

  leaveTypes(user: ActiveUser) {
    return this.leave.listTypes(user.tenantId, false);
  }

  async balances(user: ActiveUser) {
    const e = await this.employeeOf(user);
    return this.leave.balances(user.tenantId, e.id);
  }

  async requests(user: ActiveUser) {
    const e = await this.employeeOf(user);
    return this.leave.listForEmployee(user.tenantId, e.id);
  }

  async apply(user: ActiveUser, dto: ApplyLeaveDto) {
    const e = await this.employeeOf(user);
    return this.leave.apply(user.tenantId, user.id, e.id, dto);
  }

  async cancel(user: ActiveUser, requestId: string) {
    const e = await this.employeeOf(user);
    return this.leave.cancel(user.tenantId, user, requestId, e.id);
  }
}
