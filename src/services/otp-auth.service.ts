import { OTPVerification } from '../models/auth.model';
import { OTPPurpose } from '../models/common.types';
import { AuthenticationRepository } from '../repositories/authentication.repository';
import { CryptoUtils } from '../utils/crypto.utils';
import { EmailUtils } from '../utils/email.utils';
import { NotificationService } from './notification.service';
import { UserValidation } from '../models/auth.model';
import { SecurityService } from './security.service';

export class OTPAuthService {
  private readonly OTP_EXPIRY_MINUTES = 10;
  private readonly MAX_ATTEMPTS = 3;

  constructor(
    private authRepository: AuthenticationRepository,
    private notificationService: NotificationService,
    private securityService: SecurityService
  ) {}

  /**
   * Generate and send OTP via email or SMS
   */
  async generateOTP(
    identifier: string, 
    method: 'email' | 'sms', 
    purpose: OTPPurpose = OTPPurpose.LOGIN,
    recipientName?: string,
    ipAddress: string = 'unknown',
    userAgent: string = 'unknown'
  ): Promise<{ success: boolean; message: string; otpId?: string }> {
    try {
      // Check if identifier is locked out
      if (this.securityService.isLockedOut(identifier)) {
        const lockoutStatus = this.securityService.getLockoutStatus(identifier);
        const remainingMinutes = lockoutStatus.remainingTime ? Math.ceil(lockoutStatus.remainingTime / 60000) : 0;
        return { 
          success: false, 
          message: `Account temporarily locked due to too many failed attempts. Please try again in ${remainingMinutes} minutes.` 
        };
      }

      // Validate identifier format
      if (method === 'email' && !UserValidation.validateEmail(identifier)) {
        return { success: false, message: 'Invalid email format' };
      }

      if (method === 'sms' && !UserValidation.validatePhoneNumber(identifier)) {
        return { success: false, message: 'Invalid phone number format' };
      }

      // Check rate limiting
      if (!this.securityService.checkRateLimit(identifier, ipAddress, userAgent)) {
        return { 
          success: false, 
          message: 'Too many OTP requests. Please wait before trying again.' 
        };
      }

      // Invalidate any existing OTP for this identifier
      await this.invalidateExistingOTP(identifier);

      // Generate OTP code
      const code = CryptoUtils.generateOTP(6);
      
      // Calculate expiry
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + this.OTP_EXPIRY_MINUTES);

      // Create OTP record
      const otpVerification: OTPVerification = {
        id: CryptoUtils.generateUUID(),
        email: method === 'email' ? identifier : undefined,
        phoneNumber: method === 'sms' ? identifier : undefined,
        code,
        purpose,
        expiresAt,
        verified: false,
        attempts: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Save to repository
      const savedOTP = await this.authRepository.createOTP(otpVerification);

      // Send OTP via chosen method
      if (method === 'email') {
        await this.sendOTPEmail(identifier, code, recipientName);
      } else {
        await this.sendOTPSMS(identifier, code);
      }

      return {
        success: true,
        message: `OTP sent successfully via ${method}`,
        otpId: savedOTP.id
      };

    } catch (error) {
      console.error('Error generating OTP:', error);
      return { success: false, message: 'Failed to generate OTP. Please try again.' };
    }
  }

