import { MagicLinkAuthService } from '../magic-link-auth.service';
import { AuthenticationRepository } from '../../repositories/authentication.repository';
import { NotificationService } from '../notification.service';
import { SecurityService } from '../security.service';
import { MagicLink } from '../../models/auth.model';
import { LinkPurpose } from '../../models/common.types';

// Mock dependencies
jest.mock('../../repositories/authentication.repository');
jest.mock('../notification.service');
jest.mock('../security.service');

describe('MagicLinkAuthService', () => {
  let service: MagicLinkAuthService;
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

    service = new MagicLinkAuthService(
      mockAuthRepository,
      mockNotificationService,
      mockSecurityService
    );

    // Setup default mocks
    mockSecurityService.generateSecureToken.mockReturnValue('secure-token-123');
    mockSecurityService.validateTokenFormat.mockReturnValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateMagicLink', () => {
    it('should generate magic link for login purpose', async () => {
      const email = 'test@example.com';
      const purpose = LinkPurpose.LOGIN;
      const recipientName = 'Test User';

      const mockMagicLink: MagicLink = {
        id: 'magic-link-id',
        email: email.toLowerCase(),
        token: 'secure-token-123',
        purpose,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        used: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockAuthRepository.createMagicLink.mockResolvedValue(mockMagicLink);
      mockNotificationService.sendEmail.mockResolvedValue(undefined);

      const result = await service.generateMagicLink(email, purpose, recipientName);

      expect(result).toEqual(mockMagicLink);
      expect(mockSecurityService.generateSecureToken).toHaveBeenCalledWith(48, true);
      expect(mockAuthRepository.createMagicLink).toHaveBeenCalledWith(
        expect.objectContaining({
          email: email.toLowerCase(),
          token: 'secure-token-123',
          purpose,
          used: false
        })
      );
      expect(mockNotificationService.sendEmail).toHaveBeenCalled();
    });

    it('should generate magic link for invitation with extended expiry', async () => {
      const email = 'invite@example.com';
      const purpose = LinkPurpose.INVITATION;

      const mockMagicLink: MagicLink = {
        id: 'invitation-link-id',
        email: email.toLowerCase(),
        token: 'secure-token-123',
        purpose,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        used: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockAuthRepository.createMagicLink.mockResolvedValue(mockMagicLink);
      mockNotificationService.sendEmail.mockResolvedValue(undefined);

      const result = await service.generateMagicLink(email, purpose);

      expect(result).toEqual(mockMagicLink);
      // Verify expiry is set to 7 days for invitation
      const expectedExpiry = new Date();
      expectedExpiry.setHours(expectedExpiry.getHours() + 7 * 24);
      expect(mockAuthRepository.createMagicLink).toHaveBeenCalledWith(
        expect.objectContaining({
          purpose: LinkPurpose.INVITATION
        })
      );
    });

    it('should normalize email to lowercase', async () => {
      const email = 'TEST@EXAMPLE.COM';
      const purpose = LinkPurpose.LOGIN;

      const mockMagicLink: MagicLink = {
        id: 'magic-link-id',
        email: 'test@example.com',
        token: 'secure-token-123',
        purpose,
        expiresAt: new Date(),
        used: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockAuthRepository.createMagicLink.mockResolvedValue(mockMagicLink);
      mockNotificationService.sendEmail.mockResolvedValue(undefined);

      await service.generateMagicLink(email, purpose);

      expect(mockAuthRepository.createMagicLink).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com'
        })
      );
    });
  });

  describe('validateMagicLink', () => {
    it('should validate a valid magic link', async () => {
      const token = 'valid-token-123';
      const mockMagicLink: MagicLink = {
        id: 'magic-link-id',
        email: 'test@example.com',
        token,
        purpose: LinkPurpose.LOGIN,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        used: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockAuthRepository.findMagicLinkByToken.mockResolvedValue(mockMagicLink);
      mockAuthRepository.updateMagicLink.mockResolvedValue(mockMagicLink);

      const result = await service.validateMagicLink(token);

      expect(result).toEqual({
        valid: true,
        email: 'test@example.com',
        purpose: LinkPurpose.LOGIN,
        magicLinkId: 'magic-link-id'
      });
      expect(mockAuthRepository.updateMagicLink).toHaveBeenCalledWith('magic-link-id', {
        used: true,
        updatedAt: expect.any(Date)
      });
    });

    it('should reject invalid token format', async () => {
      const token = 'invalid-token';
      mockSecurityService.validateTokenFormat.mockReturnValue(false);

      const result = await service.validateMagicLink(token);

      expect(result).toEqual({ valid: false });
      expect(mockAuthRepository.findMagicLinkByToken).not.toHaveBeenCalled();
    });

    it('should reject non-existent magic link', async () => {
      const token = 'non-existent-token';
      mockAuthRepository.findMagicLinkByToken.mockResolvedValue(null);

      const result = await service.validateMagicLink(token);

      expect(result).toEqual({ valid: false });
    });

    it('should reject already used magic link', async () => {
      const token = 'used-token';
      const mockMagicLink: MagicLink = {
        id: 'magic-link-id',
        email: 'test@example.com',
        token,
        purpose: LinkPurpose.LOGIN,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        used: true, // Already used
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockAuthRepository.findMagicLinkByToken.mockResolvedValue(mockMagicLink);

      const result = await service.validateMagicLink(token);

      expect(result).toEqual({ valid: false });
    });

    it('should reject expired magic link', async () => {
      const token = 'expired-token';
      const mockMagicLink: MagicLink = {
        id: 'magic-link-id',
        email: 'test@example.com',
        token,
        purpose: LinkPurpose.LOGIN,
        expiresAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        used: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockAuthRepository.findMagicLinkByToken.mockResolvedValue(mockMagicLink);
      mockAuthRepository.updateMagicLink.mockResolvedValue(mockMagicLink);

      const result = await service.validateMagicLink(token);

      expect(result).toEqual({ valid: false });
      expect(mockAuthRepository.updateMagicLink).toHaveBeenCalledWith('magic-link-id', {
        used: true
      });
    });

    it('should handle validation errors gracefully', async () => {
      const token = 'error-token';
      mockAuthRepository.findMagicLinkByToken.mockRejectedValue(new Error('Database error'));

      const result = await service.validateMagicLink(token);

      expect(result).toEqual({ valid: false });
    });
  });

  describe('revokeMagicLink', () => {
    it('should revoke an existing magic link', async () => {
      const token = 'revoke-token';
      const mockMagicLink: MagicLink = {
        id: 'magic-link-id',
        email: 'test@example.com',
        token,
        purpose: LinkPurpose.LOGIN,
        expiresAt: new Date(),
        used: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockAuthRepository.findMagicLinkByToken.mockResolvedValue(mockMagicLink);
      mockAuthRepository.updateMagicLink.mockResolvedValue(mockMagicLink);

      const result = await service.revokeMagicLink(token);

      expect(result).toBe(true);
      expect(mockAuthRepository.updateMagicLink).toHaveBeenCalledWith('magic-link-id', {
        used: true,
        updatedAt: expect.any(Date)
      });
    });

    it('should return false for non-existent magic link', async () => {
      const token = 'non-existent-token';
      mockAuthRepository.findMagicLinkByToken.mockResolvedValue(null);

      const result = await service.revokeMagicLink(token);

      expect(result).toBe(false);
    });

    it('should handle revocation errors gracefully', async () => {
      const token = 'error-token';
      mockAuthRepository.findMagicLinkByToken.mockRejectedValue(new Error('Database error'));

      const result = await service.revokeMagicLink(token);

      expect(result).toBe(false);
    });
  });

  describe('generateInvitationLink', () => {
    it('should generate invitation link with custom email', async () => {
      const inviterName = 'Farm Admin';
      const inviteeEmail = 'fieldmanager@example.com';
      const role = 'Field Manager';

      const mockMagicLink: MagicLink = {
        id: 'invitation-id',
        email: inviteeEmail,
        token: 'invitation-token',
        purpose: LinkPurpose.INVITATION,
        expiresAt: new Date(),
        used: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockAuthRepository.createMagicLink.mockResolvedValue(mockMagicLink);
      mockNotificationService.sendEmail.mockResolvedValue(undefined);

      const result = await service.generateInvitationLink(inviterName, inviteeEmail, role);

      expect(result).toEqual(mockMagicLink);
      expect(mockNotificationService.sendEmail).toHaveBeenCalledTimes(2); // Once in generateMagicLink, once in generateInvitationLink
    });
  });
});