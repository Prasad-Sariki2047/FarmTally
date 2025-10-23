import { SupplyChainData, CommodityDelivery, TransactionHistory, CommunicationLog } from '../models';
import { SupplyChainDataType, TransactionType, CommunicationType, UserRole } from '../models/common.types';

export interface SupplyChainRepository {
  // Supply Chain Data management
  createSupplyChainData(data: SupplyChainData): Promise<SupplyChainData>;
  findSupplyChainDataById(id: string): Promise<SupplyChainData | null>;
  findById(id: string): Promise<SupplyChainData | null>;
  findSupplyChainDataByFarmAdmin(farmAdminId: string): Promise<SupplyChainData[]>;
  findByFarmAdminAndType(farmAdminId: string, type: SupplyChainDataType): Promise<SupplyChainData[]>;
  findSupplyChainDataByType(type: SupplyChainDataType): Promise<SupplyChainData[]>;
  updateSupplyChainData(id: string, updates: Partial<SupplyChainData>): Promise<SupplyChainData>;
  deleteSupplyChainData(id: string): Promise<void>;
  
  // Commodity Delivery management
  createCommodityDelivery(delivery: CommodityDelivery): Promise<CommodityDelivery>;
  findCommodityDeliveryById(id: string): Promise<CommodityDelivery | null>;
  findCommodityDeliveriesByFarmer(farmerId: string): Promise<CommodityDelivery[]>;
  findCommodityDeliveriesByFarmAdmin(farmAdminId: string): Promise<CommodityDelivery[]>;
  updateCommodityDelivery(id: string, updates: Partial<CommodityDelivery>): Promise<CommodityDelivery>;
  deleteCommodityDelivery(id: string): Promise<void>;
  
  // Transaction History management
  createTransaction(transaction: TransactionHistory): Promise<TransactionHistory>;
  findTransactionById(id: string): Promise<TransactionHistory | null>;
  findTransactionsByRelationship(relationshipId: string): Promise<TransactionHistory[]>;
  findTransactionsByType(type: TransactionType): Promise<TransactionHistory[]>;
  updateTransaction(id: string, updates: Partial<TransactionHistory>): Promise<TransactionHistory>;
  deleteTransaction(id: string): Promise<void>;
  
  // Communication Log management
  createCommunicationLog(log: CommunicationLog): Promise<CommunicationLog>;
  findCommunicationLogById(id: string): Promise<CommunicationLog | null>;
  findCommunicationLogsByRelationship(relationshipId: string): Promise<CommunicationLog[]>;
  findCommunicationLogsByType(type: CommunicationType): Promise<CommunicationLog[]>;
  updateCommunicationLog(id: string, updates: Partial<CommunicationLog>): Promise<CommunicationLog>;
  deleteCommunicationLog(id: string): Promise<void>;
  
  // Role-based data access methods
  findCommodityDeliveriesByUserRole(userId: string, userRole: UserRole): Promise<CommodityDelivery[]>;
  findTransactionsByUserRole(userId: string, userRole: UserRole, relationshipIds?: string[]): Promise<TransactionHistory[]>;
  findCommunicationLogsByUserRole(userId: string, userRole: UserRole, relationshipIds?: string[]): Promise<CommunicationLog[]>;
}