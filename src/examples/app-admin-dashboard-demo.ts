/**
 * App Admin Dashboard Demo
 * Demonstrates the complete App Admin dashboard functionality
 * Requirements: 2.1, 2.2, 2.5 - App Admin dashboard interface
 */

import { AdminControllerImpl } from '../api/admin.controller';
import { DashboardControllerImpl } from '../api/dashboard.controller';
import { AppAdminDashboardComponentImpl } from '../components/app-admin-dashboard.component';
import { WidgetRendererImpl } from '../services/widget-renderer.service';
import { UserRole } from '../models/common.types';

// Mock implementations for demonstration
class MockUserRepository {
  async findAll() {
    return [
      { id: '1', fullName: 'John Doe', email: 'john@example.com', role: UserRole.FARM_ADMIN, status: 'active', createdAt: new Date() },
      { id: '2', fullName: 'Jane Smith', email: 'jane@example.com', role: UserRole.FIELD_MANAGER, status: 'active', createdAt: new Date() },
      { id: '3', fullName: 'Bob Wilson', email: 'bob@example.com', role: UserRole.FARMER, status: 'suspended', createdAt: new Date() }
    ];
  }

  async findById(id: string) {
    const users = await this.findAll();
    return users.find(u => u.id === id) || null;
  }

  async findByRole(role: UserRole) {
    const users = await this.findAll();
    return users.filter(u => u.role === role);
  }

  async update(id: string, updates: any) {
    const user = await this.findById(id);
    return user ? { ...user, ...updates } : null;
  }
}

class MockRegistrationRepository {
  async findAll() {
    return [
      {
        id: 'req_001',
        userData: {
          fullName: 'Alice Johnson',
          email: 'alice@example.com',
          selectedRole: UserRole.FARM_ADMIN,
          profileData: { businessName: 'Green Valley Farm', farmSize: 150 }
        },
        status: 'pending',
        submittedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      },
      {
        id: 'req_002',
        userData: {
          fullName: 'Mike Brown',
          email: 'mike@example.com',
          selectedRole: UserRole.INPUT_SUPPLIER,
          profileData: { businessName: 'AgriSupply Co', serviceAreas: ['fertilizers'] }
        },
        status: 'pending',
        submittedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
      }
    ];
  }

  async findByStatus(status: string) {
    const requests = await this.findAll();
    return requests.filter(r => r.status === status);
  }

  async findById(id: string) {
    const requests = await this.findAll();
    return requests.find(r => r.id === id) || null;
  }

  async update(id: string, updates: any) {
    const request = await this.findById(id);
    return request ? { ...request, ...updates } : null;
  }
}

class MockBusinessRelationshipRepository {
  async findRelationshipsByFarmAdmin(farmAdminId: string) {
    return [];
  }

  async findRelationshipsByServiceProvider(serviceProviderId: string) {
    return [];
  }
}

class MockNotificationService {
  async sendEmail(email: string, subject: string, message: string) {
    console.log(`Email sent to ${email}: ${subject}`);
    return Promise.resolve();
  }

  async sendApprovalNotification(email: string, approved: boolean, message: string) {
    console.log(`Approval notification sent to ${email}: ${approved ? 'Approved' : 'Rejected'} - ${message}`);
    return Promise.resolve();
  }
}

/**
 * Demonstrate App Admin Dashboard functionality
 */
