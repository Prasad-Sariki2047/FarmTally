import { AuthenticationSession, MagicLink, OTPVerification } from '../models';
import { AuthenticationMethod, LinkPurpose, OTPPurpose, UserRole } from '../models/common.types';
import { User } from '../models/user.model';
import { AuthenticationRepository } from '../repositories/authentication.repository';
import { UserRepository } from '../repositories/user.repository';
import { NotificationService } from './notification.service';
import { MagicLinkAuthService } from './magic-link-auth.service';
import { OTPAuthService } from './otp-auth.service';
import { SocialAuthService, SocialAuthProfile } from './social-auth.service';
import { SessionManagementService, SessionMetadata } from './session-management.service';
import { SecurityService } from './security.service';
import { AuditService } from './audit.service';
import { AuthPreferenceService } from './auth-preference.service';

export interface AuthenticationResult {
  success: boolean;
  user?: User;
  sessionToken?: string;
  requiresRegistration?: boolean;
  message: string;
}

export class AuthenticationService {
  private magicLinkService: MagicLinkAuthService;
  private otpService: OTPAuthService;
  private socialAuthService: SocialAuthService;
  private sessionService: SessionManagementService;
  private securityService: SecurityService;
  private auditService: AuditService;
  private authPreferenceService: AuthPreferenceService;

  constructor(
    private authRepository: AuthenticationRepository,
    private userRepository: UserRepository,
    private notificationService: NotificationService
  ) {
    this.securityService = new SecurityService();
    this.auditService = new AuditService();
    this.authPreferenceService = new AuthPreferenceService(this.auditService);
    
    this.magicLinkService = new MagicLinkAuthService(authRepository, notificationService, this.securityService);
    this.otpService = new OTPAuthService(authRepository, notificationService, this.securityService);
    this.socialAuthService = new SocialAuthService(authRepository, userRepository);
    this.sessionService = new SessionManagementService(authRepository, userRepository, this.securityService, this.auditService);
  }

  // Magic Link Authentication
  async generateMagicLink(email: string, purpose: LinkPurpose, recipientName?: string): Promise<MagicLink> {
    return this.magicLinkService.generateMagicLink(email, purpose, recipientName);
  }

  async validateMagicLink(token: string): Promise<{ valid: boolean; email?: string; purpose?: LinkPurpose }> {
    return this.magicLinkService.validateMagicLink(token);
  }

  async authenticateWithMagicLink(token: string, metadata: SessionMetadata): Promise<AuthenticationResult> {
    const validation = await this.magicLinkService.validateMagicLink(token);
    
    if (!validation.valid || !validation.email) {
      return { success: false, message: 'Invalid or expired magic link' };
    }

    const user = await this.userRepository.findByEmail(validation.email);
    if (!user) {
      return { 
        success: false, 
        requiresRegistration: true,
        message: 'User not found. Please complete registration.' 
      };
    }

    if (user.status !== 'active') {
      return { success: false, message: 'Account is not active. Please contact support.' };
    }

    // Create session
    const sessionResult = await this.sessionService.createSession(
      user.id, 
      AuthenticationMethod.MAGIC_LINK, 
      metadata
    );

    if (!sessionResult.success) {
      return { success: false, message: sessionResult.message };
    }

    return {
      success: true,
      user,
      sessionToken: sessionResult.sessionToken,
      message: 'Authentication successful'
    };
  }

  // OTP Authentication
  async generateOTP(
    identifier: string, 
    method: 'email' | 'sms', 
    purpose: OTPPurpose = OTPPurpose.LOGIN,
    recipientName?: string,
    ipAddress: string = 'unknown',
    userAgent: string = 'unknown'
  ): Promise<{ success: boolean; message: string; otpId?: string }> {
    return this.otpService.generateOTP(identifier, method, purpose, recipientName, ipAddress, userAgent);
  }

