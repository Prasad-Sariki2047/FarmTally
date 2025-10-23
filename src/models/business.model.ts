import { BaseEntity, RelationshipType, RelationshipStatus, SupplyChainDataType, AccessLevel, DeliveryStatus, PaymentStatus, TransactionType, TransactionStatus, CommunicationType, UserRole } from './common.types';

export interface BusinessRelationship extends BaseEntity {
  farmAdminId: string;
  serviceProviderId: string;
  type: RelationshipType;
  status: RelationshipStatus;
  establishedDate: Date;
  terminatedDate?: Date;
  permissions: BusinessDataAccessPermissions;
  contractDetails?: ContractDetails;
}

export interface SupplyChainData extends BaseEntity {
  farmAdminId: string;
  type: SupplyChainDataType;
  data: any;
  visibility: DataVisibility[];
}

export interface DataVisibility {
  userId: string;
  userRole: UserRole;
  accessLevel: AccessLevel;
}

export interface CommodityDelivery extends BaseEntity {
  farmerId: string;
  farmAdminId: string;
  commodityType: string;
  quantity: number;
  scheduledDate: Date;
  actualDate?: Date;
  status: DeliveryStatus;
  paymentInfo?: PaymentInfo;
}

export interface PaymentInfo {
  amount: number;
  currency: string;
  status: PaymentStatus;
  dueDate: Date;
  paidDate?: Date;
}

export interface ContractDetails extends BaseEntity {
  terms: string;
  startDate: Date;
  endDate?: Date;
  paymentTerms: string;
  deliveryTerms?: string;
  specialConditions?: string[];
}

export interface TransactionHistory extends BaseEntity {
  relationshipId: string;
  type: TransactionType;
  description: string;
  amount?: number;
  date: Date;
  status: TransactionStatus;
  metadata: any;
}

export interface CommunicationLog extends BaseEntity {
  relationshipId: string;
  senderId: string;
  receiverId: string;
  message: string;
  type: CommunicationType;
  timestamp: Date;
  read: boolean;
}

export interface BusinessDataAccessPermissions {
  canRead: string[];
  canWrite: string[];
  canDelete: string[];
  restrictions: BusinessAccessRestriction[];
}

export interface BusinessAccessRestriction {
  field: string;
  condition: string;
  value: any;
}

// Validation functions for business data integrity
export class BusinessValidation {
  static validateCommodityType(commodityType: string): boolean {
    return commodityType.trim().length >= 2 && commodityType.trim().length <= 50;
  }

  static validateQuantity(quantity: number): boolean {
    return quantity > 0 && Number.isFinite(quantity);
  }

  static validateAmount(amount: number): boolean {
    return amount >= 0 && Number.isFinite(amount);
  }

  static validateCurrency(currency: string): boolean {
    const validCurrencies = ['USD', 'EUR', 'GBP', 'NGN', 'KES', 'GHS', 'ZAR'];
    return validCurrencies.includes(currency.toUpperCase());
  }

  static validateDateRange(startDate: Date, endDate?: Date): boolean {
    if (!endDate) return true;
    return startDate <= endDate;
  }

  static validateBusinessRelationship(relationship: Partial<BusinessRelationship>): string[] {
    const errors: string[] = [];

    if (!relationship.farmAdminId || relationship.farmAdminId.trim().length === 0) {
      errors.push('Farm Admin ID is required');
    }

    if (!relationship.serviceProviderId || relationship.serviceProviderId.trim().length === 0) {
      errors.push('Service Provider ID is required');
    }

    if (relationship.type && !Object.values(RelationshipType).includes(relationship.type)) {
      errors.push('Invalid relationship type');
    }

    if (relationship.status && !Object.values(RelationshipStatus).includes(relationship.status)) {
      errors.push('Invalid relationship status');
    }

    return errors;
  }

  static validateCommodityDelivery(delivery: Partial<CommodityDelivery>): string[] {
    const errors: string[] = [];

    if (!delivery.farmerId || delivery.farmerId.trim().length === 0) {
      errors.push('Farmer ID is required');
    }

    if (!delivery.farmAdminId || delivery.farmAdminId.trim().length === 0) {
      errors.push('Farm Admin ID is required');
    }

    if (delivery.commodityType && !this.validateCommodityType(delivery.commodityType)) {
      errors.push('Invalid commodity type');
    }

    if (delivery.quantity && !this.validateQuantity(delivery.quantity)) {
      errors.push('Quantity must be a positive number');
    }

    if (delivery.status && !Object.values(DeliveryStatus).includes(delivery.status)) {
      errors.push('Invalid delivery status');
    }

    return errors;
  }

  static validatePaymentInfo(payment: Partial<PaymentInfo>): string[] {
    const errors: string[] = [];

    if (payment.amount !== undefined && !this.validateAmount(payment.amount)) {
      errors.push('Amount must be a non-negative number');
    }

    if (payment.currency && !this.validateCurrency(payment.currency)) {
      errors.push('Invalid currency code');
    }

    if (payment.status && !Object.values(PaymentStatus).includes(payment.status)) {
      errors.push('Invalid payment status');
    }

    if (payment.dueDate && payment.paidDate && payment.dueDate > payment.paidDate) {
      errors.push('Paid date cannot be before due date');
    }

    return errors;
  }

  static validateTransactionHistory(transaction: Partial<TransactionHistory>): string[] {
    const errors: string[] = [];

    if (!transaction.relationshipId || transaction.relationshipId.trim().length === 0) {
      errors.push('Relationship ID is required');
    }

    if (transaction.type && !Object.values(TransactionType).includes(transaction.type)) {
      errors.push('Invalid transaction type');
    }

    if (!transaction.description || transaction.description.trim().length === 0) {
      errors.push('Transaction description is required');
    }

    if (transaction.amount !== undefined && !this.validateAmount(transaction.amount)) {
      errors.push('Amount must be a non-negative number');
    }

    if (transaction.status && !Object.values(TransactionStatus).includes(transaction.status)) {
      errors.push('Invalid transaction status');
    }

    return errors;
  }

  static validateCommunicationLog(communication: Partial<CommunicationLog>): string[] {
    const errors: string[] = [];

    if (!communication.relationshipId || communication.relationshipId.trim().length === 0) {
      errors.push('Relationship ID is required');
    }

    if (!communication.senderId || communication.senderId.trim().length === 0) {
      errors.push('Sender ID is required');
    }

    if (!communication.receiverId || communication.receiverId.trim().length === 0) {
      errors.push('Receiver ID is required');
    }

    if (!communication.message || communication.message.trim().length === 0) {
      errors.push('Message content is required');
    }

    if (communication.type && !Object.values(CommunicationType).includes(communication.type)) {
      errors.push('Invalid communication type');
    }

    return errors;
  }
}