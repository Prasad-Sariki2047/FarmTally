import { AuthenticationService, AuthenticationResult } from '../authentication.service';
import { AuthenticationRepository } from '../../repositories/authentication.repository';
import { UserRepository } from '../../repositories/user.repository';
import { NotificationService } from '../notification.service';
import { MagicLinkAuthService } from '../magic-link-auth.service';
import { OTPAuthService } from '../otp-auth.service';
import { SocialAuthService } from '../social-auth.service';
import { SessionManagementService } from '../session-management.service';
import { User } from '../../models/user.model';
import { UserRole, AuthenticationMethod, UserStatus, LinkPurpose, OTPPurpose } from '../../models/common.types';

// Mock all dependencies
jest.mock('../../repositories/authentication.repository');
jest.mock('../../repositories/user.repository');
jest.mock('../notification.service');
jest.mock('../magic-link-auth.service');
jest.mock('../otp-auth.service');
jest.mock('../social-auth.service');
jest.mock('../session-management.service');
jest.mock('../security.service');
jest.mock('../audit.service');
jest.mock('../auth-preference.service');

describe('AuthenticationService', () => {
  let service: AuthenticationService;
  let mockAuthRepository: jest.Mocked<AuthenticationRepository>;
  let mockUserRepository: jest.Mocked<UserRepository>;
  let mockNotificationService: jest.Mocked<NotificationService>;
  let mockMagicLinkService: jest.Mocked<MagicLinkAuthService>;
  let mockOTPService: jest.Mocked<OTPAuthService>;
  let mockSocialAuthService: jest.Mocked<SocialAuthService>;
  let mockSessionService: jest.Mocked<SessionManagementService>;

  const mockUser: User = {
    id: 'user-id',
    email: 'test@example.com',
    fullName: 'Test User',
    role: UserRole.FARM_ADMIN,
    status: UserStatus.ACTIVE,
    authMethods: [AuthenticationMethod.MAGIC_LINK],
    profileData: {},
    emailVerified: true,
    phoneVerified: false,
    profileCompleted: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockSessionMetadata = {
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
    deviceInfo: 'Test Device'
  };

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
    
    mockUserRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findByRole: jest.fn(),
      findByStatus: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findAll: jest.fn(),
    } as jest.Mocked<UserRepository>;
    
    mockNotificationService = {
      sendEmail: jest.fn(),
      sendSMS: jest.fn(),
      sendMagicLinkEmail: jest.fn(),
      sendOTPEmail: jest.fn(),
      sendOTPSMS: jest.fn(),
      sendApprovalNotification: jest.fn(),
      sendInvitationEmail: jest.fn(),
    } as jest.Mocked<NotificationService>;

    service = new AuthenticationService(
      mockAuthRepository,
      mockUserRepository,
      mockNotificationService
    );

    // Get mocked service instances
    mockMagicLinkService = (service as any).magicLinkService;
    mockOTPService = (service as any).otpService;
    mockSocialAuthService = (service as any).socialAuthService;
    mockSessionService = (service as any).sessionService;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('authenticateWithMagicLink', () => {
    it('should authenticate user with valid magic link', async () => {
      const token = 'valid-magic-link-token';

      mockMagicLinkService.validateMagicLink.mockResolvedValue({
        valid: true,
        email: 'test@example.com',
        purpose: LinkPurpose.LOGIN,
        magicLinkId: 'magic-link-id'
      });
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      mockSessionService.createSession.mockResolvedValue({
        success: true,
        sessionToken: 'session-token-123',
        session: {} as any,
        message: 'Session created'
      });

      const result = await service.authenticateWithMagicLink(token, mockSessionMetadata);

      expect(result).toEqual({
        success: true,
        user: mockUser,
        sessionToken: 'session-token-123',
        message: 'Authentication successful'
      });
      expect(mockMagicLinkService.validateMagicLink).toHaveBeenCalledWith(token);
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockSessionService.createSession).toHaveBeenCalledWith(
        'user-id',
        AuthenticationMethod.MAGIC_LINK,
        mockSessionMetadata
      );
    });

    it('should reject invalid magic link', async () => {
      const token = 'invalid-token';

      mockMagicLinkService.validateMagicLink.mockResolvedValue({
        valid: false
      });

      const result = await service.authenticateWithMagicLink(token, mockSessionMetadata);

      expect(result).toEqual({
        success: false,
        message: 'Invalid or expired magic link'
      });
    });

    it('should require registration for non-existent user', async () => {
      const token = 'valid-token';

      mockMagicLinkService.validateMagicLink.mockResolvedValue({
        valid: true,
        email: 'newuser@example.com',
        purpose: LinkPurpose.LOGIN
      });
      mockUserRepository.findByEmail.mockResolvedValue(null);

      const result = await service.authenticateWithMagicLink(token, mockSessionMetadata);

      expect(result).toEqual({
        success: false,
        requiresRegistration: true,
        message: 'User not found. Please complete registration.'
      });
    });

    it('should reject inactive user', async () => {
      const token = 'valid-token';
      const inactiveUser: User = { ...mockUser, status: UserStatus.PENDING_APPROVAL };

      mockMagicLinkService.validateMagicLink.mockResolvedValue({
        valid: true,
        email: 'test@example.com',
        purpose: LinkPurpose.LOGIN
      });
      mockUserRepository.findByEmail.mockResolvedValue(inactiveUser);

      const result = await service.authenticateWithMagicLink(token, mockSessionMetadata);

      expect(result).toEqual({
        success: false,
        message: 'Account is not active. Please contact support.'
      });
    });

    it('should handle session creation failure', async () => {
      const token = 'valid-token';

      mockMagicLinkService.validateMagicLink.mockResolvedValue({
        valid: true,
        email: 'test@example.com',
        purpose: LinkPurpose.LOGIN
      });
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      mockSessionService.createSession.mockResolvedValue({
        success: false,
        message: 'Session creation failed'
      });

      const result = await service.authenticateWithMagicLink(token, mockSessionMetadata);

      expect(result).toEqual({
        success: false,
        message: 'Session creation failed'
      });
    });
  });

  describe('authenticateWithOTP', () => {
    it('should authenticate user with valid OTP', async () => {
      const identifier = 'test@example.com';
      const code = '123456';

      mockOTPService.validateOTP.mockResolvedValue({
        valid: true,
        message: 'OTP verified successfully',
        otpId: 'otp-id',
        purpose: OTPPurpose.LOGIN
      });
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      mockSessionService.createSession.mockResolvedValue({
        success: true,
        sessionToken: 'session-token-123',
        session: {} as any,
        message: 'Session created'
      });

      const result = await service.authenticateWithOTP(identifier, code, mockSessionMetadata);

      expect(result).toEqual({
        success: true,
        user: mockUser,
        sessionToken: 'session-token-123',
        message: 'Authentication successful'
      });
      expect(mockOTPService.validateOTP).toHaveBeenCalledWith(
        identifier,
        code,
        mockSessionMetadata.ipAddress,
        mockSessionMetadata.userAgent
      );
    });

    it('should reject invalid OTP', async () => {
      const identifier = 'test@example.com';
      const code = '123456';

      mockOTPService.validateOTP.mockResolvedValue({
        valid: false,
        message: 'Invalid OTP code'
      });

      const result = await service.authenticateWithOTP(identifier, code, mockSessionMetadata);

      expect(result).toEqual({
        success: false,
        message: 'Invalid OTP code'
      });
    });

    it('should require registration for non-existent user', async () => {
      const identifier = 'newuser@example.com';
      const code = '123456';

      mockOTPService.validateOTP.mockResolvedValue({
        valid: true,
        message: 'OTP verified successfully',
        otpId: 'otp-id',
        purpose: OTPPurpose.LOGIN
      });
      mockUserRepository.findByEmail.mockResolvedValue(null);

      const result = await service.authenticateWithOTP(identifier, code, mockSessionMetadata);

      expect(result).toEqual({
        success: false,
        requiresRegistration: true,
        message: 'User not found. Please complete registration.'
      });
    });
  });

  describe('authenticateWithGoogle', () => {
    it('should authenticate user with valid Google token', async () => {
      const idToken = 'valid-google-token';

      mockSocialAuthService.authenticateWithGoogle.mockResolvedValue({
        success: true,
        user: mockUser,
        isNewUser: false,
        message: 'Authentication successful'
      });
      mockSessionService.createSession.mockResolvedValue({
        success: true,
        sessionToken: 'session-token-123',
        session: {} as any,
        message: 'Session created'
      });

      const result = await service.authenticateWithGoogle(idToken, mockSessionMetadata);

      expect(result).toEqual({
        success: true,
        user: mockUser,
        sessionToken: 'session-token-123',
        message: 'Authentication successful'
      });
      expect(mockSocialAuthService.authenticateWithGoogle).toHaveBeenCalledWith(idToken);
    });

    it('should require registration for new Google user', async () => {
      const idToken = 'valid-google-token';

      mockSocialAuthService.authenticateWithGoogle.mockResolvedValue({
        success: true,
        requiresRegistration: true,
        message: 'New user detected. Please complete registration.',
        user: { email: 'newuser@example.com', fullName: 'New User' } as any
      });

      const result = await service.authenticateWithGoogle(idToken, mockSessionMetadata);

      expect(result).toEqual({
        success: false,
        requiresRegistration: true,
        message: 'New user detected. Please complete registration.',
        user: expect.objectContaining({
          email: 'newuser@example.com',
          fullName: 'New User'
        })
      });
    });

    it('should handle Google authentication failure', async () => {
      const idToken = 'invalid-google-token';

      mockSocialAuthService.authenticateWithGoogle.mockResolvedValue({
        success: false,
        message: 'Invalid Google token'
      });

      const result = await service.authenticateWithGoogle(idToken, mockSessionMetadata);

      expect(result).toEqual({
        success: false,
        message: 'Invalid Google token'
      });
    });
  });

  describe('registerUserWithMagicLink', () => {
    it('should register user with magic link', async () => {
      const email = 'newuser@example.com';
      const fullName = 'New User';
      const selectedRole = UserRole.FARM_ADMIN;

      mockUserRepository.findByEmail.mockResolvedValue(null); // No existing user
      mockMagicLinkService.generateMagicLink.mockResolvedValue({
        id: 'magic-link-id',
        email,
        token: 'registration-token',
        purpose: LinkPurpose.REGISTRATION,
        expiresAt: new Date(),
        used: false,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const result = await service.registerUserWithMagicLink(email, fullName, selectedRole);

      expect(result).toEqual({
        success: true,
        message: 'Registration link sent to your email',
        registrationId: 'magic-link-id'
      });
      expect(mockMagicLinkService.generateMagicLink).toHaveBeenCalledWith(
        email,
        LinkPurpose.REGISTRATION,
        fullName
      );
    });

    it('should reject registration for existing user', async () => {
      const email = 'existing@example.com';
      const fullName = 'Existing User';
      const selectedRole = UserRole.FARM_ADMIN;

      mockUserRepository.findByEmail.mockResolvedValue(mockUser);

      const result = await service.registerUserWithMagicLink(email, fullName, selectedRole);

      expect(result).toEqual({
        success: false,
        message: 'User with this email already exists'
      });
    });

    it('should handle registration errors', async () => {
      const email = 'error@example.com';
      const fullName = 'Error User';
      const selectedRole = UserRole.FARM_ADMIN;

      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockMagicLinkService.generateMagicLink.mockRejectedValue(new Error('Email service error'));

      const result = await service.registerUserWithMagicLink(email, fullName, selectedRole);

      expect(result).toEqual({
        success: false,
        message: 'Registration failed. Please try again.'
      });
    });
  });

  describe('registerUserWithGoogle', () => {
    it('should register user with Google profile', async () => {
      const idToken = 'valid-google-token';
      const selectedRole = UserRole.FARM_ADMIN;
      const additionalProfileData = { farmSize: 100 };

      mockSocialAuthService.validateGoogleToken.mockResolvedValue({
        valid: true,
        profile: {
          id: 'google-user-id',
          email: 'newuser@example.com',
          name: 'New User',
          verified_email: true,
          provider: 'google'
        }
      });
      mockSocialAuthService.createUserFromGoogleProfile.mockResolvedValue({
        success: true,
        user: mockUser,
        message: 'User created successfully from Google profile'
      });

      const result = await service.registerUserWithGoogle(idToken, selectedRole, additionalProfileData);

      expect(result).toEqual({
        success: true,
        user: mockUser,
        message: 'User created successfully from Google profile'
      });
      expect(mockSocialAuthService.createUserFromGoogleProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'newuser@example.com',
          name: 'New User'
        }),
        selectedRole,
        additionalProfileData
      );
    });

    it('should reject registration with invalid Google token', async () => {
      const idToken = 'invalid-google-token';
      const selectedRole = UserRole.FARM_ADMIN;

      mockSocialAuthService.validateGoogleToken.mockResolvedValue({
        valid: false,
        error: 'Invalid token'
      });

      const result = await service.registerUserWithGoogle(idToken, selectedRole);

      expect(result).toEqual({
        success: false,
        message: 'Invalid Google token'
      });
    });
  });

  describe('validateSession', () => {
    it('should validate active session', async () => {
      const sessionToken = 'valid-session-token';

      mockSessionService.validateSession.mockResolvedValue({
        valid: true,
        user: mockUser,
        message: 'Session is valid'
      });

      const result = await service.validateSession(sessionToken);

      expect(result).toEqual({
        valid: true,
        userId: 'user-id',
        user: mockUser
      });
      expect(mockSessionService.validateSession).toHaveBeenCalledWith(sessionToken);
    });

    it('should reject invalid session', async () => {
      const sessionToken = 'invalid-session-token';

      mockSessionService.validateSession.mockResolvedValue({
        valid: false,
        message: 'Session is invalid'
      });

      const result = await service.validateSession(sessionToken);

      expect(result).toEqual({
        valid: false,
        userId: undefined,
        user: undefined
      });
    });
  });

  describe('generateMagicLink', () => {
    it('should delegate to magic link service', async () => {
      const email = 'test@example.com';
      const purpose = LinkPurpose.LOGIN;
      const recipientName = 'Test User';

      const mockMagicLink = {
        id: 'magic-link-id',
        email,
        token: 'magic-token',
        purpose,
        expiresAt: new Date(),
        used: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockMagicLinkService.generateMagicLink.mockResolvedValue(mockMagicLink);

      const result = await service.generateMagicLink(email, purpose, recipientName);

      expect(result).toEqual(mockMagicLink);
      expect(mockMagicLinkService.generateMagicLink).toHaveBeenCalledWith(email, purpose, recipientName);
    });
  });

  describe('generateOTP', () => {
    it('should delegate to OTP service', async () => {
      const identifier = 'test@example.com';
      const method = 'email';
      const purpose = OTPPurpose.LOGIN;

      const mockResponse = {
        success: true,
        message: 'OTP sent successfully via email',
        otpId: 'otp-id'
      };

      mockOTPService.generateOTP.mockResolvedValue(mockResponse);

      const result = await service.generateOTP(identifier, method, purpose);

      expect(result).toEqual(mockResponse);
      expect(mockOTPService.generateOTP).toHaveBeenCalledWith(
        identifier,
        method,
        purpose,
        undefined,
        'unknown',
        'unknown'
      );
    });
  });
});