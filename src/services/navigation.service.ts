import { NavigationItem, Permission } from '../models/rbac.model';
import { BusinessRelationship } from '../models/business.model';
import { UserRole, RelationshipStatus } from '../models/common.types';
import { BusinessRelationshipRepository } from '../repositories/business-relationship.repository';
import { UserRepository } from '../repositories/user.repository';

export interface NavigationService {
  getNavigationForUser(userId: string): Promise<NavigationItem[]>;
  validateNavigationAccess(navItem: NavigationItem, userPermissions: string[]): boolean;
  getContextualNavigation(userId: string, context: NavigationContext): Promise<NavigationItem[]>;
  buildBreadcrumbs(currentPath: string, navigation: NavigationItem[]): NavigationBreadcrumb[];
}

export interface NavigationContext {
  currentPath?: string;
  relationshipId?: string;
  businessContext?: string;
}

export interface NavigationBreadcrumb {
  label: string;
  path: string;
  isActive: boolean;
}

export class NavigationServiceImpl implements NavigationService {
  constructor(
    private userRepository: UserRepository,
    private businessRelationshipRepository: BusinessRelationshipRepository
  ) {}

  /**
   * Get complete navigation structure for a user based on their role and relationships
   * Implements requirement 7.1, 7.2 - Dynamic dashboard rendering based on role
   */
  async getNavigationForUser(userId: string): Promise<NavigationItem[]> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        return [];
      }

      // Get base navigation for the role
      const baseNavigation = this.getBaseNavigationForRole(user.role);

      // Get user's business relationships
      const relationships = await this.getUserRelationships(userId, user.role);
      const activeRelationships = relationships.filter(rel => rel.status === RelationshipStatus.ACTIVE);

      // Add relationship-specific navigation
      const relationshipNavigation = this.getRelationshipNavigation(user.role, activeRelationships);

      // Merge and organize navigation
      return this.mergeNavigation(baseNavigation, relationshipNavigation);
    } catch (error) {
      console.error('Error getting navigation for user:', error);
      return [];
    }
  }

  /**
   * Validate if user has access to a navigation item
   */
  validateNavigationAccess(navItem: NavigationItem, userPermissions: string[]): boolean {
    return navItem.permissions.every(permission => 
      userPermissions.includes(permission)
    );
  }

  /**
   * Get contextual navigation based on current user context
   */
  async getContextualNavigation(userId: string, context: NavigationContext): Promise<NavigationItem[]> {
    try {
      const baseNavigation = await this.getNavigationForUser(userId);
      
      if (!context.currentPath) {
        return baseNavigation;
      }

      // Add contextual items based on current path
      const contextualItems = await this.getContextualItems(userId, context);
      
      return [...baseNavigation, ...contextualItems];
    } catch (error) {
      console.error('Error getting contextual navigation:', error);
      return [];
    }
  }

  /**
   * Build breadcrumb navigation for current path
   */
  buildBreadcrumbs(currentPath: string, navigation: NavigationItem[]): NavigationBreadcrumb[] {
    const breadcrumbs: NavigationBreadcrumb[] = [];
    const pathSegments = currentPath.split('/').filter(segment => segment.length > 0);
    
    let currentNavPath = '';
    
    for (const segment of pathSegments) {
      currentNavPath += `/${segment}`;
      
      // Find matching navigation item
      const navItem = this.findNavigationItem(currentNavPath, navigation);
      
      if (navItem) {
        breadcrumbs.push({
          label: navItem.label,
          path: navItem.path,
          isActive: navItem.path === currentPath
        });
      } else {
        // Create breadcrumb for path segment without navigation item
        breadcrumbs.push({
          label: this.formatSegmentLabel(segment),
          path: currentNavPath,
          isActive: currentNavPath === currentPath
        });
      }
    }
    
    return breadcrumbs;
  }

  // Private helper methods

  private getBaseNavigationForRole(userRole: UserRole): NavigationItem[] {
    const baseItems: NavigationItem[] = [
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

    switch (userRole) {
      case UserRole.APP_ADMIN:
        return [
          ...baseItems,
          {
            id: 'user-management',
            label: 'User Management',
            path: '/admin',
            permissions: ['registration:read'],
            children: [
              {
                id: 'pending-registrations',
                label: 'Pending Registrations',
                path: '/admin/registrations',
                permissions: ['registration:read']
              },
              {
                id: 'active-users',
                label: 'Active Users',
                path: '/admin/users',
                permissions: ['users:read']
              },
              {
                id: 'system-settings',
                label: 'System Settings',
                path: '/admin/settings',
                permissions: ['system:manage']
              }
            ]
          }
        ];

      case UserRole.FARM_ADMIN:
        return [
          ...baseItems,
          {
            id: 'business-overview',
            label: 'Business Overview',
            path: '/business',
            permissions: ['business:read'],
            children: [
              {
                id: 'supply-chain',
                label: 'Supply Chain',
                path: '/business/supply-chain',
                permissions: ['supply-chain:read']
              },
              {
                id: 'relationships',
                label: 'Business Relationships',
                path: '/business/relationships',
                permissions: ['relationships:read']
              }
            ]
          }
        ];

      case UserRole.FIELD_MANAGER:
        return [
          ...baseItems,
          {
            id: 'field-operations',
            label: 'Field Operations',
            path: '/field-operations',
            permissions: ['field-operations:read'],
            children: [
              {
                id: 'current-operations',
                label: 'Current Operations',
                path: '/field-operations/current',
                permissions: ['field-operations:read']
              },
              {
                id: 'planning',
                label: 'Planning',
                path: '/field-operations/planning',
                permissions: ['field-operations:update']
              }
            ]
          }
        ];

      default:
        // Service provider roles
        return [
          ...baseItems,
          {
            id: 'business-activities',
            label: 'Business Activities',
            path: '/business',
            permissions: ['business:read'],
            children: [
              {
                id: 'partnerships',
                label: 'Partnerships',
                path: '/business/partnerships',
                permissions: ['relationships:read']
              },
              {
                id: 'transactions',
                label: 'Transactions',
                path: '/business/transactions',
                permissions: ['transactions:read']
              }
            ]
          }
        ];
    }
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

  private getRelationshipNavigation(userRole: UserRole, relationships: BusinessRelationship[]): NavigationItem[] {
    if (relationships.length === 0) {
      return [];
    }

    const relationshipNav: NavigationItem[] = [];

    if (userRole === UserRole.FARM_ADMIN) {
      // Group relationships by type for Farm Admin
      const fieldManagers = relationships.filter(rel => rel.type === 'field_manager');
      const serviceProviders = relationships.filter(rel => rel.type !== 'field_manager');

      if (fieldManagers.length > 0) {
        relationshipNav.push({
          id: 'field-managers',
          label: `Field Managers (${fieldManagers.length})`,
          path: '/field-managers',
          permissions: ['relationships:read'],
          children: fieldManagers.map(rel => ({
            id: `field-manager-${rel.id}`,
            label: `Field Manager ${rel.serviceProviderId}`,
            path: `/field-managers/${rel.id}`,
            permissions: ['relationships:read']
          }))
        });
      }

      if (serviceProviders.length > 0) {
        relationshipNav.push({
          id: 'service-providers',
          label: `Service Providers (${serviceProviders.length})`,
          path: '/service-providers',
          permissions: ['relationships:read'],
          children: this.groupServiceProviders(serviceProviders)
        });
      }
    } else if (userRole === UserRole.FIELD_MANAGER) {
      // Field Manager sees their Farm Admin connections
      const farmAdmins = relationships.filter(rel => rel.type === 'field_manager');
      
      if (farmAdmins.length > 0) {
        relationshipNav.push({
          id: 'farm-admins',
          label: 'Farm Operations',
          path: '/farm-operations',
          permissions: ['field-operations:read'],
          children: farmAdmins.map(rel => ({
            id: `farm-${rel.id}`,
            label: `Farm ${rel.farmAdminId}`,
            path: `/farm-operations/${rel.id}`,
            permissions: ['field-operations:read']
          }))
        });
      }
    } else {
      // Service providers see their Farm Admin connections
      relationshipNav.push({
        id: 'farm-partnerships',
        label: `Farm Partnerships (${relationships.length})`,
        path: '/partnerships',
        permissions: ['relationships:read'],
        children: relationships.map(rel => ({
          id: `partnership-${rel.id}`,
          label: `Partnership ${rel.farmAdminId}`,
          path: `/partnerships/${rel.id}`,
          permissions: ['relationships:read']
        }))
      });
    }

    return relationshipNav;
  }

  private groupServiceProviders(serviceProviders: BusinessRelationship[]): NavigationItem[] {
    const grouped = serviceProviders.reduce((acc, rel) => {
      if (!acc[rel.type]) {
        acc[rel.type] = [];
      }
      acc[rel.type].push(rel);
      return acc;
    }, {} as Record<string, BusinessRelationship[]>);

    return Object.entries(grouped).map(([type, rels]) => ({
      id: `${type}-group`,
      label: `${this.formatRelationshipType(type)} (${rels.length})`,
      path: `/service-providers/${type}`,
      permissions: ['relationships:read'],
      children: rels.map(rel => ({
        id: `${type}-${rel.id}`,
        label: `${this.formatRelationshipType(type)} ${rel.serviceProviderId}`,
        path: `/service-providers/${type}/${rel.id}`,
        permissions: ['relationships:read']
      }))
    }));
  }

  private mergeNavigation(baseNav: NavigationItem[], relationshipNav: NavigationItem[]): NavigationItem[] {
    // Insert relationship navigation after base items but before profile
    const profileIndex = baseNav.findIndex(item => item.id === 'profile');
    
    if (profileIndex > 0) {
      return [
        ...baseNav.slice(0, profileIndex),
        ...relationshipNav,
        ...baseNav.slice(profileIndex)
      ];
    }
    
    return [...baseNav, ...relationshipNav];
  }

  private async getContextualItems(userId: string, context: NavigationContext): Promise<NavigationItem[]> {
    const contextualItems: NavigationItem[] = [];

    // Add contextual navigation based on current path
    if (context.currentPath?.includes('/relationships/') && context.relationshipId) {
      contextualItems.push({
        id: 'relationship-details',
        label: 'Relationship Details',
        path: `/relationships/${context.relationshipId}/details`,
        permissions: ['relationships:read']
      });
      
      contextualItems.push({
        id: 'relationship-communications',
        label: 'Communications',
        path: `/relationships/${context.relationshipId}/communications`,
        permissions: ['communications:read']
      });
    }

    return contextualItems;
  }

  private findNavigationItem(path: string, navigation: NavigationItem[]): NavigationItem | null {
    for (const item of navigation) {
      if (item.path === path) {
        return item;
      }
      
      if (item.children) {
        const found = this.findNavigationItem(path, item.children);
        if (found) {
          return found;
        }
      }
    }
    
    return null;
  }

  private formatSegmentLabel(segment: string): string {
    return segment
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private formatRelationshipType(type: string): string {
    const typeMap: Record<string, string> = {
      'farmer_supplier': 'Farmers',
      'lorry_agency': 'Lorry Agencies',
      'equipment_provider': 'Equipment Providers',
      'input_supplier': 'Input Suppliers',
      'dealer': 'Dealers'
    };
    
    return typeMap[type] || type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
}