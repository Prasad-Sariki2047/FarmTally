import { User, UserRegistrationData, UserProfileUpdates, RegistrationRequest, UserValidation } from '../models';
import { UserRole, UserStatus, ApprovalStatus, AuthenticationMethod, LinkPurpose } from '../models/common.types';
import { UserRepository } from '../repositories/user.repository';
import { RegistrationRepository } from '../repositories/registration.repository';
import { NotificationService } from './notification.service';
import { MagicLinkAuthService } from './magic-link-auth.service';
import { AuthenticationRepository } from '../repositories/authentication.repository';
import { SecurityService } from './security.service';

export interface UserManagementService {
  registerUser(userData: UserRegistrationData): Promise<RegistrationRequest>;
  activateUser(userId: string, roleId: string): Promise<User>;
  getUserByEmail(email: string): Promise<User | null>;
  getUserById(userId: string): Promise<User | null>;
  updateUserProfile(userId: string, updates: UserProfileUpdates): Promise<User>;
  suspendUser(userId: string, reason: string): Promise<void>;
  reactivateUser(userId: string): Promise<void>;
  deleteUser(userId: string): Promise<void>;
  createInvitedUser(userData: UserRegistrationData): Promise<User>;
}

export interface RegistrationResult {
  success: boolean;
  message: string;
  registrationRequest?: RegistrationRequest;
  verificationRequired?: boolean;
}

export class UserManagementServiceImpl implements UserManagementService {
  private magicLinkService: MagicLinkAuthService;

  constructor(
    private userRepository: UserRepository,
    private registrationRepository: RegistrationRepository,
    private notificationService: NotificationService,
    private authRepository: AuthenticationRepository
  ) {
    this.magicLinkService = new MagicLinkAuthService(authRepository, notificationService, new SecurityService());
  }

