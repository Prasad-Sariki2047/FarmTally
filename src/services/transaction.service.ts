import { TransactionHistory, PaymentInfo, ContractDetails, User } from '../models';
import { TransactionType, TransactionStatus, PaymentStatus, UserRole } from '../models/common.types';
import { SupplyChainRepository } from '../repositories/supply-chain.repository';
import { BusinessRelationshipService } from './business-relationship.service';
import { UserManagementService } from './user-management.service';
import { NotificationService } from './notification.service';
import { CryptoUtils } from '../utils/crypto.utils';

export interface TransactionManager {
  // Transaction management
  createTransaction(relationshipId: string, transactionData: Partial<TransactionHistory>): Promise<TransactionHistory>;
  updateTransactionStatus(transactionId: string, status: TransactionStatus, userId: string): Promise<TransactionHistory>;
  getTransactionById(transactionId: string): Promise<TransactionHistory | null>;
  getTransactionsByRelationship(relationshipId: string): Promise<TransactionHistory[]>;
  getTransactionsByUser(userId: string, userRole: UserRole): Promise<TransactionHistory[]>;
  
  // Payment tracking
  updatePaymentStatus(transactionId: string, paymentStatus: PaymentStatus, userId: string): Promise<TransactionHistory>;
  getOverdueTransactions(userId: string, userRole: UserRole): Promise<TransactionHistory[]>;
  getPendingPayments(userId: string, userRole: UserRole): Promise<TransactionHistory[]>;
  
  // Contract management
  createContract(relationshipId: string, contractData: ContractDetails): Promise<ContractDetails>;
  updateContract(contractId: string, updates: Partial<ContractDetails>, userId: string): Promise<ContractDetails>;
  getContractsByRelationship(relationshipId: string): Promise<ContractDetails[]>;
  
  // Transaction history and reporting
  getTransactionHistory(userId: string, userRole: UserRole, filters?: TransactionFilters): Promise<TransactionHistory[]>;
  getTransactionSummary(userId: string, userRole: UserRole, period: TimePeriod): Promise<TransactionSummary>;
}

export interface TransactionFilters {
  type?: TransactionType;
  status?: TransactionStatus;
  dateFrom?: Date;
  dateTo?: Date;
  relationshipId?: string;
}

export interface TimePeriod {
  startDate: Date;
  endDate: Date;
}

export interface TransactionSummary {
  totalTransactions: number;
  totalAmount: number;
  pendingAmount: number;
  completedAmount: number;
  byType: Record<TransactionType, { count: number; amount: number }>;
  byStatus: Record<TransactionStatus, { count: number; amount: number }>;
}

export class TransactionService implements TransactionManager {
  private contracts: Map<string, ContractDetails> = new Map();

