import { AuthenticationMethod, UserRole } from '../models/common.types';
import { CryptoUtils } from '../utils/crypto.utils';
import { AuditService } from './audit.service';

export interface AuthenticationPreference {
  id: string;
  userId: string;
  preferredMethods: AuthenticationMethod[];
  enabledMethods: AuthenticationMethod[];
  defaultMethod: AuthenticationMethod;
  twoFactorEnabled: boolean;
  backupMethods: AuthenticationMethod[];
  socialProviders: SocialProvider[];
  securitySettings: SecuritySettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface SocialProvider {
  provider: SocialProviderType;
  providerId: string;
  email: string;
  displayName: string;
  profilePicture?: string;
  linkedAt: Date;
  verified: boolean;
  primary: boolean;
}

export enum SocialProviderType {
  GOOGLE = 'google',
  FACEBOOK = 'facebook',
  MICROSOFT = 'microsoft',
  APPLE = 'apple'
}

export interface SecuritySettings {
  requireStrongAuthentication: boolean;
  sessionTimeout: number; // in minutes
  allowMultipleSessions: boolean;
  requireReauthForSensitive: boolean;
  ipWhitelist: string[];
  deviceTrust: DeviceTrustSettings;
  notificationPreferences: NotificationPreferences;
}

export interface DeviceTrustSettings {
  enabled: boolean;
  trustDurationDays: number;
  maxTrustedDevices: number;
  requireApprovalForNewDevices: boolean;
}

export interface NotificationPreferences {
  emailOnLogin: boolean;
  emailOnNewDevice: boolean;
  emailOnSuspiciousActivity: boolean;
  smsOnCriticalActions: boolean;
}

export interface TrustedDevice {
  id: string;
  userId: string;
  deviceFingerprint: string;
  deviceName: string;
  deviceType: string;
  ipAddress: string;
  userAgent: string;
  trustedAt: Date;
  lastUsed: Date;
  expiresAt: Date;
  active: boolean;
}

export interface AuthMethodSwitchRequest {
  userId: string;
  fromMethod: AuthenticationMethod;
  toMethod: AuthenticationMethod;
  reason: string;
  requestedAt: Date;
  approvedAt?: Date;
  approvedBy?: string;
  status: SwitchRequestStatus;
}

export enum SwitchRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired'
}

export class AuthPreferenceService {
  private preferences = new Map<string, AuthenticationPreference>();
  private trustedDevices = new Map<string, TrustedDevice[]>();
  private switchRequests = new Map<string, AuthMethodSwitchRequest[]>();

  constructor(private auditService: AuditService) {}

  /**
   * Get user authentication preferences
   */
  async getUserPreferences(userId: string): Promise<AuthenticationPreference | null> {
    return this.preferences.get(userId) || null;
  }

