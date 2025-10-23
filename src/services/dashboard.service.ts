import { DashboardConfig, DashboardWidget, NavigationItem, Permission, RBACValidation } from '../models/rbac.model';
import { BusinessRelationship } from '../models/business.model';
import { User } from '../models/user.model';
import { UserRole, WidgetType, RelationshipStatus } from '../models/common.types';
import { UserRepository } from '../repositories/user.repository';
import { BusinessRelationshipRepository } from '../repositories/business-relationship.repository';

export interface DashboardService {
  getDashboardConfig(userId: string): Promise<DashboardConfig>;
  getCustomizedDashboardConfig(userId: string, customizations?: DashboardCustomization): Promise<DashboardConfig>;
  updateDashboardConfig(userId: string, config: Partial<DashboardConfig>): Promise<DashboardConfig>;
  getAvailableWidgets(userRole: UserRole): Promise<DashboardWidget[]>;
  validateDashboardConfig(config: DashboardConfig): Promise<string[]>;
}

export interface DashboardCustomization {
  widgetOrder?: string[];
  hiddenWidgets?: string[];
  customWidgets?: DashboardWidget[];
  navigationOrder?: string[];
  hiddenNavigation?: string[];
}

export class DashboardServiceImpl implements DashboardService {
  constructor(
    private userRepository: UserRepository,
    private businessRelationshipRepository: BusinessRelationshipRepository
  ) {}

  /**
   * Get dashboard configuration for a user with role-specific customizations
   * Implements requirement 4.1, 6.1, 7.1, 7.2 - Role-specific dashboard configurations
   */
  async getDashboardConfig(userId: string): Promise<DashboardConfig> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Get base configuration for the role
      const baseConfig = RBACValidation.getDefaultDashboardConfig(user.role);

      // Customize based on user's business relationships
      const customizedConfig = await this.customizeConfigForRelationships(user, baseConfig);

