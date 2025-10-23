# FarmTally Database Specification

## Document Overview

This document provides a comprehensive database specification for the FarmTally agricultural supply chain management platform. It defines the database architecture, schema designs, and data management strategies for all microservices in the system.

## Table of Contents

1. [Database Architecture Overview](#database-architecture-overview)
2. [Microservice Database Specifications](#microservice-database-specifications)
3. [Database Schema Definitions](#database-schema-definitions)
4. [Data Relationships and Constraints](#data-relationships-and-constraints)
5. [Performance and Optimization](#performance-and-optimization)
6. [Security and Compliance](#security-and-compliance)
7. [Backup and Recovery](#backup-and-recovery)
8. [Migration and Versioning](#migration-and-versioning)

---

## Database Architecture Overview

### Design Principles

- **Database per Microservice**: Each microservice owns its data and database
- **Polyglot Persistence**: Different database technologies for different use cases
- **Event-Driven Consistency**: Cross-service data consistency via events
- **ACID Compliance**: Strong consistency within service boundaries
- **Audit Trail**: Complete audit logging for compliance and debugging

### Technology Stack

| Database Type | Technology | Use Cases |
|---------------|------------|-----------|
| Relational | PostgreSQL | Transactional data, user management, financial records |
| Document | MongoDB | Flexible schemas, field operations, tracking data |
| Cache | Redis | Session management, real-time data, rate limiting |
| Analytics | ClickHouse | Time-series data, business intelligence, metrics |
| Search | Elasticsearch | Full-text search, log analysis (optional) |

### Cross-Service Data Strategy

- **No Direct Database Access**: Services communicate only via APIs
- **Event Sourcing**: Critical business events stored as immutable logs
- **Eventual Consistency**: Cross-service data synchronized via events
- **Saga Pattern**: Distributed transaction management
- **CQRS**: Command Query Responsibility Segregation for complex queries

---

## Microservice Database Specifications

### 1. User Management Service

**Database Name:** `farmtally_users`  
**Technology:** PostgreSQL 15+  
**Purpose:** User accounts, profiles, and role management

#### Tables Overview
- `users` - Core user account information
- `user_profiles` - Role-specific profile data
- `registration_requests` - Pending user registrations
- `user_sessions` - Active user sessions
- `user_preferences` - User customization settings
- `user_audit_logs` - User activity audit trail

#### Storage Requirements
- **Initial Size:** 1GB
- **Growth Rate:** ~100MB/month (estimated 1000 users/month)
- **Backup Frequency:** Daily full, hourly incremental

---

### 2. Authentication Service

**Database Name:** `farmtally_auth`  
**Technology:** PostgreSQL 15+ with encryption at rest  
**Purpose:** Authentication tokens, sessions, and security

#### Tables Overview
- `magic_links` - Magic link tokens and metadata
- `otp_codes` - One-time password management
- `social_auth_tokens` - OAuth provider tokens
- `authentication_sessions` - Session management
- `auth_audit_logs` - Authentication attempt logs
- `security_events` - Security-related events

#### Storage Requirements
- **Initial Size:** 500MB
- **Growth Rate:** ~50MB/month
- **Backup Frequency:** Daily full, real-time replication
- **Retention:** Auth logs 2 years, tokens 30 days

---

### 3. Approval Workflow Service

**Database Name:** `farmtally_approvals`  
**Technology:** PostgreSQL 15+  
**Purpose:** Approval workflows and decision tracking

#### Tables Overview
- `approval_workflows` - Workflow definitions
- `approval_requests` - Individual approval requests
- `approval_decisions` - Admin decisions and reasoning
- `workflow_history` - Complete approval audit trail
- `approval_notifications` - Notification tracking
- `workflow_templates` - Reusable workflow templates

#### Storage Requirements
- **Initial Size:** 200MB
- **Growth Rate:** ~20MB/month
- **Backup Frequency:** Daily full, hourly incremental

---

### 4. Business Relationship Service

**Database Name:** `farmtally_relationships`  
**Technology:** PostgreSQL 15+  
**Purpose:** Business partnerships and relationship management

#### Tables Overview
- `business_relationships` - Active business partnerships
- `relationship_requests` - Pending relationship requests
- `relationship_permissions` - Data sharing permissions
- `partnership_contracts` - Contract terms and conditions
- `relationship_history` - Relationship lifecycle tracking
- `invitations` - Partner and Field Manager invitations

#### Storage Requirements
- **Initial Size:** 300MB
- **Growth Rate:** ~30MB/month
- **Backup Frequency:** Daily full, hourly incremental

---

### 5. Role-Based Access Control (RBAC) Service

**Database Name:** `farmtally_permissions`  
**Technology:** PostgreSQL 15+  
**Purpose:** Permissions, roles, and access control

#### Tables Overview
- `roles` - Role definitions and hierarchies
- `permissions` - System permissions catalog
- `role_permissions` - Role-to-permission mappings
- `user_permissions` - User-specific permission overrides
- `resource_access_rules` - Resource-based access control
- `dashboard_configurations` - Role-specific dashboard configs

#### Storage Requirements
- **Initial Size:** 100MB
- **Growth Rate:** ~10MB/month
- **Backup Frequency:** Daily full, hourly incremental

---

### 6. Supply Chain Management Service

**Database Name:** `farmtally_supply_chain`  
**Technology:** PostgreSQL 15+ (primary) + MongoDB 6+ (flexible data)  
**Purpose:** Supply chain operations and tracking

#### PostgreSQL Tables
- `farms` - Farm information and locations
- `fields` - Field details and crop assignments
- `crop_cycles` - Crop lifecycle management
- `commodities` - Commodity production tracking
- `inventory_items` - Input and output inventory
- `delivery_schedules` - Logistics and delivery planning

#### MongoDB Collections
- `field_operations` - Flexible field activity tracking
- `supply_chain_events` - Event-driven supply chain updates
- `tracking_data` - Real-time location and status tracking
- `sensor_data` - IoT sensor data (future expansion)

#### Storage Requirements
- **PostgreSQL Initial Size:** 1GB
- **MongoDB Initial Size:** 2GB
- **Growth Rate:** ~200MB/month combined
- **Backup Frequency:** Daily full, hourly incremental

---

### 7. Communication & Notification Service

**Database Name:** `farmtally_communications`  
**Technology:** PostgreSQL 15+ + Redis 7+  
**Purpose:** Messaging, notifications, and communication

#### PostgreSQL Tables
- `notifications` - All system notifications
- `messages` - Inter-user messaging
- `email_logs` - Email delivery tracking
- `sms_logs` - SMS delivery tracking
- `communication_preferences` - User communication settings
- `document_sharing` - Shared document tracking

#### Redis Data Structures
- Real-time notification queues
- Message delivery status cache
- Communication rate limiting counters
- Active user presence tracking

#### Storage Requirements
- **PostgreSQL Initial Size:** 500MB
- **Redis Initial Size:** 100MB
- **Growth Rate:** ~100MB/month
- **Backup Frequency:** PostgreSQL daily, Redis snapshots every 6 hours

---

### 8. Transaction & Financial Service

**Database Name:** `farmtally_transactions`  
**Technology:** PostgreSQL 15+ with strict ACID compliance  
**Purpose:** Financial transactions and contract management

#### Tables Overview
- `transactions` - Financial transactions
- `purchase_orders` - Purchase order management
- `contracts` - Business contracts and agreements
- `payments` - Payment processing and tracking
- `invoices` - Invoice generation and management
- `financial_records` - Accounting and reconciliation
- `payment_methods` - Supported payment methods

#### Storage Requirements
- **Initial Size:** 500MB
- **Growth Rate:** ~75MB/month
- **Backup Frequency:** Real-time replication, daily full backup
- **Retention:** Financial records 7 years (compliance)

---

### 9. Analytics & Reporting Service

**Database Name:** `farmtally_analytics`  
**Technology:** PostgreSQL 15+ + ClickHouse 23+  
**Purpose:** Business intelligence and analytics

#### PostgreSQL Tables
- `reports` - Generated reports metadata
- `report_templates` - Report template definitions
- `analytics_jobs` - Scheduled analytics processing
- `business_metrics` - Key performance indicators
- `dashboard_widgets` - Dashboard configuration

#### ClickHouse Tables
- `user_activity_events` - User activity tracking
- `system_performance_metrics` - System performance data
- `business_intelligence_data` - Aggregated BI data
- `supply_chain_analytics` - Supply chain metrics

#### Storage Requirements
- **PostgreSQL Initial Size:** 200MB
- **ClickHouse Initial Size:** 1GB
- **Growth Rate:** ~500MB/month (ClickHouse heavy)
- **Backup Frequency:** PostgreSQL daily, ClickHouse weekly

---

### 10. Audit & Compliance Service

**Database Name:** `farmtally_audit`  
**Technology:** PostgreSQL 15+ with write-only tables  
**Purpose:** Audit trails and compliance monitoring

#### Tables Overview
- `audit_logs` - Complete system audit trail
- `compliance_checks` - Compliance monitoring results
- `data_access_logs` - Data access tracking
- `system_events` - System-level event logging
- `security_events` - Security-related event tracking
- `regulatory_reports` - Compliance reporting data

#### Storage Requirements
- **Initial Size:** 1GB
- **Growth Rate:** ~300MB/month
- **Backup Frequency:** Real-time replication, daily full backup
- **Retention:** 10 years (regulatory compliance)

---

## Database Schema Definitions

### User Management Service Schema

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role user_role_enum NOT NULL,
    status user_status_enum NOT NULL DEFAULT 'pending_approval',
    phone_number VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE,
    email_verified BOOLEAN DEFAULT FALSE,
    phone_verified BOOLEAN DEFAULT FALSE,
    profile_completed BOOLEAN DEFAULT FALSE
);

-- User profiles table for role-specific data
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    profile_data JSONB NOT NULL DEFAULT '{}',
    business_license VARCHAR(100),
    tax_id VARCHAR(50),
    address JSONB,
    emergency_contact JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Registration requests
CREATE TABLE registration_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    selected_role user_role_enum NOT NULL,
    profile_data JSONB NOT NULL DEFAULT '{}',
    status approval_status_enum NOT NULL DEFAULT 'pending',
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by UUID REFERENCES users(id),
    rejection_reason TEXT,
    verification_token VARCHAR(255),
    token_expires_at TIMESTAMP WITH TIME ZONE
);

-- User sessions
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    auth_method auth_method_enum NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT TRUE
);

-- User preferences
CREATE TABLE user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    preferences JSONB NOT NULL DEFAULT '{}',
    notification_settings JSONB NOT NULL DEFAULT '{}',
    dashboard_layout JSONB,
    language VARCHAR(10) DEFAULT 'en',
    timezone VARCHAR(50) DEFAULT 'UTC',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enums
CREATE TYPE user_role_enum AS ENUM (
    'app_admin',
    'farm_admin',
    'field_manager',
    'farmer',
    'lorry_agency',
    'field_equipment_manager',
    'input_supplier',
    'dealer'
);

CREATE TYPE user_status_enum AS ENUM (
    'pending_approval',
    'active',
    'suspended',
    'rejected',
    'inactive'
);

CREATE TYPE approval_status_enum AS ENUM (
    'pending',
    'approved',
    'rejected'
);

CREATE TYPE auth_method_enum AS ENUM (
    'magic_link',
    'otp_email',
    'otp_sms',
    'social_google'
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_registration_requests_status ON registration_requests(status);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token ON user_sessions(session_token);
```

### Authentication Service Schema

```sql
-- Magic links table
CREATE TABLE magic_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    purpose link_purpose_enum NOT NULL,
    user_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    ip_address INET,
    user_agent TEXT,
    is_used BOOLEAN DEFAULT FALSE
);

-- OTP codes table
CREATE TABLE otp_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier VARCHAR(255) NOT NULL, -- email or phone
    code VARCHAR(10) NOT NULL,
    delivery_method delivery_method_enum NOT NULL,
    purpose otp_purpose_enum NOT NULL,
    user_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    is_verified BOOLEAN DEFAULT FALSE
);

-- Social authentication tokens
CREATE TABLE social_auth_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    provider social_provider_enum NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    profile_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- Authentication sessions
CREATE TABLE authentication_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    auth_method auth_method_enum NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    device_fingerprint VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE
);

-- Authentication audit logs
CREATE TABLE auth_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    email VARCHAR(255),
    auth_method auth_method_enum,
    action auth_action_enum NOT NULL,
    success BOOLEAN NOT NULL,
    failure_reason TEXT,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    additional_data JSONB
);

-- Enums
CREATE TYPE link_purpose_enum AS ENUM (
    'registration',
    'login',
    'invitation',
    'password_reset'
);

CREATE TYPE delivery_method_enum AS ENUM (
    'email',
    'sms'
);

CREATE TYPE otp_purpose_enum AS ENUM (
    'login',
    'registration',
    'verification',
    'password_reset'
);

CREATE TYPE social_provider_enum AS ENUM (
    'google',
    'facebook',
    'apple'
);

CREATE TYPE auth_action_enum AS ENUM (
    'login_attempt',
    'login_success',
    'login_failure',
    'logout',
    'token_refresh',
    'password_reset',
    'account_locked',
    'account_unlocked'
);

-- Indexes
CREATE INDEX idx_magic_links_token ON magic_links(token);
CREATE INDEX idx_magic_links_email ON magic_links(email);
CREATE INDEX idx_otp_codes_identifier ON otp_codes(identifier);
CREATE INDEX idx_social_auth_user_id ON social_auth_tokens(user_id);
CREATE INDEX idx_auth_sessions_user_id ON authentication_sessions(user_id);
CREATE INDEX idx_auth_audit_user_id ON auth_audit_logs(user_id);
CREATE INDEX idx_auth_audit_created_at ON auth_audit_logs(created_at);
```

### Business Relationship Service Schema

```sql
-- Business relationships table
CREATE TABLE business_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_admin_id UUID NOT NULL,
    partner_id UUID NOT NULL,
    relationship_type relationship_type_enum NOT NULL,
    status relationship_status_enum NOT NULL DEFAULT 'pending',
    established_date TIMESTAMP WITH TIME ZONE,
    terminated_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID NOT NULL,
    terms_agreed BOOLEAN DEFAULT FALSE,
    contract_reference VARCHAR(100),
    notes TEXT,
    UNIQUE(farm_admin_id, partner_id, relationship_type)
);

-- Relationship requests table
CREATE TABLE relationship_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID NOT NULL,
    target_farm_admin_id UUID NOT NULL,
    relationship_type relationship_type_enum NOT NULL,
    status request_status_enum NOT NULL DEFAULT 'pending',
    message TEXT,
    proposed_terms JSONB,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    responded_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    response_message TEXT
);

