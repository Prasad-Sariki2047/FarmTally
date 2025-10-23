import { DashboardControllerImpl } from '../api/dashboard.controller';
import { BusinessRelationshipService } from '../services/business-relationship.service';
import { SupplyChainRepository } from '../repositories/supply-chain.repository';
import { WidgetRendererImpl, RenderedWidget } from '../services/widget-renderer.service';
import { BusinessRelationship, SupplyChainData } from '../models/business.model';
import { UserRole, RelationshipType, RelationshipStatus, SupplyChainDataType, DeliveryStatus, TransactionStatus } from '../models/common.types';

/**
 * Farm Admin Dashboard Component
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5 - Farm Admin central dashboard
 */
export interface FarmAdminDashboardComponent {
  loadDashboard(farmAdminId: string): Promise<FarmAdminDashboardView>;
  inviteFieldManager(farmAdminId: string, email: string): Promise<{ success: boolean; message: string }>;
  approveRelationshipRequest(relationshipId: string, farmAdminId: string): Promise<{ success: boolean; message: string }>;
  rejectRelationshipRequest(relationshipId: string, farmAdminId: string, reason: string): Promise<{ success: boolean; message: string }>;
  terminateRelationship(relationshipId: string, reason: string): Promise<{ success: boolean; message: string }>;
  refreshDashboard(farmAdminId: string): Promise<FarmAdminDashboardView>;
}

export interface FarmAdminDashboardView {
  widgets: RenderedWidget[];
  businessRelationships: {
    overview: RelationshipOverview;
    activeRelationships: RelationshipSummary[];
    pendingRequests: RelationshipRequest[];
    fieldManagers: FieldManagerSummary[];
    serviceProviders: ServiceProviderSummary[];
  };
  supplyChainStatus: {
    overview: SupplyChainOverview;
    commodityDeliveries: CommodityDeliverySummary[];
    recentTransactions: TransactionSummary[];
    upcomingActivities: UpcomingActivity[];
  };
  fieldManagerManagement: {
    activeManagers: FieldManagerSummary[];
    pendingInvitations: InvitationSummary[];
    recentActivity: FieldActivity[];
  };
  serviceProviderManagement: {
    providersByType: Record<RelationshipType, ServiceProviderSummary[]>;
    pendingRequests: RelationshipRequest[];
    recentCommunications: CommunicationSummary[];
  };
  quickActions: FarmAdminQuickAction[];
  notifications: FarmAdminNotification[];
}

export interface RelationshipOverview {
  totalActive: number;
  totalPending: number;
  fieldManagers: number;
  farmers: number;
  lorryAgencies: number;
  equipmentProviders: number;
  inputSuppliers: number;
  dealers: number;
  recentlyEstablished: number;
}

export interface RelationshipSummary {
  id: string;
  serviceProvider: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  };
  type: RelationshipType;
  status: RelationshipStatus;
  establishedDate: Date;
  lastActivity?: Date;
  isActive: boolean;
}

export interface RelationshipRequest {
  id: string;
  serviceProvider: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    profileSummary: string;
  };
  type: RelationshipType;
  requestedDate: Date;
  daysPending: number;
  isUrgent: boolean;
  message?: string;
}

export interface FieldManagerSummary {
  id: string;
  name: string;
  email: string;
  status: RelationshipStatus;
  joinedDate: Date;
  lastActivity?: Date;
  specializations: string[];
  currentAssignments: number;
  recentUpdates: number;
}

export interface ServiceProviderSummary {
  id: string;
  name: string;
  email: string;
  type: RelationshipType;
  status: RelationshipStatus;
  establishedDate: Date;
  lastTransaction?: Date;
  totalTransactions: number;
  businessSummary: string;
}

export interface SupplyChainOverview {
  totalDeliveries: number;
  pendingDeliveries: number;
  completedDeliveries: number;
  overdueDeliveries: number;
  totalTransactions: number;
  pendingPayments: number;
  recentActivity: number;
}

