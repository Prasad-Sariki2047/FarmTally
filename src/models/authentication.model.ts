import { BaseEntity, AuthenticationMethod, LinkPurpose, OTPPurpose } from './common.types';

export interface AuthenticationSession extends BaseEntity {
  userId: string;
  method: AuthenticationMethod;
  expiresAt: Date;
  ipAddress: string;
  userAgent: string;
}

export interface MagicLink extends BaseEntity {
  email: string;
  token: string;
  purpose: LinkPurpose;
  expiresAt: Date;
  used: boolean;
}

export interface OTPVerification extends BaseEntity {
  email?: string;
  phoneNumber?: string;
  code: string;
  purpose: OTPPurpose;
  expiresAt: Date;
  verified: boolean;
  attempts: number;
}