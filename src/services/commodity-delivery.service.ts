import { CommodityDelivery, PaymentInfo, User } from '../models';
import { DeliveryStatus, PaymentStatus, UserRole } from '../models/common.types';
import { SupplyChainRepository } from '../repositories/supply-chain.repository';
import { BusinessRelationshipService } from './business-relationship.service';
import { UserManagementService } from './user-management.service';
import { NotificationService } from './notification.service';
import { CryptoUtils } from '../utils/crypto.utils';

export interface CommodityDeliveryManager {
  // Delivery scheduling and management
  scheduleDelivery(farmerId: string, farmAdminId: string, deliveryData: Partial<CommodityDelivery>): Promise<CommodityDelivery>;
  updateDeliveryStatus(deliveryId: string, status: DeliveryStatus, userId: string): Promise<CommodityDelivery>;
  getDeliveriesByFarmer(farmerId: string): Promise<CommodityDelivery[]>;
  getDeliveriesByFarmAdmin(farmAdminId: string): Promise<CommodityDelivery[]>;
  getDeliveryById(deliveryId: string): Promise<CommodityDelivery | null>;
  
  // Commodity availability management
  updateCommodityAvailability(farmerId: string, commodityType: string, quantity: number): Promise<void>;
  getCommodityAvailability(farmerId: string): Promise<{ commodityType: string; quantity: number }[]>;
  
  // Delivery tracking and coordination
  trackDelivery(deliveryId: string): Promise<CommodityDelivery>;
  getUpcomingDeliveries(userId: string, userRole: UserRole): Promise<CommodityDelivery[]>;
  getDeliveryHistory(userId: string, userRole: UserRole): Promise<CommodityDelivery[]>;
  
  // Payment and contract management
  updatePaymentInfo(deliveryId: string, paymentInfo: PaymentInfo, userId: string): Promise<CommodityDelivery>;
  getOverduePayments(farmAdminId: string): Promise<CommodityDelivery[]>;
  
  // Notification and communication
  sendDeliveryNotification(deliveryId: string, message: string, recipientRole: UserRole): Promise<void>;
  getDeliveryNotifications(userId: string): Promise<any[]>;
}

export class CommodityDeliveryService implements CommodityDeliveryManager {
  private commodityAvailability: Map<string, Map<string, number>> = new Map(); // farmerId -> commodityType -> quantity

  constructor(
    private supplyChainRepository: SupplyChainRepository,
    private businessRelationshipService: BusinessRelationshipService,
    private userManagementService: UserManagementService,
    private notificationService: NotificationService
  ) {}

