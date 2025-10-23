import { AuthenticationMethod } from '../models/common.types';
import { CryptoUtils } from '../utils/crypto.utils';

export interface SecurityConfig {
  maxFailedAttempts: number;
  lockoutDurationMinutes: number;
  rateLimitWindowMinutes: number;
  maxRequestsPerWindow: number;
  sessionTimeoutMinutes: number;
  tokenExpiryMinutes: number;
}

export interface BruteForceAttempt {
  identifier: string;
  attempts: number;
  firstAttempt: Date;
  lastAttempt: Date;
  lockedUntil?: Date;
}

export interface RateLimitEntry {
  identifier: string;
  count: number;
  windowStart: Date;
}

export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  identifier: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  severity: SecuritySeverity;
  details: any;
}

export enum SecurityEventType {
  BRUTE_FORCE_DETECTED = 'brute_force_detected',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  SUSPICIOUS_LOGIN = 'suspicious_login',
  TOKEN_TAMPERING = 'token_tampering',
  SESSION_HIJACK_ATTEMPT = 'session_hijack_attempt',
  ACCOUNT_LOCKOUT = 'account_lockout',
  MULTIPLE_IP_ACCESS = 'multiple_ip_access'
}

export enum SecuritySeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export class SecurityService {
  private readonly config: SecurityConfig;
  private bruteForceMap = new Map<string, BruteForceAttempt>();
  private rateLimitMap = new Map<string, RateLimitEntry>();
  private securityEvents: SecurityEvent[] = [];
  private suspiciousIPs = new Set<string>();

  constructor(config?: Partial<SecurityConfig>) {
    this.config = {
      maxFailedAttempts: 5,
      lockoutDurationMinutes: 15,
      rateLimitWindowMinutes: 15,
      maxRequestsPerWindow: 10,
      sessionTimeoutMinutes: 1440, // 24 hours
      tokenExpiryMinutes: 60,
      ...config
    };
  }

  /**
   * Check if identifier is currently locked due to brute force attempts
   */
  isLockedOut(identifier: string): boolean {
    const attempt = this.bruteForceMap.get(identifier);
    
    if (!attempt || !attempt.lockedUntil) {
      return false;
    }

    // Check if lockout has expired
    if (new Date() > attempt.lockedUntil) {
      // Reset the attempt record
      this.bruteForceMap.delete(identifier);
      return false;
    }

    return true;
  }

  /**
   * Record a failed authentication attempt
   */
  recordFailedAttempt(identifier: string, ipAddress: string, userAgent: string): void {
    const now = new Date();
    const attempt = this.bruteForceMap.get(identifier);

    if (!attempt) {
      // First failed attempt
      this.bruteForceMap.set(identifier, {
        identifier,
        attempts: 1,
        firstAttempt: now,
        lastAttempt: now
      });
    } else {
      // Increment attempts
      attempt.attempts++;
      attempt.lastAttempt = now;

      // Check if we should lock the account
      if (attempt.attempts >= this.config.maxFailedAttempts) {
        const lockoutUntil = new Date();
        lockoutUntil.setMinutes(lockoutUntil.getMinutes() + this.config.lockoutDurationMinutes);
        attempt.lockedUntil = lockoutUntil;

        // Log security event
        this.logSecurityEvent({
          type: SecurityEventType.ACCOUNT_LOCKOUT,
          identifier,
          ipAddress,
          userAgent,
          severity: SecuritySeverity.HIGH,
          details: {
            attempts: attempt.attempts,
            lockoutDuration: this.config.lockoutDurationMinutes
          }
        });

        // Mark IP as suspicious
        this.suspiciousIPs.add(ipAddress);
      } else if (attempt.attempts >= Math.floor(this.config.maxFailedAttempts / 2)) {
        // Log brute force detection
        this.logSecurityEvent({
          type: SecurityEventType.BRUTE_FORCE_DETECTED,
          identifier,
          ipAddress,
          userAgent,
          severity: SecuritySeverity.MEDIUM,
          details: {
            attempts: attempt.attempts,
            maxAttempts: this.config.maxFailedAttempts
          }
        });
      }
    }
  }

  /**
   * Record a successful authentication (reset failed attempts)
   */
  recordSuccessfulAttempt(identifier: string): void {
    this.bruteForceMap.delete(identifier);
  }

