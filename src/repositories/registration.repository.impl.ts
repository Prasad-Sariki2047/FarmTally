import { Pool } from 'pg';
import { RegistrationRequest } from '../models';
import { ApprovalStatus } from '../models/common.types';
import { RegistrationRepository } from './registration.repository';
import { dbConnection } from '../config/database.config';

export class RegistrationRepositoryImpl implements RegistrationRepository {
  private pool: Pool;

  constructor() {
    this.pool = dbConnection.getPostgreSQLPool();
  }

  async create(request: RegistrationRequest): Promise<RegistrationRequest> {
    const client = await this.pool.connect();
    try {
      const query = `
        INSERT INTO registration_requests (
          id, user_data, status, submitted_at, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
      
      const values = [
        request.id,
        JSON.stringify(request.userData),
        request.status,
        request.submittedAt,
        request.createdAt,
        request.updatedAt
      ];

      const result = await client.query(query, values);
      return this.mapRowToRegistrationRequest(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async findById(id: string): Promise<RegistrationRequest | null> {
    const client = await this.pool.connect();
    try {
      const query = 'SELECT * FROM registration_requests WHERE id = $1';
      const result = await client.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.mapRowToRegistrationRequest(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async findByStatus(status: ApprovalStatus): Promise<RegistrationRequest[]> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT * FROM registration_requests 
        WHERE status = $1 
        ORDER BY submitted_at DESC
      `;
      const result = await client.query(query, [status]);
      
      return result.rows.map(row => this.mapRowToRegistrationRequest(row));
    } finally {
      client.release();
    }
  }

  async findByEmail(email: string): Promise<RegistrationRequest | null> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT * FROM registration_requests 
        WHERE user_data->>'email' = $1 
        ORDER BY created_at DESC 
        LIMIT 1
      `;
      const result = await client.query(query, [email.toLowerCase().trim()]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.mapRowToRegistrationRequest(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async update(id: string, updates: Partial<RegistrationRequest>): Promise<RegistrationRequest> {
    const client = await this.pool.connect();
    try {
      const setClause = [];
      const values = [];
      let paramIndex = 1;

      if (updates.status !== undefined) {
        setClause.push(`status = $${paramIndex++}`);
        values.push(updates.status);
      }
      
      if (updates.reviewedAt !== undefined) {
        setClause.push(`reviewed_at = $${paramIndex++}`);
        values.push(updates.reviewedAt);
      }
      
      if (updates.reviewedBy !== undefined) {
        setClause.push(`reviewed_by = $${paramIndex++}`);
        values.push(updates.reviewedBy);
      }
      
      if (updates.rejectionReason !== undefined) {
        setClause.push(`rejection_reason = $${paramIndex++}`);
        values.push(updates.rejectionReason);
      }

      setClause.push(`updated_at = $${paramIndex++}`);
      values.push(new Date());
      
      values.push(id);

      const query = `
        UPDATE registration_requests 
        SET ${setClause.join(', ')} 
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await client.query(query, values);
      
      if (result.rows.length === 0) {
        throw new Error('Registration request not found');
      }
      
      return this.mapRowToRegistrationRequest(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async delete(id: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      const query = 'DELETE FROM registration_requests WHERE id = $1';
      await client.query(query, [id]);
    } finally {
      client.release();
    }
  }

  async findAll(): Promise<RegistrationRequest[]> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT * FROM registration_requests 
        ORDER BY created_at DESC
      `;
      const result = await client.query(query);
      
      return result.rows.map(row => this.mapRowToRegistrationRequest(row));
    } finally {
      client.release();
    }
  }

  private mapRowToRegistrationRequest(row: any): RegistrationRequest {
    return {
      id: row.id,
      userData: JSON.parse(row.user_data),
      status: row.status as ApprovalStatus,
      submittedAt: row.submitted_at,
      reviewedAt: row.reviewed_at,
      reviewedBy: row.reviewed_by,
      rejectionReason: row.rejection_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}