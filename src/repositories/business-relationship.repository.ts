import { BusinessRelationship, Invitation } from '../models';
import { RelationshipType, RelationshipStatus, InvitationStatus } from '../models/common.types';

export interface BusinessRelationshipRepository {
  // Business Relationship management
  createRelationship(relationship: BusinessRelationship): Promise<BusinessRelationship>;
  findRelationshipById(id: string): Promise<BusinessRelationship | null>;
  findRelationshipsByFarmAdmin(farmAdminId: string): Promise<BusinessRelationship[]>;
  findRelationshipsByServiceProvider(serviceProviderId: string): Promise<BusinessRelationship[]>;
  findRelationshipsByType(type: RelationshipType): Promise<BusinessRelationship[]>;
  findRelationshipsByStatus(status: RelationshipStatus): Promise<BusinessRelationship[]>;
  updateRelationship(id: string, updates: Partial<BusinessRelationship>): Promise<BusinessRelationship>;
  deleteRelationship(id: string): Promise<void>;
  
  // Invitation management
  createInvitation(invitation: Invitation): Promise<Invitation>;
  findInvitationById(id: string): Promise<Invitation | null>;
  findInvitationByToken(token: string): Promise<Invitation | null>;
  findInvitationsByInviter(inviterId: string): Promise<Invitation[]>;
  findInvitationsByEmail(email: string): Promise<Invitation[]>;
  findInvitationsByStatus(status: InvitationStatus): Promise<Invitation[]>;
  updateInvitation(id: string, updates: Partial<Invitation>): Promise<Invitation>;
  deleteInvitation(id: string): Promise<void>;
}