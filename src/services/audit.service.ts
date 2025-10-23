import { AuthenticationMethod, UserRole } from '../models/common.types';
import { CryptoUtils } from '../utils/crypto.utils';

export interface AuditLogEntry {
  id: string;
  userId: string;
  userRole?: UserRole;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  method?: AuthenticationMethod;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  timestamp: Date;
  details?: any;
  severity: AuditSeverity;
  sessionId?: string;
}

export enum AuditAction {
  // Authentication actions
  LOGIN_ATTEMPT = 'login_attempt',
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILURE = 'login_failure',
  LOGOUT = 'logout',
  SESSION_CREATED = 'session_created',
  SESSION_REFRESHED = 'session_refreshed',
  SESSION_REVOKED = 'session_revoked',
  PASSWORD_RESET = 'password_reset',
  OTP_GENERATED = 'otp_generated',
  OTP_VERIFIED = 'otp_verified',
  OTP_FAILED = 'otp_failed',
  MAGIC_LINK_GENERATED = 'magic_link_generated',
  MAGIC_LINK_USED = 'magic_link_used',
  
  // User management actions
  USER_REGISTERED = 'user_registered',
  USER_APPROVED = 'user_approved',
  USER_REJECTED = 'user_rejected',
  USER_ACTIVATED = 'user_activated',
  USER_SUSPENDED = 'user_suspended',
  USER_PROFILE_UPDATED = 'user_profile_updated',
  USER_ROLE_CHANGED = 'user_role_changed',
  
  // Business relationship actions
  RELATIONSHIP_CREATED = 'relationship_created',
  RELATIONSHIP_APPROVED = 'relationship_approved',
  RELATIONSHIP_REJECTED = 'relationship_rejected',
  INVITATION_SENT = 'invitation_sent',
  INVITATION_ACCEPTED = 'invitation_accepted',
  INVITATION_DECLINED = 'invitation_declined',
  
  // Data access actions
  DATA_ACCESSED = 'data_accessed',
  DATA_CREATED = 'data_created',
  DATA_UPDATED = 'data_updated',
  DATA_DELETED = 'data_deleted',
  DATA_EXPORTED = 'data_exported',
  
  // Supply chain actions
  COMMODITY_CREATED = 'commodity_created',
  COMMODITY_UPDATED = 'commodity_updated',
  DELIVERY_SCHEDULED = 'delivery_scheduled',
  DELIVERY_COMPLETED = 'delivery_completed',
  TRANSACTION_CREATED = 'transaction_created',
  PAYMENT_PROCESSED = 'payment_processed',
  
  // Security events
  SECURITY_VIOLATION = 'security_violation',
  BRUTE_FORCE_DETECTED = 'brute_force_detected',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  ACCOUNT_LOCKED = 'account_locked',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  
  // System actions
  SYSTEM_BACKUP = 'system_backup',
  SYSTEM_RESTORE = 'system_restore',
  CONFIGURATION_CHANGED = 'configuration_changed',
  MAINTENANCE_MODE = 'maintenance_mode'
}

export enum AuditSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export interface AuditQuery {
  userId?: string;
  userRole?: UserRole;
  action?: AuditAction;
  resource?: string;
  severity?: AuditSeverity;
  startDate?: Date;
  endDate?: Date;
  ipAddress?: string;
  success?: boolean;
  limit?: number;
  offset?: number;
}

export interface AuditSummary {
  totalEntries: number;
  successfulActions: number;
  failedActions: number;
  securityEvents: number;
  topActions: { action: AuditAction; count: number }[];
  topUsers: { userId: string; count: number }[];
  timeRange: { start: Date; end: Date };
}

export interface SecurityAlert {
  id: string;
  type: SecurityAlertType;
  severity: AuditSeverity;
  userId?: string;
  ipAddress?: string;
  description: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  relatedAuditEntries: string[];
}

export enum SecurityAlertType {
  MULTIPLE_FAILED_LOGINS = 'multiple_failed_logins',
  SUSPICIOUS_IP_ACTIVITY = 'suspicious_ip_activity',
  UNUSUAL_ACCESS_PATTERN = 'unusual_access_pattern',
  PRIVILEGE_ESCALATION = 'privilege_escalation',
  DATA_BREACH_ATTEMPT = 'data_breach_attempt',
  ACCOUNT_COMPROMISE = 'account_compromise'
}

export class AuditService {
  private auditLog: AuditLogEntry[] = [];
  private securityAlerts: SecurityAlert[] = [];
  private readonly MAX_LOG_ENTRIES = 10000;
  private readonly ALERT_THRESHOLDS = {
    failedLoginsPerHour: 10,
    suspiciousIPRequests: 50,
    dataAccessPerMinute: 100
  };

