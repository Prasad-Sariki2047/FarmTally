import { RegistrationRequest, ApprovalDecision } from '../models';
import { ApprovalStatus, UserRole, UserStatus } from '../models/common.types';
import { RegistrationRepository } from '../repositories/registration.repository';
import { UserRepository } from '../repositories/user.repository';
import { NotificationService } from './notification.service';

export interface ApprovalWorkflowEngine {
  submitForApproval(request: RegistrationRequest): Promise<void>;
  processApproval(requestId: string, decision: ApprovalDecision): Promise<void>;
  getPendingRequests(): Promise<RegistrationRequest[]>;
  getRequestById(requestId: string): Promise<RegistrationRequest | null>;
  notifyApprovalDecision(userId: string, decision: ApprovalDecision): Promise<void>;
  getRequestsByStatus(status: string): Promise<RegistrationRequest[]>;
}

export interface ApprovalResult {
  success: boolean;
  message: string;
  registrationRequest?: RegistrationRequest;
}

export class ApprovalWorkflowEngineImpl implements ApprovalWorkflowEngine {
  constructor(
    private registrationRepository: RegistrationRepository,
    private userRepository: UserRepository,
    private notificationService: NotificationService
  ) {}

  /**
   * Submit registration request for approval
   * Requirements: 1.5, 2.1
   */
  async submitForApproval(request: RegistrationRequest): Promise<void> {
    // Validate request
    if (!request.userData || !request.userData.email || !request.userData.selectedRole) {
      throw new Error('Invalid registration request data');
    }

    // Update request status to pending
    await this.registrationRepository.update(request.id, {
      status: ApprovalStatus.PENDING,
      submittedAt: new Date(),
      updatedAt: new Date()
    });

    // Notify App Admins
    await this.notifyAppAdminsOfNewRequest(request);
  }

  /**
   * Process approval or rejection decision
   * Requirements: 2.2, 2.4, 2.5
   */
  async processApproval(requestId: string, decision: ApprovalDecision): Promise<void> {
    const request = await this.registrationRepository.findById(requestId);
    if (!request) {
      throw new Error('Registration request not found');
    }

    if (request.status !== ApprovalStatus.PENDING) {
      throw new Error('Registration request is not in pending status');
    }

    // Update request with decision
    const updatedRequest = await this.registrationRepository.update(requestId, {
      status: decision.approved ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED,
      reviewedAt: decision.timestamp,
      reviewedBy: decision.appAdminId,
      rejectionReason: decision.reason,
      updatedAt: new Date()
    });

    if (decision.approved) {
      // Create user account
      await this.createUserFromApprovedRequest(updatedRequest);
    }

    // Notify user of decision
    await this.notifyUserOfDecision(updatedRequest, decision);
  }

  /**
   * Get all pending registration requests
   * Requirements: 2.1
   */
  async getPendingRequests(): Promise<RegistrationRequest[]> {
    return await this.registrationRepository.findByStatus(ApprovalStatus.PENDING);
  }

  /**
   * Get registration request by ID
   */
  async getRequestById(requestId: string): Promise<RegistrationRequest | null> {
    return await this.registrationRepository.findById(requestId);
  }

  /**
   * Get requests by status
   */
  async getRequestsByStatus(status: string): Promise<RegistrationRequest[]> {
    const approvalStatus = status as ApprovalStatus;
    if (!Object.values(ApprovalStatus).includes(approvalStatus)) {
      throw new Error('Invalid approval status');
    }
    return await this.registrationRepository.findByStatus(approvalStatus);
  }