-- Relationship permissions table
CREATE TABLE relationship_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    relationship_id UUID NOT NULL REFERENCES business_relationships(id) ON DELETE CASCADE,
    data_type VARCHAR(100) NOT NULL,
    access_level access_level_enum NOT NULL,
    restrictions JSONB DEFAULT '{}',
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    granted_by UUID NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE
);

-- Partnership contracts table
CREATE TABLE partnership_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    relationship_id UUID NOT NULL REFERENCES business_relationships(id) ON DELETE CASCADE,
    contract_type contract_type_enum NOT NULL,
    terms JSONB NOT NULL,
    effective_date DATE NOT NULL,
    expiry_date DATE,
    auto_renewal BOOLEAN DEFAULT FALSE,
    renewal_period INTEGER, -- in days
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    signed_by_farm_admin TIMESTAMP WITH TIME ZONE,
    signed_by_partner TIMESTAMP WITH TIME ZONE,
    contract_status contract_status_enum DEFAULT 'draft'
);

-- Invitations table
CREATE TABLE invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inviter_id UUID NOT NULL,
    invitee_email VARCHAR(255) NOT NULL,
    invitation_type invitation_type_enum NOT NULL,
    status invitation_status_enum NOT NULL DEFAULT 'pending',
    invitation_token VARCHAR(255) UNIQUE NOT NULL,
    message TEXT,
    metadata JSONB DEFAULT '{}',
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    declined_at TIMESTAMP WITH TIME ZONE
);

