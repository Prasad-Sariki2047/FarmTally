import { CommunicationLog, User, BusinessRelationship } from '../models';
import { CommunicationType, UserRole } from '../models/common.types';
import { SupplyChainRepository } from '../repositories/supply-chain.repository';
import { BusinessRelationshipService } from './business-relationship.service';
import { UserManagementService } from './user-management.service';
import { NotificationService } from './notification.service';
import { CryptoUtils } from '../utils/crypto.utils';

export interface CommunicationManager {
  // Inter-role messaging
  sendMessage(senderId: string, receiverId: string, message: string, relationshipId?: string): Promise<CommunicationLog>;
  getMessages(userId: string, relationshipId?: string): Promise<CommunicationLog[]>;
  getConversation(userId1: string, userId2: string, relationshipId?: string): Promise<CommunicationLog[]>;
  markMessageAsRead(messageId: string, userId: string): Promise<void>;
  
  // Business notifications
  sendBusinessNotification(relationshipId: string, message: string, type: CommunicationType, senderId?: string): Promise<CommunicationLog>;
  getBusinessNotifications(userId: string): Promise<CommunicationLog[]>;
  
  // System alerts and updates
  sendSystemAlert(userId: string, message: string, metadata?: any): Promise<CommunicationLog>;
  broadcastSystemAlert(userRole: UserRole, message: string, metadata?: any): Promise<CommunicationLog[]>;
  
  // Communication history and management
  getCommunicationHistory(userId: string, filters?: CommunicationFilters): Promise<CommunicationLog[]>;
  deleteCommunication(communicationId: string, userId: string): Promise<void>;
  
  // Notification preferences and delivery
  updateNotificationPreferences(userId: string, preferences: NotificationPreferences): Promise<void>;
  getNotificationPreferences(userId: string): Promise<NotificationPreferences>;
}

export interface CommunicationFilters {
  type?: CommunicationType;
  relationshipId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  read?: boolean;
}

export interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  inApp: boolean;
  businessUpdates: boolean;
  systemAlerts: boolean;
  messageNotifications: boolean;
}

export class CommunicationService implements CommunicationManager {
  private notificationPreferences: Map<string, NotificationPreferences> = new Map();