export interface CommodityDeliverySummary {
  id: string;
  farmer: {
    id: string;
    name: string;
  };
  commodityType: string;
  quantity: number;
  scheduledDate: Date;
  actualDate?: Date;
  status: DeliveryStatus;
  isOverdue: boolean;
  paymentStatus?: string;
}

export interface TransactionSummary {
  id: string;
  partner: {
    id: string;
    name: string;
    role: UserRole;
  };
  type: string;
  description: string;
  amount?: number;
  date: Date;
  status: TransactionStatus;
}

export interface UpcomingActivity {
  id: string;
  type: 'delivery' | 'payment' | 'meeting' | 'maintenance';
  title: string;
  description: string;
  scheduledDate: Date;
  priority: 'high' | 'medium' | 'low';
  relatedParty?: {
    id: string;
    name: string;
    role: UserRole;
  };
}

export interface InvitationSummary {
  id: string;
  email: string;
  sentDate: Date;
  expiresAt: Date;
  status: string;
  isExpired: boolean;
}

export interface FieldActivity {
  id: string;
  fieldManager: {
    id: string;
    name: string;
  };
  activity: string;
  description: string;
  timestamp: Date;
  location?: string;
}

export interface CommunicationSummary {
  id: string;
  partner: {
    id: string;
    name: string;
    role: UserRole;
  };
  lastMessage: string;
  timestamp: Date;
  unreadCount: number;
  type: string;
}

export interface FarmAdminQuickAction {
  id: string;
  label: string;
  description: string;
  icon: string;
  action: string;
  count?: number;
  priority: 'high' | 'medium' | 'low';
  category: 'relationships' | 'supply-chain' | 'field-management' | 'communications';
}

export interface FarmAdminNotification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: Date;
  isRead: boolean;
  actionUrl?: string;
  category: 'relationships' | 'supply-chain' | 'field-management' | 'system';
}

export class FarmAdminDashboardComponentImpl implements FarmAdminDashboardComponent {
  constructor(
    private dashboardController: DashboardControllerImpl,
    private businessRelationshipService: BusinessRelationshipService,
    private supplyChainRepository: SupplyChainRepository,
    private widgetRenderer: WidgetRendererImpl
  ) {}

  /**
   * Load complete Farm Admin dashboard data
   * Requirements: 4.1 - Business relationship overview and central management
   */
  async loadDashboard(farmAdminId: string): Promise<FarmAdminDashboardView> {
    try {
      // Get dashboard configuration and render widgets
      const configResult = await this.dashboardController.getDashboardConfig(UserRole.FARM_ADMIN);
      const widgets: RenderedWidget[] = [];

      if (configResult.success && configResult.config) {
        for (const widget of configResult.config.widgets) {
          const renderedWidget = await this.widgetRenderer.renderWidget(
            widget, 
            farmAdminId,
            UserRole.FARM_ADMIN
          );
          widgets.push(renderedWidget);
        }
      }

      // Load business relationships data
      const businessRelationships = await this.loadBusinessRelationshipsData(farmAdminId);

      // Load supply chain status
      const supplyChainStatus = await this.loadSupplyChainStatus(farmAdminId);

      // Load field manager management data
      const fieldManagerManagement = await this.loadFieldManagerManagement(farmAdminId);

      // Load service provider management data
      const serviceProviderManagement = await this.loadServiceProviderManagement(farmAdminId);

      // Generate quick actions
      const quickActions = this.generateQuickActions(businessRelationships, supplyChainStatus);

      // Generate notifications
      const notifications = this.generateNotifications(businessRelationships, supplyChainStatus);

      return {
        widgets,
        businessRelationships,
        supplyChainStatus,
        fieldManagerManagement,
        serviceProviderManagement,
        quickActions,
        notifications
      };
    } catch (error) {
      console.error('Error loading Farm Admin dashboard:', error);
      throw error;
    }
  }