-- Relationship history table
CREATE TABLE relationship_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    relationship_id UUID NOT NULL REFERENCES business_relationships(id) ON DELETE CASCADE,
    action history_action_enum NOT NULL,
    performed_by UUID NOT NULL,
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    details JSONB DEFAULT '{}',
    previous_status relationship_status_enum,
    new_status relationship_status_enum
);

-- Enums
CREATE TYPE relationship_type_enum AS ENUM (
    'field_manager',
    'farmer_supplier',
    'lorry_agency',
    'equipment_provider',
    'input_supplier',
    'dealer'
);

CREATE TYPE relationship_status_enum AS ENUM (
    'pending',
    'active',
    'suspended',
    'terminated',
    'expired'
);

CREATE TYPE request_status_enum AS ENUM (
    'pending',
    'approved',
    'rejected',
    'expired',
    'withdrawn'
);

CREATE TYPE access_level_enum AS ENUM (
    'read_only',
    'read_write',
    'full_access',
    'restricted'
);

CREATE TYPE contract_type_enum AS ENUM (
    'service_agreement',
    'supply_contract',
    'transportation_agreement',
    'equipment_lease',
    'commodity_purchase'
);

CREATE TYPE contract_status_enum AS ENUM (
    'draft',
    'pending_signature',
    'active',
    'expired',
    'terminated'
);