  async validateOTP(
    identifier: string, 
    code: string,
    ipAddress: string = 'unknown',
    userAgent: string = 'unknown'
  ): Promise<{ 
    valid: boolean; 
    message: string; 
    otpId?: string; 
    purpose?: OTPPurpose;
    attemptsRemaining?: number;
  }> {
    return this.otpService.validateOTP(identifier, code, ipAddress, userAgent);
  }

  async authenticateWithOTP(identifier: string, code: string, metadata: SessionMetadata): Promise<AuthenticationResult> {
    const validation = await this.otpService.validateOTP(identifier, code, metadata.ipAddress, metadata.userAgent);
    
    if (!validation.valid) {
      return { success: false, message: validation.message };
    }

    const user = await this.userRepository.findByEmail(identifier);
    if (!user) {
      return { 
        success: false, 
        requiresRegistration: true,
        message: 'User not found. Please complete registration.' 
      };
    }

    if (user.status !== 'active') {
      return { success: false, message: 'Account is not active. Please contact support.' };
    }

    // Create session
    const sessionResult = await this.sessionService.createSession(
      user.id, 
      AuthenticationMethod.OTP, 
      metadata
    );

    if (!sessionResult.success) {
      return { success: false, message: sessionResult.message };
    }

    return {
      success: true,
      user,
      sessionToken: sessionResult.sessionToken,
      message: 'Authentication successful'
    };
  }

  // Social Authentication
  async validateSocialAuth(provider: string, token: string): Promise<{ valid: boolean; email?: string; profile?: any }> {
    if (provider === 'google') {
      const result = await this.socialAuthService.validateGoogleToken(token);
      return {
        valid: result.valid,
        email: result.profile?.email,
        profile: result.profile
      };
    }
    
    return { valid: false };
  }

  async authenticateWithGoogle(idToken: string, metadata: SessionMetadata): Promise<AuthenticationResult> {
    const authResult = await this.socialAuthService.authenticateWithGoogle(idToken);
    
    if (!authResult.success) {
      return { success: false, message: authResult.message };
    }

    if (authResult.requiresRegistration) {
      return {
        success: false,
        requiresRegistration: true,
        message: authResult.message,
        user: authResult.user
      };
    }

    if (!authResult.user) {
      return { success: false, message: 'Authentication failed' };
    }

    // Create session
    const sessionResult = await this.sessionService.createSession(
      authResult.user.id, 
      AuthenticationMethod.SOCIAL_GOOGLE, 
      metadata
    );

    if (!sessionResult.success) {
      return { success: false, message: sessionResult.message };
    }

    return {
      success: true,
      user: authResult.user,
      sessionToken: sessionResult.sessionToken,
      message: 'Authentication successful'
    };
  }

  // Session Management
  async createSession(userId: string, method: AuthenticationMethod, metadata: SessionMetadata): Promise<AuthenticationSession> {
    const result = await this.sessionService.createSession(userId, method, metadata);
    if (!result.success || !result.session) {
      throw new Error(result.message);
    }
    return result.session;
  }

  async validateSession(sessionToken: string): Promise<{ valid: boolean; userId?: string; user?: User }> {
    const result = await this.sessionService.validateSession(sessionToken);
    return {
      valid: result.valid,
      userId: result.user?.id,
      user: result.user
    };
  }

  async refreshSession(sessionToken: string, metadata: SessionMetadata): Promise<{ success: boolean; newToken?: string; message: string }> {
    return this.sessionService.refreshSession(sessionToken, metadata);
  }

  async revokeSession(sessionToken: string): Promise<void> {
    await this.sessionService.revokeSession(sessionToken);
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    await this.sessionService.revokeAllUserSessions(userId);
  }

  // User Registration with Authentication
  async registerUserWithMagicLink(email: string, fullName: string, selectedRole: UserRole): Promise<{
    success: boolean;
    message: string;
    registrationId?: string;
  }> {
    try {
      // Check if user already exists
      const existingUser = await this.userRepository.findByEmail(email);
      if (existingUser) {
        return { success: false, message: 'User with this email already exists' };
      }

      // Generate magic link for registration completion
      const magicLink = await this.magicLinkService.generateMagicLink(
        email, 
        LinkPurpose.REGISTRATION, 
        fullName
      );

      return {
        success: true,
        message: 'Registration link sent to your email',
        registrationId: magicLink.id
      };

    } catch (error) {
      console.error('Error in user registration:', error);
      return { success: false, message: 'Registration failed. Please try again.' };
    }
  }

