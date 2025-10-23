import { SocialAuthService, SocialAuthProfile, GoogleTokenPayload } from '../social-auth.service';
import { AuthenticationRepository } from '../../repositories/authentication.repository';
import { UserRepository } from '../../repositories/user.repository';
import { User, UserRegistrationData } from '../../models/user.model';
import { UserRole, AuthenticationMethod, UserStatus } from '../../models/common.types';

// Mock dependencies
jest.mock('../../repositories/authentication.repository');
jest.mock('../../repositories/user.repository');

describe('SocialAuthService', () => {
  let service: SocialAuthService;
  let mockAuthRepository: jest.Mocked<AuthenticationRepository>;
  let mockUserRepository: jest.Mocked<UserRepository>;

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

    // Set environment variable for testing
    process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';

    service = new SocialAuthService(mockAuthRepository, mockUserRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.GOOGLE_CLIENT_ID;
  });

  describe('validateGoogleToken', () => {
    it('should validate a valid Google token', async () => {
      const idToken = 'valid.google.token';
      
      // Mock the private method by spying on it
      const mockPayload: GoogleTokenPayload = {
        iss: 'https://accounts.google.com',
        sub: 'google-user-id',
        aud: 'test-google-client-id',
        email: 'test@example.com',
        email_verified: true,
        name: 'Test User',
        picture: 'https://example.com/photo.jpg',
        given_name: 'Test',
        family_name: 'User',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      };

      // Mock the private verifyGoogleIdToken method
      jest.spyOn(service as any, 'verifyGoogleIdToken').mockResolvedValue(mockPayload);

      const result = await service.validateGoogleToken(idToken);

      expect(result).toEqual({
        valid: true,
        profile: {
          id: 'google-user-id',
          email: 'test@example.com',
          name: 'Test User',
          picture: 'https://example.com/photo.jpg',
          verified_email: true,
          provider: 'google'
        }
      });
    });

    it('should reject invalid Google token', async () => {
      const idToken = 'invalid.google.token';
      
      jest.spyOn(service as any, 'verifyGoogleIdToken').mockResolvedValue(null);

      const result = await service.validateGoogleToken(idToken);

      expect(result).toEqual({
        valid: false,
        error: 'Invalid Google token'
      });
    });

    it('should handle missing Google client ID', async () => {
      delete process.env.GOOGLE_CLIENT_ID;
      
      // Create new service instance without Google client ID
      const serviceWithoutConfig = new SocialAuthService(mockAuthRepository, mockUserRepository);
      
      const result = await serviceWithoutConfig.validateGoogleToken('any.token');

      expect(result).toEqual({
        valid: false,
        error: 'Google authentication not configured'
      });
    });

    it('should handle token validation errors', async () => {
      const idToken = 'error.token';
      
      jest.spyOn(service as any, 'verifyGoogleIdToken').mockRejectedValue(new Error('Validation error'));

      const result = await service.validateGoogleToken(idToken);

      expect(result).toEqual({
        valid: false,
        error: 'Token validation failed'
      });
    });
  });

  describe('authenticateWithGoogle', () => {
    const mockProfile: SocialAuthProfile = {
      id: 'google-user-id',
      email: 'test@example.com',
      name: 'Test User',
      picture: 'https://example.com/photo.jpg',
      verified_email: true,
      provider: 'google'
    };

    it('should authenticate existing user with Google auth already linked', async () => {
      const idToken = 'valid.token';
      
      const existingUser: User = {
        id: 'user-id',
        email: 'test@example.com',
        fullName: 'Test User',
        role: UserRole.FARM_ADMIN,
        status: UserStatus.ACTIVE,
        authMethods: [AuthenticationMethod.SOCIAL_GOOGLE],
        profileData: {},
        emailVerified: true,
        phoneVerified: false,
        profileCompleted: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      jest.spyOn(service, 'validateGoogleToken').mockResolvedValue({
        valid: true,
        profile: mockProfile
      });
      mockUserRepository.findByEmail.mockResolvedValue(existingUser);

      const result = await service.authenticateWithGoogle(idToken);

      expect(result).toEqual({
        success: true,
        user: existingUser,
        isNewUser: false,
        message: 'Authentication successful'
      });
    });

    it('should link Google auth to existing user without Google auth', async () => {
      const idToken = 'valid.token';
      
      const existingUser: User = {
        id: 'user-id',
        email: 'test@example.com',
        fullName: 'Test User',
        role: UserRole.FARM_ADMIN,
        status: UserStatus.ACTIVE,
        authMethods: [AuthenticationMethod.MAGIC_LINK], // No Google auth
        profileData: {},
        emailVerified: true,
        phoneVerified: false,
        profileCompleted: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const updatedUser: User = {
        ...existingUser,
        authMethods: [AuthenticationMethod.MAGIC_LINK, AuthenticationMethod.SOCIAL_GOOGLE]
      };

      jest.spyOn(service, 'validateGoogleToken').mockResolvedValue({
        valid: true,
        profile: mockProfile
      });
      mockUserRepository.findByEmail.mockResolvedValue(existingUser);
      mockUserRepository.update.mockResolvedValue(updatedUser);

      const result = await service.authenticateWithGoogle(idToken);

      expect(result).toEqual({
        success: true,
        user: updatedUser,
        isNewUser: false,
        message: 'Google authentication linked to existing account'
      });
      expect(mockUserRepository.update).toHaveBeenCalledWith('user-id', {
        authMethods: [AuthenticationMethod.MAGIC_LINK, AuthenticationMethod.SOCIAL_GOOGLE],
        updatedAt: expect.any(Date)
      });
    });

    it('should require registration for new user', async () => {
      const idToken = 'valid.token';
      
      jest.spyOn(service, 'validateGoogleToken').mockResolvedValue({
        valid: true,
        profile: mockProfile
      });
      mockUserRepository.findByEmail.mockResolvedValue(null); // No existing user

      const result = await service.authenticateWithGoogle(idToken);

      expect(result).toEqual({
        success: true,
        requiresRegistration: true,
        message: 'New user detected. Please complete registration.',
        user: expect.objectContaining({
          email: 'test@example.com',
          fullName: 'Test User'
        })
      });
    });

    it('should handle invalid Google token', async () => {
      const idToken = 'invalid.token';
      
      jest.spyOn(service, 'validateGoogleToken').mockResolvedValue({
        valid: false,
        error: 'Invalid token'
      });

      const result = await service.authenticateWithGoogle(idToken);

      expect(result).toEqual({
        success: false,
        message: 'Invalid token'
      });
    });

    it('should handle authentication errors', async () => {
      const idToken = 'error.token';
      
      jest.spyOn(service, 'validateGoogleToken').mockRejectedValue(new Error('Auth error'));

      const result = await service.authenticateWithGoogle(idToken);

      expect(result).toEqual({
        success: false,
        message: 'Authentication failed. Please try again.'
      });
    });
  });

  describe('linkGoogleAccount', () => {
    it('should link Google account to existing user', async () => {
      const userId = 'user-id';
      const idToken = 'valid.token';
      
      const existingUser: User = {
        id: userId,
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

      const mockProfile: SocialAuthProfile = {
        id: 'google-user-id',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/photo.jpg',
        verified_email: true,
        provider: 'google'
      };

      jest.spyOn(service, 'validateGoogleToken').mockResolvedValue({
        valid: true,
        profile: mockProfile
      });
      mockUserRepository.findById.mockResolvedValue(existingUser);
      mockUserRepository.findByEmail.mockResolvedValue(existingUser);
      mockUserRepository.update.mockResolvedValue(existingUser);

      const result = await service.linkGoogleAccount(userId, idToken);

      expect(result).toEqual({
        success: true,
        message: 'Google account linked successfully'
      });
      expect(mockUserRepository.update).toHaveBeenCalledWith(userId, {
        authMethods: [AuthenticationMethod.MAGIC_LINK, AuthenticationMethod.SOCIAL_GOOGLE],
        profileData: expect.objectContaining({
          googleId: 'google-user-id',
          profilePicture: 'https://example.com/photo.jpg'
        }),
        updatedAt: expect.any(Date)
      });
    });

    it('should reject linking when user not found', async () => {
      const userId = 'non-existent-user';
      const idToken = 'valid.token';
      
      const mockProfile: SocialAuthProfile = {
        id: 'google-user-id',
        email: 'test@example.com',
        name: 'Test User',
        verified_email: true,
        provider: 'google'
      };

      jest.spyOn(service, 'validateGoogleToken').mockResolvedValue({
        valid: true,
        profile: mockProfile
      });
      mockUserRepository.findById.mockResolvedValue(null);

      const result = await service.linkGoogleAccount(userId, idToken);

      expect(result).toEqual({
        success: false,
        message: 'User not found'
      });
    });

    it('should reject linking when email mismatch', async () => {
      const userId = 'user-id';
      const idToken = 'valid.token';
      
      const existingUser: User = {
        id: userId,
        email: 'user@example.com',
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

      const mockProfile: SocialAuthProfile = {
        id: 'google-user-id',
        email: 'different@example.com', // Different email
        name: 'Test User',
        verified_email: true,
        provider: 'google'
      };

      jest.spyOn(service, 'validateGoogleToken').mockResolvedValue({
        valid: true,
        profile: mockProfile
      });
      mockUserRepository.findById.mockResolvedValue(existingUser);

      const result = await service.linkGoogleAccount(userId, idToken);

      expect(result).toEqual({
        success: false,
        message: 'Google account email does not match user account email'
      });
    });

    it('should handle already linked Google account', async () => {
      const userId = 'user-id';
      const idToken = 'valid.token';
      
      const existingUser: User = {
        id: userId,
        email: 'test@example.com',
        fullName: 'Test User',
        role: UserRole.FARM_ADMIN,
        status: UserStatus.ACTIVE,
        authMethods: [AuthenticationMethod.SOCIAL_GOOGLE], // Already linked
        profileData: {},
        emailVerified: true,
        phoneVerified: false,
        profileCompleted: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockProfile: SocialAuthProfile = {
        id: 'google-user-id',
        email: 'test@example.com',
        name: 'Test User',
        verified_email: true,
        provider: 'google'
      };

      jest.spyOn(service, 'validateGoogleToken').mockResolvedValue({
        valid: true,
        profile: mockProfile
      });
      mockUserRepository.findById.mockResolvedValue(existingUser);

      const result = await service.linkGoogleAccount(userId, idToken);

      expect(result).toEqual({
        success: true,
        message: 'Google account is already linked'
      });
    });
  });

  describe('unlinkGoogleAccount', () => {
    it('should unlink Google account from user', async () => {
      const userId = 'user-id';
      
      const existingUser: User = {
        id: userId,
        email: 'test@example.com',
        fullName: 'Test User',
        role: UserRole.FARM_ADMIN,
        status: UserStatus.ACTIVE,
        authMethods: [AuthenticationMethod.MAGIC_LINK, AuthenticationMethod.SOCIAL_GOOGLE],
        profileData: {
          googleId: 'google-user-id',
          profilePicture: 'https://example.com/photo.jpg'
        },
        emailVerified: true,
        phoneVerified: false,
        profileCompleted: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockUserRepository.findById.mockResolvedValue(existingUser);
      mockUserRepository.update.mockResolvedValue(existingUser);

      const result = await service.unlinkGoogleAccount(userId);

      expect(result).toEqual({
        success: true,
        message: 'Google account unlinked successfully'
      });
      expect(mockUserRepository.update).toHaveBeenCalledWith(userId, {
        authMethods: [AuthenticationMethod.MAGIC_LINK],
        profileData: {}, // Google data removed
        updatedAt: expect.any(Date)
      });
    });

    it('should reject unlinking when user has no other auth methods', async () => {
      const userId = 'user-id';
      
      const existingUser: User = {
        id: userId,
        email: 'test@example.com',
        fullName: 'Test User',
        role: UserRole.FARM_ADMIN,
        status: UserStatus.ACTIVE,
        authMethods: [AuthenticationMethod.SOCIAL_GOOGLE], // Only Google auth
        profileData: {},
        emailVerified: true,
        phoneVerified: false,
        profileCompleted: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockUserRepository.findById.mockResolvedValue(existingUser);

      const result = await service.unlinkGoogleAccount(userId);

      expect(result).toEqual({
        success: false,
        message: 'Cannot unlink Google account. User must have at least one authentication method.'
      });
    });

    it('should handle user not found', async () => {
      const userId = 'non-existent-user';
      
      mockUserRepository.findById.mockResolvedValue(null);

      const result = await service.unlinkGoogleAccount(userId);

      expect(result).toEqual({
        success: false,
        message: 'User not found'
      });
    });
  });

  describe('createUserFromGoogleProfile', () => {
    it('should create user from Google profile', async () => {
      const mockProfile: SocialAuthProfile = {
        id: 'google-user-id',
        email: 'newuser@example.com',
        name: 'New User',
        picture: 'https://example.com/photo.jpg',
        verified_email: true,
        provider: 'google'
      };

      const selectedRole = UserRole.FARM_ADMIN;
      const additionalProfileData = { farmSize: 100 };

      const createdUser: User = {
        id: 'new-user-id',
        email: 'newuser@example.com',
        fullName: 'New User',
        role: selectedRole,
        status: UserStatus.PENDING_APPROVAL,
        authMethods: [AuthenticationMethod.SOCIAL_GOOGLE],
        profileData: {
          googleId: 'google-user-id',
          profilePicture: 'https://example.com/photo.jpg',
          farmSize: 100
        },
        emailVerified: true,
        phoneVerified: false,
        profileCompleted: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockUserRepository.findByEmail.mockResolvedValue(null); // No existing user
      mockUserRepository.create.mockResolvedValue(createdUser);

      const result = await service.createUserFromGoogleProfile(mockProfile, selectedRole, additionalProfileData);

      expect(result).toEqual({
        success: true,
        user: createdUser,
        message: 'User created successfully from Google profile'
      });
      expect(mockUserRepository.create).toHaveBeenCalledWith({
        email: 'newuser@example.com',
        fullName: 'New User',
        selectedRole,
        authMethod: AuthenticationMethod.SOCIAL_GOOGLE,
        profileData: {
          googleId: 'google-user-id',
          profilePicture: 'https://example.com/photo.jpg',
          farmSize: 100
        }
      });
    });

    it('should reject creating user when email already exists', async () => {
      const mockProfile: SocialAuthProfile = {
        id: 'google-user-id',
        email: 'existing@example.com',
        name: 'Existing User',
        verified_email: true,
        provider: 'google'
      };

      const existingUser: User = {
        id: 'existing-user-id',
        email: 'existing@example.com',
        fullName: 'Existing User',
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

      mockUserRepository.findByEmail.mockResolvedValue(existingUser);

      const result = await service.createUserFromGoogleProfile(mockProfile, UserRole.FARM_ADMIN);

      expect(result).toEqual({
        success: false,
        message: 'User with this email already exists'
      });
    });

    it('should handle user creation errors', async () => {
      const mockProfile: SocialAuthProfile = {
        id: 'google-user-id',
        email: 'error@example.com',
        name: 'Error User',
        verified_email: true,
        provider: 'google'
      };

      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.create.mockRejectedValue(new Error('Database error'));

      const result = await service.createUserFromGoogleProfile(mockProfile, UserRole.FARM_ADMIN);

      expect(result).toEqual({
        success: false,
        message: 'Failed to create user account'
      });
    });
  });
});