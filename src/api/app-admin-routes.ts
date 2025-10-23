import { AdminControllerImpl } from './admin.controller';
import { DashboardControllerImpl } from './dashboard.controller';
import { UserRole } from '../models/common.types';

// Generic HTTP request/response interfaces
export interface HttpRequest {
  user?: {
    id: string;
    role: UserRole;
  };
  params: Record<string, string>;
  body: any;
}

export interface HttpResponse {
  status(code: number): HttpResponse;
  json(data: any): void;
}

/**
 * App Admin Dashboard Routes
 * Requirements: 2.1, 2.2, 2.5 - App Admin dashboard interface
 */
export class AppAdminRoutes {
  constructor(
    private adminController: AdminControllerImpl,
    private dashboardController: DashboardControllerImpl
  ) {}

  /**
   * GET /admin/dashboard
   * Get App Admin dashboard data with pending registrations and system stats
   * Requirements: 2.1 - Display pending registration requests and system oversight
   */
  async getDashboard(req: HttpRequest, res: HttpResponse): Promise<void> {
    try {
      // Verify user is App Admin (in real implementation, this would be middleware)
      const userRole = req.user?.role;
      if (userRole !== UserRole.APP_ADMIN) {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
      }

      const result = await this.dashboardController.getAppAdminDashboard();
      
      if (result.success) {
        res.json({
          success: true,
          data: result.data
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to load dashboard data'
        });
      }
    } catch (error) {
      console.error('Error in App Admin dashboard route:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * GET /admin/registrations/pending
   * Get pending registration requests for approval workflow
   * Requirements: 2.1 - Pending registration requests interface
   */
  async getPendingRegistrations(req: HttpRequest, res: HttpResponse): Promise<void> {
    try {
      const userRole = req.user?.role;
      if (userRole !== UserRole.APP_ADMIN) {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
      }

      const result = await this.adminController.getPendingRegistrations();
      res.json(result);
    } catch (error) {
      console.error('Error getting pending registrations:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * POST /admin/registrations/:requestId/approve
   * Approve a registration request
   * Requirements: 2.2 - App Admin approval processing
   */
  async approveRegistration(req: HttpRequest, res: HttpResponse): Promise<void> {
    try {
      const userRole = req.user?.role;
      const userId = req.user?.id;
      
      if (userRole !== UserRole.APP_ADMIN) {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
      }

      const { requestId } = req.params;
      
      if (!userId) {
        res.status(401).json({ success: false, message: 'User ID not found' });
        return;
      }

      const decision = {
        approved: true,
        appAdminId: userId,
        timestamp: new Date()
      };

      const result = await this.adminController.approveRegistration(requestId, decision);
      res.json(result);
    } catch (error) {
      console.error('Error approving registration:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * POST /admin/registrations/:requestId/reject
   * Reject a registration request with reason
   * Requirements: 2.5 - App Admin rejection with reason documentation
   */
  async rejectRegistration(req: HttpRequest, res: HttpResponse): Promise<void> {
    try {
      const userRole = req.user?.role;
      const userId = req.user?.id;
      
      if (userRole !== UserRole.APP_ADMIN) {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
      }

      const { requestId } = req.params;
      const { reason } = req.body;

      if (!userId) {
        res.status(401).json({ success: false, message: 'User ID not found' });
        return;
      }

      if (!reason || reason.trim().length === 0) {
        res.status(400).json({
          success: false,
          message: 'Rejection reason is required'
        });
        return;
      }

      const decision = {
        approved: false,
        reason: reason.trim(),
        appAdminId: userId,
        timestamp: new Date()
      };

      const result = await this.adminController.rejectRegistration(requestId, decision);
      res.json(result);
    } catch (error) {
      console.error('Error rejecting registration:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * GET /admin/users
   * Get all users for user management
   * Requirements: 2.1 - User management and system oversight
   */
  async getAllUsers(req: HttpRequest, res: HttpResponse): Promise<void> {
    try {
      const userRole = req.user?.role;
      if (userRole !== UserRole.APP_ADMIN) {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
      }

      const result = await this.adminController.getAllUsers();
      res.json(result);
    } catch (error) {
      console.error('Error getting all users:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * POST /admin/users/:userId/suspend
   * Suspend a user account
   * Requirements: 2.1 - User management and system oversight
   */
  async suspendUser(req: HttpRequest, res: HttpResponse): Promise<void> {
    try {
      const userRole = req.user?.role;
      if (userRole !== UserRole.APP_ADMIN) {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
      }

      const { userId } = req.params;
      const { reason } = req.body;

      if (!reason || reason.trim().length === 0) {
        res.status(400).json({
          success: false,
          message: 'Suspension reason is required'
        });
        return;
      }

      const result = await this.adminController.suspendUser(userId, reason.trim());
      res.json(result);
    } catch (error) {
      console.error('Error suspending user:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * POST /admin/users/:userId/reactivate
   * Reactivate a suspended user account
   * Requirements: 2.1 - User management and system oversight
   */
  async reactivateUser(req: HttpRequest, res: HttpResponse): Promise<void> {
    try {
      const userRole = req.user?.role;
      if (userRole !== UserRole.APP_ADMIN) {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
      }

      const { userId } = req.params;
      const result = await this.adminController.reactivateUser(userId);
      res.json(result);
    } catch (error) {
      console.error('Error reactivating user:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * GET /admin/system/stats
   * Get system statistics for monitoring
   * Requirements: 2.1 - System oversight features
   */
  async getSystemStats(req: HttpRequest, res: HttpResponse): Promise<void> {
    try {
      const userRole = req.user?.role;
      if (userRole !== UserRole.APP_ADMIN) {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
      }

      const result = await this.adminController.getSystemStats();
      res.json(result);
    } catch (error) {
      console.error('Error getting system stats:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * GET /admin/dashboard/config
   * Get App Admin dashboard configuration
   * Requirements: 2.1 - App Admin dashboard interface
   */
  async getDashboardConfig(req: HttpRequest, res: HttpResponse): Promise<void> {
    try {
      const userRole = req.user?.role;
      if (userRole !== UserRole.APP_ADMIN) {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
      }

      const result = await this.dashboardController.getDashboardConfig(UserRole.APP_ADMIN);
      res.json(result);
    } catch (error) {
      console.error('Error getting dashboard config:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

// Route setup function for framework integration
export function setupAppAdminRoutes(
  adminController: AdminControllerImpl,
  dashboardController: DashboardControllerImpl
) {
  const routes = new AppAdminRoutes(adminController, dashboardController);

  return {
    // Dashboard routes
    'GET /admin/dashboard': routes.getDashboard.bind(routes),
    'GET /admin/dashboard/config': routes.getDashboardConfig.bind(routes),
    
    // Registration management routes
    'GET /admin/registrations/pending': routes.getPendingRegistrations.bind(routes),
    'POST /admin/registrations/:requestId/approve': routes.approveRegistration.bind(routes),
    'POST /admin/registrations/:requestId/reject': routes.rejectRegistration.bind(routes),
    
    // User management routes
    'GET /admin/users': routes.getAllUsers.bind(routes),
    'POST /admin/users/:userId/suspend': routes.suspendUser.bind(routes),
    'POST /admin/users/:userId/reactivate': routes.reactivateUser.bind(routes),
    
    // System oversight routes
    'GET /admin/system/stats': routes.getSystemStats.bind(routes)
  };
}