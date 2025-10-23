import { BaseEntity, UserRole, UserStatus, AuthenticationMethod } from './common.types';

export interface User extends BaseEntity {
  email: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  phoneNumber?: string;
  profileData: RoleSpecificProfile;
  lastLoginAt?: Date;
  authMethods: AuthenticationMethod[];
  emailVerified: boolean;
  phoneVerified: boolean;
  profileCompleted: boolean;
}

export interface RoleSpecificProfile {
  [key: string]: any;
  // Farm Admin specific
  businessName?: string;
  farmSize?: number;
  cropTypes?: string[];
  // Field Manager specific
  experience?: number;
  specializations?: string[];
  // Farmer specific
  commodityTypes?: string[];
  productionCapacity?: number;
  // Service provider specific
  serviceAreas?: string[];
  capacity?: number;
  certifications?: string[];
}

export interface UserRegistrationData {
  email: string;
  fullName: string;
  selectedRole: UserRole;
  profileData: RoleSpecificProfile;
  authMethod: AuthenticationMethod;
}

export interface UserProfileUpdates {
  fullName?: string;
  profileData?: Partial<RoleSpecificProfile>;
  authMethods?: AuthenticationMethod[];
}