  /**
   * Create default authentication preferences for new user
   */
  async createDefaultPreferences(
    userId: string,
    userRole: UserRole,
    initialMethod: AuthenticationMethod
  ): Promise<AuthenticationPreference> {
    const defaultPreference: AuthenticationPreference = {
      id: CryptoUtils.generateUUID(),
      userId,
      preferredMethods: [initialMethod],
      enabledMethods: [initialMethod, AuthenticationMethod.MAGIC_LINK, AuthenticationMethod.OTP],
      defaultMethod: initialMethod,
      twoFactorEnabled: false,
      backupMethods: [AuthenticationMethod.MAGIC_LINK],
      socialProviders: [],
      securitySettings: this.getDefaultSecuritySettings(userRole),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.preferences.set(userId, defaultPreference);

    await this.auditService.logUserAction(
      userId,
      userRole,
      'user_profile_updated' as any,
      'auth_preferences',
      defaultPreference.id,
      true,
      'system',
      'system',
      undefined,
      { action: 'created_default_preferences', method: initialMethod }
    );

    return defaultPreference;
  }

  /**
   * Update authentication preferences
   */
  async updatePreferences(
    userId: string,
    userRole: UserRole,
    updates: Partial<AuthenticationPreference>,
    ipAddress: string,
    userAgent: string
  ): Promise<{ success: boolean; message: string; preferences?: AuthenticationPreference }> {
    try {
      const existingPreferences = this.preferences.get(userId);
      
      if (!existingPreferences) {
        return { success: false, message: 'User preferences not found' };
      }

      // Validate updates
      const validationResult = this.validatePreferenceUpdates(updates, existingPreferences);
      if (!validationResult.valid) {
        return { success: false, message: validationResult.message };
      }

      // Apply updates
      const updatedPreferences: AuthenticationPreference = {
        ...existingPreferences,
        ...updates,
        updatedAt: new Date()
      };

      this.preferences.set(userId, updatedPreferences);

      await this.auditService.logUserAction(
        userId,
        userRole,
        'user_profile_updated' as any,
        'auth_preferences',
        updatedPreferences.id,
        true,
        ipAddress,
        userAgent,
        undefined,
        { action: 'updated_preferences', changes: updates }
      );

      return {
        success: true,
        message: 'Authentication preferences updated successfully',
        preferences: updatedPreferences
      };

    } catch (error) {
      console.error('Error updating preferences:', error);
      return { success: false, message: 'Failed to update preferences' };
    }
  }

  /**
   * Add social authentication provider
   */
  async linkSocialProvider(
    userId: string,
    userRole: UserRole,
    provider: SocialProviderType,
    providerData: {
      providerId: string;
      email: string;
      displayName: string;
      profilePicture?: string;
    },
    ipAddress: string,
    userAgent: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const preferences = this.preferences.get(userId);
      
      if (!preferences) {
        return { success: false, message: 'User preferences not found' };
      }

      // Check if provider already linked
      const existingProvider = preferences.socialProviders.find(
        p => p.provider === provider && p.providerId === providerData.providerId
      );

      if (existingProvider) {
        return { success: false, message: 'Social provider already linked' };
      }

      // Check if email is already used by another provider
      const emailConflict = preferences.socialProviders.find(
        p => p.email === providerData.email && p.provider !== provider
      );

      if (emailConflict) {
        return { success: false, message: 'Email already linked to another social provider' };
      }

      const socialProvider: SocialProvider = {
        provider,
        providerId: providerData.providerId,
        email: providerData.email,
        displayName: providerData.displayName,
        profilePicture: providerData.profilePicture,
        linkedAt: new Date(),
        verified: true,
        primary: preferences.socialProviders.length === 0
      };

      preferences.socialProviders.push(socialProvider);

      // Add social auth to enabled methods if not already present
      if (!preferences.enabledMethods.includes(AuthenticationMethod.SOCIAL_AUTH)) {
        preferences.enabledMethods.push(AuthenticationMethod.SOCIAL_AUTH);
      }

      preferences.updatedAt = new Date();
      this.preferences.set(userId, preferences);

      await this.auditService.logUserAction(
        userId,
        userRole,
        'user_profile_updated' as any,
        'social_auth',
        socialProvider.providerId,
        true,
        ipAddress,
        userAgent,
        undefined,
        { action: 'linked_social_provider', provider, email: providerData.email }
      );

      return { success: true, message: 'Social provider linked successfully' };

    } catch (error) {
      console.error('Error linking social provider:', error);
      return { success: false, message: 'Failed to link social provider' };
    }
  }

