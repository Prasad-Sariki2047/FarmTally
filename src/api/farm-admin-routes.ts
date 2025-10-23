import { FarmAdminDashboardComponentImpl } from '../components/farm-admin-dashboard.component';
import { DashboardControllerImpl } from './dashboard.controller';
import { BusinessRelationshipService } from '../services/business-relationship.service';
import { SupplyChainRepository } from '../repositories/supply-chain.repository';
import { WidgetRendererImpl } from '../services/widget-renderer.service';

/**
 * Farm Admin API Routes
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5 - Farm Admin central dashboard API endpoints
 */
export interface FarmAdminRoutes {
  // Dashboard endpoints
  getDashboard(farmAdminId: string): Promise<{ success: boolean; data?: any; error?: string }>;
  refreshDashboard(farmAdminId: string): Promise<{ success: boolean; data?: any; error?: string }>;
  
  // Business relationship management endpoints
  getBusinessRelationships(farmAdminId: string): Promise<{ success: boolean; data?: any; error?: string }>;
  getPendingRelationshipRequests(farmAdminId: string): Promise<{ success: boolean; data?: any; error?: string }>;
  approveRelationshipRequest(relationshipId: string, farmAdminId: string): Promise<{ success: boolean; message: string }>;
  rejectRelationshipRequest(relationshipId: string, farmAdminId: string, reason: string): Promise<{ success: boolean; message: string }>;
  terminateRelationship(relationshipId: string, reason: string): Promise<{ success: boolean; message: string }>;
  
  // Field Manager management endpoints
  getFieldManagers(farmAdminId: string): Promise<{ success: boolean; data?: any; error?: string }>;
  inviteFieldManager(farmAdminId: string, email: string): Promise<{ success: boolean; message: string }>;
  getPendingInvitations(farmAdminId: string): Promise<{ success: boolean; data?: any; error?: string }>;
  
  // Supply chain endpoints
  getSupplyChainStatus(farmAdminId: string): Promise<{ success: boolean; data?: any; error?: string }>;
  getCommodityDeliveries(farmAdminId: string, filters?: any): Promise<{ success: boolean; data?: any; error?: string }>;
  getTransactions(farmAdminId: string, filters?: any): Promise<{ success: boolean; data?: any; error?: string }>;
  
  // Service provider management endpoints
  getServiceProviders(farmAdminId: string): Promise<{ success: boolean; data?: any; error?: string }>;
  getServiceProvidersByType(farmAdminId: string, type: string): Promise<{ success: boolean; data?: any; error?: string }>;
}

export class FarmAdminRoutesImpl implements FarmAdminRoutes {
  private farmAdminDashboard: FarmAdminDashboardComponentImpl;

  constructor(
    dashboardController: DashboardControllerImpl,
    businessRelationshipService: BusinessRelationshipService,
    supplyChainRepository: SupplyChainRepository,
    widgetRenderer: WidgetRendererImpl
  ) {
    this.farmAdminDashboard = new FarmAdminDashboardComponentImpl(
      dashboardController,
      businessRelationshipService,
      supplyChainRepository,
      widgetRenderer
    );
  }