CREATE TYPE invitation_type_enum AS ENUM (
    'field_manager',
    'business_partner',
    'system_user'
);

CREATE TYPE invitation_status_enum AS ENUM (
    'pending',
    'accepted',
    'declined',
    'expired'
);

CREATE TYPE history_action_enum AS ENUM (
    'created',
    'approved',
    'rejected',
    'activated',
    'suspended',
    'terminated',
    'renewed',
    'modified'
);

-- Indexes
CREATE INDEX idx_business_relationships_farm_admin ON business_relationships(farm_admin_id);
CREATE INDEX idx_business_relationships_partner ON business_relationships(partner_id);
CREATE INDEX idx_relationship_requests_target ON relationship_requests(target_farm_admin_id);
CREATE INDEX idx_relationship_permissions_relationship ON relationship_permissions(relationship_id);
CREATE INDEX idx_invitations_token ON invitations(invitation_token);
CREATE INDEX idx_invitations_email ON invitations(invitee_email);
```

### Supply Chain Management Service Schema

#### PostgreSQL Schema

```sql
-- Farms table
CREATE TABLE farms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_admin_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    location JSONB NOT NULL, -- coordinates, address
    total_area DECIMAL(10,2), -- in hectares
    soil_type VARCHAR(100),
    climate_zone VARCHAR(100),
    certification_details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- Fields table
CREATE TABLE fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    field_number VARCHAR(50) NOT NULL,
    name VARCHAR(255),
    area DECIMAL(10,2) NOT NULL, -- in hectares
    soil_characteristics JSONB,
    irrigation_system VARCHAR(100),
    location_coordinates JSONB,
    current_status field_status_enum DEFAULT 'available',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(farm_id, field_number)
);

-- Crop cycles table
CREATE TABLE crop_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    field_id UUID NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
    crop_type VARCHAR(100) NOT NULL,
    crop_variety VARCHAR(100),
    planting_date DATE NOT NULL,
    expected_harvest_date DATE NOT NULL,
    actual_harvest_date DATE,
    status crop_cycle_status_enum DEFAULT 'planned',
    estimated_yield DECIMAL(10,2),
    actual_yield DECIMAL(10,2),
    quality_grade VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Commodities table