  /**
   * Invite Field Manager via magic link
   * Requirements: 5.1, 5.2, 5.3 - Field Manager invitation system
   */
  async inviteFieldManager(farmAdminId: string, email: string): Promise<{ success: boolean; message: string }> {
    try {
      if (!email || !email.trim()) {
        return {
          success: false,
          message: 'Email address is required'
        };
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return {
          success: false,
          message: 'Please provide a valid email address'
        };
      }

      await this.businessRelationshipService.inviteFieldManager(farmAdminId, email.trim());

      return {
        success: true,
        message: `Invitation sent successfully to ${email.trim()}`
      };
    } catch (error) {
      console.error('Error inviting Field Manager:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to send invitation'
      };
    }
  }

  /**
   * Approve service provider relationship request
   * Requirements: 8.2, 8.3 - Farm Admin approval interface for relationships
   */
  async approveRelationshipRequest(relationshipId: string, farmAdminId: string): Promise<{ success: boolean; message: string }> {
    try {
      await this.businessRelationshipService.approveRelationshipRequest(relationshipId, farmAdminId);

      return {
        success: true,
        message: 'Relationship request approved successfully'
      };
    } catch (error) {
      console.error('Error approving relationship request:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to approve relationship request'
      };
    }
  }

  /**
   * Reject service provider relationship request
   * Requirements: 8.2, 8.3 - Farm Admin approval interface for relationships
   */
  async rejectRelationshipRequest(relationshipId: string, farmAdminId: string, reason: string): Promise<{ success: boolean; message: string }> {
    try {
      if (!reason || reason.trim().length === 0) {
        return {
          success: false,
          message: 'Rejection reason is required'
        };
      }

      await this.businessRelationshipService.rejectRelationshipRequest(relationshipId, farmAdminId, reason.trim());

      return {
        success: true,
        message: 'Relationship request rejected successfully'
      };
    } catch (error) {
      console.error('Error rejecting relationship request:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to reject relationship request'
      };
    }
  }

  /**
   * Terminate an existing relationship
   * Requirements: 4.2, 4.3 - Business relationship management
   */
  async terminateRelationship(relationshipId: string, reason: string): Promise<{ success: boolean; message: string }> {
    try {
      if (!reason || reason.trim().length === 0) {
        return {
          success: false,
          message: 'Termination reason is required'
        };
      }

      await this.businessRelationshipService.terminateRelationship(relationshipId, reason.trim());

      return {
        success: true,
        message: 'Relationship terminated successfully'
      };
    } catch (error) {
      console.error('Error terminating relationship:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to terminate relationship'
      };
    }
  }

  /**
   * Refresh dashboard data
   */
  async refreshDashboard(farmAdminId: string): Promise<FarmAdminDashboardView> {
    return await this.loadDashboard(farmAdminId);
  }

  // Private helper methods for data loading