  /**
   * Get Farm Admin dashboard data
   * Requirements: 4.1 - Business relationship overview and central management
   */
  async getDashboard(farmAdminId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      if (!farmAdminId || farmAdminId.trim().length === 0) {
        return {
          success: false,
          error: 'Farm Admin ID is required'
        };
      }

      const dashboardData = await this.farmAdminDashboard.loadDashboard(farmAdminId);
      
      return {
        success: true,
        data: dashboardData
      };
    } catch (error) {
      console.error('Error getting Farm Admin dashboard:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load dashboard'
      };
    }
  }

  /**
   * Refresh Farm Admin dashboard data
   */
  async refreshDashboard(farmAdminId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      if (!farmAdminId || farmAdminId.trim().length === 0) {
        return {
          success: false,
          error: 'Farm Admin ID is required'
        };
      }

      const dashboardData = await this.farmAdminDashboard.refreshDashboard(farmAdminId);
      
      return {
        success: true,
        data: dashboardData
      };
    } catch (error) {
      console.error('Error refreshing Farm Admin dashboard:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to refresh dashboard'
      };
    }
  }

  /**
   * Get business relationships overview
   * Requirements: 4.1, 4.2 - Business relationship overview and management
   */
  async getBusinessRelationships(farmAdminId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      if (!farmAdminId || farmAdminId.trim().length === 0) {
        return {
          success: false,
          error: 'Farm Admin ID is required'
        };
      }

      const dashboardData = await this.farmAdminDashboard.loadDashboard(farmAdminId);
      
      return {
        success: true,
        data: dashboardData.businessRelationships
      };
    } catch (error) {
      console.error('Error getting business relationships:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load business relationships'
      };
    }
  }

  /**
   * Get pending relationship requests
   * Requirements: 8.2 - Farm Admin approval interface for relationships
   */
  async getPendingRelationshipRequests(farmAdminId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      if (!farmAdminId || farmAdminId.trim().length === 0) {
        return {
          success: false,
          error: 'Farm Admin ID is required'
        };
      }

      const dashboardData = await this.farmAdminDashboard.loadDashboard(farmAdminId);
      
      return {
        success: true,
        data: {
          pendingRequests: dashboardData.businessRelationships.pendingRequests,
          count: dashboardData.businessRelationships.pendingRequests.length,
          urgentCount: dashboardData.businessRelationships.pendingRequests.filter(r => r.isUrgent).length
        }
      };
    } catch (error) {
      console.error('Error getting pending relationship requests:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load pending requests'
      };
    }
  }

  /**
   * Approve relationship request
   * Requirements: 8.2, 8.3 - Farm Admin approval interface for relationships
   */
  async approveRelationshipRequest(relationshipId: string, farmAdminId: string): Promise<{ success: boolean; message: string }> {
    try {
      if (!relationshipId || relationshipId.trim().length === 0) {
        return {
          success: false,
          message: 'Relationship ID is required'
        };
      }

      if (!farmAdminId || farmAdminId.trim().length === 0) {
        return {
          success: false,
          message: 'Farm Admin ID is required'
        };
      }

      return await this.farmAdminDashboard.approveRelationshipRequest(relationshipId, farmAdminId);
    } catch (error) {
      console.error('Error approving relationship request:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to approve relationship request'
      };
    }
  }

  /**
   * Reject relationship request
   * Requirements: 8.2, 8.3 - Farm Admin approval interface for relationships
   */
  async rejectRelationshipRequest(relationshipId: string, farmAdminId: string, reason: string): Promise<{ success: boolean; message: string }> {
    try {
      if (!relationshipId || relationshipId.trim().length === 0) {
        return {
          success: false,
          message: 'Relationship ID is required'
        };
      }

      if (!farmAdminId || farmAdminId.trim().length === 0) {
        return {
          success: false,
          message: 'Farm Admin ID is required'
        };
      }

      if (!reason || reason.trim().length === 0) {
        return {
          success: false,
          message: 'Rejection reason is required'
        };
      }

      return await this.farmAdminDashboard.rejectRelationshipRequest(relationshipId, farmAdminId, reason);
    } catch (error) {
      console.error('Error rejecting relationship request:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to reject relationship request'
      };
    }
  }

  /**
   * Terminate existing relationship
   * Requirements: 4.2, 4.3 - Business relationship management
   */
  async terminateRelationship(relationshipId: string, reason: string): Promise<{ success: boolean; message: string }> {
    try {
      if (!relationshipId || relationshipId.trim().length === 0) {
        return {
          success: false,
          message: 'Relationship ID is required'
        };
      }

      if (!reason || reason.trim().length === 0) {
        return {
          success: false,
          message: 'Termination reason is required'
        };
      }

      return await this.farmAdminDashboard.terminateRelationship(relationshipId, reason);
    } catch (error) {
      console.error('Error terminating relationship:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to terminate relationship'
      };
    }
  }

  /**
   * Get Field Managers
   * Requirements: 4.2, 4.3 - Field Manager management interfaces
   */
  async getFieldManagers(farmAdminId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      if (!farmAdminId || farmAdminId.trim().length === 0) {
        return {
          success: false,
          error: 'Farm Admin ID is required'
        };
      }

      const dashboardData = await this.farmAdminDashboard.loadDashboard(farmAdminId);
      
      return {
        success: true,
        data: dashboardData.fieldManagerManagement
      };
    } catch (error) {
      console.error('Error getting Field Managers:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load Field Managers'
      };
    }
  }

  /**
   * Invite Field Manager
   * Requirements: 5.1, 5.2, 5.3 - Field Manager invitation system
   */
  async inviteFieldManager(farmAdminId: string, email: string): Promise<{ success: boolean; message: string }> {
    try {
      if (!farmAdminId || farmAdminId.trim().length === 0) {
        return {
          success: false,
          message: 'Farm Admin ID is required'
        };
      }

      if (!email || email.trim().length === 0) {
        return {
          success: false,
          message: 'Email address is required'
        };
      }

      return await this.farmAdminDashboard.inviteFieldManager(farmAdminId, email);
    } catch (error) {
      console.error('Error inviting Field Manager:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to send invitation'
      };
    }
  }

  /**
   * Get pending invitations
   * Requirements: 5.2, 5.3 - Field Manager invitation workflow
   */
  async getPendingInvitations(farmAdminId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      if (!farmAdminId || farmAdminId.trim().length === 0) {
        return {
          success: false,
          error: 'Farm Admin ID is required'
        };
      }

      const dashboardData = await this.farmAdminDashboard.loadDashboard(farmAdminId);
      
      return {
        success: true,
        data: {
          pendingInvitations: dashboardData.fieldManagerManagement.pendingInvitations,
          count: dashboardData.fieldManagerManagement.pendingInvitations.length,
          expiredCount: dashboardData.fieldManagerManagement.pendingInvitations.filter(inv => inv.isExpired).length
        }
      };
    } catch (error) {
      console.error('Error getting pending invitations:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load pending invitations'
      };
    }
  }

  /**
   * Get supply chain status
   * Requirements: 4.4, 4.5 - Supply chain status display
   */
  async getSupplyChainStatus(farmAdminId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      if (!farmAdminId || farmAdminId.trim().length === 0) {
        return {
          success: false,
          error: 'Farm Admin ID is required'
        };
      }

      const dashboardData = await this.farmAdminDashboard.loadDashboard(farmAdminId);
      
      return {
        success: true,
        data: dashboardData.supplyChainStatus
      };
    } catch (error) {
      console.error('Error getting supply chain status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load supply chain status'
      };
    }
  }

  /**
   * Get commodity deliveries with optional filters
   * Requirements: 4.4, 4.5 - Supply chain status display
   */
  async getCommodityDeliveries(farmAdminId: string, filters?: any): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      if (!farmAdminId || farmAdminId.trim().length === 0) {
        return {
          success: false,
          error: 'Farm Admin ID is required'
        };
      }

      const dashboardData = await this.farmAdminDashboard.loadDashboard(farmAdminId);
      let deliveries = dashboardData.supplyChainStatus.commodityDeliveries;

      // Apply filters if provided
      if (filters) {
        if (filters.status) {
          deliveries = deliveries.filter((d: any) => d.status === filters.status);
        }
        if (filters.overdue === 'true') {
          deliveries = deliveries.filter((d: any) => d.isOverdue);
        }
        if (filters.commodityType) {
          deliveries = deliveries.filter((d: any) => 
            d.commodityType.toLowerCase().includes(filters.commodityType.toLowerCase())
          );
        }
      }
      
      return {
        success: true,
        data: {
          deliveries,
          count: deliveries.length,
          filters: filters || {}
        }
      };
    } catch (error) {
      console.error('Error getting commodity deliveries:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load commodity deliveries'
      };
    }
  }

  /**
   * Get transactions with optional filters
   * Requirements: 4.4, 4.5 - Supply chain status display
   */
  async getTransactions(farmAdminId: string, filters?: any): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      if (!farmAdminId || farmAdminId.trim().length === 0) {
        return {
          success: false,
          error: 'Farm Admin ID is required'
        };
      }

      const dashboardData = await this.farmAdminDashboard.loadDashboard(farmAdminId);
      let transactions = dashboardData.supplyChainStatus.recentTransactions;

      // Apply filters if provided
      if (filters) {
        if (filters.status) {
          transactions = transactions.filter((t: any) => t.status === filters.status);
        }
        if (filters.type) {
          transactions = transactions.filter((t: any) => t.type === filters.type);
        }
        if (filters.pending === 'true') {
          transactions = transactions.filter((t: any) => t.status === 'pending');
        }
      }
      
      return {
        success: true,
        data: {
          transactions,
          count: transactions.length,
          filters: filters || {}
        }
      };
    } catch (error) {
      console.error('Error getting transactions:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load transactions'
      };
    }
  }

  /**
   * Get service providers
   * Requirements: 4.2, 4.3 - Service provider management interfaces
   */
  async getServiceProviders(farmAdminId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      if (!farmAdminId || farmAdminId.trim().length === 0) {
        return {
          success: false,
          error: 'Farm Admin ID is required'
        };
      }

      const dashboardData = await this.farmAdminDashboard.loadDashboard(farmAdminId);
      
      return {
        success: true,
        data: dashboardData.serviceProviderManagement
      };
    } catch (error) {
      console.error('Error getting service providers:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load service providers'
      };
    }
  }

  /**
   * Get service providers by type
   * Requirements: 4.2, 4.3 - Service provider management interfaces
   */
  async getServiceProvidersByType(farmAdminId: string, type: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      if (!farmAdminId || farmAdminId.trim().length === 0) {
        return {
          success: false,
          error: 'Farm Admin ID is required'
        };
      }

      if (!type || type.trim().length === 0) {
        return {
          success: false,
          error: 'Service provider type is required'
        };
      }

      const dashboardData = await this.farmAdminDashboard.loadDashboard(farmAdminId);
      const providersByType = dashboardData.serviceProviderManagement.providersByType;
      
      return {
        success: true,
        data: {
          type,
          providers: (providersByType as any)[type] || [],
          count: ((providersByType as any)[type] || []).length
        }
      };
    } catch (error) {
      console.error('Error getting service providers by type:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load service providers by type'
      };
    }
  }
}