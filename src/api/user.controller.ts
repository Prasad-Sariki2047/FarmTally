import { User, UserProfileUpdates } from '../models';

export interface UserController {
  // User profile management
  getProfile(userId: string): Promise<{ success: boolean; user?: User }>;
  updateProfile(userId: string, updates: UserProfileUpdates): Promise<{ success: boolean; user?: User }>;
  
  // User preferences
  getAuthMethods(userId: string): Promise<{ success: boolean; methods?: string[] }>;
  updateAuthMethods(userId: string, methods: string[]): Promise<{ success: boolean; message: string }>;
  
  // User relationships
  getRelationships(userId: string): Promise<{ success: boolean; relationships?: any[] }>;
  
  // User dashboard data
  getDashboardData(userId: string): Promise<{ success: boolean; data?: any }>;
}