  private async loadBusinessRelationshipsData(farmAdminId: string): Promise<FarmAdminDashboardView['businessRelationships']> {
    try {
      // Get all relationships for the farm admin
      const allRelationships = await this.businessRelationshipService.getRelationships(farmAdminId);
      const activeRelationships = allRelationships.filter(rel => rel.status === RelationshipStatus.ACTIVE);
      const pendingRequests = await this.businessRelationshipService.getPendingRelationshipRequests(farmAdminId);

      // Create overview
      const overview: RelationshipOverview = {
        totalActive: activeRelationships.length,
        totalPending: pendingRequests.length,
        fieldManagers: activeRelationships.filter(rel => rel.type === RelationshipType.FIELD_MANAGER).length,
        farmers: activeRelationships.filter(rel => rel.type === RelationshipType.FARMER_SUPPLIER).length,
        lorryAgencies: activeRelationships.filter(rel => rel.type === RelationshipType.LORRY_AGENCY).length,
        equipmentProviders: activeRelationships.filter(rel => rel.type === RelationshipType.EQUIPMENT_PROVIDER).length,
        inputSuppliers: activeRelationships.filter(rel => rel.type === RelationshipType.INPUT_SUPPLIER).length,
        dealers: activeRelationships.filter(rel => rel.type === RelationshipType.DEALER).length,
        recentlyEstablished: activeRelationships.filter(rel => 
          Date.now() - rel.establishedDate.getTime() < 7 * 24 * 60 * 60 * 1000
        ).length
      };

      // Transform active relationships
      const activeRelationshipSummaries: RelationshipSummary[] = activeRelationships.map(rel => ({
        id: rel.id,
        serviceProvider: {
          id: rel.serviceProviderId,
          name: `Service Provider ${rel.serviceProviderId.substring(0, 8)}`,
          email: `provider${rel.serviceProviderId.substring(0, 4)}@example.com`,
          role: this.getServiceProviderRole(rel.type)
        },
        type: rel.type,
        status: rel.status,
        establishedDate: rel.establishedDate,
        lastActivity: rel.updatedAt,
        isActive: rel.status === RelationshipStatus.ACTIVE
      }));

      // Transform pending requests
      const pendingRequestSummaries: RelationshipRequest[] = pendingRequests.map(req => {
        const daysPending = Math.floor((Date.now() - req.establishedDate.getTime()) / (1000 * 60 * 60 * 24));
        
        return {
          id: req.id,
          serviceProvider: {
            id: req.serviceProviderId,
            name: `Service Provider ${req.serviceProviderId.substring(0, 8)}`,
            email: `provider${req.serviceProviderId.substring(0, 4)}@example.com`,
            role: this.getServiceProviderRole(req.type),
            profileSummary: this.createServiceProviderProfileSummary(req.type)
          },
          type: req.type,
          requestedDate: req.establishedDate,
          daysPending,
          isUrgent: daysPending > 7
        };
      });

      // Get Field Managers
      const fieldManagers = activeRelationships
        .filter(rel => rel.type === RelationshipType.FIELD_MANAGER)
        .map(rel => this.createFieldManagerSummary(rel));

      // Get Service Providers
      const serviceProviders = activeRelationships
        .filter(rel => rel.type !== RelationshipType.FIELD_MANAGER)
        .map(rel => this.createServiceProviderSummary(rel));

      return {
        overview,
        activeRelationships: activeRelationshipSummaries,
        pendingRequests: pendingRequestSummaries,
        fieldManagers,
        serviceProviders
      };
    } catch (error) {
      console.error('Error loading business relationships data:', error);
      return {
        overview: {
          totalActive: 0,
          totalPending: 0,
          fieldManagers: 0,
          farmers: 0,
          lorryAgencies: 0,
          equipmentProviders: 0,
          inputSuppliers: 0,
          dealers: 0,
          recentlyEstablished: 0
        },
        activeRelationships: [],
        pendingRequests: [],
        fieldManagers: [],
        serviceProviders: []
      };
    }
  }

  private async loadSupplyChainStatus(farmAdminId: string): Promise<FarmAdminDashboardView['supplyChainStatus']> {
    try {
      // Get supply chain data - placeholder implementation
      // In a real implementation, this would use the actual repository method
      const supplyChainData: SupplyChainData[] = [];
      
      // Get commodity deliveries
      const commodityDeliveries = supplyChainData
        .filter((data: SupplyChainData) => data.type === SupplyChainDataType.COMMODITY_DELIVERY)
        .map((data: SupplyChainData) => this.createCommodityDeliverySummary(data));

      // Get recent transactions
      const transactions = supplyChainData
        .filter((data: SupplyChainData) => data.type === SupplyChainDataType.SALES_TRANSACTION)
        .slice(0, 10)
        .map((data: SupplyChainData) => this.createTransactionSummary(data));

      // Create overview
      const overview: SupplyChainOverview = {
        totalDeliveries: commodityDeliveries.length,
        pendingDeliveries: commodityDeliveries.filter((d: CommodityDeliverySummary) => d.status === DeliveryStatus.SCHEDULED).length,
        completedDeliveries: commodityDeliveries.filter((d: CommodityDeliverySummary) => d.status === DeliveryStatus.DELIVERED).length,
        overdueDeliveries: commodityDeliveries.filter((d: CommodityDeliverySummary) => d.isOverdue).length,
        totalTransactions: transactions.length,
        pendingPayments: transactions.filter((t: TransactionSummary) => t.status === TransactionStatus.PENDING).length,
        recentActivity: supplyChainData.filter((data: SupplyChainData) => 
          Date.now() - data.updatedAt.getTime() < 24 * 60 * 60 * 1000
        ).length
      };

      // Generate upcoming activities
      const upcomingActivities = this.generateUpcomingActivities(commodityDeliveries, transactions);

      return {
        overview,
        commodityDeliveries: commodityDeliveries.slice(0, 10),
        recentTransactions: transactions,
        upcomingActivities
      };
    } catch (error) {
      console.error('Error loading supply chain status:', error);
      return {
        overview: {
          totalDeliveries: 0,
          pendingDeliveries: 0,
          completedDeliveries: 0,
          overdueDeliveries: 0,
          totalTransactions: 0,
          pendingPayments: 0,
          recentActivity: 0
        },
        commodityDeliveries: [],
        recentTransactions: [],
        upcomingActivities: []
      };
    }
  }

