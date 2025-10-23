import { BusinessRelationship, Invitation, UserRegistrationData, User } from '../models';
import { RelationshipType, RelationshipStatus, InvitationStatus, UserRole } from '../models/common.types';
import { BusinessRelationshipRepository } from '../repositories/business-relationship.repository';
import { UserManagementService } from './user-management.service';
import { MagicLinkAuthService } from './magic-link-auth.service';
import { CryptoUtils } from '../utils/crypto.utils';

export interface BusinessRelationshipManager {
  createRelationship(farmAdminId: string, serviceProviderId: string, type: RelationshipType): Promise<BusinessRelationship>;
  inviteFieldManager(farmAdminId: string, email: string): Promise<Invitation>;
  acceptInvitation(invitationId: string, userData: UserRegistrationData): Promise<User>;
  getRelationships(userId: string): Promise<BusinessRelationship[]>;
  getRelationshipById(relationshipId: string): Promise<BusinessRelationship | null>;
  updateRelationshipStatus(relationshipId: string, status: RelationshipStatus): Promise<BusinessRelationship>;
  terminateRelationship(relationshipId: string, reason: string): Promise<void>;
  getInvitationsByUser(userId: string): Promise<Invitation[]>;
  cancelInvitation(invitationId: string): Promise<void>;
  
  // Service provider relationship management
  requestRelationship(serviceProviderId: string, farmAdminId: string, type: RelationshipType, message?: string): Promise<BusinessRelationship>;
  getPendingRelationshipRequests(farmAdminId: string): Promise<BusinessRelationship[]>;
  approveRelationshipRequest(relationshipId: string, farmAdminId: string): Promise<BusinessRelationship>;
  rejectRelationshipRequest(relationshipId: string, farmAdminId: string, reason: string): Promise<void>;
  getRelationshipsByStatus(userId: string, status: RelationshipStatus): Promise<BusinessRelationship[]>;
}

export class BusinessRelationshipService implements BusinessRelationshipManager {
  constructor(
    private businessRelationshipRepository: BusinessRelationshipRepository,
    private userManagementService: UserManagementService,
    private magicLinkAuthService: MagicLinkAuthService
  ) {}