CREATE TABLE commodities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    crop_cycle_id UUID NOT NULL REFERENCES crop_cycles(id) ON DELETE CASCADE,
    commodity_type VARCHAR(100) NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    quality_grade VARCHAR(50),
    harvest_date DATE,
    storage_location VARCHAR(255),
    status commodity_status_enum DEFAULT 'harvested',
    market_price DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'USD',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inventory items table
CREATE TABLE inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    item_type inventory_type_enum NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    current_quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
    unit VARCHAR(20) NOT NULL,
    minimum_threshold DECIMAL(10,2),
    maximum_capacity DECIMAL(10,2),
    unit_cost DECIMAL(10,2),
    supplier_info JSONB,
    storage_conditions JSONB,
    expiry_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Delivery schedules table
CREATE TABLE delivery_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    commodity_id UUID NOT NULL REFERENCES commodities(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL,
    lorry_agency_id UUID,
    pickup_location JSONB NOT NULL,
    delivery_location JSONB NOT NULL,
    scheduled_pickup_date TIMESTAMP WITH TIME ZONE NOT NULL,
    scheduled_delivery_date TIMESTAMP WITH TIME ZONE NOT NULL,
    actual_pickup_date TIMESTAMP WITH TIME ZONE,
    actual_delivery_date TIMESTAMP WITH TIME ZONE,
    status delivery_status_enum DEFAULT 'scheduled',
    transportation_cost DECIMAL(10,2),
    special_requirements TEXT,
    tracking_number VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enums
CREATE TYPE field_status_enum AS ENUM (
    'available',
    'planted',
    'growing',
    'ready_for_harvest',
    'harvested',
    'fallow',
    'maintenance'
);

CREATE TYPE crop_cycle_status_enum AS ENUM (
    'planned',
    'planted',
    'growing',
    'flowering',
    'maturing',
    'ready_for_harvest',
    'harvested',
    'completed',
    'failed'
);

CREATE TYPE commodity_status_enum AS ENUM (
    'harvested',
    'stored',
    'quality_tested',
    'ready_for_sale',
    'sold',
    'in_transit',
    'delivered'
);

CREATE TYPE inventory_type_enum AS ENUM (
    'seeds',
    'fertilizers',
    'pesticides',
    'equipment',
    'fuel',
    'packaging_materials',
    'harvested_commodities'
);

CREATE TYPE delivery_status_enum AS ENUM (
    'scheduled',
    'confirmed',
    'in_transit',
    'delivered',
    'cancelled',
    'delayed'
);

-- Indexes
CREATE INDEX idx_farms_admin_id ON farms(farm_admin_id);
CREATE INDEX idx_fields_farm_id ON fields(farm_id);
CREATE INDEX idx_crop_cycles_field_id ON crop_cycles(field_id);
CREATE INDEX idx_commodities_crop_cycle_id ON commodities(crop_cycle_id);
CREATE INDEX idx_inventory_farm_id ON inventory_items(farm_id);
CREATE INDEX idx_delivery_schedules_commodity_id ON delivery_schedules(commodity_id);
```

#### MongoDB Schema (Document Collections)

```javascript
// Field Operations Collection
{
  _id: ObjectId,
  fieldId: UUID,
  operationType: String, // "planting", "irrigation", "fertilization", "pest_control", "harvest"
  operationDate: Date,
  performedBy: UUID,
  details: {
    equipment: [String],
    materials: [{
      name: String,
      quantity: Number,
      unit: String
    }],
    weather: {
      temperature: Number,
      humidity: Number,
      rainfall: Number
    },
    notes: String,
    photos: [String], // URLs to photos
    gpsCoordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  results: {
    areaCompleted: Number,
    timeSpent: Number,
    costIncurred: Number,
    qualityRating: Number
  },
  createdAt: Date,
  updatedAt: Date
}

// Supply Chain Events Collection
{
  _id: ObjectId,
  eventType: String, // "commodity_ready", "pickup_scheduled", "in_transit", "delivered"
  entityId: UUID, // commodity, delivery, etc.
  entityType: String,
  timestamp: Date,
  location: {
    latitude: Number,
    longitude: Number,
    address: String
  },
  data: {
    // Flexible event-specific data
  },
  participants: [UUID],
  metadata: {
    source: String,
    version: String,
    correlationId: String
  }
}

// Tracking Data Collection
{
  _id: ObjectId,
  trackingId: String,
  entityId: UUID,
  entityType: String, // "delivery", "commodity", "equipment"
  currentLocation: {
    latitude: Number,
    longitude: Number,
    address: String,
    timestamp: Date
  },
  status: String,
  route: [{
    latitude: Number,
    longitude: Number,
    timestamp: Date,
    speed: Number,
    heading: Number
  }],
  milestones: [{
    name: String,
    expectedTime: Date,
    actualTime: Date,
    status: String
  }],
  sensors: {
    temperature: Number,
    humidity: Number,
    vibration: Number,
    // Other sensor data
  },
  createdAt: Date,
  updatedAt: Date
}
```

### Communication Service Schema

```sql
-- Notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID NOT NULL,
    sender_id UUID,
    notification_type notification_type_enum NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    delivery_method delivery_method_enum NOT NULL,
    priority priority_level_enum DEFAULT 'normal',
    status notification_status_enum DEFAULT 'pending',
    scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages table
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL,
    recipient_id UUID NOT NULL,
    thread_id UUID,
    subject VARCHAR(255),
    content TEXT NOT NULL,
    message_type message_type_enum DEFAULT 'direct',
    attachments JSONB DEFAULT '[]',
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    is_encrypted BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}'
);