  /**
   * Notify user of approval decision
   * Requirements: 2.3, 2.4
   */
  async notifyApprovalDecision(userId: string, decision: ApprovalDecision): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (decision.approved) {
      await this.notificationService.sendApprovalNotification(
        user.email,
        true,
        'Your FarmTally registration has been approved. You can now log in to access your dashboard.'
      );
    } else {
      await this.notificationService.sendApprovalNotification(
        user.email,
        false,
        decision.reason || 'Your registration request has been rejected.'
      );
    }
  }

  /**
   * Approve registration request
   * Requirements: 2.2, 2.4
   */
  async approveRegistration(requestId: string, appAdminId: string): Promise<ApprovalResult> {
    try {
      const decision: ApprovalDecision = {
        approved: true,
        appAdminId,
        timestamp: new Date()
      };

      await this.processApproval(requestId, decision);

      return {
        success: true,
        message: 'Registration approved successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Approval failed'
      };
    }
  }

  /**
   * Reject registration request
   * Requirements: 2.5
   */
  async rejectRegistration(requestId: string, appAdminId: string, reason: string): Promise<ApprovalResult> {
    try {
      const decision: ApprovalDecision = {
        approved: false,
        reason,
        appAdminId,
        timestamp: new Date()
      };

      await this.processApproval(requestId, decision);

      return {
        success: true,
        message: 'Registration rejected successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Rejection failed'
      };
    }
  }

  /**
   * Get registration statistics for App Admin dashboard
   * Requirements: 2.1
   */
  async getRegistrationStatistics(): Promise<{
    pending: number;
    approved: number;
    rejected: number;
    total: number;
  }> {
    const [pending, approved, rejected, total] = await Promise.all([
      this.registrationRepository.findByStatus(ApprovalStatus.PENDING),
      this.registrationRepository.findByStatus(ApprovalStatus.APPROVED),
      this.registrationRepository.findByStatus(ApprovalStatus.REJECTED),
      this.registrationRepository.findAll()
    ]);

    return {
      pending: pending.length,
      approved: approved.length,
      rejected: rejected.length,
      total: total.length
    };
  }

  /**
   * Notify App Admins of new registration request
   * Requirements: 1.5, 2.1
   */
  private async notifyAppAdminsOfNewRequest(request: RegistrationRequest): Promise<void> {
    const appAdmins = await this.userRepository.findByRole(UserRole.APP_ADMIN);
    
    const subject = 'New Registration Request - FarmTally';
    const message = `
      A new user has requested access to FarmTally:
      
      Name: ${request.userData.fullName}
      Email: ${request.userData.email}
      Role: ${request.userData.selectedRole}
      Submitted: ${request.submittedAt.toLocaleString()}
      
      Please review and approve/reject this request in your admin dashboard.
      
      Request ID: ${request.id}
    `;

    for (const admin of appAdmins) {
      await this.notificationService.sendEmail(admin.email, subject, message);
    }
  }

  /**
   * Create user account from approved registration request
   * Requirements: 2.2, 2.4
   */
  private async createUserFromApprovedRequest(request: RegistrationRequest): Promise<void> {
    const userData = {
      ...request.userData,
      id: this.generateUserId(),
      status: UserStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.userRepository.create(request.userData);
  }

  /**
   * Notify user of approval/rejection decision
   * Requirements: 2.3, 2.4
   */
  private async notifyUserOfDecision(request: RegistrationRequest, decision: ApprovalDecision): Promise<void> {
    const email = request.userData.email;
    const fullName = request.userData.fullName;

    if (decision.approved) {
      const subject = 'Welcome to FarmTally - Registration Approved';
      const message = `
        Dear ${fullName},
        
        Congratulations! Your FarmTally registration has been approved.
        
        You can now log in to your ${request.userData.selectedRole} dashboard using your registered email address.
        
        Welcome to the FarmTally community!
        
        Best regards,
        The FarmTally Team
      `;

      await this.notificationService.sendEmail(email, subject, message);
    } else {
      const subject = 'FarmTally Registration Update';
      const message = `
        Dear ${fullName},
        
        Thank you for your interest in FarmTally. Unfortunately, your registration request has not been approved at this time.
        
        ${decision.reason ? `Reason: ${decision.reason}` : ''}
        
        If you have any questions or would like to reapply, please contact our support team.
        
        Best regards,
        The FarmTally Team
      `;

      await this.notificationService.sendEmail(email, subject, message);
    }
  }

  /**
   * Generate unique user ID
   */
  private generateUserId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}