import { Role } from '@prisma/client';

export interface ActiveUser {
  id: string;
  tenantId: string;
  role: Role;
  name: string;
  isVerified: boolean;
}
