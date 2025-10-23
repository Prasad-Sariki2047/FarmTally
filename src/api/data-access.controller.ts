import { SupplyChainData } from '../models';
import { SupplyChainDataType, AccessLevel } from '../models/common.types';
import { DataAccessService } from '../services/data-access.service';

export interface DataAccessController {
  // Data sharing and access
  shareData(farmAdminId: string, dataType: SupplyChainDataType, data: any): Promise<{ success: boolean; data?: SupplyChainData; error?: string }>;
  getAccessibleData(userId: string, dataType: SupplyChainDataType): Promise<{ success: boolean; data?: SupplyChainData[]; error?: string }>;
  updateSharedData(dataId: string, userId: string, updates: any): Promise<{ success: boolean; data?: SupplyChainData; error?: string }>;
  
  // Permission checks
  checkDataAccess(userId: string, dataId: string, accessType: 'read' | 'write' | 'delete'): Promise<{ success: boolean; hasAccess?: boolean; error?: string }>;
  getDataVisibility(userId: string, dataId: string): Promise<{ success: boolean; accessLevel?: AccessLevel; error?: string }>;
  
  // Field Manager synchronization
  syncFieldManagerData(fieldManagerId: string, farmAdminId: string): Promise<{ success: boolean; data?: SupplyChainData[]; error?: string }>;
}

export class DataAccessControllerImpl implements DataAccessController {
  constructor(
    private dataAccessService: DataAccessService
  ) {}

  /**
   * Share data with related users based on business relationships
   * Requirements: 5.4, 6.2, 8.3
   */
  async shareData(farmAdminId: string, dataType: SupplyChainDataType, data: any): Promise<{ success: boolean; data?: SupplyChainData; error?: string }> {
    try {
      // Validate input
      if (!farmAdminId || !dataType || !data) {
        return { success: false, error: 'Missing required parameters' };
      }

      const sharedData = await this.dataAccessService.shareDataWithRelatedUsers(farmAdminId, dataType, data);
      return { success: true, data: sharedData };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to share data' 
      };
    }
  }

  /**
   * Get accessible data for a user based on their relationships
   * Requirements: 5.4, 6.2, 6.5
   */
  async getAccessibleData(userId: string, dataType: SupplyChainDataType): Promise<{ success: boolean; data?: SupplyChainData[]; error?: string }> {
    try {
      if (!userId || !dataType) {
        return { success: false, error: 'Missing required parameters' };
      }

      const accessibleData = await this.dataAccessService.getAccessibleData(userId, dataType);
      return { success: true, data: accessibleData };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get accessible data' 
      };
    }
  }

  /**
   * Update shared data with permission checks
   * Requirements: 5.4, 6.2
   */
  async updateSharedData(dataId: string, userId: string, updates: any): Promise<{ success: boolean; data?: SupplyChainData; error?: string }> {
    try {
      if (!dataId || !userId || !updates) {
        return { success: false, error: 'Missing required parameters' };
      }

      const updatedData = await this.dataAccessService.updateSharedData(dataId, userId, updates);
      return { success: true, data: updatedData };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update shared data' 
      };
    }
  }

  /**
   * Check if user has access to specific data
   * Requirements: 6.2, 7.3, 7.4
   */
  async checkDataAccess(userId: string, dataId: string, accessType: 'read' | 'write' | 'delete'): Promise<{ success: boolean; hasAccess?: boolean; error?: string }> {
    try {
      if (!userId || !dataId || !accessType) {
        return { success: false, error: 'Missing required parameters' };
      }

      const hasAccess = await this.dataAccessService.checkDataAccess(userId, dataId, accessType);
      return { success: true, hasAccess };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to check data access' 
      };
    }
  }

  /**
   * Get data visibility level for a user
   * Requirements: 6.2, 7.3, 7.4
   */
  async getDataVisibility(userId: string, dataId: string): Promise<{ success: boolean; accessLevel?: AccessLevel; error?: string }> {
    try {
      if (!userId || !dataId) {
        return { success: false, error: 'Missing required parameters' };
      }

      const accessLevel = await this.dataAccessService.getDataVisibilityForUser(userId, dataId);
      return { success: true, accessLevel: accessLevel || undefined };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get data visibility' 
      };
    }
  }

  /**
   * Synchronize Field Manager data with Farm Admin
   * Requirements: 5.4, 6.2, 6.5
   */
  async syncFieldManagerData(fieldManagerId: string, farmAdminId: string): Promise<{ success: boolean; data?: SupplyChainData[]; error?: string }> {
    try {
      if (!fieldManagerId || !farmAdminId) {
        return { success: false, error: 'Missing required parameters' };
      }

      const syncedData = await this.dataAccessService.syncFieldManagerData(fieldManagerId, farmAdminId);
      return { success: true, data: syncedData };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to sync Field Manager data' 
      };
    }
  }
}