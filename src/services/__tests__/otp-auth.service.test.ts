import { OTPAuthService } from '../otp-auth.service';
import { AuthenticationRepository } from '../../repositories/authentication.repository';
import { NotificationService } from '../notification.service';
import { SecurityService } from '../security.service';
import { OTPVerification } from '../../models/auth.model';
import { OTPPurpose } from '../../models/common.types';
import { UserValidation } from '../../models/auth.model';

// Mock dependencies
jest.mock('../../repositories/authentication.repository');
jest.mock('../notification.service');
jest.mock('../security.service');
jest.mock('../../models/auth.model');

describe('OTPAuthService', () => {
  let service: OTPAuthService;
  let mockAuthRepository: jest.Mocked<AuthenticationRepository>;
  let mockNotificationService: jest.Mocked<NotificationService>;
  let mockSecurityService: jest.Mocked<SecurityService>;

  beforeEach(() => {
    mockAuthRepository = {
      createSession: jest.fn(),
      findSessionById: jest.fn(),
      findSessionsByUserId: jest.fn(),
      updateSession: jest.fn(),
      deleteSession: jest.fn(),
      deleteUserSessions: jest.fn(),
      createMagicLink: jest.fn(),
      findMagicLinkByToken: jest.fn(),
      updateMagicLink: jest.fn(),
      deleteMagicLink: jest.fn(),
      createOTP: jest.fn(),
      findOTPByIdentifier: jest.fn(),
      updateOTP: jest.fn(),
      deleteOTP: jest.fn(),
    } as jest.Mocked<AuthenticationRepository>;
    
    mockNotificationService = {
      sendEmail: jest.fn(),
      sendSMS: jest.fn(),
      sendMagicLinkEmail: jest.fn(),
      sendOTPEmail: jest.fn(),
      sendOTPSMS: jest.fn(),
      sendApprovalNotification: jest.fn(),
      sendInvitationEmail: jest.fn(),
    } as jest.Mocked<NotificationService>;
    
    mockSecurityService = {
      isLockedOut: jest.fn(),
      recordFailedAttempt: jest.fn(),
      recordSuccessfulAttempt: jest.fn(),
      checkRateLimit: jest.fn(),
      getLockoutStatus: jest.fn(),
      generateSecureToken: jest.fn(),
      validateTokenFormat: jest.fn(),
      detectSessionHijacking: jest.fn(),
      getSecurityEvents: jest.fn(),
      logSecurityEvent: jest.fn(),
      cleanup: jest.fn(),
      isSuspiciousIP: jest.fn(),
      clearSuspiciousIP: jest.fn(),
      resetSecurityData: jest.fn(),
      markIPAsSuspicious: jest.fn(),
    } as unknown as jest.Mocked<SecurityService>;

    service = new OTPAuthService(
      mockAuthRepository,
      mockNotificationService,
      mockSecurityService
    );

    // Setup default mocks
    mockSecurityService.isLockedOut.mockReturnValue(false);
    mockSecurityService.checkRateLimit.mockReturnValue(true);
    (UserValidation.validateEmail as jest.Mock).mockReturnValue(true);
    (UserValidation.validatePhoneNumber as jest.Mock).mockReturnValue(true);
    (UserValidation.validateOTPCode as jest.Mock).mockReturnValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateOTP', () => {
    it('should generate OTP for email method', async () => {
      const identifier = 'test@example.com';
      const method = 'email';
      const purpose = OTPPurpose.LOGIN;
      const recipientName = 'Test User';
      const ipAddress = '192.168.1.1';
      const userAgent = 'Mozilla/5.0';

      const mockOTP: OTPVerification = {
        id: 'otp-id',
        email: identifier,
        code: '123456',
        purpose,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        verified: false,
        attempts: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockAuthRepository.createOTP.mockResolvedValue(mockOTP);
      mockNotificationService.sendEmail.mockResolvedValue(undefined);

      const result = await service.generateOTP(identifier, method, purpose, recipientName, ipAddress, userAgent);

      expect(result).toEqual({
        success: true,
        message: 'OTP sent successfully via email',
        otpId: 'otp-id'
      });
      expect(mockAuthRepository.createOTP).toHaveBeenCalledWith(
        expect.objectContaining({
          email: identifier,
          purpose,
          verified: false,
          attempts: 0
        })
      );
      expect(mockNotificationService.sendEmail).toHaveBeenCalled();
    });

    it('should generate OTP for SMS method', async () => {
      const identifier = '+1234567890';
      const method = 'sms';
      const purpose = OTPPurpose.LOGIN;

      const mockOTP: OTPVerification = {
        id: 'otp-id',
        phoneNumber: identifier,
        code: '654321',
        purpose,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        verified: false,
        attempts: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockAuthRepository.createOTP.mockResolvedValue(mockOTP);
      mockNotificationService.sendSMS.mockResolvedValue(undefined);

      const result = await service.generateOTP(identifier, method, purpose);

      expect(result).toEqual({
        success: true,
        message: 'OTP sent successfully via sms',
        otpId: 'otp-id'
      });
      expect(mockAuthRepository.createOTP).toHaveBeenCalledWith(
        expect.objectContaining({
          phoneNumber: identifier,
          purpose,
          verified: false,
          attempts: 0
        })
      );
      expect(mockNotificationService.sendSMS).toHaveBeenCalled();
    });

    it('should reject when account is locked out', async () => {
      const identifier = 'locked@example.com';
      mockSecurityService.isLockedOut.mockReturnValue(true);
      mockSecurityService.getLockoutStatus.mockReturnValue({
        isLocked: true,
        attempts: 5,
        remainingTime: 300000 // 5 minutes
      });

      const result = await service.generateOTP(identifier, 'email');

      expect(result).toEqual({
        success: false,
        message: 'Account temporarily locked due to too many failed attempts. Please try again in 5 minutes.'
      });
      expect(mockAuthRepository.createOTP).not.toHaveBeenCalled();
    });

    it('should reject invalid email format', async () => {
      const identifier = 'invalid-email';
      (UserValidation.validateEmail as jest.Mock).mockReturnValue(false);

      const result = await service.generateOTP(identifier, 'email');

      expect(result).toEqual({
        success: false,
        message: 'Invalid email format'
      });
    });

    it('should reject invalid phone number format', async () => {
      const identifier = 'invalid-phone';
      (UserValidation.validatePhoneNumber as jest.Mock).mockReturnValue(false);

      const result = await service.generateOTP(identifier, 'sms');

      expect(result).toEqual({
        success: false,
        message: 'Invalid phone number format'
      });
    });

    it('should reject when rate limit exceeded', async () => {
      const identifier = 'test@example.com';
      mockSecurityService.checkRateLimit.mockReturnValue(false);

      const result = await service.generateOTP(identifier, 'email');

      expect(result).toEqual({
        success: false,
        message: 'Too many OTP requests. Please wait before trying again.'
      });
    });

    it('should handle generation errors gracefully', async () => {
      const identifier = 'test@example.com';
      mockAuthRepository.createOTP.mockRejectedValue(new Error('Database error'));

      const result = await service.generateOTP(identifier, 'email');

      expect(result).toEqual({
        success: false,
        message: 'Failed to generate OTP. Please try again.'
      });
    });
  });

  describe('validateOTP', () => {
    it('should validate correct OTP code', async () => {
      const identifier = 'test@example.com';
      const code = '123456';
      const ipAddress = '192.168.1.1';
      const userAgent = 'Mozilla/5.0';

      const mockOTP: OTPVerification = {
        id: 'otp-id',
        email: identifier,
        code,
        purpose: OTPPurpose.LOGIN,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
        verified: false,
        attempts: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockAuthRepository.findOTPByIdentifier.mockResolvedValue(mockOTP);
      mockAuthRepository.updateOTP.mockResolvedValue(mockOTP);

      const result = await service.validateOTP(identifier, code, ipAddress, userAgent);

      expect(result).toEqual({
        valid: true,
        message: 'OTP verified successfully',
        otpId: 'otp-id',
        purpose: OTPPurpose.LOGIN
      });
      expect(mockAuthRepository.updateOTP).toHaveBeenCalledWith('otp-id', {
        verified: true,
        updatedAt: expect.any(Date)
      });
      expect(mockSecurityService.recordSuccessfulAttempt).toHaveBeenCalledWith(identifier);
    });

    it('should reject invalid OTP format', async () => {
      const identifier = 'test@example.com';
      const code = 'invalid';
      (UserValidation.validateOTPCode as jest.Mock).mockReturnValue(false);

      const result = await service.validateOTP(identifier, code);

      expect(result).toEqual({
        valid: false,
        message: 'Invalid OTP format'
      });
    });

    it('should reject when no active OTP found', async () => {
      const identifier = 'test@example.com';
      const code = '123456';
      mockAuthRepository.findOTPByIdentifier.mockResolvedValue(null);

      const result = await service.validateOTP(identifier, code);

      expect(result).toEqual({
        valid: false,
        message: 'No active OTP found for this identifier'
      });
    });

    it('should reject already verified OTP', async () => {
      const identifier = 'test@example.com';
      const code = '123456';

      const mockOTP: OTPVerification = {
        id: 'otp-id',
        email: identifier,
        code,
        purpose: OTPPurpose.LOGIN,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        verified: true, // Already verified
        attempts: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockAuthRepository.findOTPByIdentifier.mockResolvedValue(mockOTP);

      const result = await service.validateOTP(identifier, code);

      expect(result).toEqual({
        valid: false,
        message: 'OTP has already been used'
      });
    });

    it('should reject expired OTP', async () => {
      const identifier = 'test@example.com';
      const code = '123456';

      const mockOTP: OTPVerification = {
        id: 'otp-id',
        email: identifier,
        code,
        purpose: OTPPurpose.LOGIN,
        expiresAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
        verified: false,
        attempts: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockAuthRepository.findOTPByIdentifier.mockResolvedValue(mockOTP);
      mockAuthRepository.deleteOTP.mockResolvedValue(undefined);

      const result = await service.validateOTP(identifier, code);

      expect(result).toEqual({
        valid: false,
        message: 'OTP has expired. Please request a new one.'
      });
      expect(mockAuthRepository.deleteOTP).toHaveBeenCalledWith('otp-id');
    });

    it('should reject when maximum attempts exceeded', async () => {
      const identifier = 'test@example.com';
      const code = '123456';

      const mockOTP: OTPVerification = {
        id: 'otp-id',
        email: identifier,
        code,
        purpose: OTPPurpose.LOGIN,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        verified: false,
        attempts: 3, // Max attempts reached
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockAuthRepository.findOTPByIdentifier.mockResolvedValue(mockOTP);
      mockAuthRepository.deleteOTP.mockResolvedValue(undefined);

      const result = await service.validateOTP(identifier, code);

      expect(result).toEqual({
        valid: false,
        message: 'Maximum verification attempts exceeded. Please request a new OTP.'
      });
      expect(mockAuthRepository.deleteOTP).toHaveBeenCalledWith('otp-id');
    });

    it('should handle incorrect OTP code with attempts tracking', async () => {
      const identifier = 'test@example.com';
      const code = '123456';
      const wrongCode = '654321';

      const mockOTP: OTPVerification = {
        id: 'otp-id',
        email: identifier,
        code: wrongCode, // Different code
        purpose: OTPPurpose.LOGIN,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        verified: false,
        attempts: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockAuthRepository.findOTPByIdentifier.mockResolvedValue(mockOTP);
      mockAuthRepository.updateOTP.mockResolvedValue(mockOTP);

      const result = await service.validateOTP(identifier, code);

      expect(result).toEqual({
        valid: false,
        message: 'Invalid OTP. 1 attempts remaining.',
        attemptsRemaining: 1
      });
      expect(mockAuthRepository.updateOTP).toHaveBeenCalledWith('otp-id', {
        attempts: 2,
        updatedAt: expect.any(Date)
      });
      expect(mockSecurityService.recordFailedAttempt).toHaveBeenCalled();
    });

    it('should handle validation errors gracefully', async () => {
      const identifier = 'test@example.com';
      const code = '123456';
      mockAuthRepository.findOTPByIdentifier.mockRejectedValue(new Error('Database error'));

      const result = await service.validateOTP(identifier, code);

      expect(result).toEqual({
        valid: false,
        message: 'Failed to validate OTP. Please try again.'
      });
    });
  });

  describe('resendOTP', () => {
    it('should resend existing OTP via email', async () => {
      const identifier = 'test@example.com';
      const method = 'email';

      const mockOTP: OTPVerification = {
        id: 'otp-id',
        email: identifier,
        code: '123456',
        purpose: OTPPurpose.LOGIN,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        verified: false,
        attempts: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockAuthRepository.findOTPByIdentifier.mockResolvedValue(mockOTP);
      mockNotificationService.sendEmail.mockResolvedValue(undefined);

      const result = await service.resendOTP(identifier, method);

      expect(result).toEqual({
        success: true,
        message: 'OTP resent successfully via email'
      });
      expect(mockNotificationService.sendEmail).toHaveBeenCalled();
    });

    it('should resend existing OTP via SMS', async () => {
      const identifier = '+1234567890';
      const method = 'sms';

      const mockOTP: OTPVerification = {
        id: 'otp-id',
        phoneNumber: identifier,
        code: '123456',
        purpose: OTPPurpose.LOGIN,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        verified: false,
        attempts: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockAuthRepository.findOTPByIdentifier.mockResolvedValue(mockOTP);
      mockNotificationService.sendSMS.mockResolvedValue(undefined);

      const result = await service.resendOTP(identifier, method);

      expect(result).toEqual({
        success: true,
        message: 'OTP resent successfully via sms'
      });
      expect(mockNotificationService.sendSMS).toHaveBeenCalled();
    });

    it('should reject resend when no active OTP found', async () => {
      const identifier = 'test@example.com';
      const method = 'email';
      mockAuthRepository.findOTPByIdentifier.mockResolvedValue(null);

      const result = await service.resendOTP(identifier, method);

      expect(result).toEqual({
        success: false,
        message: 'No active OTP found to resend'
      });
    });

    it('should reject resend when OTP is expired', async () => {
      const identifier = 'test@example.com';
      const method = 'email';

      const mockOTP: OTPVerification = {
        id: 'otp-id',
        email: identifier,
        code: '123456',
        purpose: OTPPurpose.LOGIN,
        expiresAt: new Date(Date.now() - 10 * 60 * 1000), // Expired
        verified: false,
        attempts: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockAuthRepository.findOTPByIdentifier.mockResolvedValue(mockOTP);
      mockAuthRepository.deleteOTP.mockResolvedValue(undefined);

      const result = await service.resendOTP(identifier, method);

      expect(result).toEqual({
        success: false,
        message: 'OTP has expired. Please request a new one.'
      });
      expect(mockAuthRepository.deleteOTP).toHaveBeenCalledWith('otp-id');
    });

    it('should reject resend when rate limit exceeded', async () => {
      const identifier = 'test@example.com';
      const method = 'email';
      mockSecurityService.checkRateLimit.mockReturnValue(false);

      const mockOTP: OTPVerification = {
        id: 'otp-id',
        email: identifier,
        code: '123456',
        purpose: OTPPurpose.LOGIN,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        verified: false,
        attempts: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockAuthRepository.findOTPByIdentifier.mockResolvedValue(mockOTP);

      const result = await service.resendOTP(identifier, method);

      expect(result).toEqual({
        success: false,
        message: 'Too many requests. Please wait before trying again.'
      });
    });
  });
});