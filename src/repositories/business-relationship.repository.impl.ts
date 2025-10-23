import { Pool } from 'pg';
import { BusinessRelationship, Invitation } from '../models';
import { RelationshipType, RelationshipStatus, InvitationStatus } from '../models/common.types';
import { BusinessRelationshipRepository } from './business-relationship.repository';
import { dbConnection } from '../config/database.config';

export class BusinessRelationshipRepositoryImpl implements BusinessRelationshipRepository {
  private pool: Pool;

  constructor() {
    this.pool = dbConnection.getPostgreSQLPool();
  }

  async createRelationship(relationship: BusinessRelationship): Promise<BusinessRelationship> {
    const client = await this.pool.connect();
    try {
      const query = `
        INSERT INTO business_relationships (
          id, farm_admin_id, service_provider_id, type, status, 
          established_date, permissions, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;
      
      const values = [
        relationship.id,
        relationship.farmAdminId,
        relationship.serviceProviderId,
        relationship.type,
        relationship.status,
        relationship.establishedDate,
        JSON.stringify(relationship.permissions),
        relationship.createdAt,
        relationship.updatedAt
      ];

      const result = await client.query(query, values);
      return this.mapRowToBusinessRelationship(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async findRelationshipById(id: string): Promise<BusinessRelationship | null> {
    const client = await this.pool.connect();
    try {
      const query = 'SELECT * FROM business_relationships WHERE id = $1';
      const result = await client.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.mapRowToBusinessRelationship(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async findRelationshipsByFarmAdmin(farmAdminId: string): Promise<BusinessRelationship[]> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT * FROM business_relationships 
        WHERE farm_admin_id = $1 
        ORDER BY created_at DESC
      `;
      const result = await client.query(query, [farmAdminId]);
      
      return result.rows.map(row => this.mapRowToBusinessRelationship(row));
    } finally {
      client.release();
    }
  } 
 async findRelationshipsByServiceProvider(serviceProviderId: string): Promise<BusinessRelationship[]> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT * FROM business_relationships 
        WHERE service_provider_id = $1 
        ORDER BY created_at DESC
      `;
      const result = await client.query(query, [serviceProviderId]);
      
      return result.rows.map(row => this.mapRowToBusinessRelationship(row));
    } finally {
      client.release();
    }
  }

  async findRelationshipsByType(type: RelationshipType): Promise<BusinessRelationship[]> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT * FROM business_relationships 
        WHERE type = $1 
        ORDER BY created_at DESC
      `;
      const result = await client.query(query, [type]);
      
      return result.rows.map(row => this.mapRowToBusinessRelationship(row));
    } finally {
      client.release();
    }
  }

  async findRelationshipsByStatus(status: RelationshipStatus): Promise<BusinessRelationship[]> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT * FROM business_relationships 
        WHERE status = $1 
        ORDER BY created_at DESC
      `;
      const result = await client.query(query, [status]);
      
      return result.rows.map(row => this.mapRowToBusinessRelationship(row));
    } finally {
      client.release();
    }
  }

  async updateRelationship(id: string, updates: Partial<BusinessRelationship>): Promise<BusinessRelationship> {
    const client = await this.pool.connect();
    try {
      const setClause = [];
      const values = [];
      let paramIndex = 1;

      if (updates.status !== undefined) {
        setClause.push(`status = $${paramIndex++}`);
        values.push(updates.status);
      }
      
      if (updates.establishedDate !== undefined) {
        setClause.push(`established_date = $${paramIndex++}`);
        values.push(updates.establishedDate);
      }
      
      if (updates.terminatedDate !== undefined) {
        setClause.push(`terminated_date = $${paramIndex++}`);
        values.push(updates.terminatedDate);
      }
      
      if (updates.permissions !== undefined) {
        setClause.push(`permissions = $${paramIndex++}`);
        values.push(JSON.stringify(updates.permissions));
      }

      setClause.push(`updated_at = $${paramIndex++}`);
      values.push(new Date());
      
      values.push(id);

      const query = `
        UPDATE business_relationships 
        SET ${setClause.join(', ')} 
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await client.query(query, values);
      
      if (result.rows.length === 0) {
        throw new Error('Relationship not found');
      }
      
      return this.mapRowToBusinessRelationship(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async deleteRelationship(id: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      const query = 'DELETE FROM business_relationships WHERE id = $1';
      await client.query(query, [id]);
    } finally {
      client.release();
    }
  }

  // Invitation methods
  async createInvitation(invitation: Invitation): Promise<Invitation> {
    const client = await this.pool.connect();
    try {
      const query = `
        INSERT INTO invitations (
          id, inviter_id, invitee_email, invitee_role, relationship_type,
          status, magic_link_token, expires_at, sent_at, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;
      
      const values = [
        invitation.id,
        invitation.inviterId,
        invitation.inviteeEmail,
        invitation.inviteeRole,
        invitation.relationshipType,
        invitation.status,
        invitation.magicLinkToken,
        invitation.expiresAt,
        invitation.sentAt,
        invitation.createdAt,
        invitation.updatedAt
      ];

      const result = await client.query(query, values);
      return this.mapRowToInvitation(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async findInvitationById(id: string): Promise<Invitation | null> {
    const client = await this.pool.connect();
    try {
      const query = 'SELECT * FROM invitations WHERE id = $1';
      const result = await client.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.mapRowToInvitation(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async findInvitationByToken(token: string): Promise<Invitation | null> {
    const client = await this.pool.connect();
    try {
      const query = 'SELECT * FROM invitations WHERE magic_link_token = $1';
      const result = await client.query(query, [token]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.mapRowToInvitation(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async findInvitationsByInviter(inviterId: string): Promise<Invitation[]> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT * FROM invitations 
        WHERE inviter_id = $1 
        ORDER BY created_at DESC
      `;
      const result = await client.query(query, [inviterId]);
      
      return result.rows.map(row => this.mapRowToInvitation(row));
    } finally {
      client.release();
    }
  }  