  /**
   * Create a business relationship between Farm Admin and service provider
   */
  async createRelationship(farmAdminId: string, serviceProviderId: string, type: RelationshipType): Promise<BusinessRelationship> {
    // Validate users exist and have correct roles
    const farmAdmin = await this.userManagementService.getUserById(farmAdminId);
    const serviceProvider = await this.userManagementService.getUserById(serviceProviderId);

    if (!farmAdmin || farmAdmin.role !== UserRole.FARM_ADMIN) {
      throw new Error('Invalid Farm Admin');
    }

    if (!serviceProvider) {
      throw new Error('Service provider not found');
    }

    // Validate relationship type matches service provider role
    this.validateRelationshipType(type, serviceProvider.role);

    // Check if relationship already exists
    const existingRelationships = await this.businessRelationshipRepository.findRelationshipsByFarmAdmin(farmAdminId);
    const existingRelationship = existingRelationships.find(
      rel => rel.serviceProviderId === serviceProviderId && rel.type === type
    );

    if (existingRelationship) {
      throw new Error('Relationship already exists');
    }

    // Create new relationship
    const relationship: BusinessRelationship = {
      id: CryptoUtils.generateUUID(),
      farmAdminId,
      serviceProviderId,
      type,
      status: RelationshipStatus.ACTIVE,
      establishedDate: new Date(),
      permissions: this.getDefaultPermissions(type),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return await this.businessRelationshipRepository.createRelationship(relationship);
  }

  /**
   * Invite a Field Manager via magic link
   */
  async inviteFieldManager(farmAdminId: string, email: string): Promise<Invitation> {
    // Validate Farm Admin
    const farmAdmin = await this.userManagementService.getUserById(farmAdminId);
    if (!farmAdmin || farmAdmin.role !== UserRole.FARM_ADMIN) {
      throw new Error('Only Farm Admins can invite Field Managers');
    }

    // Check if user already exists
    const existingUser = await this.userManagementService.getUserByEmail(email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Check for existing pending invitation
    const existingInvitations = await this.businessRelationshipRepository.findInvitationsByEmail(email);
    const pendingInvitation = existingInvitations.find(inv => inv.status === InvitationStatus.PENDING);
    
    if (pendingInvitation) {
      throw new Error('Pending invitation already exists for this email');
    }

    // Generate magic link token
    const magicLink = await this.magicLinkAuthService.generateInvitationLink(
      farmAdmin.fullName,
      email,
      'Field Manager'
    );

    // Create invitation record
    const invitation: Invitation = {
      id: CryptoUtils.generateUUID(),
      inviterId: farmAdminId,
      inviteeEmail: email.toLowerCase().trim(),
      inviteeRole: UserRole.FIELD_MANAGER,
      relationshipType: RelationshipType.FIELD_MANAGER,
      status: InvitationStatus.PENDING,
      magicLinkToken: magicLink.token,
      expiresAt: magicLink.expiresAt,
      sentAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return await this.businessRelationshipRepository.createInvitation(invitation);
  }

  /**
   * Accept an invitation and create user account with relationship
   */
  async acceptInvitation(invitationId: string, userData: UserRegistrationData): Promise<User> {
    // Find and validate invitation
    const invitation = await this.businessRelationshipRepository.findInvitationById(invitationId);
    
    if (!invitation) {
      throw new Error('Invitation not found');
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new Error('Invitation is no longer valid');
    }

    if (new Date() > invitation.expiresAt) {
      // Mark as expired
      await this.businessRelationshipRepository.updateInvitation(invitationId, {
        status: InvitationStatus.EXPIRED,
        updatedAt: new Date()
      });
      throw new Error('Invitation has expired');
    }

    // Validate email matches invitation
    if (userData.email.toLowerCase().trim() !== invitation.inviteeEmail) {
      throw new Error('Email does not match invitation');
    }

    // Validate role matches invitation
    if (userData.selectedRole !== invitation.inviteeRole) {
      throw new Error('Role does not match invitation');
    }

    try {
      // Create user account (bypassing normal approval process for invited users)
      const newUser = await this.userManagementService.createInvitedUser(userData);

      // Create business relationship
      await this.createRelationship(
        invitation.inviterId,
        newUser.id,
        invitation.relationshipType
      );

      // Mark invitation as accepted
      await this.businessRelationshipRepository.updateInvitation(invitationId, {
        status: InvitationStatus.ACCEPTED,
        acceptedAt: new Date(),
        updatedAt: new Date()
      });

      return newUser;
    } catch (error) {
      console.error('Error accepting invitation:', error);
      throw new Error('Failed to accept invitation');
    }
  }

  /**
   * Get all relationships for a user
   */
  async getRelationships(userId: string): Promise<BusinessRelationship[]> {
    const user = await this.userManagementService.getUserById(userId);
    
    if (!user) {
      throw new Error('User not found');
    }

    if (user.role === UserRole.FARM_ADMIN) {
      return await this.businessRelationshipRepository.findRelationshipsByFarmAdmin(userId);
    } else {
      return await this.businessRelationshipRepository.findRelationshipsByServiceProvider(userId);
    }
  }

  /**
   * Get relationship by ID
   */
  async getRelationshipById(relationshipId: string): Promise<BusinessRelationship | null> {
    return await this.businessRelationshipRepository.findRelationshipById(relationshipId);
  }

  /**
   * Update relationship status
   */
  async updateRelationshipStatus(relationshipId: string, status: RelationshipStatus): Promise<BusinessRelationship> {
    const relationship = await this.businessRelationshipRepository.findRelationshipById(relationshipId);
    
    if (!relationship) {
      throw new Error('Relationship not found');
    }

    return await this.businessRelationshipRepository.updateRelationship(relationshipId, {
      status,
      updatedAt: new Date()
    });
  }

  /**
   * Terminate a relationship
   */
  async terminateRelationship(relationshipId: string, reason: string): Promise<void> {
    const relationship = await this.businessRelationshipRepository.findRelationshipById(relationshipId);
    
    if (!relationship) {
      throw new Error('Relationship not found');
    }

    await this.businessRelationshipRepository.updateRelationship(relationshipId, {
      status: RelationshipStatus.TERMINATED,
      updatedAt: new Date()
    });

    // Log termination reason (could be stored in a separate audit table)
    console.log(`Relationship ${relationshipId} terminated. Reason: ${reason}`);
  }

  /**
   * Get invitations by user (sent or received)
   */
  async getInvitationsByUser(userId: string): Promise<Invitation[]> {
    return await this.businessRelationshipRepository.findInvitationsByInviter(userId);
  }

  /**
   * Cancel an invitation
   */
  async cancelInvitation(invitationId: string): Promise<void> {
    const invitation = await this.businessRelationshipRepository.findInvitationById(invitationId);
    
    if (!invitation) {
      throw new Error('Invitation not found');
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new Error('Can only cancel pending invitations');
    }

    await this.businessRelationshipRepository.updateInvitation(invitationId, {
      status: InvitationStatus.CANCELLED,
      updatedAt: new Date()
    });
  }

  /**
   * Validate relationship type matches user role
   */
  private validateRelationshipType(type: RelationshipType, userRole: UserRole): void {
    const validMappings: Record<RelationshipType, UserRole[]> = {
      [RelationshipType.FIELD_MANAGER]: [UserRole.FIELD_MANAGER],
      [RelationshipType.FARMER_SUPPLIER]: [UserRole.FARMER],
      [RelationshipType.LORRY_AGENCY]: [UserRole.LORRY_AGENCY],
      [RelationshipType.EQUIPMENT_PROVIDER]: [UserRole.FIELD_EQUIPMENT_MANAGER],
      [RelationshipType.INPUT_SUPPLIER]: [UserRole.INPUT_SUPPLIER],
      [RelationshipType.DEALER]: [UserRole.DEALER]
    };

    if (!validMappings[type]?.includes(userRole)) {
      throw new Error(`Invalid relationship type ${type} for user role ${userRole}`);
    }
  }

  /**
   * Request a business relationship with a Farm Admin (for service providers)
   * Requirements: 8.1, 8.2
   */
  async requestRelationship(serviceProviderId: string, farmAdminId: string, type: RelationshipType, message?: string): Promise<BusinessRelationship> {
    // Validate users exist and have correct roles
    const serviceProvider = await this.userManagementService.getUserById(serviceProviderId);
    const farmAdmin = await this.userManagementService.getUserById(farmAdminId);

    if (!serviceProvider) {
      throw new Error('Service provider not found');
    }

    if (!farmAdmin || farmAdmin.role !== UserRole.FARM_ADMIN) {
      throw new Error('Invalid Farm Admin');
    }

    // Validate relationship type matches service provider role
    this.validateRelationshipType(type, serviceProvider.role);

    // Check if relationship already exists
    const existingRelationships = await this.businessRelationshipRepository.findRelationshipsByFarmAdmin(farmAdminId);
    const existingRelationship = existingRelationships.find(
      rel => rel.serviceProviderId === serviceProviderId && rel.type === type
    );

    if (existingRelationship) {
      throw new Error('Relationship already exists or is pending');
    }

    // Create relationship request with pending status
    const relationship: BusinessRelationship = {
      id: CryptoUtils.generateUUID(),
      farmAdminId,
      serviceProviderId,
      type,
      status: RelationshipStatus.PENDING,
      establishedDate: new Date(),
      permissions: this.getDefaultPermissions(type),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const createdRelationship = await this.businessRelationshipRepository.createRelationship(relationship);

    // Notify Farm Admin of the relationship request
    await this.notifyFarmAdminOfRelationshipRequest(farmAdmin, serviceProvider, type, message);

    return createdRelationship;
  }

  /**
   * Get pending relationship requests for a Farm Admin
   * Requirements: 8.2
   */
  async getPendingRelationshipRequests(farmAdminId: string): Promise<BusinessRelationship[]> {
    const farmAdmin = await this.userManagementService.getUserById(farmAdminId);
    if (!farmAdmin || farmAdmin.role !== UserRole.FARM_ADMIN) {
      throw new Error('Only Farm Admins can view relationship requests');
    }

    const allRelationships = await this.businessRelationshipRepository.findRelationshipsByFarmAdmin(farmAdminId);
    return allRelationships.filter(rel => rel.status === RelationshipStatus.PENDING);
  }

  /**
   * Approve a relationship request
   * Requirements: 8.2, 8.3
   */
  async approveRelationshipRequest(relationshipId: string, farmAdminId: string): Promise<BusinessRelationship> {
    const relationship = await this.businessRelationshipRepository.findRelationshipById(relationshipId);
    
    if (!relationship) {
      throw new Error('Relationship request not found');
    }

    if (relationship.farmAdminId !== farmAdminId) {
      throw new Error('Unauthorized to approve this relationship request');
    }

    if (relationship.status !== RelationshipStatus.PENDING) {
      throw new Error('Relationship request is not pending');
    }

    // Update relationship status to active
    const updatedRelationship = await this.businessRelationshipRepository.updateRelationship(relationshipId, {
      status: RelationshipStatus.ACTIVE,
      updatedAt: new Date()
    });

    // Notify service provider of approval
    const serviceProvider = await this.userManagementService.getUserById(relationship.serviceProviderId);
    const farmAdmin = await this.userManagementService.getUserById(farmAdminId);
    
    if (serviceProvider && farmAdmin) {
      await this.notifyServiceProviderOfApproval(serviceProvider, farmAdmin, relationship.type);
    }

    return updatedRelationship;
  }

  /**
   * Reject a relationship request
   * Requirements: 8.2, 8.3
   */
  async rejectRelationshipRequest(relationshipId: string, farmAdminId: string, reason: string): Promise<void> {
    const relationship = await this.businessRelationshipRepository.findRelationshipById(relationshipId);
    
    if (!relationship) {
      throw new Error('Relationship request not found');
    }

    if (relationship.farmAdminId !== farmAdminId) {
      throw new Error('Unauthorized to reject this relationship request');
    }

    if (relationship.status !== RelationshipStatus.PENDING) {
      throw new Error('Relationship request is not pending');
    }

    // Update relationship status to terminated
    await this.businessRelationshipRepository.updateRelationship(relationshipId, {
      status: RelationshipStatus.TERMINATED,
      updatedAt: new Date()
    });

    // Notify service provider of rejection
    const serviceProvider = await this.userManagementService.getUserById(relationship.serviceProviderId);
    const farmAdmin = await this.userManagementService.getUserById(farmAdminId);
    
    if (serviceProvider && farmAdmin) {
      await this.notifyServiceProviderOfRejection(serviceProvider, farmAdmin, relationship.type, reason);
    }
  }

  /**
   * Get relationships by status
   * Requirements: 8.3
   */
  async getRelationshipsByStatus(userId: string, status: RelationshipStatus): Promise<BusinessRelationship[]> {
    const user = await this.userManagementService.getUserById(userId);
    
    if (!user) {
      throw new Error('User not found');
    }

    let relationships: BusinessRelationship[];
    
    if (user.role === UserRole.FARM_ADMIN) {
      relationships = await this.businessRelationshipRepository.findRelationshipsByFarmAdmin(userId);
    } else {
      relationships = await this.businessRelationshipRepository.findRelationshipsByServiceProvider(userId);
    }

    return relationships.filter(rel => rel.status === status);
  }

  /**
   * Notify Farm Admin of relationship request
   */
  private async notifyFarmAdminOfRelationshipRequest(farmAdmin: User, serviceProvider: User, type: RelationshipType, message?: string): Promise<void> {
    const subject = `New Business Relationship Request - FarmTally`;
    const body = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>New Business Relationship Request</h2>
        <p>Hello ${farmAdmin.fullName},</p>
        <p>You have received a new business relationship request:</p>
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Service Provider:</strong> ${serviceProvider.fullName}</p>
          <p><strong>Email:</strong> ${serviceProvider.email}</p>
          <p><strong>Role:</strong> ${serviceProvider.role}</p>
          <p><strong>Relationship Type:</strong> ${type}</p>
          ${message ? `<p><strong>Message:</strong> ${message}</p>` : ''}
        </div>
        <p>Please review this request in your Farm Admin dashboard.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/dashboard/relationships" 
             style="background-color: #4CAF50; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Review Request
          </a>
        </div>
        <hr>
        <p style="color: #666; font-size: 12px;">
          FarmTally - Agricultural Supply Chain Management Platform
        </p>
      </div>
    `;

    await this.magicLinkAuthService['notificationService'].sendEmail(farmAdmin.email, subject, body, true);
  }

  /**
   * Notify service provider of approval
   */
  private async notifyServiceProviderOfApproval(serviceProvider: User, farmAdmin: User, type: RelationshipType): Promise<void> {
    const subject = `Business Relationship Approved - FarmTally`;
    const body = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Business Relationship Approved!</h2>
        <p>Hello ${serviceProvider.fullName},</p>
        <p>Great news! Your business relationship request has been approved:</p>
        <div style="background-color: #e8f5e8; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Farm Admin:</strong> ${farmAdmin.fullName}</p>
          <p><strong>Relationship Type:</strong> ${type}</p>
          <p><strong>Status:</strong> Active</p>
        </div>
        <p>You can now access shared data and collaborate with this Farm Admin.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/dashboard" 
             style="background-color: #4CAF50; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Access Dashboard
          </a>
        </div>
        <hr>
        <p style="color: #666; font-size: 12px;">
          FarmTally - Agricultural Supply Chain Management Platform
        </p>
      </div>
    `;

    await this.magicLinkAuthService['notificationService'].sendEmail(serviceProvider.email, subject, body, true);
  }

  /**
   * Notify service provider of rejection
   */
  private async notifyServiceProviderOfRejection(serviceProvider: User, farmAdmin: User, type: RelationshipType, reason: string): Promise<void> {
    const subject = `Business Relationship Request Update - FarmTally`;
    const body = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Business Relationship Request Update</h2>
        <p>Hello ${serviceProvider.fullName},</p>
        <p>We regret to inform you that your business relationship request has not been approved:</p>
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Farm Admin:</strong> ${farmAdmin.fullName}</p>
          <p><strong>Relationship Type:</strong> ${type}</p>
          <p><strong>Reason:</strong> ${reason}</p>
        </div>
        <p>You may contact the Farm Admin directly or try reaching out to other Farm Admins who might be interested in your services.</p>
        <hr>
        <p style="color: #666; font-size: 12px;">
          FarmTally - Agricultural Supply Chain Management Platform
        </p>
      </div>
    `;

    await this.magicLinkAuthService['notificationService'].sendEmail(serviceProvider.email, subject, body, true);
  }

  /**
   * Get default permissions for relationship type
   */
  private getDefaultPermissions(type: RelationshipType): any {
    // Default permissions based on relationship type
    const defaultPermissions = {
      canRead: ['basic_profile', 'contact_info'],
      canWrite: [],
      canDelete: [],
      restrictions: []
    };

    switch (type) {
      case RelationshipType.FIELD_MANAGER:
        return {
          ...defaultPermissions,
          canRead: [...defaultPermissions.canRead, 'field_operations', 'crop_data', 'equipment_usage'],
          canWrite: ['field_operations', 'crop_status_updates']
        };
      case RelationshipType.FARMER_SUPPLIER:
        return {
          ...defaultPermissions,
          canRead: [...defaultPermissions.canRead, 'commodity_requirements', 'delivery_schedules'],
          canWrite: ['commodity_availability', 'delivery_updates']
        };
      case RelationshipType.LORRY_AGENCY:
        return {
          ...defaultPermissions,
          canRead: [...defaultPermissions.canRead, 'delivery_schedules', 'transportation_requests'],
          canWrite: ['delivery_status', 'transportation_updates']
        };
      case RelationshipType.EQUIPMENT_PROVIDER:
        return {
          ...defaultPermissions,
          canRead: [...defaultPermissions.canRead, 'equipment_requirements', 'usage_schedules'],
          canWrite: ['equipment_availability', 'maintenance_updates']
        };
      case RelationshipType.INPUT_SUPPLIER:
        return {
          ...defaultPermissions,
          canRead: [...defaultPermissions.canRead, 'input_requirements', 'supply_schedules'],
          canWrite: ['input_availability', 'supply_updates']
        };
      case RelationshipType.DEALER:
        return {
          ...defaultPermissions,
          canRead: [...defaultPermissions.canRead, 'commodity_availability', 'harvest_schedules'],
          canWrite: ['purchase_orders', 'pricing_updates']
        };
      default:
        return defaultPermissions;
    }
  }
}