-- Email logs table
CREATE TABLE email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID REFERENCES notifications(id),
    recipient_email VARCHAR(255) NOT NULL,
    sender_email VARCHAR(255),
    subject VARCHAR(255) NOT NULL,
    template_id VARCHAR(100),
    provider VARCHAR(50),
    provider_message_id VARCHAR(255),
    status email_status_enum DEFAULT 'queued',
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    opened_at TIMESTAMP WITH TIME ZONE,
    clicked_at TIMESTAMP WITH TIME ZONE,
    bounced_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SMS logs table
CREATE TABLE sms_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID REFERENCES notifications(id),
    recipient_phone VARCHAR(20) NOT NULL,
    message_content TEXT NOT NULL,
    provider VARCHAR(50),
    provider_message_id VARCHAR(255),
    status sms_status_enum DEFAULT 'queued',
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    cost DECIMAL(8,4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Communication preferences table
CREATE TABLE communication_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    email_notifications BOOLEAN DEFAULT TRUE,
    sms_notifications BOOLEAN DEFAULT TRUE,
    push_notifications BOOLEAN DEFAULT TRUE,
    notification_types JSONB DEFAULT '{}', -- per-type preferences
    quiet_hours JSONB DEFAULT '{}', -- start/end times
    frequency_limits JSONB DEFAULT '{}', -- rate limiting per type
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Document sharing table
CREATE TABLE document_sharing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL,
    owner_id UUID NOT NULL,
    shared_with_id UUID NOT NULL,
    access_level doc_access_level_enum NOT NULL,
    shared_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    accessed_at TIMESTAMP WITH TIME ZONE,
    download_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE
);

-- Enums
CREATE TYPE notification_type_enum AS ENUM (
    'registration_approved',
    'registration_rejected',
    'relationship_request',
    'relationship_approved',
    'delivery_scheduled',
    'payment_received',
    'system_alert',
    'reminder'
);

CREATE TYPE priority_level_enum AS ENUM (
    'low',
    'normal',
    'high',
    'urgent'
);

CREATE TYPE notification_status_enum AS ENUM (
    'pending',
    'sent',
    'delivered',
    'read',
    'failed'
);

CREATE TYPE message_type_enum AS ENUM (
    'direct',
    'broadcast',
    'system'
);

CREATE TYPE email_status_enum AS ENUM (
    'queued',
    'sent',
    'delivered',
    'opened',
    'clicked',
    'bounced',
    'failed'
);

CREATE TYPE sms_status_enum AS ENUM (
    'queued',
    'sent',
    'delivered',
    'failed'
);

CREATE TYPE doc_access_level_enum AS ENUM (
    'view',
    'comment',
    'edit',
    'full'
);

-- Indexes
CREATE INDEX idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX idx_notifications_type ON notifications(notification_type);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_recipient ON messages(recipient_id);
CREATE INDEX idx_messages_thread ON messages(thread_id);
CREATE INDEX idx_email_logs_recipient ON email_logs(recipient_email);
CREATE INDEX idx_sms_logs_recipient ON sms_logs(recipient_phone);
```

---

## Data Relationships and Constraints

### Cross-Service Data Relationships

Since each microservice has its own database, relationships across services are maintained through:

1. **Foreign Key References**: Using UUIDs to reference entities in other services
2. **Event-Driven Synchronization**: Changes propagated via events
3. **API-Based Validation**: Cross-service data validation via API calls
4. **Eventual Consistency**: Data consistency achieved over time

### Key Relationship Patterns

#### User-Centric Relationships
```
User Management Service (users.id) 
    ↓ (referenced by)
All Other Services (user_id fields)
```

#### Business Relationship Flow
```
Business Relationship Service (business_relationships.id)
    ↓ (enables)
Supply Chain Service (farm operations)
    ↓ (generates)
Transaction Service (financial transactions)
    ↓ (triggers)
Communication Service (notifications)
```

### Data Integrity Constraints

#### Within Service Constraints
- **Primary Keys**: All tables use UUID primary keys
- **Foreign Keys**: Enforced within service boundaries
- **Unique Constraints**: Email addresses, tokens, business relationships
- **Check Constraints**: Data validation rules
- **Not Null Constraints**: Required fields enforcement

#### Cross-Service Constraints
- **API Validation**: Cross-service data validation
- **Event Validation**: Event payload validation
- **Compensating Transactions**: Rollback mechanisms for distributed transactions

---

## Performance and Optimization

### Database Performance Strategy

#### Indexing Strategy
```sql
-- Primary indexes (automatically created)
-- All primary keys (UUID)
-- All foreign keys

