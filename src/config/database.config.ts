import { Pool, PoolConfig } from 'pg';
import { createClient, RedisClientType } from 'redis';
import * as dotenv from 'dotenv';

dotenv.config();

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  maxConnections?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

export class DatabaseConnection {
  private static instance: DatabaseConnection;
  private pgPool: Pool | null = null;
  private redisClient: RedisClientType | null = null;

  private constructor() {}

  static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  async initializePostgreSQL(): Promise<Pool> {
    if (this.pgPool) {
      return this.pgPool;
    }

    const config: PoolConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'farmtally_users',
      user: process.env.DB_USER || 'farmtally_user',
      password: process.env.DB_PASSWORD || 'password',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      max: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000'),
    };

    this.pgPool = new Pool(config);

    // Test connection
    try {
      const client = await this.pgPool.connect();
      console.log('✅ PostgreSQL connection established successfully');
      client.release();
    } catch (error) {
      console.error('❌ Failed to connect to PostgreSQL:', error);
      throw error;
    }

    return this.pgPool;
  }

  async initializeRedis(): Promise<RedisClientType> {
    if (this.redisClient) {
      return this.redisClient;
    }

    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    this.redisClient = createClient({
      url: redisUrl,
      socket: {
        connectTimeout: 5000,
      },
    });

    this.redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    this.redisClient.on('connect', () => {
      console.log('✅ Redis connection established successfully');
    });

    await this.redisClient.connect();
    return this.redisClient;
  }

  getPostgreSQLPool(): Pool {
    if (!this.pgPool) {
      throw new Error('PostgreSQL not initialized. Call initializePostgreSQL() first.');
    }
    return this.pgPool;
  }

  getRedisClient(): RedisClientType {
    if (!this.redisClient) {
      throw new Error('Redis not initialized. Call initializeRedis() first.');
    }
    return this.redisClient;
  }

  async closeConnections(): Promise<void> {
    if (this.pgPool) {
      await this.pgPool.end();
      this.pgPool = null;
      console.log('PostgreSQL connection closed');
    }

    if (this.redisClient) {
      await this.redisClient.quit();
      this.redisClient = null;
      console.log('Redis connection closed');
    }
  }
}

export const dbConnection = DatabaseConnection.getInstance();