  constructor(
    private supplyChainRepository: SupplyChainRepository,
    private businessRelationshipService: BusinessRelationshipService,
    private userManagementService: UserManagementService,
    private notificationService: NotificationService
  ) {}  /**

   * Send a message between users in a business relationship
   * Requirements: 8.5, 9.5
   */
  async sendMessage(senderId: string, receiverId: string, message: string, relationshipId?: string): Promise<CommunicationLog> {
    // Validate users exist
    const sender = await this.userManagementService.getUserById(senderId);
    const receiver = await this.userManagementService.getUserById(receiverId);

    if (!sender || !receiver) {
      throw new Error('Sender or receiver not found');
    }

    // Validate business relationship if provided
    let validatedRelationshipId = relationshipId;
    if (!relationshipId) {
      // Try to find a relationship between the users
      const senderRelationships = await this.businessRelationshipService.getRelationships(senderId);
      const relationship = senderRelationships.find(rel => 
        rel.farmAdminId === receiverId || rel.serviceProviderId === receiverId
      );
      
      if (relationship) {
        validatedRelationshipId = relationship.id;
      } else {
        throw new Error('No business relationship exists between sender and receiver');
      }
    } else {
      // Validate the provided relationship
      const relationship = await this.businessRelationshipService.getRelationshipById(relationshipId);
      if (!relationship) {
        throw new Error('Business relationship not found');
      }
      
      // Verify users are part of this relationship
      if (relationship.farmAdminId !== senderId && relationship.serviceProviderId !== senderId &&
          relationship.farmAdminId !== receiverId && relationship.serviceProviderId !== receiverId) {
        throw new Error('Users are not part of the specified business relationship');
      }
    }

    // Create communication log
    const communicationLog: CommunicationLog = {
      id: CryptoUtils.generateUUID(),
      relationshipId: validatedRelationshipId!,
      senderId,
      receiverId,
      message: message.trim(),
      type: CommunicationType.MESSAGE,
      timestamp: new Date(),
      read: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const createdLog = await this.supplyChainRepository.createCommunicationLog(communicationLog);

    // Send notification to receiver
    await this.sendMessageNotification(createdLog, sender, receiver);

    return createdLog;
  }

  /**
   * Get messages for a user, optionally filtered by relationship
   * Requirements: 9.5
   */
  async getMessages(userId: string, relationshipId?: string): Promise<CommunicationLog[]> {
    const user = await this.userManagementService.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    let messages: CommunicationLog[];

    if (relationshipId) {
      // Get messages for specific relationship
      messages = await this.supplyChainRepository.findCommunicationLogsByRelationship(relationshipId);
      // Filter to only messages where user is sender or receiver
      messages = messages.filter(msg => msg.senderId === userId || msg.receiverId === userId);
    } else {
      // Get all messages for user across all relationships
      const relationships = await this.businessRelationshipService.getRelationships(userId);
      const relationshipIds = relationships.map(rel => rel.id);
      messages = await this.supplyChainRepository.findCommunicationLogsByUserRole(userId, user.role, relationshipIds);
      // Filter to only messages
      messages = messages.filter(msg => msg.type === CommunicationType.MESSAGE);
    }

    // Sort by timestamp (most recent first)
    return messages.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get conversation between two users
   * Requirements: 9.5
   */
  async getConversation(userId1: string, userId2: string, relationshipId?: string): Promise<CommunicationLog[]> {
    let messages: CommunicationLog[];

    if (relationshipId) {
      messages = await this.supplyChainRepository.findCommunicationLogsByRelationship(relationshipId);
    } else {
      // Find relationship between users
      const user1Relationships = await this.businessRelationshipService.getRelationships(userId1);
      const relationship = user1Relationships.find(rel => 
        rel.farmAdminId === userId2 || rel.serviceProviderId === userId2
      );
      
      if (!relationship) {
        return []; // No relationship, no conversation
      }
      
      messages = await this.supplyChainRepository.findCommunicationLogsByRelationship(relationship.id);
    }

    // Filter to conversation between the two users
    const conversation = messages.filter(msg => 
      (msg.senderId === userId1 && msg.receiverId === userId2) ||
      (msg.senderId === userId2 && msg.receiverId === userId1)
    );

    // Sort by timestamp (oldest first for conversation view)
    return conversation.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Mark a message as read
   * Requirements: 9.5
   */
  async markMessageAsRead(messageId: string, userId: string): Promise<void> {
    const message = await this.supplyChainRepository.findCommunicationLogById(messageId);
    
    if (!message) {
      throw new Error('Message not found');
    }

    // Only the receiver can mark message as read
    if (message.receiverId !== userId) {
      throw new Error('Only the message receiver can mark it as read');
    }

    await this.supplyChainRepository.updateCommunicationLog(messageId, {
      read: true,
      updatedAt: new Date()
    });
  } 
 /**
   * Send business notification to all parties in a relationship
   * Requirements: 8.5, 9.5
   */
  async sendBusinessNotification(relationshipId: string, message: string, type: CommunicationType, senderId?: string): Promise<CommunicationLog> {
    const relationship = await this.businessRelationshipService.getRelationshipById(relationshipId);
    if (!relationship) {
      throw new Error('Business relationship not found');
    }

    // Determine sender and receiver
    let actualSenderId = senderId || 'system';
    let receiverId: string;

    if (senderId) {
      // If sender is specified, send to the other party in the relationship
      if (relationship.farmAdminId === senderId) {
        receiverId = relationship.serviceProviderId;
      } else if (relationship.serviceProviderId === senderId) {
        receiverId = relationship.farmAdminId;
      } else {
        throw new Error('Sender is not part of the business relationship');
      }
    } else {
      // System notification - send to both parties (we'll create two logs)
      receiverId = relationship.farmAdminId; // Start with farm admin
    }

    const communicationLog: CommunicationLog = {
      id: CryptoUtils.generateUUID(),
      relationshipId,
      senderId: actualSenderId,
      receiverId,
      message: message.trim(),
      type,
      timestamp: new Date(),
      read: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const createdLog = await this.supplyChainRepository.createCommunicationLog(communicationLog);

    // Send notification
    const receiver = await this.userManagementService.getUserById(receiverId);
    if (receiver) {
      await this.sendBusinessUpdateNotification(createdLog, receiver);
    }

    // If system notification, also send to service provider
    if (!senderId && relationship.serviceProviderId !== receiverId) {
      const serviceProviderLog: CommunicationLog = {
        ...communicationLog,
        id: CryptoUtils.generateUUID(),
        receiverId: relationship.serviceProviderId
      };
      
      await this.supplyChainRepository.createCommunicationLog(serviceProviderLog);
      
      const serviceProvider = await this.userManagementService.getUserById(relationship.serviceProviderId);
      if (serviceProvider) {
        await this.sendBusinessUpdateNotification(serviceProviderLog, serviceProvider);
      }
    }

    return createdLog;
  }

  /**
   * Get business notifications for a user
   * Requirements: 9.5
   */
  async getBusinessNotifications(userId: string): Promise<CommunicationLog[]> {
    const user = await this.userManagementService.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const relationships = await this.businessRelationshipService.getRelationships(userId);
    const relationshipIds = relationships.map(rel => rel.id);
    
    const notifications = await this.supplyChainRepository.findCommunicationLogsByUserRole(userId, user.role, relationshipIds);
    
    // Filter to business notifications only
    return notifications.filter(notif => 
      notif.type === CommunicationType.BUSINESS_UPDATE && 
      notif.receiverId === userId
    ).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Send system alert to a specific user
   * Requirements: 8.5
   */
  async sendSystemAlert(userId: string, message: string, metadata?: any): Promise<CommunicationLog> {
    const user = await this.userManagementService.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const communicationLog: CommunicationLog = {
      id: CryptoUtils.generateUUID(),
      relationshipId: 'system', // Special relationship ID for system messages
      senderId: 'system',
      receiverId: userId,
      message: message.trim(),
      type: CommunicationType.SYSTEM_ALERT,
      timestamp: new Date(),
      read: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const createdLog = await this.supplyChainRepository.createCommunicationLog(communicationLog);

    // Send notification
    await this.sendSystemAlertNotification(createdLog, user);

    return createdLog;
  }

  /**
   * Broadcast system alert to all users of a specific role
   * Requirements: 8.5
   */
  async broadcastSystemAlert(userRole: UserRole, message: string, metadata?: any): Promise<CommunicationLog[]> {
    // This would typically get users from a repository method
    // For now, we'll create a placeholder implementation
    const createdLogs: CommunicationLog[] = [];

    // In a real implementation, we'd get all users of the specified role
    // and send individual alerts to each
    
    return createdLogs;
  }

  /**
   * Get communication history with optional filters
   * Requirements: 9.5
   */
  async getCommunicationHistory(userId: string, filters?: CommunicationFilters): Promise<CommunicationLog[]> {
    const user = await this.userManagementService.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const relationships = await this.businessRelationshipService.getRelationships(userId);
    const relationshipIds = relationships.map(rel => rel.id);
    
    let communications = await this.supplyChainRepository.findCommunicationLogsByUserRole(userId, user.role, relationshipIds);

    // Apply filters
    if (filters) {
      if (filters.type) {
        communications = communications.filter(comm => comm.type === filters.type);
      }
      if (filters.relationshipId) {
        communications = communications.filter(comm => comm.relationshipId === filters.relationshipId);
      }
      if (filters.dateFrom) {
        communications = communications.filter(comm => comm.timestamp >= filters.dateFrom!);
      }
      if (filters.dateTo) {
        communications = communications.filter(comm => comm.timestamp <= filters.dateTo!);
      }
      if (filters.read !== undefined) {
        communications = communications.filter(comm => comm.read === filters.read);
      }
    }

    // Sort by timestamp (most recent first)
    return communications.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Delete a communication log
   * Requirements: 9.5
   */
  async deleteCommunication(communicationId: string, userId: string): Promise<void> {
    const communication = await this.supplyChainRepository.findCommunicationLogById(communicationId);
    
    if (!communication) {
      throw new Error('Communication not found');
    }

    // Only sender or receiver can delete the communication
    if (communication.senderId !== userId && communication.receiverId !== userId) {
      throw new Error('Unauthorized to delete this communication');
    }

    await this.supplyChainRepository.deleteCommunicationLog(communicationId);
  } 
 /**
   * Update notification preferences for a user
   */
  async updateNotificationPreferences(userId: string, preferences: NotificationPreferences): Promise<void> {
    const user = await this.userManagementService.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    this.notificationPreferences.set(userId, preferences);
  }

  /**
   * Get notification preferences for a user
   */
  async getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
    const user = await this.userManagementService.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    return this.notificationPreferences.get(userId) || {
      email: true,
      sms: false,
      inApp: true,
      businessUpdates: true,
      systemAlerts: true,
      messageNotifications: true
    };
  }

  // Private helper methods

  private async sendMessageNotification(message: CommunicationLog, sender: User, receiver: User): Promise<void> {
    const preferences = await this.getNotificationPreferences(receiver.id);
    
    if (!preferences.messageNotifications) {
      return; // User has disabled message notifications
    }

    const subject = `New Message from ${sender.fullName} - FarmTally`;
    const body = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>New Message</h2>
        <p>Hello ${receiver.fullName},</p>
        <p>You have received a new message from ${sender.fullName}:</p>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #007bff;">
          <p style="margin: 0; font-style: italic;">"${message.message}"</p>
        </div>
        <p><strong>Sent:</strong> ${message.timestamp.toLocaleString()}</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/dashboard/messages/${message.relationshipId}" 
             style="background-color: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            View Conversation
          </a>
        </div>
        <hr>
        <p style="color: #666; font-size: 12px;">
          FarmTally - Agricultural Supply Chain Management Platform
        </p>
      </div>
    `;

    if (preferences.email) {
      await this.notificationService.sendEmail(receiver.email, subject, body, true);
    }
  }

  private async sendBusinessUpdateNotification(notification: CommunicationLog, receiver: User): Promise<void> {
    const preferences = await this.getNotificationPreferences(receiver.id);
    
    if (!preferences.businessUpdates) {
      return; // User has disabled business update notifications
    }

    const subject = `Business Update - FarmTally`;
    const body = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Business Update</h2>
        <p>Hello ${receiver.fullName},</p>
        <p>You have received a business update:</p>
        <div style="background-color: #fff3cd; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
          <p style="margin: 0;">${notification.message}</p>
        </div>
        <p><strong>Type:</strong> ${notification.type}</p>
        <p><strong>Time:</strong> ${notification.timestamp.toLocaleString()}</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/dashboard/notifications" 
             style="background-color: #ffc107; color: black; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            View All Notifications
          </a>
        </div>
        <hr>
        <p style="color: #666; font-size: 12px;">
          FarmTally - Agricultural Supply Chain Management Platform
        </p>
      </div>
    `;

    if (preferences.email) {
      await this.notificationService.sendEmail(receiver.email, subject, body, true);
    }
  }

  private async sendSystemAlertNotification(alert: CommunicationLog, receiver: User): Promise<void> {
    const preferences = await this.getNotificationPreferences(receiver.id);
    
    if (!preferences.systemAlerts) {
      return; // User has disabled system alert notifications
    }

    const subject = `System Alert - FarmTally`;
    const body = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>System Alert</h2>
        <p>Hello ${receiver.fullName},</p>
        <p>You have received a system alert:</p>
        <div style="background-color: #f8d7da; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #dc3545;">
          <p style="margin: 0; font-weight: bold;">${alert.message}</p>
        </div>
        <p><strong>Time:</strong> ${alert.timestamp.toLocaleString()}</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/dashboard" 
             style="background-color: #dc3545; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Go to Dashboard
          </a>
        </div>
        <hr>
        <p style="color: #666; font-size: 12px;">
          FarmTally - Agricultural Supply Chain Management Platform
        </p>
      </div>
    `;

    if (preferences.email) {
      await this.notificationService.sendEmail(receiver.email, subject, body, true);
    }
  }
}