import { DashboardWidget, Permission } from '../models/rbac.model';
import { BusinessRelationship } from '../models/business.model';
import { UserRole, WidgetType, RelationshipStatus } from '../models/common.types';
import { BusinessRelationshipRepository } from '../repositories/business-relationship.repository';

export interface WidgetRenderer {
  renderWidget(widget: DashboardWidget, userId: string, userRole: UserRole): Promise<RenderedWidget>;
  validateWidgetPermissions(widget: DashboardWidget, userPermissions: string[]): boolean;
  getWidgetData(widget: DashboardWidget, userId: string, userRole: UserRole): Promise<any>;
}

export interface RenderedWidget {
  id: string;
  type: WidgetType;
  title: string;
  data: any;
  config: any;
  permissions: string[];
  isVisible: boolean;
  isInteractive: boolean;
  lastUpdated: Date;
}

export class WidgetRendererImpl implements WidgetRenderer {
  constructor(
    private businessRelationshipRepository: BusinessRelationshipRepository
  ) {}

  /**
   * Render a widget with data and configuration for a specific user
   * Implements requirement 7.1, 7.2 - Dynamic dashboard rendering based on role
   */
  async renderWidget(widget: DashboardWidget, userId: string, userRole: UserRole): Promise<RenderedWidget> {
    try {
      // Get widget data based on type and user context
      const data = await this.getWidgetData(widget, userId, userRole);
      
      // Determine if widget is interactive based on permissions and role
      const isInteractive = this.isWidgetInteractive(widget, userRole);
      
      return {
        id: widget.id,
        type: widget.type,
        title: widget.title,
        data,
        config: widget.config,
        permissions: widget.permissions,
        isVisible: true,
        isInteractive,
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error(`Error rendering widget ${widget.id}:`, error);
      
      // Return error widget
      return {
        id: widget.id,
        type: widget.type,
        title: widget.title,
        data: { error: 'Failed to load widget data' },
        config: widget.config,
        permissions: widget.permissions,
        isVisible: true,
        isInteractive: false,
        lastUpdated: new Date()
      };
    }
  }

  /**
   * Validate if user has permissions to view a widget
   */
  validateWidgetPermissions(widget: DashboardWidget, userPermissions: string[]): boolean {
    return widget.permissions.every(permission => 
      userPermissions.includes(permission)
    );
  }

  /**
   * Get data for a specific widget type
   * Implements requirement 7.1, 7.2 - Widget and navigation permissions
   */
  async getWidgetData(widget: DashboardWidget, userId: string, userRole: UserRole): Promise<any> {
    switch (widget.type) {
      case WidgetType.PENDING_APPROVALS:
        return await this.getPendingApprovalsData(userId, userRole, widget.config);
      
      case WidgetType.RELATIONSHIP_OVERVIEW:
        return await this.getRelationshipOverviewData(userId, userRole, widget.config);
      
      case WidgetType.SUPPLY_CHAIN_STATUS:
        return await this.getSupplyChainStatusData(userId, userRole, widget.config);
      
      case WidgetType.RECENT_TRANSACTIONS:
        return await this.getRecentTransactionsData(userId, userRole, widget.config);
      
      case WidgetType.FIELD_OPERATIONS:
        return await this.getFieldOperationsData(userId, userRole, widget.config);
      
      case WidgetType.COMMODITY_SCHEDULE:
        return await this.getCommodityScheduleData(userId, userRole, widget.config);
      
      default:
        return { message: 'Widget type not supported' };
    }
  }

  // Private widget data methods

  private async getPendingApprovalsData(userId: string, userRole: UserRole, config: any): Promise<any> {
    if (userRole !== UserRole.APP_ADMIN) {
      return { count: 0, items: [] };
    }

    try {
      // This would integrate with the approval workflow service
      // For now, return structured data that matches the App Admin requirements
      const pendingRequests = [
        {
          id: 'req_001',
          applicantName: 'John Doe',
          email: 'john.doe@example.com',
          role: UserRole.FARM_ADMIN,
          submittedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          profileData: {
            businessName: 'Green Valley Farm',
            farmSize: 150,
            cropTypes: ['maize', 'wheat']
          }
        },
        {
          id: 'req_002',
          applicantName: 'Jane Smith',
          email: 'jane.smith@example.com',
          role: UserRole.FIELD_MANAGER,
          submittedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          profileData: {
            experience: 5,
            specializations: ['crop management', 'irrigation']
          }
        },
        {
          id: 'req_003',
          applicantName: 'Mike Johnson',
          email: 'mike.johnson@example.com',
          role: UserRole.INPUT_SUPPLIER,
          submittedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
          profileData: {
            businessName: 'AgriSupply Co',
            serviceAreas: ['fertilizers', 'seeds'],
            certifications: ['ISO 9001']
          }
        }
      ];

      // Group by role for summary
      const roleGroups = pendingRequests.reduce((acc, req) => {
        acc[req.role] = (acc[req.role] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        count: pendingRequests.length,
        items: pendingRequests,
        summary: {
          farmAdmins: roleGroups[UserRole.FARM_ADMIN] || 0,
          fieldManagers: roleGroups[UserRole.FIELD_MANAGER] || 0,
          farmers: roleGroups[UserRole.FARMER] || 0,
          serviceProviders: (roleGroups[UserRole.LORRY_AGENCY] || 0) + 
                           (roleGroups[UserRole.FIELD_EQUIPMENT_MANAGER] || 0) + 
                           (roleGroups[UserRole.INPUT_SUPPLIER] || 0) + 
                           (roleGroups[UserRole.DEALER] || 0)
        },
        urgentCount: pendingRequests.filter(req => 
          Date.now() - req.submittedAt.getTime() > 7 * 24 * 60 * 60 * 1000
        ).length,
        recentCount: pendingRequests.filter(req => 
          Date.now() - req.submittedAt.getTime() < 24 * 60 * 60 * 1000
        ).length
      };
    } catch (error) {
      console.error('Error getting pending approvals data:', error);
      return { count: 0, items: [], summary: {}, urgentCount: 0, recentCount: 0 };
    }
  }

  private async getRelationshipOverviewData(userId: string, userRole: UserRole, config: any): Promise<any> {
    try {
      let relationships: BusinessRelationship[] = [];

      if (userRole === UserRole.FARM_ADMIN) {
        relationships = await this.businessRelationshipRepository.findRelationshipsByFarmAdmin(userId);
      } else {
        relationships = await this.businessRelationshipRepository.findRelationshipsByServiceProvider(userId);
      }

      const activeRelationships = relationships.filter(rel => rel.status === RelationshipStatus.ACTIVE);
      
      return {
        total: relationships.length,
        active: activeRelationships.length,
        pending: relationships.filter(rel => rel.status === 'pending').length,
        byType: this.groupRelationshipsByType(activeRelationships),
        recentActivity: this.getRecentRelationshipActivity(relationships),
        summary: {
          fieldManagers: activeRelationships.filter(rel => rel.type === 'field_manager').length,
          farmers: activeRelationships.filter(rel => rel.type === 'farmer_supplier').length,
          serviceProviders: activeRelationships.filter(rel => 
            ['lorry_agency', 'equipment_provider', 'input_supplier', 'dealer'].includes(rel.type)
          ).length
        }
      };
    } catch (error) {
      console.error('Error getting relationship overview data:', error);
      return { total: 0, active: 0, pending: 0, byType: {}, recentActivity: [], summary: {} };
    }
  }

  private async getSupplyChainStatusData(userId: string, userRole: UserRole, config: any): Promise<any> {
    // This would integrate with supply chain data repositories
    return {
      status: 'operational',
      stages: {
        inputSupply: { status: 'active', count: 3 },
        fieldOperations: { status: 'active', count: 5 },
        harvest: { status: 'scheduled', count: 2 },
        transportation: { status: 'active', count: 1 },
        sales: { status: 'pending', count: 4 }
      },
      alerts: [
        {
          type: 'warning',
          message: 'Fertilizer delivery delayed by 2 days',
          timestamp: new Date()
        }
      ],
      metrics: {
        efficiency: 85,
        onTimeDelivery: 92,
        qualityScore: 88
      }
    };
  }

  private async getRecentTransactionsData(userId: string, userRole: UserRole, config: any): Promise<any> {
    const limit = config.limit || 10;
    
    // This would query transaction repositories
    return {
      transactions: [
        {
          id: '1',
          type: 'commodity_purchase',
          description: 'Maize purchase from Green Valley Farm',
          amount: 15000,
          currency: 'USD',
          date: new Date(),
          status: 'completed',
          counterparty: 'Green Valley Farm'
        },
        {
          id: '2',
          type: 'service_payment',
          description: 'Transportation service payment',
          amount: 500,
          currency: 'USD',
          date: new Date(),
          status: 'pending',
          counterparty: 'Swift Logistics'
        }
      ],
      summary: {
        totalAmount: 15500,
        completedCount: 1,
        pendingCount: 1,
        currency: 'USD'
      },
      trends: {
        thisMonth: 25000,
        lastMonth: 22000,
        growth: 13.6
      }
    };
  }

  private async getFieldOperationsData(userId: string, userRole: UserRole, config: any): Promise<any> {
    // This would integrate with field operations repositories
    return {
      currentOperations: [
        {
          id: '1',
          type: 'planting',
          crop: 'maize',
          field: 'Field A',
          progress: 75,
          startDate: new Date(),
          estimatedCompletion: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
        },
        {
          id: '2',
          type: 'fertilizing',
          crop: 'wheat',
          field: 'Field B',
          progress: 100,
          startDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          completedDate: new Date()
        }
      ],
      upcomingTasks: [
        {
          id: '3',
          type: 'irrigation',
          crop: 'maize',
          field: 'Field A',
          scheduledDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          priority: 'high'
        }
      ],
      fieldStatus: {
        totalFields: 5,
        activeFields: 3,
        readyForHarvest: 1,
        underMaintenance: 1
      },
      weatherAlert: {
        type: 'rain',
        message: 'Heavy rain expected in 2 days',
        impact: 'May delay planting operations'
      }
    };
  }

  private async getCommodityScheduleData(userId: string, userRole: UserRole, config: any): Promise<any> {
    // This would integrate with commodity delivery repositories
    return {
      upcomingDeliveries: [
        {
          id: '1',
          commodity: 'maize',
          quantity: 1000,
          unit: 'kg',
          scheduledDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          buyer: 'City Grain Market',
          status: 'confirmed'
        },
        {
          id: '2',
          commodity: 'wheat',
          quantity: 500,
          unit: 'kg',
          scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          buyer: 'Regional Flour Mill',
          status: 'pending'
        }
      ],
      inventory: {
        maize: { available: 2500, reserved: 1000, unit: 'kg' },
        wheat: { available: 800, reserved: 500, unit: 'kg' },
        rice: { available: 300, reserved: 0, unit: 'kg' }
      },
      priceAlerts: [
        {
          commodity: 'maize',
          currentPrice: 0.25,
          targetPrice: 0.30,
          currency: 'USD',
          unit: 'kg',
          trend: 'rising'
        }
      ]
    };
  }

  private isWidgetInteractive(widget: DashboardWidget, userRole: UserRole): boolean {
    // Determine if widget should be interactive based on type and role
    switch (widget.type) {
      case WidgetType.PENDING_APPROVALS:
        return userRole === UserRole.APP_ADMIN;
      
      case WidgetType.FIELD_OPERATIONS:
        return userRole === UserRole.FIELD_MANAGER || userRole === UserRole.FARM_ADMIN;
      
      case WidgetType.RELATIONSHIP_OVERVIEW:
        return userRole === UserRole.FARM_ADMIN;
      
      case WidgetType.COMMODITY_SCHEDULE:
        return userRole === UserRole.FARMER || userRole === UserRole.FARM_ADMIN;
      
      default:
        return false;
    }
  }

  private groupRelationshipsByType(relationships: BusinessRelationship[]): Record<string, number> {
    const grouped: Record<string, number> = {};
    
    relationships.forEach(rel => {
      grouped[rel.type] = (grouped[rel.type] || 0) + 1;
    });
    
    return grouped;
  }

  private getRecentRelationshipActivity(relationships: BusinessRelationship[]): any[] {
    return relationships
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 5)
      .map(rel => ({
        id: rel.id,
        type: rel.type,
        status: rel.status,
        updatedAt: rel.updatedAt,
        description: `${rel.type} relationship ${rel.status}`
      }));
  }
}