  /**
   * Check rate limiting for requests
   */
  checkRateLimit(identifier: string, ipAddress: string, userAgent: string): boolean {
    const now = new Date();
    const rateLimitData = this.rateLimitMap.get(identifier);

    if (!rateLimitData) {
      // First request
      this.rateLimitMap.set(identifier, {
        identifier,
        count: 1,
        windowStart: now
      });
      return true;
    }

    // Check if window has expired
    const windowExpiry = new Date(rateLimitData.windowStart);
    windowExpiry.setMinutes(windowExpiry.getMinutes() + this.config.rateLimitWindowMinutes);

    if (now > windowExpiry) {
      // Window expired, reset
      this.rateLimitMap.set(identifier, {
        identifier,
        count: 1,
        windowStart: now
      });
      return true;
    }

    // Check if within limit
    if (rateLimitData.count >= this.config.maxRequestsPerWindow) {
      // Log rate limit exceeded
      this.logSecurityEvent({
        type: SecurityEventType.RATE_LIMIT_EXCEEDED,
        identifier,
        ipAddress,
        userAgent,
        severity: SecuritySeverity.MEDIUM,
        details: {
          requestCount: rateLimitData.count,
          windowStart: rateLimitData.windowStart
        }
      });
      return false;
    }

    // Increment counter
    rateLimitData.count++;
    return true;
  }

  /**
   * Generate secure token with enhanced entropy
   */
  generateSecureToken(length: number = 32, includeTimestamp: boolean = true): string {
    const randomBytes = CryptoUtils.generateSecureToken(length);
    
    if (includeTimestamp) {
      const timestamp = Date.now().toString(36);
      const combined = `${timestamp}.${randomBytes}`;
      return Buffer.from(combined).toString('base64url');
    }
    
    return randomBytes;
  }

