import { UserRegistrationData } from '../models';

export interface AuthController {
  // Registration endpoints
  register(userData: UserRegistrationData): Promise<{ success: boolean; message: string; requestId?: string }>;
  
  // Magic Link authentication
  sendMagicLink(email: string): Promise<{ success: boolean; message: string }>;
  verifyMagicLink(token: string): Promise<{ success: boolean; user?: any; sessionToken?: string }>;
  
  // OTP authentication
  sendOTP(identifier: string, method: 'email' | 'sms'): Promise<{ success: boolean; message: string }>;
  verifyOTP(identifier: string, code: string): Promise<{ success: boolean; user?: any; sessionToken?: string }>;
  
  // Social authentication
  googleAuth(token: string): Promise<{ success: boolean; user?: any; sessionToken?: string }>;
  
  // Session management
  logout(sessionToken: string): Promise<{ success: boolean; message: string }>;
  refreshSession(sessionToken: string): Promise<{ success: boolean; newToken?: string }>;
}