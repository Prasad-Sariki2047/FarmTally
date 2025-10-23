import { BaseEntity, UserRole, RelationshipType, InvitationStatus } from './common.types';

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