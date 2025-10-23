import { BusinessRelationship, Invitation, UserRegistrationData, User } from '../models';
import { RelationshipType, RelationshipStatus } from '../models/common.types';
import { BusinessRelationshipService } from '../services/business-relationship.service';

export interface RelationshipController {
  // Business relationship management
  createRelationship(farmAdminId: string, serviceProviderId: string, type: RelationshipType): Promise<{ success: boolean; relationship?: BusinessRelationship; error?: string }>;
  getRelationships(userId: string): Promise<{ success: boolean; relationships?: BusinessRelationship[]; error?: string }>;
  updateRelationshipStatus(relationshipId: string, status: RelationshipStatus): Promise<{ success: boolean; relationship?: BusinessRelationship; error?: string }>;
  terminateRelationship(relationshipId: string, reason: string): Promise<{ success: boolean; message: string; error?: string }>;
  
  // Invitation management
  inviteFieldManager(farmAdminId: string, email: string): Promise<{ success: boolean; invitation?: Invitation; error?: string }>;
  getInvitations(userId: string): Promise<{ success: boolean; invitations?: Invitation[]; error?: string }>;
  acceptInvitation(invitationId: string, userData: UserRegistrationData): Promise<{ success: boolean; user?: User; error?: string }>;
  cancelInvitation(invitationId: string): Promise<{ success: boolean; message: string; error?: string }>;
  
  // Service provider relationships
  requestRelationship(serviceProviderId: string, farmAdminId: string, type: RelationshipType, message?: string): Promise<{ success: boolean; request?: any; error?: string }>;
  getPendingRelationshipRequests(farmAdminId: string): Promise<{ success: boolean; requests?: BusinessRelationship[]; error?: string }>;
  getRelationshipsByStatus(userId: string, status: RelationshipStatus): Promise<{ success: boolean; relationships?: BusinessRelationship[]; error?: string }>;
  approveRelationshipRequest(requestId: string, farmAdminId: string): Promise<{ success: boolean; relationship?: BusinessRelationship; error?: string }>;
  rejectRelationshipRequest(requestId: string, farmAdminId: string, reason: string): Promise<{ success: boolean; message: string; error?: string }>;
}

export class RelationshipControllerImpl implements RelationshipController {
  constructor(
    private businessRelationshipService: BusinessRelationshipService
  ) {}