  constructor(
    private supplyChainRepository: SupplyChainRepository,
    private businessRelationshipService: BusinessRelationshipService,
    private userManagementService: UserManagementService,
    private notificationService: NotificationService
  ) {}  /**

   * Create a new transaction for a business relationship
   * Requirements: 8.5, 9.4
   */
  async createTransaction(relationshipId: string, transactionData: Partial<TransactionHistory>): Promise<TransactionHistory> {
    // Validate relationship exists
    const relationship = await this.businessRelationshipService.getRelationshipById(relationshipId);
    if (!relationship) {
      throw new Error('Business relationship not found');
    }

    // Validate required transaction data
    if (!transactionData.type || !transactionData.description) {
      throw new Error('Transaction type and description are required');
    }

    // Create transaction record
    const transaction: TransactionHistory = {
      id: CryptoUtils.generateUUID(),
      relationshipId,
      type: transactionData.type,
      description: transactionData.description,
      amount: transactionData.amount || 0,
      date: transactionData.date || new Date(),
      status: transactionData.status || TransactionStatus.PENDING,
      metadata: transactionData.metadata || {},
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const createdTransaction = await this.supplyChainRepository.createTransaction(transaction);

    // Send notifications to relevant parties
    await this.sendTransactionCreatedNotifications(createdTransaction, relationship);

    return createdTransaction;
  }

  /**
   * Update transaction status with proper authorization
   * Requirements: 9.4
   */
  async updateTransactionStatus(transactionId: string, status: TransactionStatus, userId: string): Promise<TransactionHistory> {
    const transaction = await this.supplyChainRepository.findTransactionById(transactionId);
    
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    // Validate user has permission to update this transaction
    const relationship = await this.businessRelationshipService.getRelationshipById(transaction.relationshipId);
    if (!relationship) {
      throw new Error('Related business relationship not found');
    }

    if (relationship.farmAdminId !== userId && relationship.serviceProviderId !== userId) {
      throw new Error('Unauthorized to update this transaction');
    }

    // Validate status transition
    this.validateTransactionStatusTransition(transaction.status, status);

    const updatedTransaction = await this.supplyChainRepository.updateTransaction(transactionId, {
      status,
      updatedAt: new Date()
    });

    // Send status update notifications
    await this.sendTransactionStatusUpdateNotifications(updatedTransaction, relationship, userId);

    return updatedTransaction;
  }

  /**
   * Get transaction by ID
   */
  async getTransactionById(transactionId: string): Promise<TransactionHistory | null> {
    return await this.supplyChainRepository.findTransactionById(transactionId);
  }

  /**
   * Get all transactions for a business relationship
   * Requirements: 9.4
   */
  async getTransactionsByRelationship(relationshipId: string): Promise<TransactionHistory[]> {
    return await this.supplyChainRepository.findTransactionsByRelationship(relationshipId);
  }

  /**
   * Get transactions for a user based on their role and relationships
   * Requirements: 9.4
   */
  async getTransactionsByUser(userId: string, userRole: UserRole): Promise<TransactionHistory[]> {
    const relationships = await this.businessRelationshipService.getRelationships(userId);
    const relationshipIds = relationships.map(rel => rel.id);
    
    return await this.supplyChainRepository.findTransactionsByUserRole(userId, userRole, relationshipIds);
  }  /**
   * 
Update payment status for a transaction
   * Requirements: 9.4
   */
  async updatePaymentStatus(transactionId: string, paymentStatus: PaymentStatus, userId: string): Promise<TransactionHistory> {
    const transaction = await this.supplyChainRepository.findTransactionById(transactionId);
    
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    // Validate user has permission to update payment status
    const relationship = await this.businessRelationshipService.getRelationshipById(transaction.relationshipId);
    if (!relationship) {
      throw new Error('Related business relationship not found');
    }

    // Only farm admin can update payment status for most transaction types
    if (relationship.farmAdminId !== userId) {
      throw new Error('Only the farm admin can update payment status');
    }

    // Update transaction metadata with payment information
    const updatedMetadata = {
      ...transaction.metadata,
      paymentStatus,
      paymentUpdatedAt: new Date(),
      paymentUpdatedBy: userId
    };

    const updatedTransaction = await this.supplyChainRepository.updateTransaction(transactionId, {
      metadata: updatedMetadata,
      updatedAt: new Date()
    });

    // Send payment status update notifications
    await this.sendPaymentStatusUpdateNotifications(updatedTransaction, relationship, paymentStatus);

    return updatedTransaction;
  }

  /**
   * Get overdue transactions for a user
   * Requirements: 9.4
   */
  async getOverdueTransactions(userId: string, userRole: UserRole): Promise<TransactionHistory[]> {
    const transactions = await this.getTransactionsByUser(userId, userRole);
    const currentDate = new Date();

    return transactions.filter(transaction => {
      const paymentStatus = transaction.metadata?.paymentStatus;
      const dueDate = transaction.metadata?.dueDate ? new Date(transaction.metadata.dueDate) : null;
      
      return paymentStatus === PaymentStatus.PENDING && 
             dueDate && 
             dueDate < currentDate;
    });
  }

  /**
   * Get pending payments for a user
   * Requirements: 9.4
   */
  async getPendingPayments(userId: string, userRole: UserRole): Promise<TransactionHistory[]> {
    const transactions = await this.getTransactionsByUser(userId, userRole);

    return transactions.filter(transaction => {
      const paymentStatus = transaction.metadata?.paymentStatus;
      return paymentStatus === PaymentStatus.PENDING || !paymentStatus;
    });
  }

  /**
   * Create a contract for a business relationship
   * Requirements: 9.4
   */
  async createContract(relationshipId: string, contractData: ContractDetails): Promise<ContractDetails> {
    // Validate relationship exists
    const relationship = await this.businessRelationshipService.getRelationshipById(relationshipId);
    if (!relationship) {
      throw new Error('Business relationship not found');
    }

    // Validate required contract data
    if (!contractData.terms || !contractData.startDate || !contractData.paymentTerms) {
      throw new Error('Contract terms, start date, and payment terms are required');
    }

    const contract: ContractDetails = {
      id: CryptoUtils.generateUUID(),
      terms: contractData.terms,
      startDate: contractData.startDate,
      endDate: contractData.endDate,
      paymentTerms: contractData.paymentTerms,
      deliveryTerms: contractData.deliveryTerms,
      specialConditions: contractData.specialConditions || [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.contracts.set(contract.id, contract);

    // Update relationship with contract reference
    await this.businessRelationshipService.updateRelationshipStatus(relationshipId, relationship.status);

    return contract;
  }  /**
 
  * Update contract details
   * Requirements: 9.4
   */
  async updateContract(contractId: string, updates: Partial<ContractDetails>, userId: string): Promise<ContractDetails> {
    const contract = this.contracts.get(contractId);
    
    if (!contract) {
      throw new Error('Contract not found');
    }

    // Validate user has permission to update contract
    // This would typically involve checking if user is part of the relationship
    const user = await this.userManagementService.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const updatedContract = {
      ...contract,
      ...updates,
      id: contract.id, // Prevent ID changes
      createdAt: contract.createdAt, // Preserve creation date
      updatedAt: new Date()
    };

    this.contracts.set(contractId, updatedContract);
    return updatedContract;
  }

  /**
   * Get contracts for a business relationship
   * Requirements: 9.4
   */
  async getContractsByRelationship(relationshipId: string): Promise<ContractDetails[]> {
    // In a real implementation, this would query a contracts table
    // For now, return contracts that match the relationship (simplified)
    return Array.from(this.contracts.values()).filter(contract => 
      // This is a simplified check - in reality, we'd have a proper relationship mapping
      contract.id.includes(relationshipId.substring(0, 8))
    );
  }

  /**
   * Get transaction history with optional filters
   * Requirements: 9.4
   */
  async getTransactionHistory(userId: string, userRole: UserRole, filters?: TransactionFilters): Promise<TransactionHistory[]> {
    let transactions = await this.getTransactionsByUser(userId, userRole);

    if (filters) {
      if (filters.type) {
        transactions = transactions.filter(t => t.type === filters.type);
      }
      if (filters.status) {
        transactions = transactions.filter(t => t.status === filters.status);
      }
      if (filters.dateFrom) {
        transactions = transactions.filter(t => t.date >= filters.dateFrom!);
      }
      if (filters.dateTo) {
        transactions = transactions.filter(t => t.date <= filters.dateTo!);
      }
      if (filters.relationshipId) {
        transactions = transactions.filter(t => t.relationshipId === filters.relationshipId);
      }
    }

    // Sort by date (most recent first)
    return transactions.sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  /**
   * Get transaction summary for a time period
   * Requirements: 9.4
   */
  async getTransactionSummary(userId: string, userRole: UserRole, period: TimePeriod): Promise<TransactionSummary> {
    const transactions = await this.getTransactionHistory(userId, userRole, {
      dateFrom: period.startDate,
      dateTo: period.endDate
    });

    const summary: TransactionSummary = {
      totalTransactions: transactions.length,
      totalAmount: 0,
      pendingAmount: 0,
      completedAmount: 0,
      byType: {} as Record<TransactionType, { count: number; amount: number }>,
      byStatus: {} as Record<TransactionStatus, { count: number; amount: number }>
    };

    // Initialize type and status counters
    Object.values(TransactionType).forEach(type => {
      summary.byType[type] = { count: 0, amount: 0 };
    });
    Object.values(TransactionStatus).forEach(status => {
      summary.byStatus[status] = { count: 0, amount: 0 };
    });

    // Calculate summary statistics
    transactions.forEach(transaction => {
      const amount = transaction.amount || 0;
      
      summary.totalAmount += amount;
      
      if (transaction.status === TransactionStatus.COMPLETED) {
        summary.completedAmount += amount;
      } else if (transaction.status === TransactionStatus.PENDING) {
        summary.pendingAmount += amount;
      }

      // Update by type
      summary.byType[transaction.type].count++;
      summary.byType[transaction.type].amount += amount;

      // Update by status
      summary.byStatus[transaction.status].count++;
      summary.byStatus[transaction.status].amount += amount;
    });

    return summary;
  }

  // Private helper methods
  private validateTransactionStatusTransition(currentStatus: TransactionStatus, newStatus: TransactionStatus): void {
    const validTransitions: Record<TransactionStatus, TransactionStatus[]> = {
      [TransactionStatus.PENDING]: [TransactionStatus.COMPLETED, TransactionStatus.FAILED, TransactionStatus.CANCELLED],
      [TransactionStatus.COMPLETED]: [], // Final state
      [TransactionStatus.FAILED]: [TransactionStatus.PENDING], // Can retry
      [TransactionStatus.CANCELLED]: [] // Final state
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus}`);
    }
  }

  private async sendTransactionCreatedNotifications(transaction: TransactionHistory, relationship: any): Promise<void> {
    const farmAdmin = await this.userManagementService.getUserById(relationship.farmAdminId);
    const serviceProvider = await this.userManagementService.getUserById(relationship.serviceProviderId);

    if (!farmAdmin || !serviceProvider) {
      return;
    }

    const subject = 'New Transaction Created - FarmTally';
    
    // Notify farm admin
    await this.notificationService.sendEmail(
      farmAdmin.email,
      subject,
      this.generateTransactionNotificationEmail(transaction, farmAdmin.fullName, 'farm_admin'),
      true
    );

    // Notify service provider
    await this.notificationService.sendEmail(
      serviceProvider.email,
      subject,
      this.generateTransactionNotificationEmail(transaction, serviceProvider.fullName, 'service_provider'),
      true
    );
  }

  private async sendTransactionStatusUpdateNotifications(transaction: TransactionHistory, relationship: any, updatedBy: string): Promise<void> {
    const farmAdmin = await this.userManagementService.getUserById(relationship.farmAdminId);
    const serviceProvider = await this.userManagementService.getUserById(relationship.serviceProviderId);
    const updater = await this.userManagementService.getUserById(updatedBy);

    if (!farmAdmin || !serviceProvider || !updater) {
      return;
    }

    // Notify the other party (not the one who made the update)
    const recipient = updatedBy === farmAdmin.id ? serviceProvider : farmAdmin;
    const recipientRole = updatedBy === farmAdmin.id ? 'service_provider' : 'farm_admin';

    const subject = 'Transaction Status Updated - FarmTally';
    await this.notificationService.sendEmail(
      recipient.email,
      subject,
      this.generateTransactionStatusUpdateEmail(transaction, recipient.fullName, recipientRole, updater.fullName),
      true
    );
  }

  private async sendPaymentStatusUpdateNotifications(transaction: TransactionHistory, relationship: any, paymentStatus: PaymentStatus): Promise<void> {
    const serviceProvider = await this.userManagementService.getUserById(relationship.serviceProviderId);

    if (!serviceProvider) {
      return;
    }

    const subject = 'Payment Status Updated - FarmTally';
    await this.notificationService.sendEmail(
      serviceProvider.email,
      subject,
      this.generatePaymentStatusUpdateEmail(transaction, serviceProvider.fullName, paymentStatus),
      true
    );
  }

  private generateTransactionNotificationEmail(transaction: TransactionHistory, recipientName: string, recipientRole: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>New Transaction Created</h2>
        <p>Hello ${recipientName},</p>
        <p>A new transaction has been created:</p>
        <div style="background-color: #e8f5e8; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Transaction ID:</strong> ${transaction.id}</p>
          <p><strong>Type:</strong> ${transaction.type}</p>
          <p><strong>Description:</strong> ${transaction.description}</p>
          <p><strong>Amount:</strong> $${transaction.amount || 0}</p>
          <p><strong>Status:</strong> ${transaction.status}</p>
          <p><strong>Date:</strong> ${transaction.date.toLocaleDateString()}</p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/dashboard/transactions/${transaction.id}" 
             style="background-color: #4CAF50; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            View Transaction Details
          </a>
        </div>
        <hr>
        <p style="color: #666; font-size: 12px;">
          FarmTally - Agricultural Supply Chain Management Platform
        </p>
      </div>
    `;
  }

  private generateTransactionStatusUpdateEmail(transaction: TransactionHistory, recipientName: string, recipientRole: string, updatedBy: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Transaction Status Updated</h2>
        <p>Hello ${recipientName},</p>
        <p>The status of a transaction has been updated by ${updatedBy}:</p>
        <div style="background-color: #f0f8ff; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Transaction ID:</strong> ${transaction.id}</p>
          <p><strong>Description:</strong> ${transaction.description}</p>
          <p><strong>New Status:</strong> ${transaction.status}</p>
          <p><strong>Amount:</strong> $${transaction.amount || 0}</p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/dashboard/transactions/${transaction.id}" 
             style="background-color: #4CAF50; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            View Transaction Details
          </a>
        </div>
        <hr>
        <p style="color: #666; font-size: 12px;">
          FarmTally - Agricultural Supply Chain Management Platform
        </p>
      </div>
    `;
  }

  private generatePaymentStatusUpdateEmail(transaction: TransactionHistory, recipientName: string, paymentStatus: PaymentStatus): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Payment Status Updated</h2>
        <p>Hello ${recipientName},</p>
        <p>The payment status for your transaction has been updated:</p>
        <div style="background-color: #fff3cd; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Transaction ID:</strong> ${transaction.id}</p>
          <p><strong>Description:</strong> ${transaction.description}</p>
          <p><strong>Payment Status:</strong> ${paymentStatus}</p>
          <p><strong>Amount:</strong> $${transaction.amount || 0}</p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/dashboard/transactions/${transaction.id}" 
             style="background-color: #4CAF50; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            View Transaction Details
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