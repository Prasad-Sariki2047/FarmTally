import { MagicLink } from '../models/auth.model';
import { LinkPurpose } from '../models/common.types';
import { AuthenticationRepository } from '../repositories/authentication.repository';
import { CryptoUtils } from '../utils/crypto.utils';
import { EmailUtils } from '../utils/email.utils';
import { NotificationService } from './notification.service';
import { SecurityService } from './security.service';

export class MagicLinkAuthService {
  private readonly MAGIC_LINK_EXPIRY_HOURS = 1;
  private readonly INVITATION_EXPIRY_DAYS = 7;

  constructor(
    private authRepository: AuthenticationRepository,
    private notificationService: NotificationService,
    private securityService: SecurityService
  ) {}

  /**
   * Generate a secure magic link for authentication or invitation
   */
  async generateMagicLink(email: string, purpose: LinkPurpose, recipientName?: string): Promise<MagicLink> {
    // Generate enhanced secure token with timestamp
    const token = this.securityService.generateSecureToken(48, true);
    
    // Calculate expiry based on purpose
    const expiryHours = purpose === LinkPurpose.INVITATION ? this.INVITATION_EXPIRY_DAYS * 24 : this.MAGIC_LINK_EXPIRY_HOURS;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiryHours);

    // Create magic link record
    const magicLink: MagicLink = {
      id: CryptoUtils.generateUUID(),
      email: email.toLowerCase().trim(),
      token,
      purpose,
      expiresAt,
      used: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Save to repository
    const savedMagicLink = await this.authRepository.createMagicLink(magicLink);

    // Send email with magic link
    await this.sendMagicLinkEmail(email, token, purpose, recipientName);

    return savedMagicLink;
  }

  /**
   * Validate a magic link token
   */
  async validateMagicLink(token: string): Promise<{ valid: boolean; email?: string; purpose?: LinkPurpose; magicLinkId?: string }> {
    try {
      // Validate token format first
      if (!this.securityService.validateTokenFormat(token)) {
        return { valid: false };
      }

      // Find magic link by token
      const magicLink = await this.authRepository.findMagicLinkByToken(token);

      if (!magicLink) {
        return { valid: false };
      }

      // Check if already used
      if (magicLink.used) {
        return { valid: false };
      }

      // Check if expired
      if (new Date() > magicLink.expiresAt) {
        // Mark as used to prevent reuse
        await this.authRepository.updateMagicLink(magicLink.id, { used: true });
        return { valid: false };
      }

      // Mark as used
      await this.authRepository.updateMagicLink(magicLink.id, { 
        used: true,
        updatedAt: new Date()
      });

      return {
        valid: true,
        email: magicLink.email,
        purpose: magicLink.purpose,
        magicLinkId: magicLink.id
      };
    } catch (error) {
      console.error('Error validating magic link:', error);
      return { valid: false };
    }
  }

  /**
   * Send magic link email
   */
  private async sendMagicLinkEmail(email: string, token: string, purpose: LinkPurpose, recipientName?: string): Promise<void> {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const magicLinkUrl = `${baseUrl}/auth/magic-link?token=${token}&purpose=${purpose}`;
    
    const name = recipientName || 'User';
    let purposeText: string;

    switch (purpose) {
      case LinkPurpose.REGISTRATION:
        purposeText = 'Complete Registration';
        break;
      case LinkPurpose.LOGIN:
        purposeText = 'Login';
        break;
      case LinkPurpose.INVITATION:
        purposeText = 'Accept Invitation';
        break;
      default:
        purposeText = 'Access';
    }

    const emailContent = EmailUtils.generateMagicLinkEmail(name, magicLinkUrl, purposeText);

    await this.notificationService.sendEmail(email, emailContent.subject, emailContent.html, true);
  }

  /**
   * Clean up expired magic links
   */
  async cleanupExpiredLinks(): Promise<void> {
    // This would typically be called by a scheduled job
    // Implementation depends on the repository's bulk operations
    console.log('Cleanup expired magic links - to be implemented with bulk operations');
  }

  /**
   * Revoke a magic link (mark as used)
   */
  async revokeMagicLink(token: string): Promise<boolean> {
    try {
      const magicLink = await this.authRepository.findMagicLinkByToken(token);
      
      if (!magicLink) {
        return false;
      }

      await this.authRepository.updateMagicLink(magicLink.id, { 
        used: true,
        updatedAt: new Date()
      });

      return true;
    } catch (error) {
      console.error('Error revoking magic link:', error);
      return false;
    }
  }

  /**
   * Generate magic link for Field Manager invitation
   */
  async generateInvitationLink(inviterName: string, inviteeEmail: string, role: string): Promise<MagicLink> {
    const magicLink = await this.generateMagicLink(inviteeEmail, LinkPurpose.INVITATION);
    
    // Send invitation-specific email
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const invitationUrl = `${baseUrl}/auth/invitation?token=${magicLink.token}`;
    
    const emailContent = EmailUtils.generateInvitationEmail(inviterName, inviteeEmail, role, invitationUrl);

    await this.notificationService.sendEmail(inviteeEmail, emailContent.subject, emailContent.html, true);

    return magicLink;
  }
}