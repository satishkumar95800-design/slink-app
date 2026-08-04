import { GuardianRelation } from './enums';

export interface Student {
  id: string;
  tenantId: string;
  name: string;
  admissionNo: string;
  dob: Date | null;
  classId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StudentParent {
  studentId: string;
  parentId: string;
  relation: GuardianRelation;
  isPrimary: boolean;
}

export interface CreateStudentDto {
  name: string;
  admissionNo: string;
  dob?: string;
  classId: string;
  parentPhone: string;
  parentRelation?: GuardianRelation;
}

export interface UpdateStudentDto {
  name?: string;
  classId?: string;
  dob?: string;
}