  /**
   * Validate token format and detect tampering
   */
  validateTokenFormat(token: string, expectedLength?: number): boolean {
    try {
      // Basic format validation
      if (!token || typeof token !== 'string') {
        return false;
      }

      // Check for suspicious patterns
      if (token.includes('..') || token.includes('//') || token.includes('\\')) {
        return false;
      }

      // Check length if specified
      if (expectedLength && token.length !== expectedLength) {
        return false;
      }

      // Decode and validate if it's base64url encoded
      if (token.includes('.')) {
        const decoded = Buffer.from(token, 'base64url').toString();
        const parts = decoded.split('.');
        
        if (parts.length !== 2) {
          return false;
        }

        // Validate timestamp part
        const timestamp = parseInt(parts[0], 36);
        if (isNaN(timestamp) || timestamp <= 0) {
          return false;
        }

        // Check if timestamp is reasonable (not too old or in future)
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        if (timestamp < now - maxAge || timestamp > now + 60000) { // Allow 1 minute future
          return false;
        }
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Detect session hijacking attempts
   */
  detectSessionHijacking(
    sessionId: string,
    currentIP: string,
    currentUserAgent: string,
    originalIP: string,
    originalUserAgent: string
  ): boolean {
    // Check for IP address changes
    const ipChanged = currentIP !== originalIP;
    
    // Check for significant user agent changes
    const userAgentChanged = this.isSignificantUserAgentChange(currentUserAgent, originalUserAgent);

    // If both changed, it's highly suspicious
    if (ipChanged && userAgentChanged) {
      this.logSecurityEvent({
        type: SecurityEventType.SESSION_HIJACK_ATTEMPT,
        identifier: sessionId,
        ipAddress: currentIP,
        userAgent: currentUserAgent,
        severity: SecuritySeverity.CRITICAL,
        details: {
          originalIP,
          originalUserAgent,
          currentIP,
          currentUserAgent
        }
      });
      return true;
    }

    // Check for suspicious IP
    if (ipChanged && this.suspiciousIPs.has(currentIP)) {
      this.logSecurityEvent({
        type: SecurityEventType.SUSPICIOUS_LOGIN,
        identifier: sessionId,
        ipAddress: currentIP,
        userAgent: currentUserAgent,
        severity: SecuritySeverity.HIGH,
        details: {
          reason: 'IP address from suspicious list',
          originalIP
        }
      });
      return true;
    }

    return false;
  }

  /**
   * Check if user agent change is significant
   */
  private isSignificantUserAgentChange(current: string, original: string): boolean {
    if (!current || !original) {
      return true;
    }

    // Extract browser and OS information
    const currentBrowser = this.extractBrowserInfo(current);
    const originalBrowser = this.extractBrowserInfo(original);

    // If browser family changed, it's significant
    return currentBrowser.family !== originalBrowser.family || 
           currentBrowser.os !== originalBrowser.os;
  }

  /**
   * Extract browser information from user agent
   */
  private extractBrowserInfo(userAgent: string): { family: string; os: string } {
    const ua = userAgent.toLowerCase();
    
    let family = 'unknown';
    let os = 'unknown';

    // Browser detection
    if (ua.includes('chrome')) family = 'chrome';
    else if (ua.includes('firefox')) family = 'firefox';
    else if (ua.includes('safari')) family = 'safari';
    else if (ua.includes('edge')) family = 'edge';

    // OS detection
    if (ua.includes('windows')) os = 'windows';
    else if (ua.includes('mac')) os = 'mac';
    else if (ua.includes('linux')) os = 'linux';
    else if (ua.includes('android')) os = 'android';
    else if (ua.includes('ios')) os = 'ios';

    return { family, os };
  }

  /**
   * Log security event
   */
  private logSecurityEvent(event: Omit<SecurityEvent, 'id' | 'timestamp'>): void {
    const securityEvent: SecurityEvent = {
      id: CryptoUtils.generateUUID(),
      timestamp: new Date(),
      ...event
    };

    this.securityEvents.push(securityEvent);

    // Keep only last 1000 events in memory
    if (this.securityEvents.length > 1000) {
      this.securityEvents = this.securityEvents.slice(-1000);
    }

    // Log to console (in production, send to monitoring system)
    console.warn(`Security Event [${event.severity.toUpperCase()}]: ${event.type} for ${event.identifier}`);
  }

  /**
   * Get security events for monitoring
   */
  getSecurityEvents(
    severity?: SecuritySeverity,
    type?: SecurityEventType,
    limit: number = 100
  ): SecurityEvent[] {
    let events = this.securityEvents;

    if (severity) {
      events = events.filter(event => event.severity === severity);
    }

    if (type) {
      events = events.filter(event => event.type === type);
    }

    return events
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get lockout status for identifier
   */
  getLockoutStatus(identifier: string): {
    isLocked: boolean;
    attempts: number;
    lockedUntil?: Date;
    remainingTime?: number;
  } {
    const attempt = this.bruteForceMap.get(identifier);
    
    if (!attempt) {
      return { isLocked: false, attempts: 0 };
    }

    const isLocked = this.isLockedOut(identifier);
    let remainingTime: number | undefined;

    if (isLocked && attempt.lockedUntil) {
      remainingTime = Math.max(0, attempt.lockedUntil.getTime() - Date.now());
    }

    return {
      isLocked,
      attempts: attempt.attempts,
      lockedUntil: attempt.lockedUntil,
      remainingTime
    };
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = new Date();

    // Clean up expired brute force entries
    for (const [identifier, attempt] of this.bruteForceMap.entries()) {
      if (attempt.lockedUntil && now > attempt.lockedUntil) {
        this.bruteForceMap.delete(identifier);
      }
    }

    // Clean up expired rate limit entries
    for (const [identifier, rateLimitData] of this.rateLimitMap.entries()) {
      const windowExpiry = new Date(rateLimitData.windowStart);
      windowExpiry.setMinutes(windowExpiry.getMinutes() + this.config.rateLimitWindowMinutes);
      
      if (now > windowExpiry) {
        this.rateLimitMap.delete(identifier);
      }
    }

    console.log('Security service cleanup completed');
  }

  /**
   * Reset security data for identifier (admin function)
   */
  resetSecurityData(identifier: string): void {
    this.bruteForceMap.delete(identifier);
    this.rateLimitMap.delete(identifier);
    console.log(`Security data reset for identifier: ${identifier}`);
  }

  /**
   * Check if IP is suspicious
   */
  isSuspiciousIP(ipAddress: string): boolean {
    return this.suspiciousIPs.has(ipAddress);
  }

  /**
   * Add IP to suspicious list
   */
  markIPAsSuspicious(ipAddress: string): void {
    this.suspiciousIPs.add(ipAddress);
  }

  /**
   * Remove IP from suspicious list
   */
  clearSuspiciousIP(ipAddress: string): void {
    this.suspiciousIPs.delete(ipAddress);
  }
}