  async registerUserWithGoogle(
    idToken: string, 
    selectedRole: UserRole, 
    additionalProfileData?: any
  ): Promise<{ success: boolean; user?: User; message: string }> {
    const tokenValidation = await this.socialAuthService.validateGoogleToken(idToken);
    
    if (!tokenValidation.valid || !tokenValidation.profile) {
      return { success: false, message: 'Invalid Google token' };
    }

    return this.socialAuthService.createUserFromGoogleProfile(
      tokenValidation.profile, 
      selectedRole, 
      additionalProfileData
    );
  }

  // Authentication Preference Management
  async getUserAuthPreferences(userId: string): Promise<any> {
    return this.authPreferenceService.getUserPreferences(userId);
  }

  async updateAuthPreferences(
    userId: string,
    userRole: UserRole,
    updates: any,
    ipAddress: string,
    userAgent: string
  ): Promise<any> {
    return this.authPreferenceService.updatePreferences(userId, userRole, updates, ipAddress, userAgent);
  }

  async linkSocialProvider(
    userId: string,
    userRole: UserRole,
    provider: any,
    providerData: any,
    ipAddress: string,
    userAgent: string
  ): Promise<any> {
    return this.authPreferenceService.linkSocialProvider(userId, userRole, provider, providerData, ipAddress, userAgent);
  }

  async unlinkSocialProvider(
    userId: string,
    userRole: UserRole,
    provider: any,
    providerId: string,
    ipAddress: string,
    userAgent: string
  ): Promise<any> {
    return this.authPreferenceService.unlinkSocialProvider(userId, userRole, provider, providerId, ipAddress, userAgent);
  }

  async addTrustedDevice(
    userId: string,
    userRole: UserRole,
    deviceInfo: any
  ): Promise<any> {
    return this.authPreferenceService.addTrustedDevice(userId, userRole, deviceInfo);
  }

  async getTrustedDevices(userId: string): Promise<any> {
    return this.authPreferenceService.getTrustedDevices(userId);
  }

  async removeTrustedDevice(
    userId: string,
    userRole: UserRole,
    deviceId: string,
    ipAddress: string,
    userAgent: string
  ): Promise<any> {
    return this.authPreferenceService.removeTrustedDevice(userId, userRole, deviceId, ipAddress, userAgent);
  }

  // Security and Audit
  async getSecurityEvents(severity?: any, type?: any, limit?: number): Promise<any> {
    return this.securityService.getSecurityEvents(severity, type, limit);
  }

  async getAuditLog(query: any): Promise<any> {
    return this.auditService.queryAuditLog(query);
  }

  async getAuditSummary(startDate?: Date, endDate?: Date): Promise<any> {
    return this.auditService.generateAuditSummary(startDate, endDate);
  }

  async getSecurityAlerts(resolved?: boolean): Promise<any> {
    return this.auditService.getSecurityAlerts(resolved);
  }

  async resolveSecurityAlert(alertId: string, resolvedBy: string): Promise<boolean> {
    return this.auditService.resolveSecurityAlert(alertId, resolvedBy);
  }

  // Utility methods
  async getUserAuditLog(userId: string, limit?: number): Promise<any> {
    return this.sessionService.getUserAuditLog(userId, limit);
  }

  async checkSuspiciousActivity(userId: string): Promise<any> {
    return this.sessionService.checkSuspiciousActivity(userId);
  }

  async cleanupExpiredData(): Promise<void> {
    await Promise.all([
      this.magicLinkService.cleanupExpiredLinks(),
      this.otpService.cleanup(),
      this.sessionService.cleanupExpiredSessions(),
      this.securityService.cleanup(),
      this.authPreferenceService.cleanup()
    ]);
  }
}