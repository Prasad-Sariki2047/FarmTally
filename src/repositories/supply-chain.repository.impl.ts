import { SupplyChainRepository } from './supply-chain.repository';
import { SupplyChainData, CommodityDelivery, TransactionHistory, CommunicationLog, BusinessValidation } from '../models';
import { SupplyChainDataType, TransactionType, CommunicationType, UserRole, AccessLevel } from '../models/common.types';

export class InMemorySupplyChainRepository implements SupplyChainRepository {
  private supplyChainData: Map<string, SupplyChainData> = new Map();
  private commodityDeliveries: Map<string, CommodityDelivery> = new Map();
  private transactions: Map<string, TransactionHistory> = new Map();
  private communicationLogs: Map<string, CommunicationLog> = new Map();

  // Supply Chain Data management
  async createSupplyChainData(data: SupplyChainData): Promise<SupplyChainData> {
    if (!data.id) {
      data.id = this.generateId();
    }
    
    const now = new Date();
    data.createdAt = now;
    data.updatedAt = now;
    
    this.supplyChainData.set(data.id, { ...data });
    return { ...data };
  }

  async findSupplyChainDataById(id: string): Promise<SupplyChainData | null> {
    const data = this.supplyChainData.get(id);
    return data ? { ...data } : null;
  }

  async findById(id: string): Promise<SupplyChainData | null> {
    return this.findSupplyChainDataById(id);
  }

  async findSupplyChainDataByFarmAdmin(farmAdminId: string): Promise<SupplyChainData[]> {
    return Array.from(this.supplyChainData.values())
      .filter(data => data.farmAdminId === farmAdminId)
      .map(data => ({ ...data }));
  }

  async findByFarmAdminAndType(farmAdminId: string, type: SupplyChainDataType): Promise<SupplyChainData[]> {
    return Array.from(this.supplyChainData.values())
      .filter(data => data.farmAdminId === farmAdminId && data.type === type)
      .map(data => ({ ...data }));
  }

  async findSupplyChainDataByType(type: SupplyChainDataType): Promise<SupplyChainData[]> {
    return Array.from(this.supplyChainData.values())
      .filter(data => data.type === type)
      .map(data => ({ ...data }));
  }

  async updateSupplyChainData(id: string, updates: Partial<SupplyChainData>): Promise<SupplyChainData> {
    const existing = this.supplyChainData.get(id);
    if (!existing) {
      throw new Error(`Supply chain data with id ${id} not found`);
    }

    const updated = {
      ...existing,
      ...updates,
      id: existing.id, // Prevent ID changes
      createdAt: existing.createdAt, // Preserve creation date
      updatedAt: new Date()
    };

    this.supplyChainData.set(id, updated);
    return { ...updated };
  }

  async deleteSupplyChainData(id: string): Promise<void> {
    if (!this.supplyChainData.has(id)) {
      throw new Error(`Supply chain data with id ${id} not found`);
    }
    this.supplyChainData.delete(id);
  }

  // Commodity Delivery management
  async createCommodityDelivery(delivery: CommodityDelivery): Promise<CommodityDelivery> {
    // Validate delivery data
    const validationErrors = BusinessValidation.validateCommodityDelivery(delivery);
    if (validationErrors.length > 0) {
      throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
    }

    if (!delivery.id) {
      delivery.id = this.generateId();
    }
    
    const now = new Date();
    delivery.createdAt = now;
    delivery.updatedAt = now;
    
    this.commodityDeliveries.set(delivery.id, { ...delivery });
    return { ...delivery };
  }

  async findCommodityDeliveryById(id: string): Promise<CommodityDelivery | null> {
    const delivery = this.commodityDeliveries.get(id);
    return delivery ? { ...delivery } : null;
  }

  async findCommodityDeliveriesByFarmer(farmerId: string): Promise<CommodityDelivery[]> {
    return Array.from(this.commodityDeliveries.values())
      .filter(delivery => delivery.farmerId === farmerId)
      .map(delivery => ({ ...delivery }));
  }

  async findCommodityDeliveriesByFarmAdmin(farmAdminId: string): Promise<CommodityDelivery[]> {
    return Array.from(this.commodityDeliveries.values())
      .filter(delivery => delivery.farmAdminId === farmAdminId)
      .map(delivery => ({ ...delivery }));
  }