async findInvitationsByEmail(email: string): Promise<Invitation[]> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT * FROM invitations 
        WHERE invitee_email = $1 
        ORDER BY created_at DESC
      `;
      const result = await client.query(query, [email]);
      
      return result.rows.map(row => this.mapRowToInvitation(row));
    } finally {
      client.release();
    }
  }

  async findInvitationsByStatus(status: InvitationStatus): Promise<Invitation[]> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT * FROM invitations 
        WHERE status = $1 
        ORDER BY created_at DESC
      `;
      const result = await client.query(query, [status]);
      
      return result.rows.map(row => this.mapRowToInvitation(row));
    } finally {
      client.release();
    }
  }

  async updateInvitation(id: string, updates: Partial<Invitation>): Promise<Invitation> {
    const client = await this.pool.connect();
    try {
      const setClause = [];
      const values = [];
      let paramIndex = 1;

      if (updates.status !== undefined) {
        setClause.push(`status = $${paramIndex++}`);
        values.push(updates.status);
      }
      
      if (updates.acceptedAt !== undefined) {
        setClause.push(`accepted_at = $${paramIndex++}`);
        values.push(updates.acceptedAt);
      }

      setClause.push(`updated_at = $${paramIndex++}`);
      values.push(new Date());
      
      values.push(id);

      const query = `
        UPDATE invitations 
        SET ${setClause.join(', ')} 
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await client.query(query, values);
      
      if (result.rows.length === 0) {
        throw new Error('Invitation not found');
      }
      
      return this.mapRowToInvitation(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async deleteInvitation(id: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      const query = 'DELETE FROM invitations WHERE id = $1';
      await client.query(query, [id]);
    } finally {
      client.release();
    }
  }

  // Helper methods to map database rows to domain objects
  private mapRowToBusinessRelationship(row: any): BusinessRelationship {
    return {
      id: row.id,
      farmAdminId: row.farm_admin_id,
      serviceProviderId: row.service_provider_id,
      type: row.type as RelationshipType,
      status: row.status as RelationshipStatus,
      establishedDate: row.established_date,
      terminatedDate: row.terminated_date,
      permissions: row.permissions ? JSON.parse(row.permissions) : {},
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapRowToInvitation(row: any): Invitation {
    return {
      id: row.id,
      inviterId: row.inviter_id,
      inviteeEmail: row.invitee_email,
      inviteeRole: row.invitee_role,
      relationshipType: row.relationship_type as RelationshipType,
      status: row.status as InvitationStatus,
      magicLinkToken: row.magic_link_token,
      expiresAt: row.expires_at,
      sentAt: row.sent_at,
      acceptedAt: row.accepted_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}