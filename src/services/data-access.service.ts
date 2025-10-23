import { BusinessRelationship, SupplyChainData, DataVisibility, User } from '../models';
import { RelationshipType, UserRole, AccessLevel, SupplyChainDataType } from '../models/common.types';
import { BusinessRelationshipService } from './business-relationship.service';
import { UserManagementService } from './user-management.service';
import { SupplyChainRepository } from '../repositories/supply-chain.repository';

export interface DataAccessService {
  // Data sharing based on relationships
  shareDataWithRelatedUsers(farmAdminId: string, dataType: SupplyChainDataType, data: any): Promise<SupplyChainData>;
  getAccessibleData(userId: string, dataType: SupplyChainDataType): Promise<SupplyChainData[]>;
  updateSharedData(dataId: string, userId: string, updates: any): Promise<SupplyChainData>;
  
  // Permission enforcement
  checkDataAccess(userId: string, dataId: string, accessType: 'read' | 'write' | 'delete'): Promise<boolean>;
  getDataVisibilityForUser(userId: string, dataId: string): Promise<AccessLevel | null>;
  
  // Real-time synchronization for Field Managers
  syncFieldManagerData(fieldManagerId: string, farmAdminId: string): Promise<SupplyChainData[]>;
  notifyDataUpdate(dataId: string, updatedBy: string): Promise<void>;
}

export class DataAccessServiceImpl implements DataAccessService {
  constructor(
    private businessRelationshipService: BusinessRelationshipService,
    private userManagementService: UserManagementService,
    private supplyChainRepository: SupplyChainRepository
  ) {}

