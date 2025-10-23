import { AuthenticationRepository } from '../repositories/authentication.repository';
import { UserRepository } from '../repositories/user.repository';
import { CryptoUtils } from '../utils/crypto.utils';
import { User, UserRegistrationData } from '../models/user.model';
import { UserRole, AuthenticationMethod, UserStatus } from '../models/common.types';

export interface SocialAuthProfile {
  id: string;
  email: string;
  name: string;
  picture?: string;
  verified_email?: boolean;
  provider: 'google';
}

export interface GoogleTokenPayload {
  iss: string;
  sub: string;
  aud: string;
  email: string;
  email_verified: boolean;
  name: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
  iat: number;
  exp: number;
}

export class SocialAuthService {
  private readonly GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  private readonly GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

  constructor(
    private authRepository: AuthenticationRepository,
    private userRepository: UserRepository
  ) {
    if (!this.GOOGLE_CLIENT_ID) {
      console.warn('GOOGLE_CLIENT_ID not configured - Google Sign-In will not work');
    }
  }

  /**
   * Validate Google ID token and extract user profile
   */
  async validateGoogleToken(idToken: string): Promise<{ 
    valid: boolean; 
    profile?: SocialAuthProfile; 
    error?: string 
  }> {
    try {
      if (!this.GOOGLE_CLIENT_ID) {
        return { valid: false, error: 'Google authentication not configured' };
      }

      // In a real implementation, you would use Google's library to verify the token
      // For now, we'll simulate the token validation
      const profile = await this.verifyGoogleIdToken(idToken);
      
      if (!profile) {
        return { valid: false, error: 'Invalid Google token' };
      }

      return {
        valid: true,
        profile: {
          id: profile.sub,
          email: profile.email,
          name: profile.name,
          picture: profile.picture,
          verified_email: profile.email_verified,
          provider: 'google'
        }
      };

    } catch (error) {
      console.error('Error validating Google token:', error);
      return { valid: false, error: 'Token validation failed' };
    }
  }

  /**
   * Handle Google Sign-In authentication
   */
  async authenticateWithGoogle(idToken: string): Promise<{
    success: boolean;
    user?: User;
    isNewUser?: boolean;
    requiresRegistration?: boolean;
    message: string;
  }> {
    try {
      // Validate the Google token
      const tokenValidation = await this.validateGoogleToken(idToken);
      
      if (!tokenValidation.valid || !tokenValidation.profile) {
        return {
          success: false,
          message: tokenValidation.error || 'Invalid Google authentication'
        };
      }

      const profile = tokenValidation.profile;

      // Check if user already exists
      const existingUser = await this.userRepository.findByEmail(profile.email);

      if (existingUser) {
        // User exists - check if Google auth is already linked
        if (existingUser.authMethods.includes(AuthenticationMethod.SOCIAL_GOOGLE)) {
          return {
            success: true,
            user: existingUser,
            isNewUser: false,
            message: 'Authentication successful'
          };
        } else {
          // Link Google auth to existing account
          const updatedAuthMethods = [...existingUser.authMethods, AuthenticationMethod.SOCIAL_GOOGLE];
          const updatedUser = await this.userRepository.update(existingUser.id, {
            authMethods: updatedAuthMethods,
            updatedAt: new Date()
          });

          return {
            success: true,
            user: updatedUser,
            isNewUser: false,
            message: 'Google authentication linked to existing account'
          };
        }
      } else {
        // New user - requires registration completion
        return {
          success: true,
          requiresRegistration: true,
          message: 'New user detected. Please complete registration.',
          user: {
            email: profile.email,
            fullName: profile.name,
            profileData: {
              googleId: profile.id,
              profilePicture: profile.picture
            }
          } as any
        };
      }

    } catch (error) {
      console.error('Error in Google authentication:', error);
      return {
        success: false,
        message: 'Authentication failed. Please try again.'
      };
    }
  }

