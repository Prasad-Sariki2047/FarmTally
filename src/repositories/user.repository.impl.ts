import { Pool } from 'pg';
import { User, UserRegistrationData } from '../models';
import { UserRole, UserStatus } from '../models/common.types';
import { UserRepository } from './user.repository';
import { dbConnection } from '../config/database.config';
import { CryptoUtils } from '../utils/crypto.utils';

export class UserRepositoryImpl implements UserRepository {
  private pool: Pool;

  constructor() {
    this.pool = dbConnection.getPostgreSQLPool();
  }

  async create(userData: UserRegistrationData): Promise<User> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Create user record
      const userId = CryptoUtils.generateUUID();
      const userQuery = `
        INSERT INTO users (
          id, email, full_name, role, status, 
          created_at, updated_at, email_verified, profile_completed
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;
      
      const userValues = [
        userId,
        userData.email.toLowerCase().trim(),
        userData.fullName,
        userData.selectedRole,
        'pending_approval', // Default status for new users
        new Date(),
        new Date(),
        false, // Email not verified yet
        false  // Profile not completed yet
      ];

      const userResult = await client.query(userQuery, userValues);

      // Create user profile record
      const profileQuery = `
        INSERT INTO user_profiles (
          id, user_id, profile_data, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5)
      `;
      
      const profileValues = [
        CryptoUtils.generateUUID(),
        userId,
        JSON.stringify(userData.profileData),
        new Date(),
        new Date()
      ];

      await client.query(profileQuery, profileValues);
      await client.query('COMMIT');

      return this.mapRowToUser(userResult.rows[0], userData.profileData);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async findById(id: string): Promise<User | null> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT u.*, up.profile_data 
        FROM users u
        LEFT JOIN user_profiles up ON u.id = up.user_id
        WHERE u.id = $1
      `;
      const result = await client.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      const profileData = row.profile_data ? JSON.parse(row.profile_data) : {};
      return this.mapRowToUser(row, profileData);
    } finally {
      client.release();
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT u.*, up.profile_data 
        FROM users u
        LEFT JOIN user_profiles up ON u.id = up.user_id
        WHERE u.email = $1
      `;
      const result = await client.query(query, [email.toLowerCase().trim()]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      const profileData = row.profile_data ? JSON.parse(row.profile_data) : {};
      return this.mapRowToUser(row, profileData);
    } finally {
      client.release();
    }
  }

  async findByRole(role: UserRole): Promise<User[]> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT u.*, up.profile_data 
        FROM users u
        LEFT JOIN user_profiles up ON u.id = up.user_id
        WHERE u.role = $1
        ORDER BY u.created_at DESC
      `;
      const result = await client.query(query, [role]);
      
      return result.rows.map(row => {
        const profileData = row.profile_data ? JSON.parse(row.profile_data) : {};
        return this.mapRowToUser(row, profileData);
      });
    } finally {
      client.release();
    }
  }

  async findByStatus(status: UserStatus): Promise<User[]> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT u.*, up.profile_data 
        FROM users u
        LEFT JOIN user_profiles up ON u.id = up.user_id
        WHERE u.status = $1
        ORDER BY u.created_at DESC
      `;
      const result = await client.query(query, [status]);
      
      return result.rows.map(row => {
        const profileData = row.profile_data ? JSON.parse(row.profile_data) : {};
        return this.mapRowToUser(row, profileData);
      });
    } finally {
      client.release();
    }
  }

  async update(id: string, updates: Partial<User>): Promise<User> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Update user table
      const userSetClause = [];
      const userValues = [];
      let paramIndex = 1;

      if (updates.fullName !== undefined) {
        userSetClause.push(`full_name = $${paramIndex++}`);
        userValues.push(updates.fullName);
      }
      
      if (updates.status !== undefined) {
        userSetClause.push(`status = $${paramIndex++}`);
        userValues.push(updates.status);
      }
      
      if (updates.phoneNumber !== undefined) {
        userSetClause.push(`phone_number = $${paramIndex++}`);
        userValues.push(updates.phoneNumber);
      }
      
      if (updates.emailVerified !== undefined) {
        userSetClause.push(`email_verified = $${paramIndex++}`);
        userValues.push(updates.emailVerified);
      }
      
      if (updates.phoneVerified !== undefined) {
        userSetClause.push(`phone_verified = $${paramIndex++}`);
        userValues.push(updates.phoneVerified);
      }
      
      if (updates.profileCompleted !== undefined) {
        userSetClause.push(`profile_completed = $${paramIndex++}`);
        userValues.push(updates.profileCompleted);
      }

      userSetClause.push(`updated_at = $${paramIndex++}`);
      userValues.push(new Date());
      
      userValues.push(id);

      const userQuery = `
        UPDATE users 
        SET ${userSetClause.join(', ')} 
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const userResult = await client.query(userQuery, userValues);
      
      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      // Update profile data if provided
      if (updates.profileData !== undefined) {
        const profileQuery = `
          UPDATE user_profiles 
          SET profile_data = $1, updated_at = $2 
          WHERE user_id = $3
        `;
        await client.query(profileQuery, [
          JSON.stringify(updates.profileData),
          new Date(),
          id
        ]);
      }

      await client.query('COMMIT');

      // Fetch updated user with profile data
      const updatedUser = await this.findById(id);
      if (!updatedUser) {
        throw new Error('Failed to fetch updated user');
      }

      return updatedUser;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async delete(id: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      // User profiles will be deleted automatically due to CASCADE
      const query = 'DELETE FROM users WHERE id = $1';
      await client.query(query, [id]);
    } finally {
      client.release();
    }
  }

  async findAll(limit?: number, offset?: number): Promise<User[]> {
    const client = await this.pool.connect();
    try {
      let query = `
        SELECT u.*, up.profile_data 
        FROM users u
        LEFT JOIN user_profiles up ON u.id = up.user_id
        ORDER BY u.created_at DESC
      `;
      
      const values = [];
      if (limit !== undefined) {
        query += ` LIMIT $1`;
        values.push(limit);
        
        if (offset !== undefined) {
          query += ` OFFSET $2`;
          values.push(offset);
        }
      }

      const result = await client.query(query, values);
      
      return result.rows.map(row => {
        const profileData = row.profile_data ? JSON.parse(row.profile_data) : {};
        return this.mapRowToUser(row, profileData);
      });
    } finally {
      client.release();
    }
  }

  async count(): Promise<number> {
    const client = await this.pool.connect();
    try {
      const query = 'SELECT COUNT(*) as count FROM users';
      const result = await client.query(query);
      return parseInt(result.rows[0].count);
    } finally {
      client.release();
    }
  }

  async updateLastLogin(id: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      const query = `
        UPDATE users 
        SET last_login_at = $1, updated_at = $1 
        WHERE id = $2
      `;
      await client.query(query, [new Date(), id]);
    } finally {
      client.release();
    }
  }

  // Helper method to map database row to User domain object
  private mapRowToUser(row: any, profileData: any = {}): User {
    return {
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      role: row.role as UserRole,
      status: row.status as UserStatus,
      phoneNumber: row.phone_number,
      profileData: profileData,
      authMethods: [], // This would be populated from a separate auth methods table if needed
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastLoginAt: row.last_login_at,
      emailVerified: row.email_verified,
      phoneVerified: row.phone_verified,
      profileCompleted: row.profile_completed
    };
  }
}