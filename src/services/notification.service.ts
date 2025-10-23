import { EmailUtils } from '../utils/email.utils';

export interface NotificationService {
  sendEmail(to: string, subject: string, body: string, isHtml?: boolean): Promise<void>;
  sendSMS(phoneNumber: string, message: string): Promise<void>;
  sendMagicLinkEmail(email: string, magicLink: string, purpose: string): Promise<void>;
  sendOTPEmail(email: string, otp: string): Promise<void>;
  sendOTPSMS(phoneNumber: string, otp: string): Promise<void>;
  sendApprovalNotification(email: string, approved: boolean, reason?: string): Promise<void>;
  sendInvitationEmail(email: string, inviterName: string, magicLink: string): Promise<void>;
}

export class NotificationServiceImpl implements NotificationService {
  /**
   * Send email notification
   */
  async sendEmail(to: string, subject: string, body: string, isHtml: boolean = false): Promise<void> {
    try {
      // In a real implementation, this would use a service like SendGrid, AWS SES, etc.
      console.log(`Sending email to: ${to}`);
      console.log(`Subject: ${subject}`);
      console.log(`Body: ${body}`);
      console.log(`Is HTML: ${isHtml}`);
      
      // Simulate email sending delay
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error('Failed to send email:', error);
      throw new Error('Email sending failed');
    }
  }

  /**
   * Send SMS notification
   */
  async sendSMS(phoneNumber: string, message: string): Promise<void> {
    try {
      // In a real implementation, this would use a service like Twilio, AWS SNS, etc.
      console.log(`Sending SMS to: ${phoneNumber}`);
      console.log(`Message: ${message}`);
      
      // Simulate SMS sending delay
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error('Failed to send SMS:', error);
      throw new Error('SMS sending failed');
    }
  }

  /**
   * Send magic link email
   */
  async sendMagicLinkEmail(email: string, magicLink: string, purpose: string): Promise<void> {
    const emailContent = EmailUtils.generateMagicLinkEmail('User', magicLink, purpose);
    await this.sendEmail(email, emailContent.subject, emailContent.html, true);
  }

  /**
   * Send OTP via email
   */
  async sendOTPEmail(email: string, otp: string): Promise<void> {
    const emailContent = EmailUtils.generateOTPEmail('User', otp);
    await this.sendEmail(email, emailContent.subject, emailContent.html, true);
  }

  /**
   * Send OTP via SMS
   */
  async sendOTPSMS(phoneNumber: string, otp: string): Promise<void> {
    const message = `Your FarmTally verification code is: ${otp}. This code will expire in 10 minutes.`;
    await this.sendSMS(phoneNumber, message);
  }

  /**
   * Send approval notification
   */
  async sendApprovalNotification(email: string, approved: boolean, reason?: string): Promise<void> {
    const emailContent = EmailUtils.generateApprovalEmail('User', approved, reason);
    await this.sendEmail(email, emailContent.subject, emailContent.html, true);
  }

  /**
   * Send invitation email
   */
  async sendInvitationEmail(email: string, inviterName: string, magicLink: string): Promise<void> {
    const emailContent = EmailUtils.generateInvitationEmail(inviterName, email, 'Field Manager', magicLink);
    await this.sendEmail(email, emailContent.subject, emailContent.html, true);
  }
}