      return customizedConfig;
    } catch (error) {
      console.error('Error getting dashboard config:', error);
      throw error;
    }
  }

  /**
   * Get customized dashboard configuration with user preferences
   * Implements requirement 7.1, 7.2 - Dynamic dashboard rendering based on role
   */
  async getCustomizedDashboardConfig(
    userId: string, 
    customizations?: DashboardCustomization
  ): Promise<DashboardConfig> {
    try {
      const baseConfig = await this.getDashboardConfig(userId);

      if (!customizations) {
        return baseConfig;
      }

      // Apply customizations
      const customizedConfig = { ...baseConfig };

      // Reorder widgets if specified
      if (customizations.widgetOrder) {
        customizedConfig.widgets = this.reorderWidgets(baseConfig.widgets, customizations.widgetOrder);
      }

      // Hide widgets if specified
      if (customizations.hiddenWidgets) {
        customizedConfig.widgets = customizedConfig.widgets.filter(
          widget => !customizations.hiddenWidgets!.includes(widget.id)
        );
      }

      // Add custom widgets if specified
      if (customizations.customWidgets) {
        customizedConfig.widgets.push(...customizations.customWidgets);
      }

      // Reorder navigation if specified
      if (customizations.navigationOrder) {
        customizedConfig.navigation = this.reorderNavigation(baseConfig.navigation, customizations.navigationOrder);
      }

      // Hide navigation items if specified
      if (customizations.hiddenNavigation) {
        customizedConfig.navigation = customizedConfig.navigation.filter(
          nav => !customizations.hiddenNavigation!.includes(nav.id)
        );
      }

      return customizedConfig;
    } catch (error) {
      console.error('Error getting customized dashboard config:', error);
      throw error;
    }
  }

  /**
   * Update dashboard configuration for a user
   */
  async updateDashboardConfig(userId: string, config: Partial<DashboardConfig>): Promise<DashboardConfig> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Validate the configuration
      const currentConfig = await this.getDashboardConfig(userId);
      const updatedConfig = { ...currentConfig, ...config };
      
      const validationErrors = await this.validateDashboardConfig(updatedConfig);
      if (validationErrors.length > 0) {
        throw new Error(`Invalid dashboard configuration: ${validationErrors.join(', ')}`);
      }

      // In a real implementation, you would save this to a user preferences store
      // For now, we'll return the updated config
      return updatedConfig;
    } catch (error) {
      console.error('Error updating dashboard config:', error);
      throw error;
    }
  }

  /**
   * Get available widgets for a specific role
   * Implements requirement 7.1, 7.2 - Widget and navigation permissions
   */
  async getAvailableWidgets(userRole: UserRole): Promise<DashboardWidget[]> {
    try {
      const allWidgets = this.getAllPossibleWidgets();
      
      // Filter widgets based on role permissions
      const rolePermissions = this.getRolePermissions(userRole);
      
      return allWidgets.filter(widget => 
        widget.permissions.every(permission => 
          rolePermissions.includes(permission)
        )
      );
    } catch (error) {
      console.error('Error getting available widgets:', error);
      return [];
    }
  }

  /**
   * Validate dashboard configuration
   */
  async validateDashboardConfig(config: DashboardConfig): Promise<string[]> {
    const errors: string[] = [];

    // Validate widgets
    for (const widget of config.widgets) {
      const widgetErrors = RBACValidation.validateDashboardWidget(widget);
      errors.push(...widgetErrors);
    }

    // Validate permissions
    for (const permission of config.permissions) {
      const permissionErrors = RBACValidation.validatePermission(permission);
      errors.push(...permissionErrors);
    }

    // Validate navigation
    for (const navItem of config.navigation) {
      const navErrors = RBACValidation.validateNavigationItem(navItem);
      errors.push(...navErrors);
    }

    return errors;
  }

  // Private helper methods

  private async customizeConfigForRelationships(user: User, baseConfig: DashboardConfig): Promise<DashboardConfig> {
    const customizedConfig = { ...baseConfig };

    // Get user's business relationships
    const relationships = await this.getUserRelationships(user.id, user.role);
    const activeRelationships = relationships.filter(rel => rel.status === RelationshipStatus.ACTIVE);

    // Add relationship-specific widgets and permissions
    if (activeRelationships.length > 0) {
      customizedConfig.widgets = [...customizedConfig.widgets, ...this.getRelationshipWidgets(user.role, activeRelationships)];
      customizedConfig.permissions = [...customizedConfig.permissions, ...this.getRelationshipPermissions(user.role, activeRelationships)];
      customizedConfig.navigation = [...customizedConfig.navigation, ...this.getRelationshipNavigation(user.role, activeRelationships)];
    }

    return customizedConfig;
  }

  private async getUserRelationships(userId: string, userRole: UserRole): Promise<BusinessRelationship[]> {
    try {
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

  private getRelationshipWidgets(userRole: UserRole, relationships: BusinessRelationship[]): DashboardWidget[] {
    const widgets: DashboardWidget[] = [];

    if (userRole === UserRole.FARM_ADMIN && relationships.length > 0) {
      widgets.push({
        id: 'active-relationships',
        type: WidgetType.RELATIONSHIP_OVERVIEW,
        title: 'Active Business Relationships',
        dataSource: 'active-relationships',
        permissions: ['relationships:read'],
        config: { 
          showCount: relationships.length,
          showTypes: [...new Set(relationships.map(r => r.type))]
        }
      });
    }

    if (userRole === UserRole.FIELD_MANAGER && relationships.length > 0) {
      widgets.push({
        id: 'farm-operations',
        type: WidgetType.FIELD_OPERATIONS,
        title: 'Farm Operations Status',
        dataSource: 'field-operations',
        permissions: ['field-operations:read'],
        config: { 
          farmAdminId: relationships[0].farmAdminId,
          editable: true
        }
      });
    }

    // Add service provider specific widgets
    if ([UserRole.FARMER, UserRole.LORRY_AGENCY, UserRole.FIELD_EQUIPMENT_MANAGER, 
         UserRole.INPUT_SUPPLIER, UserRole.DEALER].includes(userRole) && relationships.length > 0) {
      widgets.push({
        id: 'business-transactions',
        type: WidgetType.RECENT_TRANSACTIONS,
        title: 'Recent Business Transactions',
        dataSource: 'business-transactions',
        permissions: ['transactions:read'],
        config: { 
          relationshipIds: relationships.map(r => r.id),
          limit: 5
        }
      });
    }

    return widgets;
  }

  private getRelationshipPermissions(userRole: UserRole, relationships: BusinessRelationship[]): Permission[] {
    const permissions: Permission[] = [];

    if (relationships.length > 0) {
      permissions.push({
        resource: 'relationships',
        actions: ['read']
      });

      if (userRole === UserRole.FARM_ADMIN) {
        permissions.push({
          resource: 'relationships',
          actions: ['create', 'update', 'manage']
        });
      }

      if (userRole === UserRole.FIELD_MANAGER) {
        permissions.push({
          resource: 'field-operations',
          actions: ['read', 'update']
        });
      }

      // Service provider permissions
      if ([UserRole.FARMER, UserRole.LORRY_AGENCY, UserRole.FIELD_EQUIPMENT_MANAGER, 
           UserRole.INPUT_SUPPLIER, UserRole.DEALER].includes(userRole)) {
        permissions.push({
          resource: 'transactions',
          actions: ['read', 'create']
        });
        permissions.push({
          resource: 'communications',
          actions: ['read', 'create']
        });
      }
    }

    return permissions;
  }

  private getRelationshipNavigation(userRole: UserRole, relationships: BusinessRelationship[]): NavigationItem[] {
    const navigation: NavigationItem[] = [];

    if (relationships.length > 0) {
      if (userRole === UserRole.FARM_ADMIN) {
        navigation.push({
          id: 'business-network',
          label: 'Business Network',
          path: '/business-network',
          permissions: ['relationships:read'],
          children: [
            {
              id: 'field-managers',
              label: 'Field Managers',
              path: '/business-network/field-managers',
              permissions: ['relationships:read']
            },
            {
              id: 'service-providers',
              label: 'Service Providers',
              path: '/business-network/service-providers',
              permissions: ['relationships:read']
            }
          ]
        });
      }

      if (userRole === UserRole.FIELD_MANAGER) {
        navigation.push({
          id: 'farm-operations',
          label: 'Farm Operations',
          path: '/farm-operations',
          permissions: ['field-operations:read']
        });
      }

      // Service provider navigation
      if ([UserRole.FARMER, UserRole.LORRY_AGENCY, UserRole.FIELD_EQUIPMENT_MANAGER, 
           UserRole.INPUT_SUPPLIER, UserRole.DEALER].includes(userRole)) {
        navigation.push({
          id: 'business-partnerships',
          label: 'Business Partnerships',
          path: '/partnerships',
          permissions: ['relationships:read']
        });
        navigation.push({
          id: 'transactions',
          label: 'Transactions',
          path: '/transactions',
          permissions: ['transactions:read']
        });
      }
    }

    return navigation;
  }

  private reorderWidgets(widgets: DashboardWidget[], order: string[]): DashboardWidget[] {
    const orderedWidgets: DashboardWidget[] = [];
    const widgetMap = new Map(widgets.map(w => [w.id, w]));

    // Add widgets in the specified order
    for (const widgetId of order) {
      const widget = widgetMap.get(widgetId);
      if (widget) {
        orderedWidgets.push(widget);
        widgetMap.delete(widgetId);
      }
    }

    // Add remaining widgets
    orderedWidgets.push(...Array.from(widgetMap.values()));

    return orderedWidgets;
  }

  private reorderNavigation(navigation: NavigationItem[], order: string[]): NavigationItem[] {
    const orderedNavigation: NavigationItem[] = [];
    const navMap = new Map(navigation.map(n => [n.id, n]));

    // Add navigation items in the specified order
    for (const navId of order) {
      const navItem = navMap.get(navId);
      if (navItem) {
        orderedNavigation.push(navItem);
        navMap.delete(navId);
      }
    }

    // Add remaining navigation items
    orderedNavigation.push(...Array.from(navMap.values()));

    return orderedNavigation;
  }

  private getAllPossibleWidgets(): DashboardWidget[] {
    return [
      {
        id: 'pending-approvals',
        type: WidgetType.PENDING_APPROVALS,
        title: 'Pending Approvals',
        dataSource: 'registration-requests',
        permissions: ['registration:read', 'registration:approve'],
        config: {}
      },
      {
        id: 'relationship-overview',
        type: WidgetType.RELATIONSHIP_OVERVIEW,
        title: 'Business Relationships',
        dataSource: 'business-relationships',
        permissions: ['relationships:read'],
        config: {}
      },
      {
        id: 'supply-chain-status',
        type: WidgetType.SUPPLY_CHAIN_STATUS,
        title: 'Supply Chain Status',
        dataSource: 'supply-chain',
        permissions: ['supply-chain:read'],
        config: {}
      },
      {
        id: 'recent-transactions',
        type: WidgetType.RECENT_TRANSACTIONS,
        title: 'Recent Transactions',
        dataSource: 'transactions',
        permissions: ['transactions:read'],
        config: {}
      },
      {
        id: 'field-operations',
        type: WidgetType.FIELD_OPERATIONS,
        title: 'Field Operations',
        dataSource: 'field-data',
        permissions: ['field-operations:read'],
        config: {}
      },
      {
        id: 'commodity-schedule',
        type: WidgetType.COMMODITY_SCHEDULE,
        title: 'Commodity Schedule',
        dataSource: 'commodity-deliveries',
        permissions: ['commodity:read'],
        config: {}
      }
    ];
  }

  private getRolePermissions(userRole: UserRole): string[] {
    const baseConfig = RBACValidation.getDefaultDashboardConfig(userRole);
    const permissions: string[] = [];

    baseConfig.permissions.forEach(permission => {
      permission.actions.forEach(action => {
        permissions.push(`${permission.resource}:${action}`);
      });
    });

    return permissions;
  }
}