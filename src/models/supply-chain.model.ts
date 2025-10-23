import { BaseEntity, SupplyChainDataType, AccessLevel, UserRole, DeliveryStatus, PaymentStatus } from './common.types';

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