import { AuthenticationSession, MagicLink, OTPVerification } from '../models';

export interface AuthenticationRepository {
  // Session management
  createSession(session: AuthenticationSession): Promise<AuthenticationSession>;
  findSessionById(id: string): Promise<AuthenticationSession | null>;
  findSessionsByUserId(userId: string): Promise<AuthenticationSession[]>;
  updateSession(id: string, updates: Partial<AuthenticationSession>): Promise<AuthenticationSession>;
  deleteSession(id: string): Promise<void>;
  deleteUserSessions(userId: string): Promise<void>;
  
  // Magic Link management
  createMagicLink(magicLink: MagicLink): Promise<MagicLink>;
  findMagicLinkByToken(token: string): Promise<MagicLink | null>;
  updateMagicLink(id: string, updates: Partial<MagicLink>): Promise<MagicLink>;
  deleteMagicLink(id: string): Promise<void>;
  
  // OTP management
  createOTP(otp: OTPVerification): Promise<OTPVerification>;
  findOTPByIdentifier(identifier: string): Promise<OTPVerification | null>;
  updateOTP(id: string, updates: Partial<OTPVerification>): Promise<OTPVerification>;
  deleteOTP(id: string): Promise<void>;
}