  /**
   * Register a new user with role selection and email verification
   * Requirements: 1.1, 1.4
   */
  async registerUser(userData: UserRegistrationData): Promise<RegistrationRequest> {
    // Validate registration data
    const validationErrors = UserValidation.validateRegistrationData(userData);
    if (validationErrors.length > 0) {
      throw new Error(`Registration validation failed: ${validationErrors.join(', ')}`);
    }

    // Check if user already exists
    const existingUser = await this.userRepository.findByEmail(userData.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Check if there's already a pending registration for this email
    const existingRegistration = await this.registrationRepository.findByEmail(userData.email);
    if (existingRegistration && existingRegistration.status === ApprovalStatus.PENDING) {
      throw new Error('Registration request already pending for this email');
    }

    // Create registration request
    const registrationRequest: RegistrationRequest = {
      id: this.generateId(),
      userData,
      status: ApprovalStatus.PENDING,
      submittedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Save registration request
    const savedRequest = await this.registrationRepository.create(registrationRequest);

    // Send email verification if using email-based auth
    if (userData.authMethod === AuthenticationMethod.MAGIC_LINK || 
        userData.authMethod === AuthenticationMethod.OTP) {
      await this.sendEmailVerification(userData.email, userData.fullName);
    }

    // Notify App Admin of new registration request
    await this.notifyAppAdminOfNewRegistration(savedRequest);

    return savedRequest;
  }

  /**
   * Register user with email verification workflow
   * Requirements: 1.1, 1.4
   */
  async registerUserWithEmailVerification(userData: UserRegistrationData): Promise<RegistrationResult> {
    try {
      const registrationRequest = await this.registerUser(userData);
      
      return {
        success: true,
        message: 'Registration submitted successfully. Please check your email for verification.',
        registrationRequest,
        verificationRequired: true
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Registration failed'
      };
    }
  }

  /**
   * Create user profile with role-specific data
   * Requirements: 1.1, 1.4
   */
  async createUserProfile(userData: UserRegistrationData): Promise<User> {
    // Validate role-specific profile data
    this.validateRoleSpecificProfile(userData.selectedRole, userData.profileData);

    const user: User = {
      id: this.generateId(),
      email: userData.email,
      fullName: userData.fullName,
      role: userData.selectedRole,
      status: UserStatus.PENDING_APPROVAL,
      profileData: userData.profileData,
      authMethods: [userData.authMethod],
      emailVerified: false,
      phoneVerified: false,
      profileCompleted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return await this.userRepository.create(userData);
  }

  /**
   * Activate user account after approval
   */
  async activateUser(userId: string, roleId: string): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const updates: Partial<User> = {
      status: UserStatus.ACTIVE,
      updatedAt: new Date()
    };

    return await this.userRepository.update(userId, updates);
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findByEmail(email);
  }

  async getUserById(userId: string): Promise<User | null> {
    return await this.userRepository.findById(userId);
  }

  async updateUserProfile(userId: string, updates: UserProfileUpdates): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Validate updates
    if (updates.fullName && !UserValidation.validateFullName(updates.fullName)) {
      throw new Error('Invalid full name');
    }

    const userUpdates: Partial<User> = {
      ...updates,
      updatedAt: new Date()
    };

    return await this.userRepository.update(userId, userUpdates);
  }

  async suspendUser(userId: string, reason: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    await this.userRepository.update(userId, {
      status: UserStatus.SUSPENDED,
      updatedAt: new Date()
    });

    // Notify user of suspension
    await this.notificationService.sendEmail(
      user.email,
      'Account Suspended',
      `Your FarmTally account has been suspended. Reason: ${reason}`
    );
  }

  async reactivateUser(userId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    await this.userRepository.update(userId, {
      status: UserStatus.ACTIVE,
      updatedAt: new Date()
    });

    // Notify user of reactivation
    await this.notificationService.sendEmail(
      user.email,
      'Account Reactivated',
      'Your FarmTally account has been reactivated. You can now log in.'
    );
  }

  async deleteUser(userId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    await this.userRepository.delete(userId);
  }

  /**
   * Send email verification link
   * Requirements: 1.1, 1.4
   */
  private async sendEmailVerification(email: string, fullName: string): Promise<void> {
    const magicLink = await this.magicLinkService.generateMagicLink(
      email,
      LinkPurpose.REGISTRATION,
      fullName
    );

    await this.notificationService.sendMagicLinkEmail(
      email,
      `${process.env.FRONTEND_URL}/verify-email?token=${magicLink.token}`,
      'email verification'
    );
  }

  /**
   * Notify App Admin of new registration request
   * Requirements: 1.1, 1.4
   */
  private async notifyAppAdminOfNewRegistration(request: RegistrationRequest): Promise<void> {
    // Find all App Admins
    const appAdmins = await this.userRepository.findByRole(UserRole.APP_ADMIN);
    
    for (const admin of appAdmins) {
      await this.notificationService.sendEmail(
        admin.email,
        'New Registration Request - FarmTally',
        `A new user has requested access to FarmTally:
        
        Name: ${request.userData.fullName}
        Email: ${request.userData.email}
        Role: ${request.userData.selectedRole}
        
        Please review and approve/reject this request in your admin dashboard.`
      );
    }
  }

  /**
   * Validate role-specific profile data
   */
  private validateRoleSpecificProfile(role: UserRole, profileData: any): void {
    switch (role) {
      case UserRole.FARM_ADMIN:
        if (!profileData.businessName || profileData.businessName.trim().length < 2) {
          throw new Error('Business name is required for Farm Admin role');
        }
        break;
      case UserRole.FIELD_MANAGER:
        if (profileData.experience !== undefined && profileData.experience < 0) {
          throw new Error('Experience must be a positive number');
        }
        break;
      case UserRole.FARMER:
        if (!profileData.commodityTypes || !Array.isArray(profileData.commodityTypes) || profileData.commodityTypes.length === 0) {
          throw new Error('At least one commodity type is required for Farmer role');
        }
        break;
      // Add validation for other roles as needed
    }
  }

  /**
   * Create user account for invited users (bypasses approval process)
   * Requirements: 5.3, 5.5
   */
  async createInvitedUser(userData: UserRegistrationData): Promise<User> {
    // Validate registration data
    const validationErrors = UserValidation.validateRegistrationData(userData);
    if (validationErrors.length > 0) {
      throw new Error(`Registration validation failed: ${validationErrors.join(', ')}`);
    }

    // Check if user already exists
    const existingUser = await this.userRepository.findByEmail(userData.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Validate role-specific profile data
    this.validateRoleSpecificProfile(userData.selectedRole, userData.profileData);

    // Create user with active status (bypassing approval)
    const user: User = {
      id: this.generateId(),
      email: userData.email.toLowerCase().trim(),
      fullName: userData.fullName,
      role: userData.selectedRole,
      status: UserStatus.ACTIVE, // Invited users are automatically active
      profileData: userData.profileData,
      authMethods: [userData.authMethod],
      emailVerified: true, // Invited users have verified emails
      phoneVerified: false,
      profileCompleted: true, // Invited users complete profile during invitation
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Convert User to UserRegistrationData for repository
    const registrationData: UserRegistrationData = {
      email: user.email,
      fullName: user.fullName,
      selectedRole: user.role,
      profileData: user.profileData,
      authMethod: user.authMethods[0] // Take first auth method
    };
    
    const createdUser = await this.userRepository.create(registrationData);

    // Send welcome email
    await this.notificationService.sendEmail(
      user.email,
      'Welcome to FarmTally!',
      `Welcome ${user.fullName}! Your FarmTally account has been created and is ready to use.`
    );

    return createdUser;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}