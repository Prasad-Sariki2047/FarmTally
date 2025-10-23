import { RegistrationRequest, ApprovalDecision, User } from '../models';
import { ApprovalStatus, UserRole, UserStatus } from '../models/common.types';
import { ApprovalWorkflowEngineImpl } from '../services/approval-workflow.service';
import { UserRepository } from '../repositories/user.repository';
import { RegistrationRepository } from '../repositories/registration.repository';
import { NotificationService } from '../services/notification.service';

export interface AdminController {
  // Registration approval management
  getPendingRegistrations(): Promise<{ success: boolean; requests?: RegistrationRequest[] }>;
  getRegistrationById(requestId: string): Promise<{ success: boolean; request?: RegistrationRequest }>;
  approveRegistration(requestId: string, decision: ApprovalDecision): Promise<{ success: boolean; message: string }>;
  rejectRegistration(requestId: string, decision: ApprovalDecision): Promise<{ success: boolean; message: string }>;
  
  // User management
  getAllUsers(): Promise<{ success: boolean; users?: User[] }>;
  getUserById(userId: string): Promise<{ success: boolean; user?: User }>;
  suspendUser(userId: string, reason: string): Promise<{ success: boolean; message: string }>;
  reactivateUser(userId: string): Promise<{ success: boolean; message: string }>;
  
  // System oversight
  getSystemStats(): Promise<{ success: boolean; stats?: SystemStats }>;
  getAuditLogs(): Promise<{ success: boolean; logs?: AuditLog[] }>;
  
  // App Admin dashboard specific
  getAppAdminDashboardData(): Promise<{ success: boolean; data?: AppAdminDashboardData }>;
}

export interface SystemStats {
  totalUsers: number;
  activeUsers: number;
  pendingRegistrations: number;
  usersByRole: Record<UserRole, number>;
  registrationsByStatus: Record<ApprovalStatus, number>;
  recentActivity: {
    newRegistrations: number;
    approvedToday: number;
    rejectedToday: number;
  };
}

export interface AuditLog {
  id: string;
  action: string;
  userId: string;
  targetId?: string;
  details: string;
  timestamp: Date;
  ipAddress?: string;
}

export interface AppAdminDashboardData {
  pendingRequests: RegistrationRequest[];
  systemStats: SystemStats;
  recentActivity: AuditLog[];
  userManagement: {
    totalUsers: number;
    activeUsers: number;
    suspendedUsers: number;
    usersByRole: Record<UserRole, number>;
  };
}

export class AdminControllerImpl implements AdminController {
  constructor(
    private approvalWorkflowEngine: ApprovalWorkflowEngineImpl,
    private userRepository: UserRepository,
    private registrationRepository: RegistrationRepository,
    private notificationService: NotificationService
  ) {}

  /**
   * Get pending registration requests for App Admin dashboard
   * Requirements: 2.1 - Display pending registration requests
   */
  async getPendingRegistrations(): Promise<{ success: boolean; requests?: RegistrationRequest[] }> {
    try {
      const requests = await this.approvalWorkflowEngine.getPendingRequests();
      return { success: true, requests };
    } catch (error) {
      console.error('Error getting pending registrations:', error);
      return { success: false };
    }
  }

  /**
   * Get registration request by ID
   */
  async getRegistrationById(requestId: string): Promise<{ success: boolean; request?: RegistrationRequest }> {
    try {
      const request = await this.approvalWorkflowEngine.getRequestById(requestId);
      if (!request) {
        return { success: false };
      }
      return { success: true, request };
    } catch (error) {
      console.error('Error getting registration by ID:', error);
      return { success: false };
    }
  }

  /**
   * Approve registration request
   * Requirements: 2.2 - App Admin approval processing
   */
  async approveRegistration(requestId: string, decision: ApprovalDecision): Promise<{ success: boolean; message: string }> {
    try {
      await this.approvalWorkflowEngine.processApproval(requestId, decision);
      return { success: true, message: 'Registration approved successfully' };
    } catch (error) {
      console.error('Error approving registration:', error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to approve registration' 
      };
    }
  }

  /**
   * Reject registration request
   * Requirements: 2.5 - App Admin rejection with reason
   */
  async rejectRegistration(requestId: string, decision: ApprovalDecision): Promise<{ success: boolean; message: string }> {
    try {
      await this.approvalWorkflowEngine.processApproval(requestId, decision);
      return { success: true, message: 'Registration rejected successfully' };
    } catch (error) {
      console.error('Error rejecting registration:', error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to reject registration' 
      };
    }
  }

