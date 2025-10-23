import { UserRole, WidgetType } from './common.types';
import { RoleSpecificProfile } from './user.model';

export interface DashboardConfig {
  role: UserRole;
  widgets: DashboardWidget[];
  permissions: Permission[];
  navigation: NavigationItem[];
}

export interface DashboardWidget {
  id: string;
  type: WidgetType;
  title: string;
  dataSource: string;
  permissions: string[];
  config: any;
}

export interface Permission {
  resource: string;
  actions: string[];
  conditions?: PermissionCondition[];
}

export interface PermissionCondition {
  field: string;
  operator: string;
  value: any;
}

export interface NavigationItem {
  id: string;
  label: string;
  path: string;
  permissions: string[];
  children?: NavigationItem[];
}

export interface DataAccessPermissions {
  canRead: string[];
  canWrite: string[];
  canDelete: string[];
  restrictions: AccessRestriction[];
}

export interface AccessRestriction {
  field: string;
  condition: string;
  value: any;
}

// Enhanced RoleSpecificProfile with validation
export interface EnhancedRoleSpecificProfile extends RoleSpecificProfile {
  // Farm Admin specific
  businessName?: string;
  farmSize?: number;
  cropTypes?: string[];
  businessRegistrationNumber?: string;
  taxId?: string;
  
  // Field Manager specific
  experience?: number;
  specializations?: string[];
  certifications?: string[];
  supervisoryExperience?: number;
  
  // Farmer specific
  commodityTypes?: string[];
  productionCapacity?: number;
  farmLocation?: string;
  organicCertified?: boolean;
  
  // Lorry Agency specific
  fleetSize?: number;
  vehicleTypes?: string[];
  coverageAreas?: string[];
  transportLicense?: string;
  
  // Field Equipment Manager specific
  equipmentTypes?: string[];
  maintenanceCapability?: boolean;
  operatorTraining?: boolean;
  
  // Input Supplier specific
  productCategories?: string[];
  supplierLicenses?: string[];
  qualityCertifications?: string[];
  
  // Dealer specific
  marketTypes?: string[];
  storageCapacity?: number;
  processingCapability?: boolean;
  distributionNetwork?: string[];
}

// RBAC validation and utility functions
export class RBACValidation {
  static validatePermission(permission: Partial<Permission>): string[] {
    const errors: string[] = [];

    if (!permission.resource || permission.resource.trim().length === 0) {
      errors.push('Permission resource is required');
    }

    if (!permission.actions || permission.actions.length === 0) {
      errors.push('Permission actions are required');
    }

    if (permission.actions) {
      const validActions = ['create', 'read', 'update', 'delete', 'approve', 'invite', 'manage'];
      const invalidActions = permission.actions.filter(action => !validActions.includes(action));
      if (invalidActions.length > 0) {
        errors.push(`Invalid actions: ${invalidActions.join(', ')}`);
      }
    }

    return errors;
  }

  static validateNavigationItem(item: Partial<NavigationItem>): string[] {
    const errors: string[] = [];

    if (!item.id || item.id.trim().length === 0) {
      errors.push('Navigation item ID is required');
    }

    if (!item.label || item.label.trim().length === 0) {
      errors.push('Navigation item label is required');
    }

    if (!item.path || item.path.trim().length === 0) {
      errors.push('Navigation item path is required');
    }

    if (!item.permissions || item.permissions.length === 0) {
      errors.push('Navigation item permissions are required');
    }

    return errors;
  }

  static validateDashboardWidget(widget: Partial<DashboardWidget>): string[] {
    const errors: string[] = [];

    if (!widget.id || widget.id.trim().length === 0) {
      errors.push('Widget ID is required');
    }

    if (widget.type && !Object.values(WidgetType).includes(widget.type)) {
      errors.push('Invalid widget type');
    }

    if (!widget.title || widget.title.trim().length === 0) {
      errors.push('Widget title is required');
    }

    if (!widget.dataSource || widget.dataSource.trim().length === 0) {
      errors.push('Widget data source is required');
    }

    if (!widget.permissions || widget.permissions.length === 0) {
      errors.push('Widget permissions are required');
    }

    return errors;
  }

  static validateRoleSpecificProfile(role: UserRole, profile: EnhancedRoleSpecificProfile): string[] {
    const errors: string[] = [];

    switch (role) {
      case UserRole.FARM_ADMIN:
        if (!profile.businessName || profile.businessName.trim().length === 0) {
          errors.push('Business name is required for Farm Admin');
        }
        if (profile.farmSize !== undefined && (profile.farmSize <= 0 || !Number.isFinite(profile.farmSize))) {
          errors.push('Farm size must be a positive number');
        }
        break;

      case UserRole.FIELD_MANAGER:
        if (profile.experience !== undefined && (profile.experience < 0 || !Number.isInteger(profile.experience))) {
          errors.push('Experience must be a non-negative integer');
        }
        break;

      case UserRole.FARMER:
        if (!profile.commodityTypes || profile.commodityTypes.length === 0) {
          errors.push('Commodity types are required for Farmer');
        }
        if (profile.productionCapacity !== undefined && (profile.productionCapacity <= 0 || !Number.isFinite(profile.productionCapacity))) {
          errors.push('Production capacity must be a positive number');
        }
        break;

      case UserRole.LORRY_AGENCY:
        if (profile.fleetSize !== undefined && (profile.fleetSize <= 0 || !Number.isInteger(profile.fleetSize))) {
          errors.push('Fleet size must be a positive integer');
        }
        if (!profile.coverageAreas || profile.coverageAreas.length === 0) {
          errors.push('Coverage areas are required for Lorry Agency');
        }
        break;

      case UserRole.FIELD_EQUIPMENT_MANAGER:
        if (!profile.equipmentTypes || profile.equipmentTypes.length === 0) {
          errors.push('Equipment types are required for Field Equipment Manager');
        }
        break;

      case UserRole.INPUT_SUPPLIER:
        if (!profile.productCategories || profile.productCategories.length === 0) {
          errors.push('Product categories are required for Input Supplier');
        }
        break;

      case UserRole.DEALER:
        if (!profile.marketTypes || profile.marketTypes.length === 0) {
          errors.push('Market types are required for Dealer');
        }
        if (profile.storageCapacity !== undefined && (profile.storageCapacity <= 0 || !Number.isFinite(profile.storageCapacity))) {
          errors.push('Storage capacity must be a positive number');
        }
        break;
    }

    return errors;
  }