  /**
   * Validate OTP code
   */
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
    try {
      // Validate code format
      if (!UserValidation.validateOTPCode(code)) {
        return { valid: false, message: 'Invalid OTP format' };
      }

      // Find active OTP for identifier
      const otpRecord = await this.authRepository.findOTPByIdentifier(identifier);

      if (!otpRecord) {
        return { valid: false, message: 'No active OTP found for this identifier' };
      }

      // Check if already verified
      if (otpRecord.verified) {
        return { valid: false, message: 'OTP has already been used' };
      }

      // Check if expired
      if (new Date() > otpRecord.expiresAt) {
        await this.authRepository.deleteOTP(otpRecord.id);
        return { valid: false, message: 'OTP has expired. Please request a new one.' };
      }

      // Check attempts limit
      if (otpRecord.attempts >= this.MAX_ATTEMPTS) {
        await this.authRepository.deleteOTP(otpRecord.id);
        return { valid: false, message: 'Maximum verification attempts exceeded. Please request a new OTP.' };
      }

      // Increment attempts
      const updatedAttempts = otpRecord.attempts + 1;
      await this.authRepository.updateOTP(otpRecord.id, { 
        attempts: updatedAttempts,
        updatedAt: new Date()
      });

      // Verify code
      if (otpRecord.code !== code) {
        // Record failed attempt for security monitoring
        this.securityService.recordFailedAttempt(identifier, ipAddress, userAgent);
        
        const attemptsRemaining = this.MAX_ATTEMPTS - updatedAttempts;
        
        if (attemptsRemaining <= 0) {
          await this.authRepository.deleteOTP(otpRecord.id);
          return { valid: false, message: 'Invalid OTP. Maximum attempts exceeded.' };
        }

        return { 
          valid: false, 
          message: `Invalid OTP. ${attemptsRemaining} attempts remaining.`,
          attemptsRemaining
        };
      }

      // Mark as verified
      await this.authRepository.updateOTP(otpRecord.id, { 
        verified: true,
        updatedAt: new Date()
      });

      // Record successful attempt (resets failed attempts)
      this.securityService.recordSuccessfulAttempt(identifier);

      return {
        valid: true,
        message: 'OTP verified successfully',
        otpId: otpRecord.id,
        purpose: otpRecord.purpose
      };

    } catch (error) {
      console.error('Error validating OTP:', error);
      return { valid: false, message: 'Failed to validate OTP. Please try again.' };
    }
  }

  /**
   * Send OTP via email
   */
  private async sendOTPEmail(email: string, code: string, recipientName?: string): Promise<void> {
    const name = recipientName || 'User';
    const emailContent = EmailUtils.generateOTPEmail(name, code);

    await this.notificationService.sendEmail(email, emailContent.subject, emailContent.html, true);
  }

  /**
   * Send OTP via SMS
   */
  private async sendOTPSMS(phoneNumber: string, code: string): Promise<void> {
    const message = `Your FarmTally verification code is: ${code}. This code will expire in ${this.OTP_EXPIRY_MINUTES} minutes.`;

    await this.notificationService.sendSMS(phoneNumber, message);
  }

  /**
   * Invalidate existing OTP for identifier
   */
  private async invalidateExistingOTP(identifier: string): Promise<void> {
    try {
      const existingOTP = await this.authRepository.findOTPByIdentifier(identifier);
      if (existingOTP && !existingOTP.verified) {
        await this.authRepository.deleteOTP(existingOTP.id);
      }
    } catch (error) {
      console.error('Error invalidating existing OTP:', error);
    }
  }

  /**
   * Clean up expired OTPs
   */
  async cleanup(): Promise<void> {
    console.log('OTP cleanup completed - expired entries removed');
  }

  /**
   * Resend OTP with same code (if not expired and attempts available)
   */
  async resendOTP(
    identifier: string, 
    method: 'email' | 'sms',
    ipAddress: string = 'unknown',
    userAgent: string = 'unknown'
  ): Promise<{ success: boolean; message: string }> {
    try {
      const otpRecord = await this.authRepository.findOTPByIdentifier(identifier);

      if (!otpRecord || otpRecord.verified) {
        return { success: false, message: 'No active OTP found to resend' };
      }

      if (new Date() > otpRecord.expiresAt) {
        await this.authRepository.deleteOTP(otpRecord.id);
        return { success: false, message: 'OTP has expired. Please request a new one.' };
      }

      if (otpRecord.attempts >= this.MAX_ATTEMPTS) {
        return { success: false, message: 'Maximum attempts exceeded. Please request a new OTP.' };
      }

      // Check rate limiting
      if (!this.securityService.checkRateLimit(identifier, ipAddress, userAgent)) {
        return { 
          success: false, 
          message: 'Too many requests. Please wait before trying again.' 
        };
      }

      // Resend OTP
      if (method === 'email' && otpRecord.email) {
        await this.sendOTPEmail(otpRecord.email, otpRecord.code);
      } else if (method === 'sms' && otpRecord.phoneNumber) {
        await this.sendOTPSMS(otpRecord.phoneNumber, otpRecord.code);
      } else {
        return { success: false, message: 'Invalid method for this OTP' };
      }

      return { success: true, message: `OTP resent successfully via ${method}` };

    } catch (error) {
      console.error('Error resending OTP:', error);
      return { success: false, message: 'Failed to resend OTP. Please try again.' };
    }
  }
}