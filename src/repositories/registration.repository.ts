import { RegistrationRequest } from '../models';
import { ApprovalStatus } from '../models/common.types';

export interface RegistrationRepository {
  create(request: RegistrationRequest): Promise<RegistrationRequest>;
  findById(id: string): Promise<RegistrationRequest | null>;
  findByStatus(status: ApprovalStatus): Promise<RegistrationRequest[]>;
  findByEmail(email: string): Promise<RegistrationRequest | null>;
  update(id: string, updates: Partial<RegistrationRequest>): Promise<RegistrationRequest>;
  delete(id: string): Promise<void>;
  findAll(): Promise<RegistrationRequest[]>;
}