-- Secondary indexes for common queries
CREATE INDEX CONCURRENTLY idx_users_email_status ON users(email, status);
CREATE INDEX CONCURRENTLY idx_notifications_recipient_type ON notifications(recipient_id, notification_type);
CREATE INDEX CONCURRENTLY idx_audit_logs_user_timestamp ON audit_logs(user_id, created_at);

-- Partial indexes for specific conditions
CREATE INDEX CONCURRENTLY idx_active_sessions ON user_sessions(user_id) WHERE is_active = true;
CREATE INDEX CONCURRENTLY idx_pending_approvals ON registration_requests(status) WHERE status = 'pending';

-- Composite indexes for complex queries
CREATE INDEX CONCURRENTLY idx_relationships_farm_partner_type ON business_relationships(farm_admin_id, partner_id, relationship_type);
```

#### Query Optimization
- **Connection Pooling**: PgBouncer for PostgreSQL connections
- **Read Replicas**: Separate read replicas for reporting queries
- **Query Caching**: Redis caching for frequently accessed data
- **Prepared Statements**: Parameterized queries for better performance

#### Partitioning Strategy
```sql
-- Partition audit logs by month
CREATE TABLE audit_logs (
    id UUID DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- other columns
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE audit_logs_2024_01 PARTITION OF audit_logs
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

### Caching Strategy

#### Redis Caching Layers
```
Application Cache:
- User sessions (30 minutes TTL)
- User permissions (15 minutes TTL)
- Dashboard data (5 minutes TTL)

Database Query Cache:
- Frequently accessed reference data (1 hour TTL)
- User profile data (30 minutes TTL)
- Business relationship data (15 minutes TTL)

Rate Limiting:
- API request counters (1 minute sliding window)
- Authentication attempts (15 minutes TTL)
- Notification delivery limits (1 hour TTL)
```

### Monitoring and Metrics

#### Database Metrics
- **Connection Pool Usage**: Monitor connection utilization
- **Query Performance**: Slow query identification and optimization
- **Index Usage**: Monitor index effectiveness
- **Disk Usage**: Storage growth tracking
- **Replication Lag**: Monitor read replica synchronization

#### Performance Thresholds
```
Response Time Targets:
- Simple queries: < 10ms
- Complex queries: < 100ms
- Report generation: < 5 seconds
- Bulk operations: < 30 seconds

Availability Targets:
- Database uptime: 99.9%
- Backup success rate: 100%
- Recovery time objective (RTO): < 4 hours
- Recovery point objective (RPO): < 1 hour
```

---

## Security and Compliance

### Data Security Measures

#### Encryption
```sql
-- Enable encryption at rest
ALTER SYSTEM SET ssl = on;
ALTER SYSTEM SET ssl_cert_file = 'server.crt';
ALTER SYSTEM SET ssl_key_file = 'server.key';

-- Encrypt sensitive columns
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Example: Encrypt PII data
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    encrypted_ssn TEXT, -- pgp_sym_encrypt(ssn, 'encryption_key')
    encrypted_phone TEXT -- pgp_sym_encrypt(phone, 'encryption_key')
);
```

#### Access Control
```sql
-- Database roles and permissions
CREATE ROLE farmtally_app_user;
CREATE ROLE farmtally_read_only;
CREATE ROLE farmtally_admin;

-- Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO farmtally_app_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO farmtally_read_only;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO farmtally_admin;

-- Row Level Security (RLS)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_profile_policy ON user_profiles
    FOR ALL TO farmtally_app_user
    USING (user_id = current_setting('app.current_user_id')::UUID);
```

### Compliance Requirements

#### Data Retention Policies
```sql
-- Automated data retention
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
    -- Delete old audit logs (keep 7 years)
    DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '7 years';
    
    -- Delete old session data (keep 90 days)
    DELETE FROM user_sessions WHERE created_at < NOW() - INTERVAL '90 days';
    
    -- Archive old notifications (keep 1 year)
    INSERT INTO notifications_archive SELECT * FROM notifications 
    WHERE created_at < NOW() - INTERVAL '1 year';
    DELETE FROM notifications WHERE created_at < NOW() - INTERVAL '1 year';
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup job
SELECT cron.schedule('cleanup-old-data', '0 2 * * 0', 'SELECT cleanup_old_data();');
```

#### Audit Trail Requirements
```sql
-- Audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (table_name, operation, new_data, user_id, created_at)
        VALUES (TG_TABLE_NAME, 'INSERT', row_to_json(NEW), 
                current_setting('app.current_user_id', true)::UUID, NOW());
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (table_name, operation, old_data, new_data, user_id, created_at)
        VALUES (TG_TABLE_NAME, 'UPDATE', row_to_json(OLD), row_to_json(NEW),
                current_setting('app.current_user_id', true)::UUID, NOW());
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (table_name, operation, old_data, user_id, created_at)
        VALUES (TG_TABLE_NAME, 'DELETE', row_to_json(OLD),
                current_setting('app.current_user_id', true)::UUID, NOW());
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Apply audit triggers to sensitive tables
CREATE TRIGGER users_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
```

---

## Backup and Recovery

### Backup Strategy

#### PostgreSQL Backup Configuration
```bash
# Continuous archiving setup
archive_mode = on
archive_command = 'cp %p /backup/archive/%f'
wal_level = replica

# Base backup script
#!/bin/bash
pg_basebackup -D /backup/base/$(date +%Y%m%d_%H%M%S) \
              -Ft -z -P -U backup_user \
              -h localhost -p 5432
```

#### Backup Schedule
```
Daily Full Backups:
- All PostgreSQL databases: 2:00 AM UTC
- MongoDB collections: 2:30 AM UTC
- Redis snapshots: 3:00 AM UTC

Hourly Incremental Backups:
- PostgreSQL WAL files: Every hour
- MongoDB oplog: Every hour

Weekly Archive:
- Full system backup to cold storage
- Backup verification and testing
```

### Recovery Procedures

#### Point-in-Time Recovery
```bash
# PostgreSQL PITR
pg_ctl stop -D /var/lib/postgresql/data
rm -rf /var/lib/postgresql/data/*
pg_basebackup -D /var/lib/postgresql/data -U backup_user
echo "restore_command = 'cp /backup/archive/%f %p'" >> /var/lib/postgresql/data/recovery.conf
echo "recovery_target_time = '2024-01-15 14:30:00'" >> /var/lib/postgresql/data/recovery.conf
pg_ctl start -D /var/lib/postgresql/data
```

#### Disaster Recovery Plan
```
RTO (Recovery Time Objective): 4 hours
RPO (Recovery Point Objective): 1 hour

Recovery Steps:
1. Assess damage and determine recovery scope
2. Restore from most recent backup
3. Apply incremental changes from logs
4. Verify data integrity
5. Resume application services
6. Notify stakeholders of recovery completion
```

---

## Migration and Versioning

### Database Migration Strategy

#### Migration Framework
```sql
-- Migration tracking table
CREATE TABLE schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    description TEXT,
    checksum VARCHAR(64)
);

-- Example migration script
-- Migration: 001_create_users_table.sql
BEGIN;

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    -- other columns
);

INSERT INTO schema_migrations (version, description, checksum)
VALUES ('001', 'Create users table', 'abc123def456');

COMMIT;
```

#### Version Control Strategy
```
Migration Naming Convention:
- Format: {version}_{description}.sql
- Example: 001_create_users_table.sql
- Example: 002_add_user_preferences.sql

Migration Rules:
1. Never modify existing migrations
2. Always use transactions for migrations
3. Include rollback scripts for each migration
4. Test migrations on staging before production
5. Backup database before major migrations
```

### Schema Evolution

#### Backward Compatibility
```sql
-- Adding new columns (backward compatible)
ALTER TABLE users ADD COLUMN phone_verified BOOLEAN DEFAULT FALSE;

-- Renaming columns (requires application changes)
-- Step 1: Add new column
ALTER TABLE users ADD COLUMN full_name VARCHAR(255);
-- Step 2: Populate new column
UPDATE users SET full_name = first_name || ' ' || last_name;
-- Step 3: Drop old columns (after application update)
ALTER TABLE users DROP COLUMN first_name, DROP COLUMN last_name;
```

#### Data Migration Scripts
```sql
-- Example: Migrate user roles to new enum
DO $$
DECLARE
    user_record RECORD;
BEGIN
    FOR user_record IN SELECT id, old_role FROM users WHERE old_role IS NOT NULL
    LOOP
        UPDATE users 
        SET role = CASE 
            WHEN user_record.old_role = 'admin' THEN 'app_admin'::user_role_enum
            WHEN user_record.old_role = 'farmer' THEN 'farm_admin'::user_role_enum
            ELSE 'farmer'::user_role_enum
        END
        WHERE id = user_record.id;
    END LOOP;
END $$;
```

### Deployment Strategy

#### Blue-Green Deployment
```
Blue Environment (Current):
- Production database with current schema
- Application version N

Green Environment (New):
- Updated database with new schema
- Application version N+1

Deployment Process:
1. Apply migrations to green environment
2. Test application with new schema
3. Switch traffic to green environment
4. Monitor for issues
5. Rollback to blue if problems occur
```

#### Zero-Downtime Migrations
```sql
-- Example: Adding a new index without blocking
CREATE INDEX CONCURRENTLY idx_users_email_status ON users(email, status);

-- Example: Adding a new column with default
ALTER TABLE users ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Example: Dropping a column safely
-- Step 1: Stop using column in application
-- Step 2: Wait for all transactions to complete
-- Step 3: Drop column
ALTER TABLE users DROP COLUMN old_column;
```

---

## Conclusion

This database specification provides a comprehensive foundation for the FarmTally agricultural supply chain management platform. The design emphasizes:

- **Scalability**: Each microservice has its own database for independent scaling
- **Security**: Comprehensive security measures including encryption and access control
- **Compliance**: Audit trails and data retention policies for regulatory compliance
- **Performance**: Optimized indexing and caching strategies
- **Reliability**: Robust backup and recovery procedures

The specification should be reviewed and updated as the system evolves and new requirements emerge.