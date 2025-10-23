import { BusinessRelationship, Invitation } from '../models';
import { RelationshipType, RelationshipStatus, InvitationStatus } from '../models/common.types';
import { BusinessRelationshipRepository } from './business-relationship.repository';
import { CryptoUtils } from '../utils/crypto.utils';

export class MockBusinessRelationshipRepository implements BusinessRelationshipRepository {
  private relationships: BusinessRelationship[] = [];
  private invitations: Invitation[] = [];

  constructor() {
    // Initialize with test data
    this.relationships = [
      {
        id: '33333333-3333-3333-3333-333333333333',
        farmAdminId: '11111111-1111-1111-1111-111111111111',
        serviceProviderId: '22222222-2222-2222-2222-222222222222',
        type: RelationshipType.FIELD_MANAGER,
        status: RelationshipStatus.ACTIVE,
        establishedDate: new Date(),
        permissions: {
          canRead: ['field_operations', 'crop_data'],
          canWrite: ['field_operations'],
          canDelete: [],
          restrictions: []
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
  }

  async createRelationship(relationship: BusinessRelationship): Promise<BusinessRelationship> {
    this.relationships.push(relationship);
    return relationship;
  }

  async findRelationshipById(id: string): Promise<BusinessRelationship | null> {
    return this.relationships.find(r => r.id === id) || null;
  }

  async findRelationshipsByFarmAdmin(farmAdminId: string): Promise<BusinessRelationship[]> {
    return this.relationships.filter(r => r.farmAdminId === farmAdminId);
  }

  async findRelationshipsByServiceProvider(serviceProviderId: string): Promise<BusinessRelationship[]> {
    return this.relationships.filter(r => r.serviceProviderId === serviceProviderId);
  }

  async findRelationshipsByType(type: RelationshipType): Promise<BusinessRelationship[]> {
    return this.relationships.filter(r => r.type === type);
  }

  async findRelationshipsByStatus(status: RelationshipStatus): Promise<BusinessRelationship[]> {
    return this.relationships.filter(r => r.status === status);
  }

  async updateRelationship(id: string, updates: Partial<BusinessRelationship>): Promise<BusinessRelationship> {
    const index = this.relationships.findIndex(r => r.id === id);
    if (index === -1) {
      throw new Error('Relationship not found');
    }
    
    this.relationships[index] = { ...this.relationships[index], ...updates, updatedAt: new Date() };
    return this.relationships[index];
  }

  async deleteRelationship(id: string): Promise<void> {
    const index = this.relationships.findIndex(r => r.id === id);
    if (index !== -1) {
      this.relationships.splice(index, 1);
    }
  }

  // Invitation methods
  async createInvitation(invitation: Invitation): Promise<Invitation> {
    this.invitations.push(invitation);
    return invitation;
  }

  async findInvitationById(id: string): Promise<Invitation | null> {
    return this.invitations.find(i => i.id === id) || null;
  }

  async findInvitationByToken(token: string): Promise<Invitation | null> {
    return this.invitations.find(i => i.magicLinkToken === token) || null;
  }

  async findInvitationsByInviter(inviterId: string): Promise<Invitation[]> {
    return this.invitations.filter(i => i.inviterId === inviterId);
  }

  async findInvitationsByEmail(email: string): Promise<Invitation[]> {
    return this.invitations.filter(i => i.inviteeEmail === email);
  }

  async findInvitationsByStatus(status: InvitationStatus): Promise<Invitation[]> {
    return this.invitations.filter(i => i.status === status);
  }

  async updateInvitation(id: string, updates: Partial<Invitation>): Promise<Invitation> {
    const index = this.invitations.findIndex(i => i.id === id);
    if (index === -1) {
      throw new Error('Invitation not found');
    }
    
    this.invitations[index] = { ...this.invitations[index], ...updates, updatedAt: new Date() };
    return this.invitations[index];
  }

  async deleteInvitation(id: string): Promise<void> {
    const index = this.invitations.findIndex(i => i.id === id);
    if (index !== -1) {
      this.invitations.splice(index, 1);
    }
  }
}