  private async loadFieldManagerManagement(farmAdminId: string): Promise<FarmAdminDashboardView['fieldManagerManagement']> {
    try {
      // Get Field Manager relationships
      const relationships = await this.businessRelationshipService.getRelationships(farmAdminId);
      const fieldManagerRelationships = relationships.filter(rel => rel.type === RelationshipType.FIELD_MANAGER);

      // Get active Field Managers
      const activeManagers = fieldManagerRelationships
        .filter(rel => rel.status === RelationshipStatus.ACTIVE)
        .map(rel => this.createFieldManagerSummary(rel));

      // Get pending invitations
      const invitations = await this.businessRelationshipService.getInvitationsByUser(farmAdminId);
      const pendingInvitations = invitations
        .filter(inv => inv.inviteeRole === UserRole.FIELD_MANAGER)
        .map(inv => this.createInvitationSummary(inv));

      // Generate recent field activities (placeholder data)
      const recentActivity: FieldActivity[] = [];

      return {
        activeManagers,
        pendingInvitations,
        recentActivity
      };
    } catch (error) {
      console.error('Error loading field manager management data:', error);
      return {
        activeManagers: [],
        pendingInvitations: [],
        recentActivity: []
      };
    }
  }

  private async loadServiceProviderManagement(farmAdminId: string): Promise<FarmAdminDashboardView['serviceProviderManagement']> {
    try {
      // Get all relationships
      const relationships = await this.businessRelationshipService.getRelationships(farmAdminId);
      const serviceProviderRelationships = relationships.filter(rel => rel.type !== RelationshipType.FIELD_MANAGER);

      // Group by type
      const providersByType: Record<RelationshipType, ServiceProviderSummary[]> = {
        [RelationshipType.FIELD_MANAGER]: [],
        [RelationshipType.FARMER_SUPPLIER]: [],
        [RelationshipType.LORRY_AGENCY]: [],
        [RelationshipType.EQUIPMENT_PROVIDER]: [],
        [RelationshipType.INPUT_SUPPLIER]: [],
        [RelationshipType.DEALER]: []
      };

      serviceProviderRelationships.forEach(rel => {
        if (rel.status === RelationshipStatus.ACTIVE) {
          providersByType[rel.type].push(this.createServiceProviderSummary(rel));
        }
      });

      // Get pending requests
      const pendingRequests = await this.businessRelationshipService.getPendingRelationshipRequests(farmAdminId);
      const pendingRequestSummaries = pendingRequests.map(req => {
        const daysPending = Math.floor((Date.now() - req.establishedDate.getTime()) / (1000 * 60 * 60 * 24));
        
        return {
          id: req.id,
          serviceProvider: {
            id: req.serviceProviderId,
            name: `Service Provider ${req.serviceProviderId.substring(0, 8)}`,
            email: `provider${req.serviceProviderId.substring(0, 4)}@example.com`,
            role: this.getServiceProviderRole(req.type),
            profileSummary: this.createServiceProviderProfileSummary(req.type)
          },
          type: req.type,
          requestedDate: req.establishedDate,
          daysPending,
          isUrgent: daysPending > 7
        };
      });

      // Generate recent communications (placeholder)
      const recentCommunications: CommunicationSummary[] = [];

      return {
        providersByType,
        pendingRequests: pendingRequestSummaries,
        recentCommunications
      };
    } catch (error) {
      console.error('Error loading service provider management data:', error);
      return {
        providersByType: {
          [RelationshipType.FIELD_MANAGER]: [],
          [RelationshipType.FARMER_SUPPLIER]: [],
          [RelationshipType.LORRY_AGENCY]: [],
          [RelationshipType.EQUIPMENT_PROVIDER]: [],
          [RelationshipType.INPUT_SUPPLIER]: [],
          [RelationshipType.DEALER]: []
        },
        pendingRequests: [],
        recentCommunications: []
      };
    }
  }

