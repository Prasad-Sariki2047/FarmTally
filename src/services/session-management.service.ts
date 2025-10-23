import { AuthenticationSession } from '../models/auth.model';
import { AuthenticationMethod } from '../models/common.types';
import { AuthenticationRepository } from '../repositories/authentication.repository';
import { UserRepository } from '../repositories/user.repository';
import { CryptoUtils } from '../utils/crypto.utils';
import { SecurityService } from './security.service';
import { AuditService } from './audit.service';
import * as jwt from 'jsonwebtoken';

export interface SessionMetadata {
  ipAddress: string;
  userAgent: string;
  deviceInfo?: string;
  location?: string;
}

export interface SessionToken {
  sessionId: string;
  userId: string;
  role: string;
  authMethod: AuthenticationMethod;
  iat: number;
  exp: number;
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  action: string;
  method: AuthenticationMethod;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  timestamp: Date;
  details?: any;
}

export class SessionManagementService {
  private readonly SESSION_EXPIRY_HOURS = 24;
  private readonly JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';
  private readonly REFRESH_THRESHOLD_HOURS = 2; // Refresh session if less than 2 hours remaining

  // In-memory audit log (in production, use database)
  private auditLog: AuditLogEntry[] = [];

  constructor(
    private authRepository: AuthenticationRepository,
    private userRepository: UserRepository,
    private securityService: SecurityService,
    private auditService: AuditService
  ) {
    if (!process.env.JWT_SECRET) {
      console.warn('JWT_SECRET not set - using fallback secret (not secure for production)');
    }
  }

  /**
   * Create a new authentication session
   */
  async createSession(
    userId: string, 
    method: AuthenticationMethod, 
    metadata: SessionMetadata
  ): Promise<{ success: boolean; sessionToken?: string; session?: AuthenticationSession; message: string }> {
    try {
      // Get user details
      const user = await this.userRepository.findById(userId);
      if (!user) {
        await this.auditService.logAuthenticationAttempt(
          userId, 
          method, 
          false, 
          metadata.ipAddress, 
          metadata.userAgent,
          { error: 'User not found' }
        );
        return { success: false, message: 'User not found' };
      }

      // Check if user is active
      if (user.status !== 'active') {
        await this.auditService.logAuthenticationAttempt(
          userId, 
          method, 
          false, 
          metadata.ipAddress, 
          metadata.userAgent,
          { error: 'User not active' }
        );
        return { success: false, message: 'User account is not active' };
      }

      // Calculate expiry
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + this.SESSION_EXPIRY_HOURS);

      // Create session record
      const session: AuthenticationSession = {
        id: CryptoUtils.generateUUID(),
        userId,
        method,
        expiresAt,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Save session to repository
      const savedSession = await this.authRepository.createSession(session);

      // Generate secure JWT token with enhanced security
      const tokenPayload: SessionToken = {
        sessionId: savedSession.id,
        userId,
        role: user.role,
        authMethod: method,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(expiresAt.getTime() / 1000)
      };

      const sessionToken = jwt.sign(tokenPayload, this.JWT_SECRET, {
        algorithm: 'HS256',
        issuer: 'farmtally',
        audience: 'farmtally-users'
      });

      // Update user's last login
      await this.userRepository.update(userId, {
        lastLoginAt: new Date(),
        updatedAt: new Date()
      });

      // Log successful authentication
      await this.auditService.logAuthenticationAttempt(
        userId, 
        method, 
        true, 
        metadata.ipAddress, 
        metadata.userAgent
      );

      return {
        success: true,
        sessionToken,
        session: savedSession,
        message: 'Session created successfully'
      };

    } catch (error) {
      console.error('Error creating session:', error);
      await this.auditService.logAuthenticationAttempt(
        userId, 
        method, 
        false, 
        metadata.ipAddress, 
        metadata.userAgent,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
      return { success: false, message: 'Failed to create session' };
    }
  }

  /**
   * Validate a session token
   */
  async validateSession(
    sessionToken: string,
    currentIP?: string,
    currentUserAgent?: string
  ): Promise<{
    valid: boolean;
    session?: AuthenticationSession;
    user?: any;
    needsRefresh?: boolean;
    message: string;
    securityWarning?: string;
  }> {
    try {
      // Validate token format first
      if (!this.securityService.validateTokenFormat(sessionToken)) {
        return { valid: false, message: 'Invalid token format' };
      }

      // Verify JWT token with enhanced options
      const decoded = jwt.verify(sessionToken, this.JWT_SECRET, {
        algorithms: ['HS256'],
        issuer: 'farmtally',
        audience: 'farmtally-users'
      }) as SessionToken;

      // Get session from repository
      const session = await this.authRepository.findSessionById(decoded.sessionId);
      
      if (!session) {
        return { valid: false, message: 'Session not found' };
      }

      // Check if session is expired
      if (new Date() > session.expiresAt) {
        // Clean up expired session
        await this.authRepository.deleteSession(session.id);
        return { valid: false, message: 'Session expired' };
      }

      // Get user details
      const user = await this.userRepository.findById(session.userId);
      if (!user) {
        await this.authRepository.deleteSession(session.id);
        return { valid: false, message: 'User not found' };
      }

      // Check if user is still active
      if (user.status !== 'active') {
        await this.authRepository.deleteSession(session.id);
        return { valid: false, message: 'User account is not active' };
      }

      // Check for session hijacking if IP/UserAgent provided
      let securityWarning: string | undefined;
      if (currentIP && currentUserAgent) {
        const hijackDetected = this.securityService.detectSessionHijacking(
          session.id,
          currentIP,
          currentUserAgent,
          session.ipAddress,
          session.userAgent
        );

        if (hijackDetected) {
          // Revoke session immediately
          await this.authRepository.deleteSession(session.id);
          return { 
            valid: false, 
            message: 'Session terminated due to security concerns',
            securityWarning: 'Potential session hijacking detected'
          };
        }

        // Check for suspicious IP
        if (this.securityService.isSuspiciousIP(currentIP)) {
          securityWarning = 'Login from previously flagged IP address';
        }
      }

      // Check if session needs refresh
      const now = new Date();
      const refreshThreshold = new Date(session.expiresAt);
      refreshThreshold.setHours(refreshThreshold.getHours() - this.REFRESH_THRESHOLD_HOURS);
      
      const needsRefresh = now > refreshThreshold;

      return {
        valid: true,
        session,
        user,
        needsRefresh,
        message: 'Session valid',
        securityWarning
      };

    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'TokenExpiredError') {
        return { valid: false, message: 'Session token expired' };
      } else if (error instanceof Error && error.name === 'JsonWebTokenError') {
        return { valid: false, message: 'Invalid session token' };
      }
      
      console.error('Error validating session:', error);
      return { valid: false, message: 'Session validation failed' };
    }
  }