  /**
   * Schedule a commodity delivery between farmer and farm admin
   * Requirements: 9.2, 9.3
   */
  async scheduleDelivery(farmerId: string, farmAdminId: string, deliveryData: Partial<CommodityDelivery>): Promise<CommodityDelivery> {
    // Validate users exist and have correct roles
    const farmer = await this.userManagementService.getUserById(farmerId);
    const farmAdmin = await this.userManagementService.getUserById(farmAdminId);

    if (!farmer || farmer.role !== UserRole.FARMER) {
      throw new Error('Invalid farmer');
    }

    if (!farmAdmin || farmAdmin.role !== UserRole.FARM_ADMIN) {
      throw new Error('Invalid farm admin');
    }

    // Verify business relationship exists
    const relationships = await this.businessRelationshipService.getRelationships(farmAdminId);
    const farmerRelationship = relationships.find(rel => rel.serviceProviderId === farmerId);
    
    if (!farmerRelationship) {
      throw new Error('No business relationship exists between farmer and farm admin');
    }

    // Validate required delivery data
    if (!deliveryData.commodityType || !deliveryData.quantity || !deliveryData.scheduledDate) {
      throw new Error('Commodity type, quantity, and scheduled date are required');
    }

    // Check commodity availability
    const availability = this.getCommodityAvailabilityForFarmer(farmerId);
    const availableQuantity = availability.get(deliveryData.commodityType) || 0;
    
    if (availableQuantity < deliveryData.quantity!) {
      throw new Error(`Insufficient commodity availability. Available: ${availableQuantity}, Requested: ${deliveryData.quantity}`);
    }

    // Create delivery record
    const delivery: CommodityDelivery = {
      id: CryptoUtils.generateUUID(),
      farmerId,
      farmAdminId,
      commodityType: deliveryData.commodityType,
      quantity: deliveryData.quantity,
      scheduledDate: deliveryData.scheduledDate,
      status: DeliveryStatus.SCHEDULED,
      paymentInfo: deliveryData.paymentInfo,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const createdDelivery = await this.supplyChainRepository.createCommodityDelivery(delivery);

    // Update commodity availability
    this.updateCommodityAvailabilityInternal(farmerId, deliveryData.commodityType, -deliveryData.quantity);

    // Send notifications
    await this.sendDeliveryScheduledNotifications(createdDelivery, farmer, farmAdmin);

    return createdDelivery;
  }

  /**
   * Update delivery status with proper authorization
   * Requirements: 9.2, 9.3
   */
  async updateDeliveryStatus(deliveryId: string, status: DeliveryStatus, userId: string): Promise<CommodityDelivery> {
    const delivery = await this.supplyChainRepository.findCommodityDeliveryById(deliveryId);
    
    if (!delivery) {
      throw new Error('Delivery not found');
    }

    const user = await this.userManagementService.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Validate user has permission to update this delivery
    if (delivery.farmerId !== userId && delivery.farmAdminId !== userId) {
      throw new Error('Unauthorized to update this delivery');
    }

    // Validate status transition
    this.validateStatusTransition(delivery.status, status);

    const updatedDelivery = await this.supplyChainRepository.updateCommodityDelivery(deliveryId, {
      status,
      actualDate: status === DeliveryStatus.DELIVERED ? new Date() : delivery.actualDate,
      updatedAt: new Date()
    });

    // Send status update notifications
    await this.sendDeliveryStatusUpdateNotifications(updatedDelivery, user);

    // Handle commodity availability adjustments if delivery is cancelled
    if (status === DeliveryStatus.CANCELLED && delivery.status !== DeliveryStatus.CANCELLED) {
      this.updateCommodityAvailabilityInternal(delivery.farmerId, delivery.commodityType, delivery.quantity);
    }

    return updatedDelivery;
  }

  /**
   * Get deliveries for a specific farmer
   * Requirements: 9.2
   */
  async getDeliveriesByFarmer(farmerId: string): Promise<CommodityDelivery[]> {
    const farmer = await this.userManagementService.getUserById(farmerId);
    if (!farmer || farmer.role !== UserRole.FARMER) {
      throw new Error('Invalid farmer');
    }

    return await this.supplyChainRepository.findCommodityDeliveriesByFarmer(farmerId);
  }

  /**
   * Get deliveries for a specific farm admin
   * Requirements: 9.2
   */
  async getDeliveriesByFarmAdmin(farmAdminId: string): Promise<CommodityDelivery[]> {
    const farmAdmin = await this.userManagementService.getUserById(farmAdminId);
    if (!farmAdmin || farmAdmin.role !== UserRole.FARM_ADMIN) {
      throw new Error('Invalid farm admin');
    }

    return await this.supplyChainRepository.findCommodityDeliveriesByFarmAdmin(farmAdminId);
  }

  /**
   * Get delivery by ID with authorization check
   */
  async getDeliveryById(deliveryId: string): Promise<CommodityDelivery | null> {
    return await this.supplyChainRepository.findCommodityDeliveryById(deliveryId);
  }

  /**
   * Update commodity availability for a farmer
   * Requirements: 9.2
   */
  async updateCommodityAvailability(farmerId: string, commodityType: string, quantity: number): Promise<void> {
    const farmer = await this.userManagementService.getUserById(farmerId);
    if (!farmer || farmer.role !== UserRole.FARMER) {
      throw new Error('Invalid farmer');
    }

    if (quantity < 0) {
      throw new Error('Quantity cannot be negative');
    }

    this.updateCommodityAvailabilityInternal(farmerId, commodityType, quantity, true);
  }

  /**
   * Get commodity availability for a farmer
   * Requirements: 9.2
   */
  async getCommodityAvailability(farmerId: string): Promise<{ commodityType: string; quantity: number }[]> {
    const farmer = await this.userManagementService.getUserById(farmerId);
    if (!farmer || farmer.role !== UserRole.FARMER) {
      throw new Error('Invalid farmer');
    }

    const availability = this.getCommodityAvailabilityForFarmer(farmerId);
    return Array.from(availability.entries()).map(([commodityType, quantity]) => ({
      commodityType,
      quantity
    }));
  }

  /**
   * Track delivery status and details
   * Requirements: 9.3
   */
  async trackDelivery(deliveryId: string): Promise<CommodityDelivery> {
    const delivery = await this.supplyChainRepository.findCommodityDeliveryById(deliveryId);
    
    if (!delivery) {
      throw new Error('Delivery not found');
    }

    return delivery;
  }

  /**
   * Get upcoming deliveries for a user based on their role
   * Requirements: 9.2, 9.3
   */
  async getUpcomingDeliveries(userId: string, userRole: UserRole): Promise<CommodityDelivery[]> {
    let deliveries: CommodityDelivery[] = [];
    const currentDate = new Date();

    switch (userRole) {
      case UserRole.FARMER:
        deliveries = await this.supplyChainRepository.findCommodityDeliveriesByFarmer(userId);
        break;
      case UserRole.FARM_ADMIN:
        deliveries = await this.supplyChainRepository.findCommodityDeliveriesByFarmAdmin(userId);
        break;
      case UserRole.APP_ADMIN:
        // App admin can see all deliveries - use role-based repository method
        deliveries = await this.supplyChainRepository.findCommodityDeliveriesByUserRole(userId, userRole);
        break;
      default:
        throw new Error('User role not authorized to view deliveries');
    }

    // Filter for upcoming deliveries (scheduled or in transit)
    return deliveries.filter(delivery => 
      (delivery.status === DeliveryStatus.SCHEDULED || delivery.status === DeliveryStatus.IN_TRANSIT) &&
      delivery.scheduledDate >= currentDate
    ).sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime());
  }