  // Helper methods for data transformation

  private getServiceProviderRole(type: RelationshipType): UserRole {
    const roleMapping: Record<RelationshipType, UserRole> = {
      [RelationshipType.FIELD_MANAGER]: UserRole.FIELD_MANAGER,
      [RelationshipType.FARMER_SUPPLIER]: UserRole.FARMER,
      [RelationshipType.LORRY_AGENCY]: UserRole.LORRY_AGENCY,
      [RelationshipType.EQUIPMENT_PROVIDER]: UserRole.FIELD_EQUIPMENT_MANAGER,
      [RelationshipType.INPUT_SUPPLIER]: UserRole.INPUT_SUPPLIER,
      [RelationshipType.DEALER]: UserRole.DEALER
    };
    return roleMapping[type];
  }

  private createFieldManagerSummary(relationship: BusinessRelationship): FieldManagerSummary {
    return {
      id: relationship.serviceProviderId,
      name: `Field Manager ${relationship.serviceProviderId.substring(0, 8)}`,
      email: `fm${relationship.serviceProviderId.substring(0, 4)}@example.com`,
      status: relationship.status,
      joinedDate: relationship.establishedDate,
      lastActivity: relationship.updatedAt,
      specializations: ['Crop Management', 'Irrigation'],
      currentAssignments: 3,
      recentUpdates: 2
    };
  }

  private createServiceProviderSummary(relationship: BusinessRelationship): ServiceProviderSummary {
    return {
      id: relationship.serviceProviderId,
      name: `${this.getServiceProviderRole(relationship.type)} ${relationship.serviceProviderId.substring(0, 8)}`,
      email: `sp${relationship.serviceProviderId.substring(0, 4)}@example.com`,
      type: relationship.type,
      status: relationship.status,
      establishedDate: relationship.establishedDate,
      lastTransaction: relationship.updatedAt,
      totalTransactions: 5,
      businessSummary: this.createServiceProviderProfileSummary(relationship.type)
    };
  }

  private createServiceProviderProfileSummary(type: RelationshipType): string {
    const summaries: Record<RelationshipType, string> = {
      [RelationshipType.FIELD_MANAGER]: 'Field operations specialist',
      [RelationshipType.FARMER_SUPPLIER]: 'Commodity supplier with diverse crop portfolio',
      [RelationshipType.LORRY_AGENCY]: 'Transportation services for agricultural logistics',
      [RelationshipType.EQUIPMENT_PROVIDER]: 'Farm equipment rental and maintenance services',
      [RelationshipType.INPUT_SUPPLIER]: 'Seeds, fertilizers, and agricultural input supplier',
      [RelationshipType.DEALER]: 'Commodity purchasing and distribution services'
    };
    return summaries[type];
  }

