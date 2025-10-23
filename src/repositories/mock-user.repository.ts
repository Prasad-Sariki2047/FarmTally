import { User, UserRegistrationData } from '../models';
import { UserRole, UserStatus } from '../models/common.types';
import { UserRepository } from './user.repository';
import { CryptoUtils } from '../utils/crypto.utils';

export class MockUserRepository implements UserRepository {
  private users: User[] = [];

  constructor() {
    // Initialize with test data
    this.users = [
      {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'admin@farmtally.com',
        fullName: 'System Administrator',
        role: UserRole.APP_ADMIN,
        status: UserStatus.ACTIVE,
        profileData: {},
        authMethods: [],
        emailVerified: true,
        phoneVerified: false,
        profileCompleted: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '11111111-1111-1111-1111-111111111111',
        email: 'farm.admin@test.com',
        fullName: 'Test Farm Admin',
        role: UserRole.FARM_ADMIN,
        status: UserStatus.ACTIVE,
        profileData: {
          businessName: 'Test Farm',
          farmSize: 100,
          cropTypes: ['wheat', 'corn']
        },
        authMethods: [],
        emailVerified: true,
        phoneVerified: false,
        profileCompleted: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '22222222-2222-2222-2222-222222222222',
        email: 'field.manager@test.com',
        fullName: 'Test Field Manager',
        role: UserRole.FIELD_MANAGER,
        status: UserStatus.ACTIVE,
        profileData: {
          experience: 5,
          specializations: ['crop_management', 'irrigation']
        },
        authMethods: [],
        emailVerified: true,
        phoneVerified: false,
        profileCompleted: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
  }

  async create(userData: UserRegistrationData): Promise<User> {
    const user: User = {
      id: CryptoUtils.generateUUID(),
      email: userData.email.toLowerCase().trim(),
      fullName: userData.fullName,
      role: userData.selectedRole,
      status: UserStatus.PENDING_APPROVAL,
      profileData: userData.profileData,
      authMethods: [userData.authMethod],
      emailVerified: false,
      phoneVerified: false,
      profileCompleted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.users.push(user);
    return user;
  }

  async findById(id: string): Promise<User | null> {
    return this.users.find(u => u.id === id) || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.users.find(u => u.email === email.toLowerCase().trim()) || null;
  }

  async findByRole(role: UserRole): Promise<User[]> {
    return this.users.filter(u => u.role === role);
  }

  async findByStatus(status: UserStatus): Promise<User[]> {
    return this.users.filter(u => u.status === status);
  }

  async update(id: string, updates: Partial<User>): Promise<User> {
    const index = this.users.findIndex(u => u.id === id);
    if (index === -1) {
      throw new Error('User not found');
    }
    
    this.users[index] = { ...this.users[index], ...updates, updatedAt: new Date() };
    return this.users[index];
  }

  async delete(id: string): Promise<void> {
    const index = this.users.findIndex(u => u.id === id);
    if (index !== -1) {
      this.users.splice(index, 1);
    }
  }

  async findAll(limit?: number, offset?: number): Promise<User[]> {
    let result = [...this.users];
    
    if (offset !== undefined) {
      result = result.slice(offset);
    }
    
    if (limit !== undefined) {
      result = result.slice(0, limit);
    }
    
    return result;
  }

  async count(): Promise<number> {
    return this.users.length;
  }

  async updateLastLogin(id: string): Promise<void> {
    const user = this.users.find(u => u.id === id);
    if (user) {
      user.lastLoginAt = new Date();
      user.updatedAt = new Date();
    }
  }
}