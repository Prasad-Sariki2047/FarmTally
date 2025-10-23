import { Pool } from 'pg';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { dbConnection } from '../config/database.config';

export class DatabaseInitService {
  private pool: Pool;

  constructor() {
    this.pool = dbConnection.getPostgreSQLPool();
  }

  async initializeDatabase(): Promise<void> {
    console.log('🔄 Initializing database...');
    
    try {
      // Read and execute the initialization SQL script
      const sqlPath = join(__dirname, '../database/init.sql');
      const sqlContent = await readFile(sqlPath, 'utf-8');
      
      const client = await this.pool.connect();
      try {
        await client.query(sqlContent);
        console.log('✅ Database initialized successfully');
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw error;
    }
  }

  async checkDatabaseConnection(): Promise<boolean> {
    try {
      const client = await this.pool.connect();
      try {
        await client.query('SELECT 1');
        console.log('✅ Database connection verified');
        return true;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      return false;
    }
  }

  async createTestData(): Promise<void> {
    console.log('🔄 Creating test data...');
    
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Create test Farm Admin
      const farmAdminQuery = `
        INSERT INTO users (id, email, full_name, role, status, email_verified, profile_completed)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (email) DO NOTHING
      `;
      
      await client.query(farmAdminQuery, [
        '11111111-1111-1111-1111-111111111111',
        'farm.admin@test.com',
        'Test Farm Admin',
        'farm_admin',
        'active',
        true,
        true
      ]);

      // Create test Field Manager
      await client.query(farmAdminQuery, [
        '22222222-2222-2222-2222-222222222222',
        'field.manager@test.com',
        'Test Field Manager',
        'field_manager',
        'active',
        true,
        true
      ]);

      // Create test business relationship
      const relationshipQuery = `
        INSERT INTO business_relationships (
          id, farm_admin_id, service_provider_id, type, status, 
          established_date, permissions, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (farm_admin_id, service_provider_id, type) DO NOTHING
      `;
      
      await client.query(relationshipQuery, [
        '33333333-3333-3333-3333-333333333333',
        '11111111-1111-1111-1111-111111111111', // Farm Admin
        '22222222-2222-2222-2222-222222222222', // Field Manager
        'field_manager',
        'active',
        new Date(),
        JSON.stringify({
          canRead: ['field_operations', 'crop_data'],
          canWrite: ['field_operations']
        }),
        new Date(),
        new Date()
      ]);

      await client.query('COMMIT');
      console.log('✅ Test data created successfully');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Failed to create test data:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}