  static getDefaultDashboardConfig(role: UserRole): DashboardConfig {
    const basePermissions: Permission[] = [
      {
        resource: 'profile',
        actions: ['read', 'update']
      },
      {
        resource: 'dashboard',
        actions: ['read']
      }
    ];

    const baseNavigation: NavigationItem[] = [
      {
        id: 'dashboard',
        label: 'Dashboard',
        path: '/dashboard',
        permissions: ['dashboard:read']
      },
      {
        id: 'profile',
        label: 'Profile',
        path: '/profile',
        permissions: ['profile:read']
      }
    ];

    switch (role) {
      case UserRole.APP_ADMIN:
        return {
          role,
          widgets: [
            {
              id: 'pending-approvals',
              type: WidgetType.PENDING_APPROVALS,
              title: 'Pending Registrations',
              dataSource: 'registration-requests',
              permissions: ['registration:read', 'registration:approve'],
              config: { showAll: true }
            },
            {
              id: 'system-overview',
              type: WidgetType.RELATIONSHIP_OVERVIEW,
              title: 'System Overview',
              dataSource: 'system-stats',
              permissions: ['system:read'],
              config: { includeMetrics: true }
            }
          ],
          permissions: [
            ...basePermissions,
            {
              resource: 'registration',
              actions: ['read', 'approve', 'reject']
            },
            {
              resource: 'system',
              actions: ['read', 'manage']
            }
          ],
          navigation: [
            ...baseNavigation,
            {
              id: 'registrations',
              label: 'User Registrations',
              path: '/registrations',
              permissions: ['registration:read']
            },
            {
              id: 'system',
              label: 'System Management',
              path: '/system',
              permissions: ['system:read']
            }
          ]
        };

      case UserRole.FARM_ADMIN:
        return {
          role,
          widgets: [
            {
              id: 'relationship-overview',
              type: WidgetType.RELATIONSHIP_OVERVIEW,
              title: 'Business Relationships',
              dataSource: 'business-relationships',
              permissions: ['relationships:read'],
              config: { showActive: true }
            },
            {
              id: 'supply-chain-status',
              type: WidgetType.SUPPLY_CHAIN_STATUS,
              title: 'Supply Chain Status',
              dataSource: 'supply-chain',
              permissions: ['supply-chain:read'],
              config: { realTime: true }
            }
          ],
          permissions: [
            ...basePermissions,
            {
              resource: 'relationships',
              actions: ['create', 'read', 'update', 'manage']
            },
            {
              resource: 'field-managers',
              actions: ['invite', 'manage']
            },
            {
              resource: 'supply-chain',
              actions: ['read', 'update']
            }
          ],
          navigation: [
            ...baseNavigation,
            {
              id: 'relationships',
              label: 'Business Relationships',
              path: '/relationships',
              permissions: ['relationships:read']
            },
            {
              id: 'field-managers',
              label: 'Field Managers',
              path: '/field-managers',
              permissions: ['field-managers:manage']
            },
            {
              id: 'supply-chain',
              label: 'Supply Chain',
              path: '/supply-chain',
              permissions: ['supply-chain:read']
            }
          ]
        };

      case UserRole.FIELD_MANAGER:
        return {
          role,
          widgets: [
            {
              id: 'field-operations',
              type: WidgetType.FIELD_OPERATIONS,
              title: 'Field Operations',
              dataSource: 'field-data',
              permissions: ['field-operations:read'],
              config: { editable: true }
            }
          ],
          permissions: [
            ...basePermissions,
            {
              resource: 'field-operations',
              actions: ['read', 'update']
            }
          ],
          navigation: [
            ...baseNavigation,
            {
              id: 'field-operations',
              label: 'Field Operations',
              path: '/field-operations',
              permissions: ['field-operations:read']
            }
          ]
        };

      default:
        return {
          role,
          widgets: [
            {
              id: 'recent-transactions',
              type: WidgetType.RECENT_TRANSACTIONS,
              title: 'Recent Transactions',
              dataSource: 'transactions',
              permissions: ['transactions:read'],
              config: { limit: 10 }
            }
          ],
          permissions: basePermissions,
          navigation: baseNavigation
        };
    }
  }
}