import { BaseEntity, RelationshipType, RelationshipStatus } from './common.types';

export interface BusinessRelationship extends BaseEntity {
  farmAdminId: string;
  serviceProviderId: string;
  type: RelationshipType;
  status: RelationshipStatus;
  establishedDate: Date;
  permissions: DataAccessPermissions;
  contractDetails?: ContractDetails;
}

export interface DataAccessPermissions {
  canRead: string[];
  canWrite: string[];
  canDelete: string[];
  restrictions: AccessRestriction[];
}

export interface AccessRestriction {
  field: string;
  condition: string;
  value: any;
}

export interface ContractDetails {
  id: string;
  terms: string;
  startDate: Date;
  endDate?: Date;
  paymentTerms: string;
  deliveryTerms?: string;
  specialConditions?: string[];
}