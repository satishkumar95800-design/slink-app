import { Role } from './enums';

export interface User {
  id: string;
  tenantId: string;
  phone: string | null;
  email: string | null;
  name: string;
  role: Role;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface JwtPayload {
  sub: string;
  tenantId: string;
  role: Role;
  iat?: number;
  exp?: number;
}

export interface SendOtpDto {
  phone: string;
  tenantId: string;
}

export interface VerifyOtpDto {
  firebaseIdToken: string;
  tenantId: string;
}

export interface RefreshTokenDto {
  refreshToken: string;
}
