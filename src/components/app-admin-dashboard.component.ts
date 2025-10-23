import { AdminControllerImpl, AppAdminDashboardData, SystemStats } from '../api/admin.controller';
import { DashboardControllerImpl } from '../api/dashboard.controller';
import { WidgetRendererImpl, RenderedWidget } from '../services/widget-renderer.service';
import { RegistrationRequest } from '../models';
import { UserRole, ApprovalStatus } from '../models/common.types';

/**
 * App Admin Dashboard Component
 * Requirements: 2.1, 2.2, 2.5 - App Admin dashboard interface
 */
export interface AppAdminDashboardComponent {
  loadDashboard(): Promise<AppAdminDashboardView>;
  approveRegistration(requestId: string, appAdminId: string): Promise<{ success: boolean; message: string }>;
  rejectRegistration(requestId: string, appAdminId: string, reason: string): Promise<{ success: boolean; message: string }>;
  suspendUser(userId: string, reason: string): Promise<{ success: boolean; message: string }>;
  reactivateUser(userId: string): Promise<{ success: boolean; message: string }>;
  refreshDashboard(): Promise<AppAdminDashboardView>;
}

export interface AppAdminDashboardView {
  widgets: RenderedWidget[];
  pendingRegistrations: {
    count: number;
    urgent: number;
    recent: number;
    items: RegistrationRequestView[];
    summary: {
      farmAdmins: number;
      fieldManagers: number;
      farmers: number;
      serviceProviders: number;
    };
  };
  systemOverview: {
    totalUsers: number;
    activeUsers: number;
    suspendedUsers: number;
    usersByRole: Record<UserRole, number>;
    recentActivity: {
      newRegistrations: number;
      approvedToday: number;
      rejectedToday: number;
    };
  };
  userManagement: {
    recentUsers: UserSummary[];
    suspendedUsers: UserSummary[];
    roleDistribution: Record<UserRole, number>;
  };
  quickActions: QuickAction[];
  notifications: DashboardNotification[];
}

export interface RegistrationRequestView {
  id: string;
  applicantName: string;
  email: string;
  role: UserRole;
  submittedAt: Date;
  daysPending: number;
  isUrgent: boolean;
  profileSummary: string;
  profileData: any;
}

export interface UserSummary {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  status: string;
  lastLoginAt?: Date;
  createdAt: Date;
}

export interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: string;
  action: string;
  count?: number;
  priority: 'high' | 'medium' | 'low';
}

export interface DashboardNotification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: Date;
  isRead: boolean;
  actionUrl?: string;
}

export class AppAdminDashboardComponentImpl implements AppAdminDashboardComponent {
  constructor(
    private adminController: AdminControllerImpl,
    private dashboardController: DashboardControllerImpl,
    private widgetRenderer: WidgetRendererImpl
  ) {}

  /**
   * Load complete App Admin dashboard data
   * Requirements: 2.1 - Display pending registration requests and system oversight
   */
  async loadDashboard(): Promise<AppAdminDashboardView> {
    try {
      // Get dashboard data from controller
      const dashboardResult = await this.adminController.getAppAdminDashboardData();
      
      if (!dashboardResult.success || !dashboardResult.data) {
        throw new Error('Failed to load dashboard data');
      }

      const data = dashboardResult.data;

      // Get dashboard configuration and render widgets
      const configResult = await this.dashboardController.getDashboardConfig(UserRole.APP_ADMIN);
      const widgets: RenderedWidget[] = [];

      if (configResult.success && configResult.config) {
        for (const widget of configResult.config.widgets) {
          const renderedWidget = await this.widgetRenderer.renderWidget(
            widget, 
            'app-admin', // placeholder admin ID
            UserRole.APP_ADMIN
          );
          widgets.push(renderedWidget);
        }
      }

      // Transform pending registrations
      const pendingRegistrations = this.transformPendingRegistrations(data.pendingRequests);

      // Create system overview
      const systemOverview = this.createSystemOverview(data.systemStats, data.userManagement);

      // Create user management summary
      const userManagement = this.createUserManagementSummary(data.userManagement);

      // Generate quick actions
      const quickActions = this.generateQuickActions(data);

      // Generate notifications
      const notifications = this.generateNotifications(data);

      return {
        widgets,
        pendingRegistrations,
        systemOverview,
        userManagement,
        quickActions,
        notifications
      };
    } catch (error) {
      console.error('Error loading App Admin dashboard:', error);
      throw error;
    }
  }

