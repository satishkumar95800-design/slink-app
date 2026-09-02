import { GuardianRelation, BloodGroup, Caste } from './enums';

export interface Student {
  id: string;
  tenantId: string;
  name: string;
  admissionNo: string;
  dob: Date | null;
  bloodGroup: BloodGroup | null;
  caste: Caste | null;
  photoUrl: string | null;
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
  bloodGroup?: BloodGroup;
  caste?: Caste;
  classId: string;
  parentPhone: string;
  parentRelation?: GuardianRelation;
  isParentPrimary?: boolean;
}

export interface UpdateStudentDto {
  name?: string;
  classId?: string;
  dob?: string;
  bloodGroup?: BloodGroup;
  caste?: Caste;
  photoUrl?: string;
}