export async function demonstrateAppAdminDashboard() {
  console.log('=== App Admin Dashboard Demo ===\n');

  // Initialize mock dependencies
  const userRepository = new MockUserRepository() as any;
  const registrationRepository = new MockRegistrationRepository() as any;
  const businessRelationshipRepository = new MockBusinessRelationshipRepository() as any;
  const notificationService = new MockNotificationService() as any;

  // Initialize services
  const approvalWorkflowEngine = new (class {
    async getPendingRequests() {
      return await registrationRepository.findByStatus('pending');
    }

    async getRequestById(id: string) {
      return await registrationRepository.findById(id);
    }

    async processApproval(requestId: string, decision: any) {
      console.log(`Processing approval for request ${requestId}:`, decision);
      await registrationRepository.update(requestId, {
        status: decision.approved ? 'approved' : 'rejected',
        reviewedAt: decision.timestamp,
        reviewedBy: decision.appAdminId,
        rejectionReason: decision.reason
      });
    }

    async getRegistrationStatistics() {
      const all = await registrationRepository.findAll();
      return {
        pending: all.filter((r: any) => r.status === 'pending').length,
        approved: all.filter((r: any) => r.status === 'approved').length,
        rejected: all.filter((r: any) => r.status === 'rejected').length,
        total: all.length
      };
    }
  })() as any;

  const widgetRenderer = new WidgetRendererImpl(businessRelationshipRepository);

  // Initialize controllers
  const adminController = new AdminControllerImpl(
    approvalWorkflowEngine,
    userRepository,
    registrationRepository,
    notificationService
  );

  const dashboardController = new DashboardControllerImpl(
    null as any, // dashboardService not needed for this demo
    adminController,
    userRepository
  );

  // Initialize dashboard component
  const dashboardComponent = new AppAdminDashboardComponentImpl(
    adminController,
    dashboardController,
    widgetRenderer
  );

  try {
    // 1. Load dashboard data
    console.log('1. Loading App Admin Dashboard...');
    const dashboardView = await dashboardComponent.loadDashboard();
    
    console.log('Dashboard loaded successfully!');
    console.log(`- Pending registrations: ${dashboardView.pendingRegistrations.count}`);
    console.log(`- Total users: ${dashboardView.systemOverview.totalUsers}`);
    console.log(`- Active users: ${dashboardView.systemOverview.activeUsers}`);
    console.log(`- Quick actions available: ${dashboardView.quickActions.length}`);
    console.log(`- Notifications: ${dashboardView.notifications.length}\n`);

    // 2. Display pending registrations
    console.log('2. Pending Registration Requests:');
    dashboardView.pendingRegistrations.items.forEach((request, index) => {
      console.log(`   ${index + 1}. ${request.applicantName} (${request.role})`);
      console.log(`      Email: ${request.email}`);
      console.log(`      Days pending: ${request.daysPending}`);
      console.log(`      Profile: ${request.profileSummary}`);
      console.log(`      Urgent: ${request.isUrgent ? 'Yes' : 'No'}\n`);
    });

    // 3. Demonstrate approval workflow
    console.log('3. Demonstrating Approval Workflow...');
    const firstRequest = dashboardView.pendingRegistrations.items[0];
    if (firstRequest) {
      console.log(`Approving registration for ${firstRequest.applicantName}...`);
      const approvalResult = await dashboardComponent.approveRegistration(
        firstRequest.id,
        'admin_001'
      );
      console.log(`Approval result: ${approvalResult.success ? 'Success' : 'Failed'} - ${approvalResult.message}\n`);
    }

    // 4. Demonstrate rejection workflow
    const secondRequest = dashboardView.pendingRegistrations.items[1];
    if (secondRequest) {
      console.log(`Rejecting registration for ${secondRequest.applicantName}...`);
      const rejectionResult = await dashboardComponent.rejectRegistration(
        secondRequest.id,
        'admin_001',
        'Incomplete business documentation provided'
      );
      console.log(`Rejection result: ${rejectionResult.success ? 'Success' : 'Failed'} - ${rejectionResult.message}\n`);
    }

    // 5. Display system statistics
    console.log('4. System Statistics:');
    const statsResult = await adminController.getSystemStats();
    if (statsResult.success && statsResult.stats) {
      const stats = statsResult.stats;
      console.log(`   Total users: ${stats.totalUsers}`);
      console.log(`   Active users: ${stats.activeUsers}`);
      console.log(`   Pending registrations: ${stats.pendingRegistrations}`);
      console.log('   Users by role:');
      Object.entries(stats.usersByRole).forEach(([role, count]) => {
        console.log(`     ${role}: ${count}`);
      });
      console.log('   Recent activity:');
      console.log(`     New registrations: ${stats.recentActivity.newRegistrations}`);
      console.log(`     Approved today: ${stats.recentActivity.approvedToday}`);
      console.log(`     Rejected today: ${stats.recentActivity.rejectedToday}\n`);
    }

    // 6. Display quick actions
    console.log('5. Available Quick Actions:');
    dashboardView.quickActions.forEach((action, index) => {
      console.log(`   ${index + 1}. ${action.label} (${action.priority} priority)`);
      console.log(`      ${action.description}`);
      console.log(`      Action: ${action.action}`);
      if (action.count) {
        console.log(`      Count: ${action.count}`);
      }
      console.log('');
    });

    // 7. Display notifications
    console.log('6. Dashboard Notifications:');
    dashboardView.notifications.forEach((notification, index) => {
      console.log(`   ${index + 1}. [${notification.type.toUpperCase()}] ${notification.title}`);
      console.log(`      ${notification.message}`);
      console.log(`      Time: ${notification.timestamp.toLocaleString()}`);
      if (notification.actionUrl) {
        console.log(`      Action: ${notification.actionUrl}`);
      }
      console.log('');
    });

    console.log('=== App Admin Dashboard Demo Complete ===');

  } catch (error) {
    console.error('Error during dashboard demo:', error);
  }
}

// Export for use in other modules
export {
  MockUserRepository,
  MockRegistrationRepository,
  MockBusinessRelationshipRepository,
  MockNotificationService
};