import { DashboardConfig, Permission, DataAccessPermissions, RBACValidation } from '../models/rbac.model';
import { BusinessRelationship, SupplyChainData, DataVisibility } from '../models/business.model';
import { User } from '../models/user.model';
import { UserRole, AccessLevel, RelationshipStatus, SupplyChainDataType, UserStatus } from '../models/common.types';
import { BusinessRelationshipRepository } from '../repositories/business-relationship.repository';
import { UserRepository } from '../repositories/user.repository';

export interface RBACService {
  checkPermission(userId: string, resource: string, action: string): Promise<boolean>;
  getAccessibleData(userId: string, dataType: string): Promise<any[]>;
  getRoleDashboardConfig(userRole: UserRole): Promise<DashboardConfig>;
  validateBusinessRelationshipAccess(userId: string, targetUserId: string): Promise<boolean>;
  getUserPermissions(userId: string): Promise<string[]>;
  hasRolePermission(userRole: UserRole, resource: string, action: string): Promise<boolean>;
}

export class RBACServiceImpl implements RBACService {
  constructor(
    private businessRelationshipRepository: BusinessRelationshipRepository,
    private userRepository: UserRepository
  ) {}

  /**
   * Check if a user has permission to perform an action on a resource
   * Implements requirement 6.2, 7.3, 7.4 - Role-based access control
   */
  async checkPermission(userId: string, resource: string, action: string): Promise<boolean> {
    try {
      // Get user details
      const user = await this.userRepository.findById(userId);
      if (!user || user.status !== UserStatus.ACTIVE) {
        return false;
      }

      // Check role-based permissions first
      const hasRolePermission = await this.hasRolePermission(user.role, resource, action);
      if (!hasRolePermission) {
        return false;
      }

      // For relationship-specific resources, validate business relationships
      if (this.isRelationshipResource(resource)) {
        return await this.validateRelationshipPermission(userId, resource, action);
      }

      return true;
    } catch (error) {
      console.error('Error checking permission:', error);
      return false;
    }
  }