  /**
   * Approve registration request
   * Requirements: 2.2 - App Admin approval processing
   */
  async approveRegistration(requestId: string, appAdminId: string): Promise<{ success: boolean; message: string }> {
    try {
      const decision = {
        approved: true,
        appAdminId,
        timestamp: new Date()
      };

      return await this.adminController.approveRegistration(requestId, decision);
    } catch (error) {
      console.error('Error approving registration:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to approve registration'
      };
    }
  }

  /**
   * Reject registration request with reason
   * Requirements: 2.5 - App Admin rejection with reason documentation
   */
  async rejectRegistration(requestId: string, appAdminId: string, reason: string): Promise<{ success: boolean; message: string }> {
    try {
      if (!reason || reason.trim().length === 0) {
        return {
          success: false,
          message: 'Rejection reason is required'
        };
      }

      const decision = {
        approved: false,
        reason: reason.trim(),
        appAdminId,
        timestamp: new Date()
      };

      return await this.adminController.rejectRegistration(requestId, decision);
    } catch (error) {
      console.error('Error rejecting registration:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to reject registration'
      };
    }
  }

  /**
   * Suspend user account
   * Requirements: 2.1 - User management and system oversight
   */
  async suspendUser(userId: string, reason: string): Promise<{ success: boolean; message: string }> {
    try {
      return await this.adminController.suspendUser(userId, reason);
    } catch (error) {
      console.error('Error suspending user:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to suspend user'
      };
    }
  }

  /**
   * Reactivate suspended user
   * Requirements: 2.1 - User management and system oversight
   */
  async reactivateUser(userId: string): Promise<{ success: boolean; message: string }> {
    try {
      return await this.adminController.reactivateUser(userId);
    } catch (error) {
      console.error('Error reactivating user:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to reactivate user'
      };
    }
  }

  /**
   * Refresh dashboard data
   */
  async refreshDashboard(): Promise<AppAdminDashboardView> {
    return await this.loadDashboard();
  }

  // Private helper methods

  private transformPendingRegistrations(requests: RegistrationRequest[]): AppAdminDashboardView['pendingRegistrations'] {
    const items: RegistrationRequestView[] = requests.map(request => {
      const daysPending = Math.floor((Date.now() - request.submittedAt.getTime()) / (1000 * 60 * 60 * 24));
      const isUrgent = daysPending > 7;

      return {
        id: request.id,
        applicantName: request.userData.fullName,
        email: request.userData.email,
        role: request.userData.selectedRole,
        submittedAt: request.submittedAt,
        daysPending,
        isUrgent,
        profileSummary: this.createProfileSummary(request.userData.selectedRole, request.userData.profileData),
        profileData: request.userData.profileData
      };
    });

    // Calculate summary
    const summary = items.reduce((acc, item) => {
      switch (item.role) {
        case UserRole.FARM_ADMIN:
          acc.farmAdmins++;
          break;
        case UserRole.FIELD_MANAGER:
          acc.fieldManagers++;
          break;
        case UserRole.FARMER:
          acc.farmers++;
          break;
        case UserRole.LORRY_AGENCY:
        case UserRole.FIELD_EQUIPMENT_MANAGER:
        case UserRole.INPUT_SUPPLIER:
        case UserRole.DEALER:
          acc.serviceProviders++;
          break;
      }
      return acc;
    }, { farmAdmins: 0, fieldManagers: 0, farmers: 0, serviceProviders: 0 });

    return {
      count: items.length,
      urgent: items.filter(item => item.isUrgent).length,
      recent: items.filter(item => item.daysPending <= 1).length,
      items,
      summary
    };
  }

  private createSystemOverview(stats: SystemStats, userMgmt: AppAdminDashboardData['userManagement']): AppAdminDashboardView['systemOverview'] {
    return {
      totalUsers: stats.totalUsers,
      activeUsers: stats.activeUsers,
      suspendedUsers: userMgmt.suspendedUsers,
      usersByRole: stats.usersByRole,
      recentActivity: stats.recentActivity
    };
  }

  private createUserManagementSummary(userMgmt: AppAdminDashboardData['userManagement']): AppAdminDashboardView['userManagement'] {
    // In a real implementation, this would fetch actual user data
    return {
      recentUsers: [], // Would be populated with recent user registrations
      suspendedUsers: [], // Would be populated with suspended users
      roleDistribution: userMgmt.usersByRole
    };
  }