  /**
   * Get delivery history for a user based on their role
   * Requirements: 9.2, 9.3
   */
  async getDeliveryHistory(userId: string, userRole: UserRole): Promise<CommodityDelivery[]> {
    let deliveries: CommodityDelivery[] = [];

    switch (userRole) {
      case UserRole.FARMER:
        deliveries = await this.supplyChainRepository.findCommodityDeliveriesByFarmer(userId);
        break;
      case UserRole.FARM_ADMIN:
        deliveries = await this.supplyChainRepository.findCommodityDeliveriesByFarmAdmin(userId);
        break;
      case UserRole.APP_ADMIN:
        // App admin can see all deliveries - use role-based repository method
        deliveries = await this.supplyChainRepository.findCommodityDeliveriesByUserRole(userId, userRole);
        break;
      default:
        throw new Error('User role not authorized to view delivery history');
    }

    // Sort by delivery date (most recent first)
    return deliveries.sort((a, b) => {
      const dateA = a.actualDate || a.scheduledDate;
      const dateB = b.actualDate || b.scheduledDate;
      return dateB.getTime() - dateA.getTime();
    });
  }

  /**
   * Update payment information for a delivery
   * Requirements: 9.4
   */
  async updatePaymentInfo(deliveryId: string, paymentInfo: PaymentInfo, userId: string): Promise<CommodityDelivery> {
    const delivery = await this.supplyChainRepository.findCommodityDeliveryById(deliveryId);
    
    if (!delivery) {
      throw new Error('Delivery not found');
    }

    const user = await this.userManagementService.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Only farm admin can update payment info
    if (delivery.farmAdminId !== userId) {
      throw new Error('Only the farm admin can update payment information');
    }

    return await this.supplyChainRepository.updateCommodityDelivery(deliveryId, {
      paymentInfo,
      updatedAt: new Date()
    });
  }