  private createCommodityDeliverySummary(data: SupplyChainData): CommodityDeliverySummary {
    const deliveryData = data.data as any;
    const scheduledDate = new Date(deliveryData.scheduledDate || data.createdAt);
    const isOverdue = scheduledDate < new Date() && deliveryData.status === DeliveryStatus.SCHEDULED;

    return {
      id: data.id,
      farmer: {
        id: deliveryData.farmerId || 'farmer-id',
        name: deliveryData.farmerName || 'Farmer Name'
      },
      commodityType: deliveryData.commodityType || 'Commodity',
      quantity: deliveryData.quantity || 0,
      scheduledDate,
      actualDate: deliveryData.actualDate ? new Date(deliveryData.actualDate) : undefined,
      status: deliveryData.status || DeliveryStatus.SCHEDULED,
      isOverdue,
      paymentStatus: deliveryData.paymentStatus || 'Pending'
    };
  }

  private createTransactionSummary(data: SupplyChainData): TransactionSummary {
    const transactionData = data.data as any;

    return {
      id: data.id,
      partner: {
        id: transactionData.partnerId || 'partner-id',
        name: transactionData.partnerName || 'Business Partner',
        role: transactionData.partnerRole || UserRole.FARMER
      },
      type: transactionData.type || 'Transaction',
      description: transactionData.description || 'Business transaction',
      amount: transactionData.amount,
      date: data.createdAt,
      status: transactionData.status || TransactionStatus.PENDING
    };
  }

  private createInvitationSummary(invitation: any): InvitationSummary {
    const isExpired = new Date() > invitation.expiresAt;

    return {
      id: invitation.id,
      email: invitation.inviteeEmail,
      sentDate: invitation.sentAt,
      expiresAt: invitation.expiresAt,
      status: invitation.status,
      isExpired
    };
  }

