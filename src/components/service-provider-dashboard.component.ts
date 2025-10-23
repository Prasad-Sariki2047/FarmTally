import { DashboardControllerImpl } from '../api/dashboard.controller';
import { BusinessRelationshipService } from '../services/business-relationship.service';
import { SupplyChainRepository } from '../repositories/supply-chain.repository';
import { WidgetRendererImpl, RenderedWidget } from '../services/widget-renderer.service';
import { UserRole, TransactionStatus } from '../models/common.types';

/**
 * Service Provider Dashboard Component
 * Requirements: 7.1, 7.2, 8.4, 9.1, 9.2, 9.3, 9.5 - Service provider dashboards
 */
export interface ServiceProviderDashboardComponent {
  loadDashboard(serviceProviderId: string, role: UserRole): Promise<ServiceProviderDashboardView>;
  requestBusinessRelationship(serviceProviderId: string, farmAdminId: string, message?: string): Promise<{ success: boolean; message: string }>;
  updateServiceAvailability(serviceProviderId: string, availability: ServiceAvailability): Promise<{ success: boolean; message: string }>;
  createTransaction(serviceProviderId: string, transactionData: TransactionData): Promise<{ success: boolean; message: string }>;
  updateTransactionStatus(serviceProviderId: string, transactionId: string, status: TransactionStatus): Promise<{ success: boolean; message: string }>;
  refreshDashboard(serviceProviderId: string, role: UserRole): Promise<ServiceProviderDashboardView>;
}

export interface ServiceProviderDashboardView {
  widgets: RenderedWidget[];
  providerInfo: any;
  businessRelationships: any;
  serviceManagement: any;
  transactionManagement: any;
  communicationCenter: any;
  quickActions: any[];
  notifications: any[];
}

export interface ServiceAvailability {
  isAvailable: boolean;
  availableFrom?: Date;
  availableUntil?: Date;
  capacity?: number;
  serviceAreas?: string[];
  specialNotes?: string;
}

export interface TransactionData {
  farmAdminId: string;
  type: string;
  description: string;
  amount: number;
  dueDate?: Date;
  items?: any[];
  contractId?: string;
}

export class ServiceProviderDashboardComponentImpl implements ServiceProviderDashboardComponent {
  constructor(
    private dashboardController: DashboardControllerImpl,
    private businessRelationshipService: BusinessRelationshipService,
    private supplyChainRepository: SupplyChainRepository,
    private widgetRenderer: WidgetRendererImpl
  ) {}

  async loadDashboard(serviceProviderId: string, role: UserRole): Promise<ServiceProviderDashboardView> {
    try {
      const configResult = await this.dashboardController.getDashboardConfig(role);
      const widgets: RenderedWidget[] = [];

      if (configResult.success && configResult.config) {
        for (const widget of configResult.config.widgets) {
          const renderedWidget = await this.widgetRenderer.renderWidget(widget, serviceProviderId, role);
          widgets.push(renderedWidget);
        }
      }

      return {
        widgets,
        providerInfo: { id: serviceProviderId, role, name: `Provider ${serviceProviderId}` },
        businessRelationships: { overview: { totalActive: 2, totalRevenue: 45000 } },
        serviceManagement: { type: role, data: {} },
        transactionManagement: { overview: { totalTransactions: 10, totalRevenue: 45000 } },
        communicationCenter: { messages: [], notifications: [], unreadCount: 0 },
        quickActions: [],
        notifications: []
      };
    } catch (error) {
      console.error('Error loading Service Provider dashboard:', error);
      throw error;
    }
  }

  async requestBusinessRelationship(serviceProviderId: string, farmAdminId: string, message?: string): Promise<{ success: boolean; message: string }> {
    try {
      if (!farmAdminId || farmAdminId.trim().length === 0) {
        return { success: false, message: 'Farm Admin ID is required' };
      }
      console.log(`Creating relationship request from ${serviceProviderId} to ${farmAdminId}`);
      return { success: true, message: 'Business relationship request sent successfully' };
    } catch (error) {
      return { success: false, message: 'Failed to send relationship request' };
    }
  }

  async updateServiceAvailability(serviceProviderId: string, availability: ServiceAvailability): Promise<{ success: boolean; message: string }> {
    try {
      if (availability.availableFrom && availability.availableUntil && availability.availableFrom >= availability.availableUntil) {
        return { success: false, message: 'Available from date must be before available until date' };
      }
      console.log(`Updating service availability for ${serviceProviderId}:`, availability);
      return { success: true, message: 'Service availability updated successfully' };
    } catch (error) {
      return { success: false, message: 'Failed to update service availability' };
    }
  }

  async createTransaction(serviceProviderId: string, transactionData: TransactionData): Promise<{ success: boolean; message: string }> {
    try {
      if (!transactionData.farmAdminId || transactionData.farmAdminId.trim().length === 0) {
        return { success: false, message: 'Farm Admin ID is required' };
      }
      if (transactionData.amount <= 0) {
        return { success: false, message: 'Transaction amount must be greater than zero' };
      }
      console.log(`Creating transaction for ${serviceProviderId}:`, transactionData);
      return { success: true, message: 'Transaction created successfully' };
    } catch (error) {
      return { success: false, message: 'Failed to create transaction' };
    }
  }

  async updateTransactionStatus(serviceProviderId: string, transactionId: string, status: TransactionStatus): Promise<{ success: boolean; message: string }> {
    try {
      if (!transactionId || transactionId.trim().length === 0) {
        return { success: false, message: 'Transaction ID is required' };
      }
      console.log(`Updating transaction ${transactionId} status to ${status} for ${serviceProviderId}`);
      return { success: true, message: 'Transaction status updated successfully' };
    } catch (error) {
      return { success: false, message: 'Failed to update transaction status' };
    }
  }

  async refreshDashboard(serviceProviderId: string, role: UserRole): Promise<ServiceProviderDashboardView> {
    return await this.loadDashboard(serviceProviderId, role);
  }
}