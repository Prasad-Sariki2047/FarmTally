export class EmailUtils {
  static generateMagicLinkEmail(recipientName: string, magicLink: string, purpose: string): { subject: string; html: string } {
    const subject = `Your FarmTally ${purpose} Link`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to FarmTally</h2>
        <p>Hello ${recipientName},</p>
        <p>Click the link below to ${purpose.toLowerCase()} to your FarmTally account:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${magicLink}" 
             style="background-color: #4CAF50; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            ${purpose} to FarmTally
          </a>
        </div>
        <p><strong>This link will expire in 1 hour for security reasons.</strong></p>
        <p>If you didn't request this, please ignore this email.</p>
        <hr>
        <p style="color: #666; font-size: 12px;">
          FarmTally - Agricultural Supply Chain Management Platform
        </p>
      </div>
    `;
    return { subject, html };
  }

  static generateOTPEmail(recipientName: string, otp: string): { subject: string; html: string } {
    const subject = 'Your FarmTally Verification Code';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>FarmTally Verification Code</h2>
        <p>Hello ${recipientName},</p>
        <p>Your verification code is:</p>
        <div style="text-align: center; margin: 30px 0;">
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; font-size: 24px; font-weight: bold; letter-spacing: 5px;">
            ${otp}
          </div>
        </div>
        <p><strong>This code will expire in 10 minutes.</strong></p>
        <p>If you didn't request this code, please ignore this email.</p>
        <hr>
        <p style="color: #666; font-size: 12px;">
          FarmTally - Agricultural Supply Chain Management Platform
        </p>
      </div>
    `;
    return { subject, html };
  }

  static generateApprovalEmail(recipientName: string, approved: boolean, reason?: string): { subject: string; html: string } {
    const subject = approved ? 'Welcome to FarmTally - Account Approved!' : 'FarmTally Registration Update';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${approved ? 'Welcome to FarmTally!' : 'Registration Update'}</h2>
        <p>Hello ${recipientName},</p>
        ${approved ? `
          <p>Great news! Your FarmTally account has been approved and is now active.</p>
          <p>You can now access your dashboard and start managing your agricultural operations.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL}/login" 
               style="background-color: #4CAF50; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Access Your Dashboard
            </a>
          </div>
        ` : `
          <p>We regret to inform you that your FarmTally registration has not been approved at this time.</p>
          ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
          <p>If you have questions about this decision, please contact our support team.</p>
        `}
        <hr>
        <p style="color: #666; font-size: 12px;">
          FarmTally - Agricultural Supply Chain Management Platform
        </p>
      </div>
    `;
    return { subject, html };
  }

  static generateInvitationEmail(inviterName: string, inviteeEmail: string, role: string, magicLink: string): { subject: string; html: string } {
    const subject = `Invitation to join FarmTally as ${role}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>You're Invited to FarmTally!</h2>
        <p>Hello,</p>
        <p>${inviterName} has invited you to join FarmTally as a ${role}.</p>
        <p>FarmTally is an agricultural supply chain management platform that helps coordinate farm operations and business relationships.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${magicLink}" 
             style="background-color: #4CAF50; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Accept Invitation
          </a>
        </div>
        <p><strong>This invitation will expire in 7 days.</strong></p>
        <p>If you don't want to join FarmTally, you can safely ignore this email.</p>
        <hr>
        <p style="color: #666; font-size: 12px;">
          FarmTally - Agricultural Supply Chain Management Platform
        </p>
      </div>
    `;
    return { subject, html };
  }
}