  private generateQuickActions(data: AppAdminDashboardData): QuickAction[] {
    const actions: QuickAction[] = [];

    // Pending registrations action
    if (data.pendingRequests.length > 0) {
      actions.push({
        id: 'review-registrations',
        label: 'Review Registrations',
        description: `${data.pendingRequests.length} pending registration requests`,
        icon: 'user-check',
        action: 'navigate:/admin/registrations/pending',
        count: data.pendingRequests.length,
        priority: data.pendingRequests.length > 5 ? 'high' : 'medium'
      });
    }

    // User management action
    if (data.userManagement.suspendedUsers > 0) {
      actions.push({
        id: 'manage-suspended-users',
        label: 'Suspended Users',
        description: `${data.userManagement.suspendedUsers} users need attention`,
        icon: 'user-x',
        action: 'navigate:/admin/users/suspended',
        count: data.userManagement.suspendedUsers,
        priority: 'medium'
      });
    }

    // System monitoring action
    actions.push({
      id: 'system-stats',
      label: 'System Statistics',
      description: 'View detailed system metrics',
      icon: 'bar-chart',
      action: 'navigate:/admin/system/stats',
      priority: 'low'
    });

    return actions;
  }

  private generateNotifications(data: AppAdminDashboardData): DashboardNotification[] {
    const notifications: DashboardNotification[] = [];

    // Urgent registrations notification
    const urgentRequests = data.pendingRequests.filter(req => 
      Date.now() - req.submittedAt.getTime() > 7 * 24 * 60 * 60 * 1000
    );

    if (urgentRequests.length > 0) {
      notifications.push({
        id: 'urgent-registrations',
        type: 'warning',
        title: 'Urgent Registration Requests',
        message: `${urgentRequests.length} registration requests have been pending for more than 7 days`,
        timestamp: new Date(),
        isRead: false,
        actionUrl: '/admin/registrations/pending'
      });
    }

    // New registrations notification
    const recentRequests = data.pendingRequests.filter(req => 
      Date.now() - req.submittedAt.getTime() < 24 * 60 * 60 * 1000
    );

    if (recentRequests.length > 0) {
      notifications.push({
        id: 'new-registrations',
        type: 'info',
        title: 'New Registration Requests',
        message: `${recentRequests.length} new registration requests received today`,
        timestamp: new Date(),
        isRead: false,
        actionUrl: '/admin/registrations/pending'
      });
    }

    // System health notification
    const activeUserPercentage = (data.systemStats.activeUsers / data.systemStats.totalUsers) * 100;
    if (activeUserPercentage < 80) {
      notifications.push({
        id: 'low-active-users',
        type: 'warning',
        title: 'Low Active User Rate',
        message: `Only ${activeUserPercentage.toFixed(1)}% of users are currently active`,
        timestamp: new Date(),
        isRead: false,
        actionUrl: '/admin/users/all'
      });
    }

    return notifications;
  }

  private createProfileSummary(role: UserRole, profileData: any): string {
    switch (role) {
      case UserRole.FARM_ADMIN:
        return `Business: ${profileData?.businessName || 'N/A'} | Farm Size: ${profileData?.farmSize || 'N/A'} acres`;
      case UserRole.FIELD_MANAGER:
        return `Experience: ${profileData?.experience || 'N/A'} years | Specializations: ${profileData?.specializations?.join(', ') || 'N/A'}`;
      case UserRole.FARMER:
        return `Commodities: ${profileData?.commodityTypes?.join(', ') || 'N/A'} | Capacity: ${profileData?.productionCapacity || 'N/A'}`;
      case UserRole.INPUT_SUPPLIER:
        return `Business: ${profileData?.businessName || 'N/A'} | Services: ${profileData?.serviceAreas?.join(', ') || 'N/A'}`;
      case UserRole.LORRY_AGENCY:
        return `Business: ${profileData?.businessName || 'N/A'} | Capacity: ${profileData?.capacity || 'N/A'}`;
      case UserRole.FIELD_EQUIPMENT_MANAGER:
        return `Services: ${profileData?.serviceAreas?.join(', ') || 'N/A'} | Certifications: ${profileData?.certifications?.join(', ') || 'N/A'}`;
      case UserRole.DEALER:
        return `Business: ${profileData?.businessName || 'N/A'} | Areas: ${profileData?.serviceAreas?.join(', ') || 'N/A'}`;
      default:
        return 'Profile information available';
    }
  }
}