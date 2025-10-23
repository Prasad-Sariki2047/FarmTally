import { User, RegistrationRequest } from '../models';
import { UserStatus, ApprovalStatus } from '../models/common.types';
import { UserRepository } from '../repositories/user.repository';
import { RegistrationRepository } from '../repositories/registration.repository';
import { NotificationService } from './notification.service';

export interface UserActivationService {
  activateUserFromApproval(registrationId: string): Promise<User>;
  sendActivationNotification(user: User): Promise<void>;
  sendRejectionNotification(email: string, fullName: string, reason?: string): Promise<void>;
  reactivateUser(userId: string): Promise<User>;
  deactivateUser(userId: string, reason: string): Promise<void>;
}

export interface ActivationResult {
  success: boolean;
  message: string;
  user?: User;
}

export class UserActivationServiceImpl implements UserActivationService {
  constructor(
    private userRepository: UserRepository,
    private registrationRepository: RegistrationRepository,
    private notificationService: NotificationService
  ) {}

  /**
   * Activate user account upon approval
   * Requirements: 2.3, 2.4
   */
  async activateUserFromApproval(registrationId: string): Promise<User> {
    const registration = await this.registrationRepository.findById(registrationId);
    if (!registration) {
      throw new Error('Registration request not found');
    }

    if (registration.status !== ApprovalStatus.APPROVED) {
      throw new Error('Registration request is not approved');
    }

    // Check if user already exists
    const existingUser = await this.userRepository.findByEmail(registration.userData.email);
    if (existingUser) {
      // Update existing user to active status
      const updatedUser = await this.userRepository.update(existingUser.id, {
        status: UserStatus.ACTIVE,
        role: registration.userData.selectedRole,
        profileData: registration.userData.profileData,
        updatedAt: new Date()
      });

      await this.sendActivationNotification(updatedUser);
      return updatedUser;
    }

    // Create new active user
    const userData = {
      ...registration.userData,
      id: this.generateUserId(),
      status: UserStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const newUser = await this.userRepository.create(registration.userData);
    
    // Update user status to active
    const activatedUser = await this.userRepository.update(newUser.id, {
      status: UserStatus.ACTIVE,
      updatedAt: new Date()
    });

    await this.sendActivationNotification(activatedUser);
    return activatedUser;
  }

  /**
   * Send approval notification email to user
   * Requirements: 2.3, 2.4
   */
  async sendActivationNotification(user: User): Promise<void> {
    const subject = 'Welcome to FarmTally - Account Activated';
    const message = this.generateActivationEmailContent(user);

    await this.notificationService.sendEmail(user.email, subject, message, true);
  }

  /**
   * Send rejection notification with reason
   * Requirements: 2.4
   */
  async sendRejectionNotification(email: string, fullName: string, reason?: string): Promise<void> {
    const subject = 'FarmTally Registration Update';
    const message = this.generateRejectionEmailContent(fullName, reason);

    await this.notificationService.sendEmail(email, subject, message, true);
  }

  /**
   * Reactivate a previously suspended user
   */
  async reactivateUser(userId: string): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (user.status === UserStatus.ACTIVE) {
      throw new Error('User is already active');
    }

    const reactivatedUser = await this.userRepository.update(userId, {
      status: UserStatus.ACTIVE,
      updatedAt: new Date()
    });

    await this.sendReactivationNotification(reactivatedUser);
    return reactivatedUser;
  }

  /**
   * Deactivate user account
   */
  async deactivateUser(userId: string, reason: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    await this.userRepository.update(userId, {
      status: UserStatus.SUSPENDED,
      updatedAt: new Date()
    });

    await this.sendDeactivationNotification(user, reason);
  }

  /**
   * Process user activation with comprehensive workflow
   * Requirements: 2.3, 2.4
   */
  async processUserActivation(registrationId: string): Promise<ActivationResult> {
    try {
      const user = await this.activateUserFromApproval(registrationId);
      
      return {
        success: true,
        message: 'User account activated successfully',
        user
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Activation failed'
      };
    }
  }

  /**
   * Process user rejection with notification
   * Requirements: 2.4
   */
  async processUserRejection(registrationId: string, reason?: string): Promise<ActivationResult> {
    try {
      const registration = await this.registrationRepository.findById(registrationId);
      if (!registration) {
        throw new Error('Registration request not found');
      }

      await this.sendRejectionNotification(
        registration.userData.email,
        registration.userData.fullName,
        reason
      );

      return {
        success: true,
        message: 'Rejection notification sent successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Rejection notification failed'
      };
    }
  }