  /**
   * Link Google account to existing user
   */
  async linkGoogleAccount(userId: string, idToken: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      // Validate the Google token
      const tokenValidation = await this.validateGoogleToken(idToken);
      
      if (!tokenValidation.valid || !tokenValidation.profile) {
        return {
          success: false,
          message: tokenValidation.error || 'Invalid Google token'
        };
      }

      const profile = tokenValidation.profile;

      // Get the user
      const user = await this.userRepository.findById(userId);
      if (!user) {
        return {
          success: false,
          message: 'User not found'
        };
      }

      // Check if the email matches
      if (user.email.toLowerCase() !== profile.email.toLowerCase()) {
        return {
          success: false,
          message: 'Google account email does not match user account email'
        };
      }

      // Check if Google auth is already linked
      if (user.authMethods.includes(AuthenticationMethod.SOCIAL_GOOGLE)) {
        return {
          success: true,
          message: 'Google account is already linked'
        };
      }

      // Check if this Google account is linked to another user
      const existingGoogleUser = await this.userRepository.findByEmail(profile.email);
      if (existingGoogleUser && existingGoogleUser.id !== userId) {
        return {
          success: false,
          message: 'This Google account is already linked to another user'
        };
      }

      // Link the Google account
      const updatedAuthMethods = [...user.authMethods, AuthenticationMethod.SOCIAL_GOOGLE];
      await this.userRepository.update(userId, {
        authMethods: updatedAuthMethods,
        profileData: {
          ...user.profileData,
          googleId: profile.id,
          profilePicture: profile.picture
        },
        updatedAt: new Date()
      });

      return {
        success: true,
        message: 'Google account linked successfully'
      };

    } catch (error) {
      console.error('Error linking Google account:', error);
      return {
        success: false,
        message: 'Failed to link Google account. Please try again.'
      };
    }
  }

  /**
   * Unlink Google account from user
   */
  async unlinkGoogleAccount(userId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        return {
          success: false,
          message: 'User not found'
        };
      }

      // Check if Google auth is linked
      if (!user.authMethods.includes(AuthenticationMethod.SOCIAL_GOOGLE)) {
        return {
          success: true,
          message: 'Google account is not linked'
        };
      }

      // Ensure user has other authentication methods
      const otherAuthMethods = user.authMethods.filter((method: AuthenticationMethod) => method !== AuthenticationMethod.SOCIAL_GOOGLE);
      if (otherAuthMethods.length === 0) {
        return {
          success: false,
          message: 'Cannot unlink Google account. User must have at least one authentication method.'
        };
      }

      // Remove Google auth method
      const updatedProfileData = { ...user.profileData };
      delete updatedProfileData.googleId;
      delete updatedProfileData.profilePicture;

      await this.userRepository.update(userId, {
        authMethods: otherAuthMethods,
        profileData: updatedProfileData,
        updatedAt: new Date()
      });

      return {
        success: true,
        message: 'Google account unlinked successfully'
      };

    } catch (error) {
      console.error('Error unlinking Google account:', error);
      return {
        success: false,
        message: 'Failed to unlink Google account. Please try again.'
      };
    }
  }

  /**
   * Get user's linked social accounts
   */
  async getLinkedAccounts(userId: string): Promise<{
    success: boolean;
    accounts?: { provider: string; linked: boolean; email?: string }[];
    message: string;
  }> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        return {
          success: false,
          message: 'User not found'
        };
      }

      const accounts = [
        {
          provider: 'google',
          linked: user.authMethods.includes(AuthenticationMethod.SOCIAL_GOOGLE),
          email: user.authMethods.includes(AuthenticationMethod.SOCIAL_GOOGLE) ? user.email : undefined
        }
      ];

      return {
        success: true,
        accounts,
        message: 'Linked accounts retrieved successfully'
      };

    } catch (error) {
      console.error('Error getting linked accounts:', error);
      return {
        success: false,
        message: 'Failed to retrieve linked accounts'
      };
    }
  }

  /**
   * Verify Google ID token (simplified implementation)
   * In production, use Google's official library: google-auth-library
   */
  private async verifyGoogleIdToken(idToken: string): Promise<GoogleTokenPayload | null> {
    try {
      // This is a simplified implementation
      // In production, you should use Google's official verification:
      // 
      // const { OAuth2Client } = require('google-auth-library');
      // const client = new OAuth2Client(this.GOOGLE_CLIENT_ID);
      // const ticket = await client.verifyIdToken({
      //   idToken: idToken,
      //   audience: this.GOOGLE_CLIENT_ID,
      // });
      // const payload = ticket.getPayload();
      
      // For now, we'll decode the JWT payload (without verification)
      // This is NOT secure for production use
      const parts = idToken.split('.');
      if (parts.length !== 3) {
        return null;
      }

      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      
      // Basic validation
      if (!payload.email || !payload.name || !payload.sub) {
        return null;
      }

      // Check expiration
      if (payload.exp && Date.now() >= payload.exp * 1000) {
        return null;
      }

      return payload as GoogleTokenPayload;

    } catch (error) {
      console.error('Error verifying Google token:', error);
      return null;
    }
  }

  /**
   * Create user from Google profile during registration
   */
  async createUserFromGoogleProfile(
    profile: SocialAuthProfile, 
    selectedRole: UserRole,
    additionalProfileData?: any
  ): Promise<{ success: boolean; user?: User; message: string }> {
    try {
      // Check if user already exists
      const existingUser = await this.userRepository.findByEmail(profile.email);
      if (existingUser) {
        return {
          success: false,
          message: 'User with this email already exists'
        };
      }

      // Create new user registration data
      const userRegistrationData: UserRegistrationData = {
        email: profile.email.toLowerCase().trim(),
        fullName: profile.name,
        selectedRole: selectedRole,
        authMethod: AuthenticationMethod.SOCIAL_GOOGLE,
        profileData: {
          googleId: profile.id,
          profilePicture: profile.picture,
          ...additionalProfileData
        }
      };

      const createdUser = await this.userRepository.create(userRegistrationData);

      return {
        success: true,
        user: createdUser,
        message: 'User created successfully from Google profile'
      };

    } catch (error) {
      console.error('Error creating user from Google profile:', error);
      return {
        success: false,
        message: 'Failed to create user account'
      };
    }
  }
}