  /**
   * Create a business relationship between Farm Admin and service provider
   * Requirements: 8.1, 8.2
   */
  async createRelationship(farmAdminId: string, serviceProviderId: string, type: RelationshipType): Promise<{ success: boolean; relationship?: BusinessRelationship; error?: string }> {
    try {
      const relationship = await this.businessRelationshipService.createRelationship(farmAdminId, serviceProviderId, type);
      return { success: true, relationship };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to create relationship' 
      };
    }
  }

  /**
   * Get all relationships for a user
   * Requirements: 4.1, 6.1, 7.1, 8.4
   */
  async getRelationships(userId: string): Promise<{ success: boolean; relationships?: BusinessRelationship[]; error?: string }> {
    try {
      const relationships = await this.businessRelationshipService.getRelationships(userId);
      return { success: true, relationships };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get relationships' 
      };
    }
  }

  /**
   * Update relationship status
   * Requirements: 8.2, 8.3
   */
  async updateRelationshipStatus(relationshipId: string, status: RelationshipStatus): Promise<{ success: boolean; relationship?: BusinessRelationship; error?: string }> {
    try {
      const relationship = await this.businessRelationshipService.updateRelationshipStatus(relationshipId, status);
      return { success: true, relationship };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update relationship status' 
      };
    }
  }

  /**
   * Terminate a relationship
   * Requirements: 8.2, 8.3
   */
  async terminateRelationship(relationshipId: string, reason: string): Promise<{ success: boolean; message: string; error?: string }> {
    try {
      await this.businessRelationshipService.terminateRelationship(relationshipId, reason);
      return { success: true, message: 'Relationship terminated successfully' };
    } catch (error) {
      return { 
        success: false, 
        message: 'Failed to terminate relationship',
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Invite Field Manager via magic link
   * Requirements: 5.1, 5.2, 5.3
   */
  async inviteFieldManager(farmAdminId: string, email: string): Promise<{ success: boolean; invitation?: Invitation; error?: string }> {
    try {
      // Validate email format
      if (!this.isValidEmail(email)) {
        return { success: false, error: 'Invalid email format' };
      }

      const invitation = await this.businessRelationshipService.inviteFieldManager(farmAdminId, email);
      return { success: true, invitation };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to send invitation' 
      };
    }
  }

  /**
   * Get invitations by user
   * Requirements: 5.1, 5.2
   */
  async getInvitations(userId: string): Promise<{ success: boolean; invitations?: Invitation[]; error?: string }> {
    try {
      const invitations = await this.businessRelationshipService.getInvitationsByUser(userId);
      return { success: true, invitations };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get invitations' 
      };
    }
  }

  /**
   * Accept invitation and create user account with relationship
   * Requirements: 5.3, 5.5
   */
  async acceptInvitation(invitationId: string, userData: UserRegistrationData): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      const user = await this.businessRelationshipService.acceptInvitation(invitationId, userData);
      return { success: true, user };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to accept invitation' 
      };
    }
  }

  /**
   * Cancel an invitation
   * Requirements: 5.1, 5.2
   */
  async cancelInvitation(invitationId: string): Promise<{ success: boolean; message: string; error?: string }> {
    try {
      await this.businessRelationshipService.cancelInvitation(invitationId);
      return { success: true, message: 'Invitation cancelled successfully' };
    } catch (error) {
      return { 
        success: false, 
        message: 'Failed to cancel invitation',
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Request relationship with Farm Admin (for service providers)
   * Requirements: 8.1, 8.2
   */
  async requestRelationship(serviceProviderId: string, farmAdminId: string, type: RelationshipType, message?: string): Promise<{ success: boolean; request?: any; error?: string }> {
    try {
      const relationship = await this.businessRelationshipService.requestRelationship(serviceProviderId, farmAdminId, type, message);
      return { success: true, request: relationship };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to request relationship' 
      };
    }
  }

  /**
   * Get pending relationship requests for Farm Admin
   * Requirements: 8.2
   */
  async getPendingRelationshipRequests(farmAdminId: string): Promise<{ success: boolean; requests?: BusinessRelationship[]; error?: string }> {
    try {
      const requests = await this.businessRelationshipService.getPendingRelationshipRequests(farmAdminId);
      return { success: true, requests };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get pending requests' 
      };
    }
  }

  /**
   * Get relationships by status
   * Requirements: 8.3
   */
  async getRelationshipsByStatus(userId: string, status: RelationshipStatus): Promise<{ success: boolean; relationships?: BusinessRelationship[]; error?: string }> {
    try {
      const relationships = await this.businessRelationshipService.getRelationshipsByStatus(userId, status);
      return { success: true, relationships };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get relationships by status' 
      };
    }
  }

  /**
   * Approve relationship request
   * Requirements: 8.2, 8.3
   */
  async approveRelationshipRequest(requestId: string, farmAdminId: string): Promise<{ success: boolean; relationship?: BusinessRelationship; error?: string }> {
    try {
      const relationship = await this.businessRelationshipService.approveRelationshipRequest(requestId, farmAdminId);
      return { success: true, relationship };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to approve relationship request' 
      };
    }
  }

  /**
   * Reject relationship request
   * Requirements: 8.2, 8.3
   */
  async rejectRelationshipRequest(requestId: string, farmAdminId: string, reason: string): Promise<{ success: boolean; message: string; error?: string }> {
    try {
      await this.businessRelationshipService.rejectRelationshipRequest(requestId, farmAdminId, reason);
      return { success: true, message: 'Relationship request rejected' };
    } catch (error) {
      return { 
        success: false, 
        message: 'Failed to reject relationship request',
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}