  /**
   * Log an audit entry
   */
  async logAuditEntry(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<void> {
    try {
      const auditEntry: AuditLogEntry = {
        id: CryptoUtils.generateUUID(),
        timestamp: new Date(),
        ...entry
      };

      // Add to in-memory log (in production, save to database)
      this.auditLog.push(auditEntry);

      // Maintain log size limit
      if (this.auditLog.length > this.MAX_LOG_ENTRIES) {
        this.auditLog = this.auditLog.slice(-this.MAX_LOG_ENTRIES);
      }

      // Check for security patterns that require alerts
      await this.checkForSecurityAlerts(auditEntry);

      // Log to console for immediate visibility
      const logLevel = this.getLogLevel(entry.severity);
      console[logLevel](`Audit: ${entry.action} by ${entry.userId} - ${entry.success ? 'SUCCESS' : 'FAILED'}`);

    } catch (error) {
      console.error('Error logging audit entry:', error);
    }
  }

  /**
   * Log authentication attempt
   */
  async logAuthenticationAttempt(
    userId: string,
    method: AuthenticationMethod,
    success: boolean,
    ipAddress: string,
    userAgent: string,
    details?: any
  ): Promise<void> {
    await this.logAuditEntry({
      userId,
      action: success ? AuditAction.LOGIN_SUCCESS : AuditAction.LOGIN_FAILURE,
      resource: 'authentication',
      method,
      ipAddress,
      userAgent,
      success,
      severity: success ? AuditSeverity.INFO : AuditSeverity.WARNING,
      details
    });
  }

  /**
   * Log user action
   */
  async logUserAction(
    userId: string,
    userRole: UserRole,
    action: AuditAction,
    resource: string,
    resourceId: string,
    success: boolean,
    ipAddress: string,
    userAgent: string,
    sessionId?: string,
    details?: any
  ): Promise<void> {
    await this.logAuditEntry({
      userId,
      userRole,
      action,
      resource,
      resourceId,
      ipAddress,
      userAgent,
      success,
      severity: success ? AuditSeverity.INFO : AuditSeverity.ERROR,
      sessionId,
      details
    });
  }

  /**
   * Log security event
   */
  async logSecurityEvent(
    userId: string,
    action: AuditAction,
    ipAddress: string,
    userAgent: string,
    severity: AuditSeverity,
    details: any
  ): Promise<void> {
    await this.logAuditEntry({
      userId,
      action,
      resource: 'security',
      ipAddress,
      userAgent,
      success: false,
      severity,
      details
    });
  }

  /**
   * Query audit log
   */
  async queryAuditLog(query: AuditQuery): Promise<{
    entries: AuditLogEntry[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      let filteredEntries = this.auditLog;

      // Apply filters
      if (query.userId) {
        filteredEntries = filteredEntries.filter(entry => entry.userId === query.userId);
      }

      if (query.userRole) {
        filteredEntries = filteredEntries.filter(entry => entry.userRole === query.userRole);
      }

      if (query.action) {
        filteredEntries = filteredEntries.filter(entry => entry.action === query.action);
      }

      if (query.resource) {
        filteredEntries = filteredEntries.filter(entry => entry.resource === query.resource);
      }

      if (query.severity) {
        filteredEntries = filteredEntries.filter(entry => entry.severity === query.severity);
      }

      if (query.ipAddress) {
        filteredEntries = filteredEntries.filter(entry => entry.ipAddress === query.ipAddress);
      }

      if (query.success !== undefined) {
        filteredEntries = filteredEntries.filter(entry => entry.success === query.success);
      }

      if (query.startDate) {
        filteredEntries = filteredEntries.filter(entry => entry.timestamp >= query.startDate!);
      }

      if (query.endDate) {
        filteredEntries = filteredEntries.filter(entry => entry.timestamp <= query.endDate!);
      }

      // Sort by timestamp (newest first)
      filteredEntries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      const total = filteredEntries.length;
      const limit = query.limit || 50;
      const offset = query.offset || 0;

      const entries = filteredEntries.slice(offset, offset + limit);
      const hasMore = offset + limit < total;

      return { entries, total, hasMore };

    } catch (error) {
      console.error('Error querying audit log:', error);
      return { entries: [], total: 0, hasMore: false };
    }
  }

  /**
   * Generate audit summary
   */
  async generateAuditSummary(startDate?: Date, endDate?: Date): Promise<AuditSummary> {
    try {
      const now = new Date();
      const start = startDate || new Date(now.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours
      const end = endDate || now;

      const relevantEntries = this.auditLog.filter(
        entry => entry.timestamp >= start && entry.timestamp <= end
      );

      const totalEntries = relevantEntries.length;
      const successfulActions = relevantEntries.filter(entry => entry.success).length;
      const failedActions = totalEntries - successfulActions;
      const securityEvents = relevantEntries.filter(
        entry => entry.resource === 'security' || entry.severity === AuditSeverity.CRITICAL
      ).length;

      // Top actions
      const actionCounts = new Map<AuditAction, number>();
      relevantEntries.forEach(entry => {
        actionCounts.set(entry.action, (actionCounts.get(entry.action) || 0) + 1);
      });

      const topActions = Array.from(actionCounts.entries())
        .map(([action, count]) => ({ action, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Top users
      const userCounts = new Map<string, number>();
      relevantEntries.forEach(entry => {
        userCounts.set(entry.userId, (userCounts.get(entry.userId) || 0) + 1);
      });

      const topUsers = Array.from(userCounts.entries())
        .map(([userId, count]) => ({ userId, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        totalEntries,
        successfulActions,
        failedActions,
        securityEvents,
        topActions,
        topUsers,
        timeRange: { start, end }
      };

    } catch (error) {
      console.error('Error generating audit summary:', error);
      throw error;
    }
  }

  /**
   * Check for security alert patterns
   */
  private async checkForSecurityAlerts(entry: AuditLogEntry): Promise<void> {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      // Check for multiple failed logins
      if (entry.action === AuditAction.LOGIN_FAILURE) {
        const recentFailures = this.auditLog.filter(
          log => log.userId === entry.userId &&
                 log.action === AuditAction.LOGIN_FAILURE &&
                 log.timestamp > oneHourAgo
        );

        if (recentFailures.length >= this.ALERT_THRESHOLDS.failedLoginsPerHour) {
          await this.createSecurityAlert({
            type: SecurityAlertType.MULTIPLE_FAILED_LOGINS,
            severity: AuditSeverity.WARNING,
            userId: entry.userId,
            ipAddress: entry.ipAddress,
            description: `${recentFailures.length} failed login attempts in the last hour`,
            relatedAuditEntries: recentFailures.map(f => f.id)
          });
        }
      }

      // Check for suspicious IP activity
      const recentIPActivity = this.auditLog.filter(
        log => log.ipAddress === entry.ipAddress && log.timestamp > oneHourAgo
      );

      if (recentIPActivity.length >= this.ALERT_THRESHOLDS.suspiciousIPRequests) {
        await this.createSecurityAlert({
          type: SecurityAlertType.SUSPICIOUS_IP_ACTIVITY,
          severity: AuditSeverity.WARNING,
          ipAddress: entry.ipAddress,
          description: `${recentIPActivity.length} requests from IP in the last hour`,
          relatedAuditEntries: recentIPActivity.map(a => a.id)
        });
      }

      // Check for unusual access patterns
      if (entry.action === AuditAction.DATA_ACCESSED) {
        const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
        const recentDataAccess = this.auditLog.filter(
          log => log.userId === entry.userId &&
                 log.action === AuditAction.DATA_ACCESSED &&
                 log.timestamp > oneMinuteAgo
        );

        if (recentDataAccess.length >= this.ALERT_THRESHOLDS.dataAccessPerMinute) {
          await this.createSecurityAlert({
            type: SecurityAlertType.UNUSUAL_ACCESS_PATTERN,
            severity: AuditSeverity.WARNING,
            userId: entry.userId,
            description: `${recentDataAccess.length} data access attempts in the last minute`,
            relatedAuditEntries: recentDataAccess.map(a => a.id)
          });
        }
      }

    } catch (error) {
      console.error('Error checking for security alerts:', error);
    }
  }

  /**
   * Create security alert
   */
  private async createSecurityAlert(
    alert: Omit<SecurityAlert, 'id' | 'timestamp' | 'resolved' | 'resolvedAt' | 'resolvedBy'>
  ): Promise<void> {
    // Check if similar alert already exists and is unresolved
    const existingAlert = this.securityAlerts.find(
      existing => existing.type === alert.type &&
                  existing.userId === alert.userId &&
                  existing.ipAddress === alert.ipAddress &&
                  !existing.resolved
    );

    if (existingAlert) {
      // Update existing alert with new related entries
      existingAlert.relatedAuditEntries.push(...alert.relatedAuditEntries);
      return;
    }

    const securityAlert: SecurityAlert = {
      id: CryptoUtils.generateUUID(),
      timestamp: new Date(),
      resolved: false,
      ...alert
    };

    this.securityAlerts.push(securityAlert);

    // Log the alert creation
    console.warn(`Security Alert Created: ${alert.type} - ${alert.description}`);
  }

  /**
   * Get security alerts
   */
  async getSecurityAlerts(resolved?: boolean): Promise<SecurityAlert[]> {
    let alerts = this.securityAlerts;

    if (resolved !== undefined) {
      alerts = alerts.filter(alert => alert.resolved === resolved);
    }

    return alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Resolve security alert
   */
  async resolveSecurityAlert(alertId: string, resolvedBy: string): Promise<boolean> {
    const alert = this.securityAlerts.find(a => a.id === alertId);
    
    if (!alert) {
      return false;
    }

    alert.resolved = true;
    alert.resolvedAt = new Date();
    alert.resolvedBy = resolvedBy;

    console.log(`Security Alert Resolved: ${alert.type} by ${resolvedBy}`);
    return true;
  }

  /**
   * Export audit log
   */
  async exportAuditLog(query: AuditQuery, format: 'json' | 'csv' = 'json'): Promise<string> {
    try {
      const result = await this.queryAuditLog({ ...query, limit: undefined, offset: undefined });
      
      if (format === 'csv') {
        return this.convertToCSV(result.entries);
      }

      return JSON.stringify(result.entries, null, 2);

    } catch (error) {
      console.error('Error exporting audit log:', error);
      throw error;
    }
  }

  /**
   * Convert audit entries to CSV format
   */
  private convertToCSV(entries: AuditLogEntry[]): string {
    if (entries.length === 0) {
      return '';
    }

    const headers = [
      'ID', 'Timestamp', 'User ID', 'User Role', 'Action', 'Resource', 
      'Resource ID', 'Method', 'IP Address', 'User Agent', 'Success', 
      'Severity', 'Session ID', 'Details'
    ];

    const csvRows = [headers.join(',')];

    entries.forEach(entry => {
      const row = [
        entry.id,
        entry.timestamp.toISOString(),
        entry.userId,
        entry.userRole || '',
        entry.action,
        entry.resource,
        entry.resourceId || '',
        entry.method || '',
        entry.ipAddress,
        `"${entry.userAgent.replace(/"/g, '""')}"`,
        entry.success.toString(),
        entry.severity,
        entry.sessionId || '',
        entry.details ? `"${JSON.stringify(entry.details).replace(/"/g, '""')}"` : ''
      ];
      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  }

  /**
   * Get log level for console output
   */
  private getLogLevel(severity: AuditSeverity): 'log' | 'info' | 'warn' | 'error' {
    switch (severity) {
      case AuditSeverity.INFO:
        return 'info';
      case AuditSeverity.WARNING:
        return 'warn';
      case AuditSeverity.ERROR:
      case AuditSeverity.CRITICAL:
        return 'error';
      default:
        return 'log';
    }
  }

  /**
   * Clean up old audit entries
   */
  async cleanup(retentionDays: number = 90): Promise<{ removedCount: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const initialCount = this.auditLog.length;
    this.auditLog = this.auditLog.filter(entry => entry.timestamp > cutoffDate);
    const removedCount = initialCount - this.auditLog.length;

    console.log(`Audit cleanup: Removed ${removedCount} entries older than ${retentionDays} days`);
    return { removedCount };
  }

  /**
   * Get audit statistics
   */
  async getAuditStatistics(): Promise<{
    totalEntries: number;
    entriesLast24Hours: number;
    failureRate: number;
    topFailureReasons: { reason: string; count: number }[];
    activeAlerts: number;
  }> {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const totalEntries = this.auditLog.length;
    const entriesLast24Hours = this.auditLog.filter(entry => entry.timestamp > last24Hours).length;
    
    const failedEntries = this.auditLog.filter(entry => !entry.success);
    const failureRate = totalEntries > 0 ? (failedEntries.length / totalEntries) * 100 : 0;

    // Top failure reasons
    const failureReasons = new Map<string, number>();
    failedEntries.forEach(entry => {
      const reason = entry.details?.message || entry.action;
      failureReasons.set(reason, (failureReasons.get(reason) || 0) + 1);
    });

    const topFailureReasons = Array.from(failureReasons.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const activeAlerts = this.securityAlerts.filter(alert => !alert.resolved).length;

    return {
      totalEntries,
      entriesLast24Hours,
      failureRate,
      topFailureReasons,
      activeAlerts
    };
  }
}