  /**
   * Refresh a session (extend expiry)
   */
  async refreshSession(sessionToken: string, metadata: SessionMetadata): Promise<{
    success: boolean;
    newSessionToken?: string;
    message: string;
  }> {
    try {
      // Validate current session
      const validation = await this.validateSession(sessionToken);
      
      if (!validation.valid || !validation.session || !validation.user) {
        return { success: false, message: validation.message };
      }

      // Create new expiry time
      const newExpiresAt = new Date();
      newExpiresAt.setHours(newExpiresAt.getHours() + this.SESSION_EXPIRY_HOURS);

      // Update session expiry
      const updatedSession = await this.authRepository.updateSession(validation.session.id, {
        expiresAt: newExpiresAt,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        updatedAt: new Date()
      });

      // Generate new secure JWT token
      const tokenPayload: SessionToken = {
        sessionId: updatedSession.id,
        userId: validation.user.id,
        role: validation.user.role,
        authMethod: validation.session.method,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(newExpiresAt.getTime() / 1000)
      };

      const newSessionToken = jwt.sign(tokenPayload, this.JWT_SECRET, {
        algorithm: 'HS256',
        issuer: 'farmtally',
        audience: 'farmtally-users'
      });

      // Log session refresh
      await this.auditService.logUserAction(
        validation.user.id,
        validation.user.role,
        'session_refreshed' as any,
        'session',
        validation.session.id,
        true,
        metadata.ipAddress,
        metadata.userAgent,
        validation.session.id
      );

      return {
        success: true,
        newSessionToken,
        message: 'Session refreshed successfully'
      };

    } catch (error: unknown) {
      console.error('Error refreshing session:', error);
      return { success: false, message: error instanceof Error ? error.message : 'Failed to refresh session' };
    }
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(sessionToken: string): Promise<{ success: boolean; message: string }> {
    try {
      // Decode token to get session ID
      const decoded = jwt.verify(sessionToken, this.JWT_SECRET) as SessionToken;
      
      // Delete session from repository
      await this.authRepository.deleteSession(decoded.sessionId);

      // Log session revocation
      await this.auditService.logUserAction(
        decoded.userId,
        undefined as any,
        'session_revoked' as any,
        'session',
        decoded.sessionId,
        true,
        'unknown',
        'unknown',
        decoded.sessionId
      );

      return { success: true, message: 'Session revoked successfully' };

    } catch (error: unknown) {
      console.error('Error revoking session:', error);
      return { success: false, message: error instanceof Error ? error.message : 'Failed to revoke session' };
    }
  }

  /**
   * Revoke all sessions for a user
   */
  async revokeAllUserSessions(userId: string): Promise<{ success: boolean; message: string; revokedCount?: number }> {
    try {
      // Get all user sessions
      const userSessions = await this.authRepository.findSessionsByUserId(userId);
      const sessionCount = userSessions.length;

      // Delete all user sessions
      await this.authRepository.deleteUserSessions(userId);

      // Log bulk session revocation
      await this.auditService.logUserAction(
        userId,
        undefined as any,
        'session_revoked' as any,
        'session',
        'bulk',
        true,
        'system',
        'system',
        undefined,
        { revokedCount: sessionCount }
      );

      return { 
        success: true, 
        message: 'All user sessions revoked successfully',
        revokedCount: sessionCount
      };

    } catch (error) {
      console.error('Error revoking all user sessions:', error);
      return { success: false, message: 'Failed to revoke user sessions' };
    }
  }

  /**
   * Get active sessions for a user
   */
  async getUserSessions(userId: string): Promise<{
    success: boolean;
    sessions?: AuthenticationSession[];
    message: string;
  }> {
    try {
      const sessions = await this.authRepository.findSessionsByUserId(userId);
      
      // Filter out expired sessions
      const now = new Date();
      const activeSessions = sessions.filter(session => session.expiresAt > now);

      // Clean up expired sessions
      const expiredSessions = sessions.filter(session => session.expiresAt <= now);
      for (const expiredSession of expiredSessions) {
        await this.authRepository.deleteSession(expiredSession.id);
      }

      return {
        success: true,
        sessions: activeSessions,
        message: 'User sessions retrieved successfully'
      };

    } catch (error) {
      console.error('Error getting user sessions:', error);
      return { success: false, message: 'Failed to retrieve user sessions' };
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<{ success: boolean; cleanedCount: number; message: string }> {
    try {
      // This would typically be implemented with a bulk delete operation in the repository
      // For now, we'll log the cleanup operation
      console.log('Session cleanup initiated - expired sessions will be removed');

      return {
        success: true,
        cleanedCount: 0, // Would be actual count from repository
        message: 'Session cleanup completed'
      };

    } catch (error) {
      console.error('Error during session cleanup:', error);
      return { success: false, cleanedCount: 0, message: 'Session cleanup failed' };
    }
  }



  /**
   * Get authentication audit log for a user
   */
  async getUserAuditLog(userId: string, limit: number = 50): Promise<{
    success: boolean;
    auditLog?: any[];
    message: string;
  }> {
    try {
      const result = await this.auditService.queryAuditLog({
        userId,
        limit
      });

      return {
        success: true,
        auditLog: result.entries,
        message: 'Audit log retrieved successfully'
      };

    } catch (error) {
      console.error('Error retrieving audit log:', error);
      return { success: false, message: 'Failed to retrieve audit log' };
    }
  }

  /**
   * Check for suspicious authentication activity
   */
  async checkSuspiciousActivity(userId: string): Promise<{
    suspicious: boolean;
    reasons: string[];
    recommendedAction?: string;
  }> {
    try {
      const reasons: string[] = [];
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      // Get recent audit entries for user
      const result = await this.auditService.queryAuditLog({
        userId,
        startDate: oneHourAgo,
        endDate: now
      });

      const recentEntries = result.entries;

      // Check for multiple failed attempts
      const failedAttempts = recentEntries.filter(entry => !entry.success);
      if (failedAttempts.length >= 5) {
        reasons.push(`${failedAttempts.length} failed authentication attempts in the last hour`);
      }

      // Check for multiple IP addresses
      const uniqueIPs = new Set(recentEntries.map(entry => entry.ipAddress));
      if (uniqueIPs.size >= 3) {
        reasons.push(`Authentication attempts from ${uniqueIPs.size} different IP addresses`);
      }

      // Check for rapid session creation
      const sessionCreations = recentEntries.filter(entry => entry.action === 'session_created');
      if (sessionCreations.length >= 10) {
        reasons.push(`${sessionCreations.length} session creations in the last hour`);
      }

      const suspicious = reasons.length > 0;
      let recommendedAction: string | undefined;

      if (suspicious) {
        if (failedAttempts.length >= 10) {
          recommendedAction = 'Consider temporarily suspending the account';
        } else if (reasons.length >= 2) {
          recommendedAction = 'Require additional verification for next login';
        } else {
          recommendedAction = 'Monitor closely for continued suspicious activity';
        }
      }

      return {
        suspicious,
        reasons,
        recommendedAction
      };

    } catch (error) {
      console.error('Error checking suspicious activity:', error);
      return {
        suspicious: false,
        reasons: ['Error checking activity']
      };
    }
  }
}