  private generateUpcomingActivities(deliveries: CommodityDeliverySummary[], transactions: TransactionSummary[]): UpcomingActivity[] {
    const activities: UpcomingActivity[] = [];

    // Add upcoming deliveries
    deliveries
      .filter(d => d.status === DeliveryStatus.SCHEDULED && d.scheduledDate > new Date())
      .slice(0, 5)
      .forEach(delivery => {
        activities.push({
          id: `delivery-${delivery.id}`,
          type: 'delivery',
          title: `${delivery.commodityType} Delivery`,
          description: `${delivery.quantity} units from ${delivery.farmer.name}`,
          scheduledDate: delivery.scheduledDate,
          priority: delivery.isOverdue ? 'high' : 'medium',
          relatedParty: {
            id: delivery.farmer.id,
            name: delivery.farmer.name,
            role: UserRole.FARMER
          }
        });
      });

    // Add upcoming payments
    transactions
      .filter(t => t.status === TransactionStatus.PENDING)
      .slice(0, 3)
      .forEach(transaction => {
        activities.push({
          id: `payment-${transaction.id}`,
          type: 'payment',
          title: 'Payment Due',
          description: transaction.description,
          scheduledDate: transaction.date,
          priority: 'medium',
          relatedParty: transaction.partner
        });
      });

    return activities.sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime());
  }

  private generateQuickActions(
    businessRelationships: FarmAdminDashboardView['businessRelationships'],
    supplyChainStatus: FarmAdminDashboardView['supplyChainStatus']
  ): FarmAdminQuickAction[] {
    const actions: FarmAdminQuickAction[] = [];

    // Pending relationship requests
    if (businessRelationships.pendingRequests.length > 0) {
      actions.push({
        id: 'review-relationship-requests',
        label: 'Review Relationship Requests',
        description: `${businessRelationships.pendingRequests.length} pending requests`,
        icon: 'users',
        action: 'navigate:/dashboard/relationships/pending',
        count: businessRelationships.pendingRequests.length,
        priority: businessRelationships.pendingRequests.some(r => r.isUrgent) ? 'high' : 'medium',
        category: 'relationships'
      });
    }

    // Invite Field Manager
    actions.push({
      id: 'invite-field-manager',
      label: 'Invite Field Manager',
      description: 'Send invitation to new Field Manager',
      icon: 'user-plus',
      action: 'modal:invite-field-manager',
      priority: 'medium',
      category: 'field-management'
    });

    // Overdue deliveries
    if (supplyChainStatus.overview.overdueDeliveries > 0) {
      actions.push({
        id: 'review-overdue-deliveries',
        label: 'Overdue Deliveries',
        description: `${supplyChainStatus.overview.overdueDeliveries} deliveries need attention`,
        icon: 'alert-triangle',
        action: 'navigate:/dashboard/supply-chain/deliveries?filter=overdue',
        count: supplyChainStatus.overview.overdueDeliveries,
        priority: 'high',
        category: 'supply-chain'
      });
    }

    // Pending payments
    if (supplyChainStatus.overview.pendingPayments > 0) {
      actions.push({
        id: 'review-pending-payments',
        label: 'Pending Payments',
        description: `${supplyChainStatus.overview.pendingPayments} payments pending`,
        icon: 'credit-card',
        action: 'navigate:/dashboard/supply-chain/payments?filter=pending',
        count: supplyChainStatus.overview.pendingPayments,
        priority: 'medium',
        category: 'supply-chain'
      });
    }

    // Manage business network
    actions.push({
      id: 'manage-business-network',
      label: 'Manage Business Network',
      description: 'View and manage all business relationships',
      icon: 'network',
      action: 'navigate:/dashboard/relationships',
      priority: 'low',
      category: 'relationships'
    });

    return actions;
  }

  private generateNotifications(
    businessRelationships: FarmAdminDashboardView['businessRelationships'],
    supplyChainStatus: FarmAdminDashboardView['supplyChainStatus']
  ): FarmAdminNotification[] {
    const notifications: FarmAdminNotification[] = [];

    // Urgent relationship requests
    const urgentRequests = businessRelationships.pendingRequests.filter(r => r.isUrgent);
    if (urgentRequests.length > 0) {
      notifications.push({
        id: 'urgent-relationship-requests',
        type: 'warning',
        title: 'Urgent Relationship Requests',
        message: `${urgentRequests.length} relationship requests have been pending for more than 7 days`,
        timestamp: new Date(),
        isRead: false,
        actionUrl: '/dashboard/relationships/pending',
        category: 'relationships'
      });
    }

    // New relationship requests
    const recentRequests = businessRelationships.pendingRequests.filter(r => r.daysPending <= 1);
    if (recentRequests.length > 0) {
      notifications.push({
        id: 'new-relationship-requests',
        type: 'info',
        title: 'New Relationship Requests',
        message: `${recentRequests.length} new relationship requests received today`,
        timestamp: new Date(),
        isRead: false,
        actionUrl: '/dashboard/relationships/pending',
        category: 'relationships'
      });
    }

    // Overdue deliveries
    if (supplyChainStatus.overview.overdueDeliveries > 0) {
      notifications.push({
        id: 'overdue-deliveries',
        type: 'error',
        title: 'Overdue Deliveries',
        message: `${supplyChainStatus.overview.overdueDeliveries} commodity deliveries are overdue`,
        timestamp: new Date(),
        isRead: false,
        actionUrl: '/dashboard/supply-chain/deliveries?filter=overdue',
        category: 'supply-chain'
      });
    }

    // Recent activity
    if (supplyChainStatus.overview.recentActivity > 0) {
      notifications.push({
        id: 'recent-supply-chain-activity',
        type: 'success',
        title: 'Supply Chain Activity',
        message: `${supplyChainStatus.overview.recentActivity} new activities in the last 24 hours`,
        timestamp: new Date(),
        isRead: false,
        actionUrl: '/dashboard/supply-chain/activity',
        category: 'supply-chain'
      });
    }

    // Field Manager activity
    if (businessRelationships.fieldManagers.length > 0) {
      const activeManagers = businessRelationships.fieldManagers.filter(fm => 
        fm.lastActivity && Date.now() - fm.lastActivity.getTime() < 24 * 60 * 60 * 1000
      );
      
      if (activeManagers.length > 0) {
        notifications.push({
          id: 'field-manager-activity',
          type: 'info',
          title: 'Field Manager Updates',
          message: `${activeManagers.length} Field Managers have provided updates today`,
          timestamp: new Date(),
          isRead: false,
          actionUrl: '/dashboard/field-management',
          category: 'field-management'
        });
      }
    }

    return notifications;
  }
}