  /**
   * Get data accessible to a user based on their role and business relationships
   * Implements requirement 7.3, 7.4 - Role-based data access filtering
   */
  async getAccessibleData(userId: string, dataType: string): Promise<any[]> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user || user.status !== UserStatus.ACTIVE) {
        return [];
      }

      // Get user's business relationships
      const relationships = await this.getUserRelationships(userId, user.role);
      
      // Filter data based on role and relationships
      return await this.filterDataByAccess(userId, user.role, dataType, relationships);
    } catch (error) {
      console.error('Error getting accessible data:', error);
      return [];
    }
  }

  /**
   * Get dashboard configuration for a specific role
   * Implements requirement 4.1, 6.1, 7.1, 7.2 - Role-specific dashboard configurations
   */
  async getRoleDashboardConfig(userRole: UserRole): Promise<DashboardConfig> {
    try {
      return RBACValidation.getDefaultDashboardConfig(userRole);
    } catch (error) {
      console.error('Error getting dashboard config:', error);
      // Return minimal config on error
      return {
        role: userRole,
        widgets: [],
        permissions: [
          {
            resource: 'profile',
            actions: ['read']
          }
        ],
        navigation: [
          {
            id: 'dashboard',
            label: 'Dashboard',
            path: '/dashboard',
            permissions: ['dashboard:read']
          }
        ]
      };
    }
  }

  /**
   * Validate if a user can access another user's data based on business relationships
   * Implements requirement 6.2 - Business relationship validation for data access
   */
  async validateBusinessRelationshipAccess(userId: string, targetUserId: string): Promise<boolean> {
    try {
      if (userId === targetUserId) {
        return true; // Users can always access their own data
      }

      const user = await this.userRepository.findById(userId);
      const targetUser = await this.userRepository.findById(targetUserId);

      if (!user || !targetUser || user.status !== UserStatus.ACTIVE || targetUser.status !== UserStatus.ACTIVE) {
        return false;
      }

      // App Admin can access all data
      if (user.role === UserRole.APP_ADMIN) {
        return true;
      }

      // Check for direct business relationship
      const hasRelationship = await this.hasActiveRelationship(userId, targetUserId);
      if (hasRelationship) {
        return true;
      }

      // Special case: Field Managers can access their Farm Admin's data
      if (user.role === UserRole.FIELD_MANAGER && targetUser.role === UserRole.FARM_ADMIN) {
        return await this.isFieldManagerOfFarmAdmin(userId, targetUserId);
      }

      // Special case: Farm Admins can access their Field Managers' data
      if (user.role === UserRole.FARM_ADMIN && targetUser.role === UserRole.FIELD_MANAGER) {
        return await this.isFieldManagerOfFarmAdmin(targetUserId, userId);
      }

      return false;
    } catch (error) {
      console.error('Error validating business relationship access:', error);
      return false;
    }
  }

  /**
   * Get all permissions for a user based on their role and relationships
   */
  async getUserPermissions(userId: string): Promise<string[]> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user || user.status !== UserStatus.ACTIVE) {
        return [];
      }

      const dashboardConfig = await this.getRoleDashboardConfig(user.role);
      const permissions: string[] = [];

      // Extract permissions from dashboard config
      dashboardConfig.permissions.forEach(permission => {
        permission.actions.forEach(action => {
          permissions.push(`${permission.resource}:${action}`);
        });
      });

      // Add relationship-specific permissions
      const relationships = await this.getUserRelationships(userId, user.role);
      const relationshipPermissions = this.getRelationshipPermissions(user.role, relationships);
      permissions.push(...relationshipPermissions);

      return [...new Set(permissions)]; // Remove duplicates
    } catch (error) {
      console.error('Error getting user permissions:', error);
      return [];
    }
  }

  /**
   * Check if a role has permission for a resource and action
   */
  async hasRolePermission(userRole: UserRole, resource: string, action: string): Promise<boolean> {
    try {
      const dashboardConfig = await this.getRoleDashboardConfig(userRole);
      
      return dashboardConfig.permissions.some(permission => 
        permission.resource === resource && permission.actions.includes(action)
      );
    } catch (error) {
      console.error('Error checking role permission:', error);
      return false;
    }
  }

  // Private helper methods

  private isRelationshipResource(resource: string): boolean {
    const relationshipResources = [
      'field-operations',
      'supply-chain',
      'transactions',
      'communications',
      'commodity-delivery',
      'equipment-usage',
      'input-supply',
      'transportation'
    ];
    return relationshipResources.includes(resource);
  }

  private async validateRelationshipPermission(userId: string, resource: string, action: string): Promise<boolean> {
    // For relationship resources, we need to validate that the user has an active relationship
    // This is a simplified check - in practice, you'd extract the target resource ID and validate
    const relationships = await this.getUserRelationships(userId, null);
    return relationships.length > 0; // Simplified - has any active relationships
  }

  private async getUserRelationships(userId: string, userRole: UserRole | null): Promise<BusinessRelationship[]> {
    try {
      if (!userRole) {
        const user = await this.userRepository.findById(userId);
        userRole = user?.role || null;
      }

      if (!userRole) {
        return [];
      }

      // Get relationships based on role
      if (userRole === UserRole.FARM_ADMIN) {
        return await this.businessRelationshipRepository.findRelationshipsByFarmAdmin(userId);
      } else {
        return await this.businessRelationshipRepository.findRelationshipsByServiceProvider(userId);
      }
    } catch (error) {
      console.error('Error getting user relationships:', error);
      return [];
    }
  }

  private async filterDataByAccess(
    userId: string, 
    userRole: UserRole, 
    dataType: string, 
    relationships: BusinessRelationship[]
  ): Promise<any[]> {
    // This is a simplified implementation
    // In practice, you'd query the specific data repositories with proper filtering
    
    const accessibleData: any[] = [];
    
    // App Admin can see all data
    if (userRole === UserRole.APP_ADMIN) {
      // Return all data of the requested type (would query appropriate repository)
      return accessibleData;
    }

    // Filter based on relationships
    const relatedUserIds = relationships
      .filter(rel => rel.status === RelationshipStatus.ACTIVE)
      .map(rel => rel.farmAdminId === userId ? rel.serviceProviderId : rel.farmAdminId);

    // Add user's own data
    relatedUserIds.push(userId);

    // Query data repositories with user ID filters
    // This would be implemented with actual repository calls
    return accessibleData;
  }

  private async hasActiveRelationship(userId1: string, userId2: string): Promise<boolean> {
    try {
      const relationships1 = await this.businessRelationshipRepository.findRelationshipsByFarmAdmin(userId1);
      const relationships2 = await this.businessRelationshipRepository.findRelationshipsByServiceProvider(userId1);
      
      const allRelationships = [...relationships1, ...relationships2];
      
      return allRelationships.some(rel => 
        rel.status === RelationshipStatus.ACTIVE &&
        (
          (rel.farmAdminId === userId1 && rel.serviceProviderId === userId2) ||
          (rel.farmAdminId === userId2 && rel.serviceProviderId === userId1)
        )
      );
    } catch (error) {
      console.error('Error checking active relationship:', error);
      return false;
    }
  }

  private async isFieldManagerOfFarmAdmin(fieldManagerId: string, farmAdminId: string): Promise<boolean> {
    try {
      const relationships = await this.businessRelationshipRepository.findRelationshipsByFarmAdmin(farmAdminId);
      
      return relationships.some(rel => 
        rel.serviceProviderId === fieldManagerId &&
        rel.type === 'field_manager' &&
        rel.status === RelationshipStatus.ACTIVE
      );
    } catch (error) {
      console.error('Error checking field manager relationship:', error);
      return false;
    }
  }

  private getRelationshipPermissions(userRole: UserRole, relationships: BusinessRelationship[]): string[] {
    const permissions: string[] = [];

    if (relationships.length === 0) {
      return permissions;
    }

    // Add permissions based on active relationships
    const activeRelationships = relationships.filter(rel => rel.status === RelationshipStatus.ACTIVE);

    if (activeRelationships.length > 0) {
      permissions.push('relationships:read');
      
      if (userRole === UserRole.FARM_ADMIN) {
        permissions.push('relationships:manage');
        permissions.push('field-managers:invite');
        permissions.push('supply-chain:read');
        permissions.push('supply-chain:update');
      }

      if (userRole === UserRole.FIELD_MANAGER) {
        permissions.push('field-operations:read');
        permissions.push('field-operations:update');
      }

      // Add service provider permissions
      if ([UserRole.FARMER, UserRole.LORRY_AGENCY, UserRole.FIELD_EQUIPMENT_MANAGER, 
           UserRole.INPUT_SUPPLIER, UserRole.DEALER].includes(userRole)) {
        permissions.push('transactions:read');
        permissions.push('communications:read');
        permissions.push('communications:create');
      }
    }

    return permissions;
  }
}