  /**
   * Remove social authentication provider
   */
  async unlinkSocialProvider(
    userId: string,
    userRole: UserRole,
    provider: SocialProviderType,
    providerId: string,
    ipAddress: string,
    userAgent: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const preferences = this.preferences.get(userId);
      
      if (!preferences) {
        return { success: false, message: 'User preferences not found' };
      }

      const providerIndex = preferences.socialProviders.findIndex(
        p => p.provider === provider && p.providerId === providerId
      );

      if (providerIndex === -1) {
        return { success: false, message: 'Social provider not found' };
      }

      // Check if this is the only authentication method
      if (preferences.enabledMethods.length === 1 && 
          preferences.enabledMethods[0] === AuthenticationMethod.SOCIAL_AUTH &&
          preferences.socialProviders.length === 1) {
        return { 
          success: false, 
          message: 'Cannot remove the only authentication method. Please add another method first.' 
        };
      }

      const removedProvider = preferences.socialProviders[providerIndex];
      preferences.socialProviders.splice(providerIndex, 1);

      // If no more social providers, remove social auth from enabled methods
      if (preferences.socialProviders.length === 0) {
        preferences.enabledMethods = preferences.enabledMethods.filter(
          method => method !== AuthenticationMethod.SOCIAL_AUTH
        );
        
        // Update default method if it was social
        if (preferences.defaultMethod === AuthenticationMethod.SOCIAL_AUTH) {
          preferences.defaultMethod = preferences.enabledMethods[0] || AuthenticationMethod.MAGIC_LINK;
        }
      }

      preferences.updatedAt = new Date();
      this.preferences.set(userId, preferences);

      await this.auditService.logUserAction(
        userId,
        userRole,
        'user_profile_updated' as any,
        'social_auth',
        providerId,
        true,
        ipAddress,
        userAgent,
        undefined,
        { action: 'unlinked_social_provider', provider, email: removedProvider.email }
      );

      return { success: true, message: 'Social provider unlinked successfully' };

    } catch (error) {
      console.error('Error unlinking social provider:', error);
      return { success: false, message: 'Failed to unlink social provider' };
    }
  }

  /**
   * Request authentication method switch
   */
  async requestMethodSwitch(
    userId: string,
    userRole: UserRole,
    fromMethod: AuthenticationMethod,
    toMethod: AuthenticationMethod,
    reason: string,
    ipAddress: string,
    userAgent: string
  ): Promise<{ success: boolean; message: string; requestId?: string }> {
    try {
      const preferences = this.preferences.get(userId);
      
      if (!preferences) {
        return { success: false, message: 'User preferences not found' };
      }

      // Validate the switch request
      if (!preferences.enabledMethods.includes(fromMethod)) {
        return { success: false, message: 'Source authentication method not enabled' };
      }

      if (!preferences.enabledMethods.includes(toMethod)) {
        return { success: false, message: 'Target authentication method not enabled' };
      }

      const switchRequest: AuthMethodSwitchRequest = {
        userId,
        fromMethod,
        toMethod,
        reason,
        requestedAt: new Date(),
        status: SwitchRequestStatus.PENDING
      };

      const userRequests = this.switchRequests.get(userId) || [];
      userRequests.push(switchRequest);
      this.switchRequests.set(userId, userRequests);

      await this.auditService.logUserAction(
        userId,
        userRole,
        'user_profile_updated' as any,
        'auth_method_switch',
        CryptoUtils.generateUUID(),
        true,
        ipAddress,
        userAgent,
        undefined,
        { action: 'requested_method_switch', fromMethod, toMethod, reason }
      );

      return { 
        success: true, 
        message: 'Authentication method switch requested successfully',
        requestId: CryptoUtils.generateUUID()
      };

    } catch (error) {
      console.error('Error requesting method switch:', error);
      return { success: false, message: 'Failed to request method switch' };
    }
  }

  /**
   * Add trusted device
   */
  async addTrustedDevice(
    userId: string,
    userRole: UserRole,
    deviceInfo: {
      deviceName: string;
      deviceType: string;
      ipAddress: string;
      userAgent: string;
    }
  ): Promise<{ success: boolean; message: string; deviceId?: string }> {
    try {
      const preferences = this.preferences.get(userId);
      
      if (!preferences || !preferences.securitySettings.deviceTrust.enabled) {
        return { success: false, message: 'Device trust not enabled' };
      }

      const userDevices = this.trustedDevices.get(userId) || [];
      
      // Check device limit
      const activeDevices = userDevices.filter(device => device.active);
      if (activeDevices.length >= preferences.securitySettings.deviceTrust.maxTrustedDevices) {
        return { 
          success: false, 
          message: `Maximum trusted devices limit (${preferences.securitySettings.deviceTrust.maxTrustedDevices}) reached` 
        };
      }

      // Generate device fingerprint
      const deviceFingerprint = CryptoUtils.createHMAC(
        `${deviceInfo.userAgent}:${deviceInfo.deviceType}:${deviceInfo.deviceName}`,
        process.env.DEVICE_SECRET || 'device-secret'
      );

      // Check if device already trusted
      const existingDevice = userDevices.find(device => device.deviceFingerprint === deviceFingerprint);
      if (existingDevice && existingDevice.active) {
        return { success: false, message: 'Device already trusted' };
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + preferences.securitySettings.deviceTrust.trustDurationDays);

      const trustedDevice: TrustedDevice = {
        id: CryptoUtils.generateUUID(),
        userId,
        deviceFingerprint,
        deviceName: deviceInfo.deviceName,
        deviceType: deviceInfo.deviceType,
        ipAddress: deviceInfo.ipAddress,
        userAgent: deviceInfo.userAgent,
        trustedAt: new Date(),
        lastUsed: new Date(),
        expiresAt,
        active: true
      };

      userDevices.push(trustedDevice);
      this.trustedDevices.set(userId, userDevices);

      await this.auditService.logUserAction(
        userId,
        userRole,
        'user_profile_updated' as any,
        'trusted_device',
        trustedDevice.id,
        true,
        deviceInfo.ipAddress,
        deviceInfo.userAgent,
        undefined,
        { action: 'added_trusted_device', deviceName: deviceInfo.deviceName }
      );

      return { 
        success: true, 
        message: 'Device added to trusted list',
        deviceId: trustedDevice.id
      };

    } catch (error) {
      console.error('Error adding trusted device:', error);
      return { success: false, message: 'Failed to add trusted device' };
    }
  }

  /**
   * Check if device is trusted
   */
  async isDeviceTrusted(userId: string, deviceFingerprint: string): Promise<boolean> {
    try {
      const userDevices = this.trustedDevices.get(userId) || [];
      const device = userDevices.find(
        d => d.deviceFingerprint === deviceFingerprint && d.active && d.expiresAt > new Date()
      );

      if (device) {
        // Update last used
        device.lastUsed = new Date();
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error checking device trust:', error);
      return false;
    }
  }

  /**
   * Remove trusted device
   */
  async removeTrustedDevice(
    userId: string,
    userRole: UserRole,
    deviceId: string,
    ipAddress: string,
    userAgent: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const userDevices = this.trustedDevices.get(userId) || [];
      const deviceIndex = userDevices.findIndex(device => device.id === deviceId);

      if (deviceIndex === -1) {
        return { success: false, message: 'Trusted device not found' };
      }

      const device = userDevices[deviceIndex];
      device.active = false;

      await this.auditService.logUserAction(
        userId,
        userRole,
        'user_profile_updated' as any,
        'trusted_device',
        deviceId,
        true,
        ipAddress,
        userAgent,
        undefined,
        { action: 'removed_trusted_device', deviceName: device.deviceName }
      );

      return { success: true, message: 'Trusted device removed successfully' };

    } catch (error) {
      console.error('Error removing trusted device:', error);
      return { success: false, message: 'Failed to remove trusted device' };
    }
  }

  /**
   * Get user's trusted devices
   */
  async getTrustedDevices(userId: string): Promise<TrustedDevice[]> {
    const userDevices = this.trustedDevices.get(userId) || [];
    return userDevices.filter(device => device.active && device.expiresAt > new Date());
  }

  /**
   * Validate preference updates
   */
  private validatePreferenceUpdates(
    updates: Partial<AuthenticationPreference>,
    existing: AuthenticationPreference
  ): { valid: boolean; message: string } {
    // Ensure at least one authentication method is enabled
    if (updates.enabledMethods && updates.enabledMethods.length === 0) {
      return { valid: false, message: 'At least one authentication method must be enabled' };
    }

    // Ensure default method is in enabled methods
    if (updates.defaultMethod && updates.enabledMethods) {
      if (!updates.enabledMethods.includes(updates.defaultMethod)) {
        return { valid: false, message: 'Default method must be in enabled methods' };
      }
    }

    // Validate security settings
    if (updates.securitySettings) {
      const settings = updates.securitySettings;
      
      if (settings.sessionTimeout && (settings.sessionTimeout < 5 || settings.sessionTimeout > 10080)) {
        return { valid: false, message: 'Session timeout must be between 5 minutes and 7 days' };
      }

      if (settings.deviceTrust?.maxTrustedDevices && settings.deviceTrust.maxTrustedDevices > 20) {
        return { valid: false, message: 'Maximum trusted devices cannot exceed 20' };
      }
    }

    return { valid: true, message: 'Valid' };
  }

  /**
   * Get default security settings based on user role
   */
  private getDefaultSecuritySettings(userRole: UserRole): SecuritySettings {
    const isHighPrivilege = userRole === UserRole.APP_ADMIN || userRole === UserRole.FARM_ADMIN;

    return {
      requireStrongAuthentication: isHighPrivilege,
      sessionTimeout: isHighPrivilege ? 480 : 1440, // 8 hours for admins, 24 hours for others
      allowMultipleSessions: !isHighPrivilege,
      requireReauthForSensitive: isHighPrivilege,
      ipWhitelist: [],
      deviceTrust: {
        enabled: false,
        trustDurationDays: 30,
        maxTrustedDevices: 5,
        requireApprovalForNewDevices: isHighPrivilege
      },
      notificationPreferences: {
        emailOnLogin: isHighPrivilege,
        emailOnNewDevice: true,
        emailOnSuspiciousActivity: true,
        smsOnCriticalActions: isHighPrivilege
      }
    };
  }

  /**
   * Clean up expired data
   */
  async cleanup(): Promise<void> {
    const now = new Date();

    // Clean up expired trusted devices
    for (const [userId, devices] of this.trustedDevices.entries()) {
      const activeDevices = devices.filter(device => device.expiresAt > now);
      if (activeDevices.length !== devices.length) {
        this.trustedDevices.set(userId, activeDevices);
      }
    }

    // Clean up expired switch requests
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    for (const [userId, requests] of this.switchRequests.entries()) {
      const activeRequests = requests.filter(request => request.requestedAt > thirtyDaysAgo);
      if (activeRequests.length !== requests.length) {
        this.switchRequests.set(userId, activeRequests);
      }
    }

    console.log('Auth preference cleanup completed');
  }
}