  async updateCommodityDelivery(id: string, updates: Partial<CommodityDelivery>): Promise<CommodityDelivery> {
    const existing = this.commodityDeliveries.get(id);
    if (!existing) {
      throw new Error(`Commodity delivery with id ${id} not found`);
    }

    const updated = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date()
    };

    // Validate updated delivery
    const validationErrors = BusinessValidation.validateCommodityDelivery(updated);
    if (validationErrors.length > 0) {
      throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
    }

    this.commodityDeliveries.set(id, updated);
    return { ...updated };
  }

  async deleteCommodityDelivery(id: string): Promise<void> {
    if (!this.commodityDeliveries.has(id)) {
      throw new Error(`Commodity delivery with id ${id} not found`);
    }
    this.commodityDeliveries.delete(id);
  }

  // Transaction History management
  async createTransaction(transaction: TransactionHistory): Promise<TransactionHistory> {
    // Validate transaction data
    const validationErrors = BusinessValidation.validateTransactionHistory(transaction);
    if (validationErrors.length > 0) {
      throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
    }

    if (!transaction.id) {
      transaction.id = this.generateId();
    }
    
    const now = new Date();
    transaction.createdAt = now;
    transaction.updatedAt = now;
    
    this.transactions.set(transaction.id, { ...transaction });
    return { ...transaction };
  }

  async findTransactionById(id: string): Promise<TransactionHistory | null> {
    const transaction = this.transactions.get(id);
    return transaction ? { ...transaction } : null;
  }

  async findTransactionsByRelationship(relationshipId: string): Promise<TransactionHistory[]> {
    return Array.from(this.transactions.values())
      .filter(transaction => transaction.relationshipId === relationshipId)
      .map(transaction => ({ ...transaction }));
  }

  async findTransactionsByType(type: TransactionType): Promise<TransactionHistory[]> {
    return Array.from(this.transactions.values())
      .filter(transaction => transaction.type === type)
      .map(transaction => ({ ...transaction }));
  }

  async updateTransaction(id: string, updates: Partial<TransactionHistory>): Promise<TransactionHistory> {
    const existing = this.transactions.get(id);
    if (!existing) {
      throw new Error(`Transaction with id ${id} not found`);
    }

    const updated = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date()
    };

    // Validate updated transaction
    const validationErrors = BusinessValidation.validateTransactionHistory(updated);
    if (validationErrors.length > 0) {
      throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
    }

    this.transactions.set(id, updated);
    return { ...updated };
  }

  async deleteTransaction(id: string): Promise<void> {
    if (!this.transactions.has(id)) {
      throw new Error(`Transaction with id ${id} not found`);
    }
    this.transactions.delete(id);
  }

  // Communication Log management
  async createCommunicationLog(log: CommunicationLog): Promise<CommunicationLog> {
    // Validate communication log data
    const validationErrors = BusinessValidation.validateCommunicationLog(log);
    if (validationErrors.length > 0) {
      throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
    }

    if (!log.id) {
      log.id = this.generateId();
    }
    
    const now = new Date();
    log.createdAt = now;
    log.updatedAt = now;
    
    this.communicationLogs.set(log.id, { ...log });
    return { ...log };
  }

  async findCommunicationLogById(id: string): Promise<CommunicationLog | null> {
    const log = this.communicationLogs.get(id);
    return log ? { ...log } : null;
  }

  async findCommunicationLogsByRelationship(relationshipId: string): Promise<CommunicationLog[]> {
    return Array.from(this.communicationLogs.values())
      .filter(log => log.relationshipId === relationshipId)
      .map(log => ({ ...log }));
  }

  async findCommunicationLogsByType(type: CommunicationType): Promise<CommunicationLog[]> {
    return Array.from(this.communicationLogs.values())
      .filter(log => log.type === type)
      .map(log => ({ ...log }));
  }

  async updateCommunicationLog(id: string, updates: Partial<CommunicationLog>): Promise<CommunicationLog> {
    const existing = this.communicationLogs.get(id);
    if (!existing) {
      throw new Error(`Communication log with id ${id} not found`);
    }

    const updated = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date()
    };

    // Validate updated communication log
    const validationErrors = BusinessValidation.validateCommunicationLog(updated);
    if (validationErrors.length > 0) {
      throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
    }

    this.communicationLogs.set(id, updated);
    return { ...updated };
  }

  async deleteCommunicationLog(id: string): Promise<void> {
    if (!this.communicationLogs.has(id)) {
      throw new Error(`Communication log with id ${id} not found`);
    }
    this.communicationLogs.delete(id);
  }

  // Role-based data access methods
  async findSupplyChainDataByUserRole(userId: string, userRole: UserRole, farmAdminId?: string): Promise<SupplyChainData[]> {
    let data = Array.from(this.supplyChainData.values());

    // Filter based on user role and business relationships
    switch (userRole) {
      case UserRole.APP_ADMIN:
        // App Admin can see all data
        break;
      case UserRole.FARM_ADMIN:
        // Farm Admin can see their own data
        data = data.filter(item => item.farmAdminId === userId);
        break;
      case UserRole.FIELD_MANAGER:
        // Field Manager can see data from their associated Farm Admin
        if (farmAdminId) {
          data = data.filter(item => 
            item.farmAdminId === farmAdminId && 
            item.visibility.some(v => v.userId === userId && v.accessLevel !== AccessLevel.READ_ONLY)
          );
        } else {
          data = [];
        }
        break;
      default:
        // Other roles see data based on visibility settings
        data = data.filter(item => 
          item.visibility.some(v => v.userId === userId)
        );
        break;
    }

    return data.map(item => ({ ...item }));
  }

  async findCommodityDeliveriesByUserRole(userId: string, userRole: UserRole): Promise<CommodityDelivery[]> {
    let deliveries = Array.from(this.commodityDeliveries.values());

    switch (userRole) {
      case UserRole.APP_ADMIN:
        // App Admin can see all deliveries
        break;
      case UserRole.FARM_ADMIN:
        // Farm Admin can see deliveries to them
        deliveries = deliveries.filter(delivery => delivery.farmAdminId === userId);
        break;
      case UserRole.FARMER:
        // Farmer can see their own deliveries
        deliveries = deliveries.filter(delivery => delivery.farmerId === userId);
        break;
      default:
        // Other roles have no direct access to commodity deliveries
        deliveries = [];
        break;
    }

    return deliveries.map(delivery => ({ ...delivery }));
  }

  async findTransactionsByUserRole(userId: string, userRole: UserRole, relationshipIds: string[] = []): Promise<TransactionHistory[]> {
    let transactions = Array.from(this.transactions.values());

    switch (userRole) {
      case UserRole.APP_ADMIN:
        // App Admin can see all transactions
        break;
      default:
        // Other roles can only see transactions from their relationships
        transactions = transactions.filter(transaction => 
          relationshipIds.includes(transaction.relationshipId)
        );
        break;
    }

    return transactions.map(transaction => ({ ...transaction }));
  }

  async findCommunicationLogsByUserRole(userId: string, userRole: UserRole, relationshipIds: string[] = []): Promise<CommunicationLog[]> {
    let logs = Array.from(this.communicationLogs.values());

    switch (userRole) {
      case UserRole.APP_ADMIN:
        // App Admin can see all communication logs
        break;
      default:
        // Other roles can see logs where they are sender, receiver, or part of the relationship
        logs = logs.filter(log => 
          log.senderId === userId || 
          log.receiverId === userId || 
          relationshipIds.includes(log.relationshipId)
        );
        break;
    }

    return logs.map(log => ({ ...log }));
  }

  // Utility methods
  private generateId(): string {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }

  // Data cleanup and maintenance methods
  async clearAllData(): Promise<void> {
    this.supplyChainData.clear();
    this.commodityDeliveries.clear();
    this.transactions.clear();
    this.communicationLogs.clear();
  }

  async getDataCounts(): Promise<{
    supplyChainData: number;
    commodityDeliveries: number;
    transactions: number;
    communicationLogs: number;
  }> {
    return {
      supplyChainData: this.supplyChainData.size,
      commodityDeliveries: this.commodityDeliveries.size,
      transactions: this.transactions.size,
      communicationLogs: this.communicationLogs.size
    };
  }
}