  /**
   * Get overdue payments for a farm admin
   * Requirements: 9.4
   */
  async getOverduePayments(farmAdminId: string): Promise<CommodityDelivery[]> {
    const farmAdmin = await this.userManagementService.getUserById(farmAdminId);
    if (!farmAdmin || farmAdmin.role !== UserRole.FARM_ADMIN) {
      throw new Error('Invalid farm admin');
    }

    const deliveries = await this.supplyChainRepository.findCommodityDeliveriesByFarmAdmin(farmAdminId);
    const currentDate = new Date();

    return deliveries.filter(delivery => 
      delivery.paymentInfo &&
      delivery.paymentInfo.status === PaymentStatus.PENDING &&
      delivery.paymentInfo.dueDate < currentDate
    );
  }

  /**
   * Send delivery notification to relevant parties
   * Requirements: 9.3
   */
  async sendDeliveryNotification(deliveryId: string, message: string, recipientRole: UserRole): Promise<void> {
    const delivery = await this.supplyChainRepository.findCommodityDeliveryById(deliveryId);
    
    if (!delivery) {
      throw new Error('Delivery not found');
    }

    let recipientId: string;
    switch (recipientRole) {
      case UserRole.FARMER:
        recipientId = delivery.farmerId;
        break;
      case UserRole.FARM_ADMIN:
        recipientId = delivery.farmAdminId;
        break;
      default:
        throw new Error('Invalid recipient role for delivery notification');
    }

    const recipient = await this.userManagementService.getUserById(recipientId);
    if (!recipient) {
      throw new Error('Recipient not found');
    }

    const subject = `Delivery Notification - ${delivery.commodityType}`;
    const body = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Delivery Notification</h2>
        <p>Hello ${recipient.fullName},</p>
        <p>${message}</p>
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Delivery ID:</strong> ${delivery.id}</p>
          <p><strong>Commodity:</strong> ${delivery.commodityType}</p>
          <p><strong>Quantity:</strong> ${delivery.quantity}</p>
          <p><strong>Scheduled Date:</strong> ${delivery.scheduledDate.toLocaleDateString()}</p>
          <p><strong>Status:</strong> ${delivery.status}</p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/dashboard/deliveries/${delivery.id}" 
             style="background-color: #4CAF50; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            View Delivery Details
          </a>
        </div>
        <hr>
        <p style="color: #666; font-size: 12px;">
          FarmTally - Agricultural Supply Chain Management Platform
        </p>
      </div>
    `;

    await this.notificationService.sendEmail(recipient.email, subject, body, true);
  }

  /**
   * Get delivery notifications for a user
   * Requirements: 9.3
   */
  async getDeliveryNotifications(userId: string): Promise<any[]> {
    // This would typically fetch from a notifications table
    // For now, return empty array as placeholder
    return [];
  }

  // Private helper methods

  private getCommodityAvailabilityForFarmer(farmerId: string): Map<string, number> {
    if (!this.commodityAvailability.has(farmerId)) {
      this.commodityAvailability.set(farmerId, new Map());
    }
    return this.commodityAvailability.get(farmerId)!;
  }

  private updateCommodityAvailabilityInternal(farmerId: string, commodityType: string, quantityChange: number, isAbsolute: boolean = false): void {
    const availability = this.getCommodityAvailabilityForFarmer(farmerId);
    
    if (isAbsolute) {
      availability.set(commodityType, quantityChange);
    } else {
      const currentQuantity = availability.get(commodityType) || 0;
      const newQuantity = Math.max(0, currentQuantity + quantityChange);
      availability.set(commodityType, newQuantity);
    }
  }

  private validateStatusTransition(currentStatus: DeliveryStatus, newStatus: DeliveryStatus): void {
    const validTransitions: Record<DeliveryStatus, DeliveryStatus[]> = {
      [DeliveryStatus.SCHEDULED]: [DeliveryStatus.IN_TRANSIT, DeliveryStatus.CANCELLED],
      [DeliveryStatus.IN_TRANSIT]: [DeliveryStatus.DELIVERED, DeliveryStatus.CANCELLED],
      [DeliveryStatus.DELIVERED]: [], // Final state
      [DeliveryStatus.CANCELLED]: [] // Final state
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus}`);
    }
  }

  private async sendDeliveryScheduledNotifications(delivery: CommodityDelivery, farmer: User, farmAdmin: User): Promise<void> {
    // Notify farmer
    await this.notificationService.sendEmail(
      farmer.email,
      'Delivery Scheduled - FarmTally',
      this.generateDeliveryScheduledEmail(delivery, farmer.fullName, 'farmer'),
      true
    );

    // Notify farm admin
    await this.notificationService.sendEmail(
      farmAdmin.email,
      'Delivery Scheduled - FarmTally',
      this.generateDeliveryScheduledEmail(delivery, farmAdmin.fullName, 'farm_admin'),
      true
    );
  }

  private async sendDeliveryStatusUpdateNotifications(delivery: CommodityDelivery, updatedBy: User): Promise<void> {
    const farmer = await this.userManagementService.getUserById(delivery.farmerId);
    const farmAdmin = await this.userManagementService.getUserById(delivery.farmAdminId);

    if (!farmer || !farmAdmin) {
      return;
    }

    // Notify the other party (not the one who made the update)
    const recipientUser = updatedBy.id === farmer.id ? farmAdmin : farmer;
    const recipientRole = updatedBy.id === farmer.id ? 'farm_admin' : 'farmer';

    await this.notificationService.sendEmail(
      recipientUser.email,
      'Delivery Status Updated - FarmTally',
      this.generateDeliveryStatusUpdateEmail(delivery, recipientUser.fullName, recipientRole, updatedBy.fullName),
      true
    );
  }

  private generateDeliveryScheduledEmail(delivery: CommodityDelivery, recipientName: string, recipientRole: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Delivery Scheduled</h2>
        <p>Hello ${recipientName},</p>
        <p>A new commodity delivery has been scheduled:</p>
        <div style="background-color: #e8f5e8; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Delivery ID:</strong> ${delivery.id}</p>
          <p><strong>Commodity:</strong> ${delivery.commodityType}</p>
          <p><strong>Quantity:</strong> ${delivery.quantity}</p>
          <p><strong>Scheduled Date:</strong> ${delivery.scheduledDate.toLocaleDateString()}</p>
          <p><strong>Status:</strong> ${delivery.status}</p>
        </div>
        <p>${recipientRole === 'farmer' ? 'Please prepare the commodity for delivery on the scheduled date.' : 'Please prepare to receive the commodity on the scheduled date.'}</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/dashboard/deliveries/${delivery.id}" 
             style="background-color: #4CAF50; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            View Delivery Details
          </a>
        </div>
        <hr>
        <p style="color: #666; font-size: 12px;">
          FarmTally - Agricultural Supply Chain Management Platform
        </p>
      </div>
    `;
  }

  private generateDeliveryStatusUpdateEmail(delivery: CommodityDelivery, recipientName: string, recipientRole: string, updatedBy: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Delivery Status Updated</h2>
        <p>Hello ${recipientName},</p>
        <p>The status of your commodity delivery has been updated by ${updatedBy}:</p>
        <div style="background-color: #f0f8ff; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Delivery ID:</strong> ${delivery.id}</p>
          <p><strong>Commodity:</strong> ${delivery.commodityType}</p>
          <p><strong>Quantity:</strong> ${delivery.quantity}</p>
          <p><strong>New Status:</strong> ${delivery.status}</p>
          ${delivery.actualDate ? `<p><strong>Actual Date:</strong> ${delivery.actualDate.toLocaleDateString()}</p>` : ''}
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/dashboard/deliveries/${delivery.id}" 
             style="background-color: #4CAF50; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            View Delivery Details
          </a>
        </div>
        <hr>
        <p style="color: #666; font-size: 12px;">
          FarmTally - Agricultural Supply Chain Management Platform
        </p>
      </div>
    `;
  }
}