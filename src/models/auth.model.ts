import { BaseEntity, AuthenticationMethod, LinkPurpose, OTPPurpose, ApprovalStatus, InvitationStatus, UserRole, RelationshipType } from './common.types';
import { UserRegistrationData } from './user.model';

export interface RegistrationRequest extends BaseEntity {
  userData: UserRegistrationData;
  status: ApprovalStatus;
  submittedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  rejectionReason?: string;
}

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

export interface Invitation extends BaseEntity {
  inviterId: string;
  inviteeEmail: string;
  inviteeRole: UserRole;
  relationshipType: RelationshipType;
  status: InvitationStatus;
  magicLinkToken: string;
  expiresAt: Date;
  sentAt: Date;
  acceptedAt?: Date;
}

export interface ApprovalDecision {
  approved: boolean;
  reason?: string;
  appAdminId: string;
  timestamp: Date;
}

// Validation functions for user data integrity
export class UserValidation {
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static validateFullName(fullName: string): boolean {
    return fullName.trim().length >= 2 && fullName.trim().length <= 100;
  }

  static validatePhoneNumber(phoneNumber: string): boolean {
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,15}$/;
    return phoneRegex.test(phoneNumber);
  }

  static validateOTPCode(code: string): boolean {
    return /^\d{6}$/.test(code);
  }

  static validateMagicLinkToken(token: string): boolean {
    return token.length >= 32 && /^[a-zA-Z0-9]+$/.test(token);
  }

  static validateRegistrationData(data: UserRegistrationData): string[] {
    const errors: string[] = [];

    if (!this.validateEmail(data.email)) {
      errors.push('Invalid email format');
    }

    if (!this.validateFullName(data.fullName)) {
      errors.push('Full name must be between 2 and 100 characters');
    }

    if (!Object.values(UserRole).includes(data.selectedRole)) {
      errors.push('Invalid user role selected');
    }

    if (!Object.values(AuthenticationMethod).includes(data.authMethod)) {
      errors.push('Invalid authentication method');
    }

    return errors;
  }

  static validateInvitationData(invitation: Partial<Invitation>): string[] {
    const errors: string[] = [];

    if (invitation.inviteeEmail && !this.validateEmail(invitation.inviteeEmail)) {
      errors.push('Invalid invitee email format');
    }

    if (invitation.inviteeRole && !Object.values(UserRole).includes(invitation.inviteeRole)) {
      errors.push('Invalid invitee role');
    }

    if (invitation.relationshipType && !Object.values(RelationshipType).includes(invitation.relationshipType)) {
      errors.push('Invalid relationship type');
    }

    return errors;
  }
}