  /**
   * Generate activation email content
   */
  private generateActivationEmailContent(user: User): string {
    const dashboardUrl = this.getDashboardUrlForRole(user.role);
    
    return `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2c5530;">Welcome to FarmTally!</h2>
            
            <p>Dear ${user.fullName},</p>
            
            <p>Congratulations! Your FarmTally registration has been approved and your account is now active.</p>
            
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #2c5530;">Account Details:</h3>
              <p><strong>Role:</strong> ${this.formatRoleName(user.role)}</p>
              <p><strong>Email:</strong> ${user.email}</p>
              <p><strong>Account Status:</strong> Active</p>
            </div>
            
            <p>You can now access your personalized dashboard and start using FarmTally's features:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${dashboardUrl}" 
                 style="background-color: #2c5530; color: white; padding: 12px 30px; 
                        text-decoration: none; border-radius: 5px; display: inline-block;">
                Access Your Dashboard
              </a>
            </div>
            
            <div style="background-color: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h4 style="margin-top: 0; color: #2c5530;">Getting Started:</h4>
              <ul>
                <li>Complete your profile information</li>
                <li>Explore your role-specific features</li>
                <li>Connect with other users in the agricultural supply chain</li>
                <li>Set up your business relationships</li>
              </ul>
            </div>
            
            <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
            
            <p>Welcome to the FarmTally community!</p>
            
            <p style="margin-top: 30px;">
              Best regards,<br>
              <strong>The FarmTally Team</strong>
            </p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="font-size: 12px; color: #666;">
              This email was sent to ${user.email}. If you did not request this account, please contact our support team.
            </p>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Generate rejection email content
   */
  private generateRejectionEmailContent(fullName: string, reason?: string): string {
    return `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #d32f2f;">FarmTally Registration Update</h2>
            
            <p>Dear ${fullName},</p>
            
            <p>Thank you for your interest in FarmTally. We have carefully reviewed your registration request.</p>
            
            <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
              <p style="margin: 0;"><strong>Registration Status:</strong> Not Approved</p>
              ${reason ? `<p style="margin: 10px 0 0 0;"><strong>Reason:</strong> ${reason}</p>` : ''}
            </div>
            
            <p>We understand this may be disappointing. Here are your next steps:</p>
            
            <ul>
              <li>Review the reason provided above (if applicable)</li>
              <li>Address any issues mentioned in the feedback</li>
              <li>Contact our support team if you need clarification</li>
              <li>You may reapply once you've addressed the concerns</li>
            </ul>
            
            <div style="background-color: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h4 style="margin-top: 0; color: #1976d2;">Need Help?</h4>
              <p style="margin-bottom: 0;">
                If you have questions about this decision or need assistance with your application, 
                please contact our support team at support@farmtally.com
              </p>
            </div>
            
            <p>We appreciate your interest in joining the FarmTally agricultural community.</p>
            
            <p style="margin-top: 30px;">
              Best regards,<br>
              <strong>The FarmTally Team</strong>
            </p>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Send reactivation notification
   */
  private async sendReactivationNotification(user: User): Promise<void> {
    const subject = 'FarmTally Account Reactivated';
    const message = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2c5530;">Account Reactivated</h2>
            
            <p>Dear ${user.fullName},</p>
            
            <p>Good news! Your FarmTally account has been reactivated and you can now access all features.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${this.getDashboardUrlForRole(user.role)}" 
                 style="background-color: #2c5530; color: white; padding: 12px 30px; 
                        text-decoration: none; border-radius: 5px; display: inline-block;">
                Access Your Dashboard
              </a>
            </div>
            
            <p>Welcome back to FarmTally!</p>
            
            <p>Best regards,<br><strong>The FarmTally Team</strong></p>
          </div>
        </body>
      </html>
    `;

    await this.notificationService.sendEmail(user.email, subject, message, true);
  }

  /**
   * Send deactivation notification
   */
  private async sendDeactivationNotification(user: User, reason: string): Promise<void> {
    const subject = 'FarmTally Account Suspended';
    const message = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #d32f2f;">Account Suspended</h2>
            
            <p>Dear ${user.fullName},</p>
            
            <p>Your FarmTally account has been temporarily suspended.</p>
            
            <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Reason:</strong> ${reason}</p>
            </div>
            
            <p>If you believe this is an error or would like to appeal this decision, please contact our support team.</p>
            
            <p>Best regards,<br><strong>The FarmTally Team</strong></p>
          </div>
        </body>
      </html>
    `;

    await this.notificationService.sendEmail(user.email, subject, message, true);
  }

  /**
   * Get dashboard URL for user role
   */
  private getDashboardUrlForRole(role: string): string {
    const baseUrl = process.env.FRONTEND_URL || 'https://app.farmtally.com';
    const roleRoutes: { [key: string]: string } = {
      'app_admin': '/admin/dashboard',
      'farm_admin': '/farm-admin/dashboard',
      'field_manager': '/field-manager/dashboard',
      'farmer': '/farmer/dashboard',
      'lorry_agency': '/lorry-agency/dashboard',
      'field_equipment_manager': '/equipment-manager/dashboard',
      'input_supplier': '/input-supplier/dashboard',
      'dealer': '/dealer/dashboard'
    };

    return `${baseUrl}${roleRoutes[role] || '/dashboard'}`;
  }

  /**
   * Format role name for display
   */
  private formatRoleName(role: string): string {
    const roleNames: { [key: string]: string } = {
      'app_admin': 'App Administrator',
      'farm_admin': 'Farm Administrator',
      'field_manager': 'Field Manager',
      'farmer': 'Farmer',
      'lorry_agency': 'Lorry Agency',
      'field_equipment_manager': 'Field Equipment Manager',
      'input_supplier': 'Input Supplier',
      'dealer': 'Dealer'
    };

    return roleNames[role] || role;
  }

  /**
   * Generate unique user ID
   */
  private generateUserId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}