  /**
   * Share data with related users based on business relationships
   * Requirements: 5.4, 6.2, 8.3
   */
  async shareDataWithRelatedUsers(farmAdminId: string, dataType: SupplyChainDataType, data: any): Promise<SupplyChainData> {
    // Validate Farm Admin
    const farmAdmin = await this.userManagementService.getUserById(farmAdminId);
    if (!farmAdmin || farmAdmin.role !== UserRole.FARM_ADMIN) {
      throw new Error('Only Farm Admins can share data');
    }

    // Get all active relationships for the Farm Admin
    const relationships = await this.businessRelationshipService.getRelationships(farmAdminId);
    const activeRelationships = relationships.filter(rel => rel.status === 'active');

    // Determine data visibility based on relationships and data type
    const visibility = this.calculateDataVisibility(activeRelationships, dataType);

    // Create supply chain data record
    const supplyChainData: SupplyChainData = {
      id: this.generateId(),
      farmAdminId,
      type: dataType,
      data,
      visibility,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const savedData = await this.supplyChainRepository.createSupplyChainData(supplyChainData);

    // Notify related users of new data
    await this.notifyRelatedUsersOfNewData(savedData, activeRelationships);

    return savedData;
  }

  /**
   * Get accessible data for a user based on their relationships
   * Requirements: 5.4, 6.2, 6.5
   */
  async getAccessibleData(userId: string, dataType: SupplyChainDataType): Promise<SupplyChainData[]> {
    const user = await this.userManagementService.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    let accessibleData: SupplyChainData[] = [];

    if (user.role === UserRole.FARM_ADMIN) {
      // Farm Admins can access their own data
      accessibleData = await this.supplyChainRepository.findByFarmAdminAndType(userId, dataType);
    } else {
      // Service providers and Field Managers access data through relationships
      const relationships = await this.businessRelationshipService.getRelationships(userId);
      const activeRelationships = relationships.filter(rel => rel.status === 'active');

      for (const relationship of activeRelationships) {
        const farmAdminData = await this.supplyChainRepository.findByFarmAdminAndType(relationship.farmAdminId, dataType);
        
        // Filter data based on visibility permissions
        const visibleData = farmAdminData.filter(data => 
          this.hasDataAccess(userId, user.role, data.visibility)
        );
        
        accessibleData.push(...visibleData);
      }
    }

    return accessibleData;
  }

  /**
   * Update shared data with permission checks
   * Requirements: 5.4, 6.2
   */
  async updateSharedData(dataId: string, userId: string, updates: any): Promise<SupplyChainData> {
    // Check write permission
    const hasWriteAccess = await this.checkDataAccess(userId, dataId, 'write');
    if (!hasWriteAccess) {
      throw new Error('Insufficient permissions to update this data');
    }

    const existingData = await this.supplyChainRepository.findById(dataId);
    if (!existingData) {
      throw new Error('Data not found');
    }

    // Update the data
    const updatedData = await this.supplyChainRepository.updateSupplyChainData(dataId, {
      data: { ...existingData.data, ...updates },
      updatedAt: new Date()
    });

    // Notify related users of the update
    await this.notifyDataUpdate(dataId, userId);

    return updatedData;
  }

  /**
   * Check if user has access to specific data
   * Requirements: 6.2, 7.3, 7.4
   */
  async checkDataAccess(userId: string, dataId: string, accessType: 'read' | 'write' | 'delete'): Promise<boolean> {
    const data = await this.supplyChainRepository.findById(dataId);
    if (!data) {
      return false;
    }

    const user = await this.userManagementService.getUserById(userId);
    if (!user) {
      return false;
    }

    // Farm Admin has full access to their own data
    if (user.role === UserRole.FARM_ADMIN && data.farmAdminId === userId) {
      return true;
    }

    // Check visibility permissions
    const userVisibility = data.visibility.find(v => v.userId === userId);
    if (!userVisibility) {
      return false;
    }

    // Check access level
    switch (accessType) {
      case 'read':
        return [AccessLevel.READ_ONLY, AccessLevel.READ_WRITE, AccessLevel.FULL_ACCESS].includes(userVisibility.accessLevel);
      case 'write':
        return [AccessLevel.READ_WRITE, AccessLevel.FULL_ACCESS].includes(userVisibility.accessLevel);
      case 'delete':
        return userVisibility.accessLevel === AccessLevel.FULL_ACCESS;
      default:
        return false;
    }
  }

  /**
   * Get data visibility level for a user
   * Requirements: 6.2, 7.3, 7.4
   */
  async getDataVisibilityForUser(userId: string, dataId: string): Promise<AccessLevel | null> {
    const data = await this.supplyChainRepository.findById(dataId);
    if (!data) {
      return null;
    }

    const userVisibility = data.visibility.find(v => v.userId === userId);
    return userVisibility ? userVisibility.accessLevel : null;
  }

  /**
   * Synchronize Field Manager data with Farm Admin
   * Requirements: 5.4, 6.2, 6.5
   */
  async syncFieldManagerData(fieldManagerId: string, farmAdminId: string): Promise<SupplyChainData[]> {
    // Verify Field Manager relationship with Farm Admin
    const relationships = await this.businessRelationshipService.getRelationships(fieldManagerId);
    const fieldManagerRelationship = relationships.find(
      rel => rel.farmAdminId === farmAdminId && 
             rel.type === RelationshipType.FIELD_MANAGER && 
             rel.status === 'active'
    );

    if (!fieldManagerRelationship) {
      throw new Error('No active Field Manager relationship found');
    }

    // Get all field operations data that Field Manager can access
    const fieldOperationsData = await this.getAccessibleData(fieldManagerId, SupplyChainDataType.FIELD_OPERATIONS);
    
    return fieldOperationsData;
  }

  /**
   * Notify related users of data updates
   * Requirements: 5.4, 6.5
   */
  async notifyDataUpdate(dataId: string, updatedBy: string): Promise<void> {
    const data = await this.supplyChainRepository.findById(dataId);
    if (!data) {
      return;
    }

    const updatedByUser = await this.userManagementService.getUserById(updatedBy);
    if (!updatedByUser) {
      return;
    }

    // Notify all users who have visibility to this data
    for (const visibility of data.visibility) {
      if (visibility.userId !== updatedBy) {
        const user = await this.userManagementService.getUserById(visibility.userId);
        if (user) {
          await this.sendDataUpdateNotification(user, updatedByUser, data);
        }
      }
    }
  }

  /**
   * Calculate data visibility based on relationships and data type
   */
  private calculateDataVisibility(relationships: BusinessRelationship[], dataType: SupplyChainDataType): DataVisibility[] {
    const visibility: DataVisibility[] = [];

    for (const relationship of relationships) {
      const accessLevel = this.getAccessLevelForRelationshipAndDataType(relationship.type, dataType);
      
      if (accessLevel) {
        visibility.push({
          userId: relationship.serviceProviderId,
          userRole: this.getUserRoleFromRelationshipType(relationship.type),
          accessLevel
        });
      }
    }

    return visibility;
  }

  /**
   * Get access level based on relationship type and data type
   */
  private getAccessLevelForRelationshipAndDataType(relationshipType: RelationshipType, dataType: SupplyChainDataType): AccessLevel | null {
    const accessMatrix: Record<RelationshipType, Partial<Record<SupplyChainDataType, AccessLevel>>> = {
      [RelationshipType.FIELD_MANAGER]: {
        [SupplyChainDataType.FIELD_OPERATIONS]: AccessLevel.READ_WRITE,
        [SupplyChainDataType.EQUIPMENT_USAGE]: AccessLevel.READ_WRITE,
        [SupplyChainDataType.INPUT_SUPPLY]: AccessLevel.READ_ONLY
      },
      [RelationshipType.FARMER_SUPPLIER]: {
        [SupplyChainDataType.COMMODITY_DELIVERY]: AccessLevel.READ_WRITE,
        [SupplyChainDataType.FIELD_OPERATIONS]: AccessLevel.READ_ONLY
      },
      [RelationshipType.LORRY_AGENCY]: {
        [SupplyChainDataType.TRANSPORTATION]: AccessLevel.READ_WRITE,
        [SupplyChainDataType.COMMODITY_DELIVERY]: AccessLevel.READ_ONLY
      },
      [RelationshipType.EQUIPMENT_PROVIDER]: {
        [SupplyChainDataType.EQUIPMENT_USAGE]: AccessLevel.READ_WRITE,
        [SupplyChainDataType.FIELD_OPERATIONS]: AccessLevel.READ_ONLY
      },
      [RelationshipType.INPUT_SUPPLIER]: {
        [SupplyChainDataType.INPUT_SUPPLY]: AccessLevel.READ_WRITE,
        [SupplyChainDataType.FIELD_OPERATIONS]: AccessLevel.READ_ONLY
      },
      [RelationshipType.DEALER]: {
        [SupplyChainDataType.SALES_TRANSACTION]: AccessLevel.READ_WRITE,
        [SupplyChainDataType.COMMODITY_DELIVERY]: AccessLevel.READ_ONLY
      }
    };

    return accessMatrix[relationshipType]?.[dataType] || null;
  }

  /**
   * Get user role from relationship type
   */
  private getUserRoleFromRelationshipType(relationshipType: RelationshipType): UserRole {
    const roleMapping: Record<RelationshipType, UserRole> = {
      [RelationshipType.FIELD_MANAGER]: UserRole.FIELD_MANAGER,
      [RelationshipType.FARMER_SUPPLIER]: UserRole.FARMER,
      [RelationshipType.LORRY_AGENCY]: UserRole.LORRY_AGENCY,
      [RelationshipType.EQUIPMENT_PROVIDER]: UserRole.FIELD_EQUIPMENT_MANAGER,
      [RelationshipType.INPUT_SUPPLIER]: UserRole.INPUT_SUPPLIER,
      [RelationshipType.DEALER]: UserRole.DEALER
    };

    return roleMapping[relationshipType];
  }

  /**
   * Check if user has access to data based on visibility
   */
  private hasDataAccess(userId: string, userRole: UserRole, visibility: DataVisibility[]): boolean {
    return visibility.some(v => v.userId === userId || v.userRole === userRole);
  }

  /**
   * Notify related users of new data
   */
  private async notifyRelatedUsersOfNewData(data: SupplyChainData, relationships: BusinessRelationship[]): Promise<void> {
    for (const relationship of relationships) {
      const user = await this.userManagementService.getUserById(relationship.serviceProviderId);
      if (user) {
        // Send notification about new shared data
        console.log(`Notifying ${user.email} about new ${data.type} data`);
      }
    }
  }

  /**
   * Send data update notification
   */
  private async sendDataUpdateNotification(recipient: User, updatedBy: User, data: SupplyChainData): Promise<void> {
    // In a real implementation, this would send email/push notifications
    console.log(`Notifying ${recipient.email} that ${updatedBy.fullName} updated ${data.type} data`);
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `data_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}