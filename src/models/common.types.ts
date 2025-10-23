// Common enums and types used across the application

export enum UserRole {
  APP_ADMIN = 'app_admin',
  FARM_ADMIN = 'farm_admin',
  FIELD_MANAGER = 'field_manager',
  FARMER = 'farmer',
  LORRY_AGENCY = 'lorry_agency',
  FIELD_EQUIPMENT_MANAGER = 'field_equipment_manager',
  INPUT_SUPPLIER = 'input_supplier',
  DEALER = 'dealer'
}

export enum UserStatus {
  PENDING_APPROVAL = 'pending_approval',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  REJECTED = 'rejected'
}

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

export enum RelationshipType {
  FIELD_MANAGER = 'field_manager',
  FARMER_SUPPLIER = 'farmer_supplier',
  LORRY_AGENCY = 'lorry_agency',
  EQUIPMENT_PROVIDER = 'equipment_provider',
  INPUT_SUPPLIER = 'input_supplier',
  DEALER = 'dealer'
}

export enum RelationshipStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  TERMINATED = 'terminated'
}

export enum AuthenticationMethod {
  MAGIC_LINK = 'magic_link',
  OTP = 'otp',
  SOCIAL_AUTH = 'social_auth',
  SOCIAL_GOOGLE = 'social_google'
}

export enum LinkPurpose {
  REGISTRATION = 'registration',
  LOGIN = 'login',
  INVITATION = 'invitation'
}

export enum OTPPurpose {
  LOGIN = 'login',
  REGISTRATION = 'registration',
  VERIFICATION = 'verification'
}

export enum InvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled'
}

export enum SupplyChainDataType {
  FIELD_OPERATIONS = 'field_operations',
  COMMODITY_DELIVERY = 'commodity_delivery',
  INPUT_SUPPLY = 'input_supply',
  EQUIPMENT_USAGE = 'equipment_usage',
  TRANSPORTATION = 'transportation',
  SALES_TRANSACTION = 'sales_transaction'
}

export enum AccessLevel {
  READ_ONLY = 'read_only',
  READ_WRITE = 'read_write',
  FULL_ACCESS = 'full_access'
}

export enum DeliveryStatus {
  SCHEDULED = 'scheduled',
  IN_TRANSIT = 'in_transit',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled'
}

export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled'
}

export enum TransactionType {
  COMMODITY_PURCHASE = 'commodity_purchase',
  SERVICE_PAYMENT = 'service_payment',
  INPUT_SUPPLY = 'input_supply',
  EQUIPMENT_RENTAL = 'equipment_rental',
  TRANSPORTATION = 'transportation'
}

export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum CommunicationType {
  MESSAGE = 'message',
  NOTIFICATION = 'notification',
  SYSTEM_ALERT = 'system_alert',
  BUSINESS_UPDATE = 'business_update'
}

export enum WidgetType {
  RELATIONSHIP_OVERVIEW = 'relationship_overview',
  SUPPLY_CHAIN_STATUS = 'supply_chain_status',
  PENDING_APPROVALS = 'pending_approvals',
  RECENT_TRANSACTIONS = 'recent_transactions',
  FIELD_OPERATIONS = 'field_operations',
  COMMODITY_SCHEDULE = 'commodity_schedule'
}

// Base interface for all entities
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

// Error response interface
export interface ErrorResponse {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
  requestId: string;
}