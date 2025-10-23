import { BaseEntity, ApprovalStatus } from './common.types';
import { UserRegistrationData } from './user.model';

export interface RegistrationRequest extends BaseEntity {
  userData: UserRegistrationData;
  status: ApprovalStatus;
  submittedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  rejectionReason?: string;
}

export interface ApprovalDecision {
  approved: boolean;
  reason?: string;
  appAdminId: string;
  timestamp: Date;
}