  /**
   * Get all users for system oversight
   * Requirements: 2.1 - User management and system oversight
   */
  async getAllUsers(): Promise<{ success: boolean; users?: User[] }> {
    try {
      const users = await this.userRepository.findAll();
      return { success: true, users };
    } catch (error) {
      console.error('Error getting all users:', error);
      return { success: false };
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<{ success: boolean; user?: User }> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        return { success: false };
      }
      return { success: true, user };
    } catch (error) {
      console.error('Error getting user by ID:', error);
      return { success: false };
    }
  }

  /**
   * Suspend user account
   * Requirements: 2.1 - User management and system oversight
   */
  async suspendUser(userId: string, reason: string): Promise<{ success: boolean; message: string }> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        return { success: false, message: 'User not found' };
      }

      await this.userRepository.update(userId, { 
        status: UserStatus.SUSPENDED,
        updatedAt: new Date()
      });

      // Log the action
      await this.logAuditAction('USER_SUSPENDED', userId, userId, `User suspended: ${reason}`);

      // Notify user
      await this.notificationService.sendEmail(
        user.email,
        'Account Suspended - FarmTally',
        `Your FarmTally account has been suspended. Reason: ${reason}. Please contact support for assistance.`
      );

      return { success: true, message: 'User suspended successfully' };
    } catch (error) {
      console.error('Error suspending user:', error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to suspend user' 
      };
    }
  }

  /**
   * Reactivate suspended user account
   * Requirements: 2.1 - User management and system oversight
   */
  async reactivateUser(userId: string): Promise<{ success: boolean; message: string }> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        return { success: false, message: 'User not found' };
      }

      await this.userRepository.update(userId, { 
        status: UserStatus.ACTIVE,
        updatedAt: new Date()
      });

      // Log the action
      await this.logAuditAction('USER_REACTIVATED', userId, userId, 'User account reactivated');

      // Notify user
      await this.notificationService.sendEmail(
        user.email,
        'Account Reactivated - FarmTally',
        'Your FarmTally account has been reactivated. You can now log in and access your dashboard.'
      );

      return { success: true, message: 'User reactivated successfully' };
    } catch (error) {
      console.error('Error reactivating user:', error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to reactivate user' 
      };
    }
  }

  /**
   * Get system statistics for App Admin dashboard
   * Requirements: 2.1 - System oversight features
   */
  async getSystemStats(): Promise<{ success: boolean; stats?: SystemStats }> {
    try {
      const [allUsers, allRegistrations] = await Promise.all([
        this.userRepository.findAll(),
        this.registrationRepository.findAll()
      ]);

      const activeUsers = allUsers.filter(user => user.status === UserStatus.ACTIVE);
      const pendingRegistrations = allRegistrations.filter(req => req.status === ApprovalStatus.PENDING);

      // Count users by role
      const usersByRole = {} as Record<UserRole, number>;
      Object.values(UserRole).forEach(role => {
        usersByRole[role] = allUsers.filter(user => user.role === role).length;
      });

      // Count registrations by status
      const registrationsByStatus = {} as Record<ApprovalStatus, number>;
      Object.values(ApprovalStatus).forEach(status => {
        registrationsByStatus[status] = allRegistrations.filter(req => req.status === status).length;
      });

      // Calculate recent activity (last 24 hours)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const recentRegistrations = allRegistrations.filter(req => 
        req.submittedAt && req.submittedAt > yesterday
      );
      const approvedToday = allRegistrations.filter(req => 
        req.reviewedAt && req.reviewedAt > yesterday && req.status === ApprovalStatus.APPROVED
      );
      const rejectedToday = allRegistrations.filter(req => 
        req.reviewedAt && req.reviewedAt > yesterday && req.status === ApprovalStatus.REJECTED
      );

      const stats: SystemStats = {
        totalUsers: allUsers.length,
        activeUsers: activeUsers.length,
        pendingRegistrations: pendingRegistrations.length,
        usersByRole,
        registrationsByStatus,
        recentActivity: {
          newRegistrations: recentRegistrations.length,
          approvedToday: approvedToday.length,
          rejectedToday: rejectedToday.length
        }
      };

      return { success: true, stats };
    } catch (error) {
      console.error('Error getting system stats:', error);
      return { success: false };
    }
  }

  /**
   * Get audit logs for system monitoring
   * Requirements: 2.1 - System oversight features
   */
  async getAuditLogs(): Promise<{ success: boolean; logs?: AuditLog[] }> {
    try {
      // In a real implementation, this would fetch from an audit log repository
      // For now, return empty array as audit logging is not fully implemented
      const logs: AuditLog[] = [];
      return { success: true, logs };
    } catch (error) {
      console.error('Error getting audit logs:', error);
      return { success: false };
    }
  }

  /**
   * Get comprehensive App Admin dashboard data
   * Requirements: 2.1, 2.2, 2.5 - App Admin dashboard interface
   */
  async getAppAdminDashboardData(): Promise<{ success: boolean; data?: AppAdminDashboardData }> {
    try {
      const [pendingResult, statsResult, logsResult, allUsers] = await Promise.all([
        this.getPendingRegistrations(),
        this.getSystemStats(),
        this.getAuditLogs(),
        this.getAllUsers()
      ]);

      if (!pendingResult.success || !statsResult.success || !logsResult.success || !allUsers.success) {
        return { success: false };
      }

      const users = allUsers.users || [];
      const suspendedUsers = users.filter(user => user.status === UserStatus.SUSPENDED);

      // Count users by role
      const usersByRole = {} as Record<UserRole, number>;
      Object.values(UserRole).forEach(role => {
        usersByRole[role] = users.filter(user => user.role === role).length;
      });

      const data: AppAdminDashboardData = {
        pendingRequests: pendingResult.requests || [],
        systemStats: statsResult.stats!,
        recentActivity: logsResult.logs || [],
        userManagement: {
          totalUsers: users.length,
          activeUsers: users.filter(user => user.status === UserStatus.ACTIVE).length,
          suspendedUsers: suspendedUsers.length,
          usersByRole
        }
      };

      return { success: true, data };
    } catch (error) {
      console.error('Error getting App Admin dashboard data:', error);
      return { success: false };
    }
  }

  /**
   * Log audit action (placeholder implementation)
   */
  private async logAuditAction(action: string, userId: string, targetId: string, details: string): Promise<void> {
    // In a real implementation, this would save to an audit log repository
    console.log(`Audit Log: ${action} by ${userId} on ${targetId} - ${details}`);
  }
}