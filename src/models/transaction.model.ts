import { BaseEntity, TransactionType, TransactionStatus, CommunicationType } from './common.types';

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