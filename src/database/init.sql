-- FarmTally Database Initialization Script
-- This script creates the necessary tables for the User Role Management system

-- Create enums first
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

CREATE TYPE invitation_status_enum AS ENUM (
    'pending',
    'accepted',
    'declined',
    'expired',
    'cancelled'
);

-- Users table (from User Management Service)
CREATE TABLE IF NOT EXISTS users (
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
CREATE TABLE IF NOT EXISTS user_profiles (
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

-- Business relationships table
CREATE TABLE IF NOT EXISTS business_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_admin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_provider_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type relationship_type_enum NOT NULL,
    status relationship_status_enum NOT NULL DEFAULT 'pending',
    established_date TIMESTAMP WITH TIME ZONE,
    terminated_date TIMESTAMP WITH TIME ZONE,
    permissions JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(farm_admin_id, service_provider_id, type)
);

-- Invitations table
CREATE TABLE IF NOT EXISTS invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inviter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invitee_email VARCHAR(255) NOT NULL,
    invitee_role user_role_enum NOT NULL,
    relationship_type relationship_type_enum NOT NULL,
    status invitation_status_enum NOT NULL DEFAULT 'pending',
    magic_link_token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    accepted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Registration requests table
CREATE TABLE IF NOT EXISTS registration_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    selected_role user_role_enum NOT NULL,
    profile_data JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by UUID REFERENCES users(id),
    rejection_reason TEXT,
    verification_token VARCHAR(255),
    token_expires_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_business_relationships_farm_admin ON business_relationships(farm_admin_id);
CREATE INDEX IF NOT EXISTS idx_business_relationships_service_provider ON business_relationships(service_provider_id);
CREATE INDEX IF NOT EXISTS idx_business_relationships_status ON business_relationships(status);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(magic_link_token);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(invitee_email);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations(status);
CREATE INDEX IF NOT EXISTS idx_registration_requests_status ON registration_requests(status);

-- Insert default App Admin user (for testing)
INSERT INTO users (id, email, full_name, role, status, email_verified, profile_completed)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'admin@farmtally.com',
    'System Administrator',
    'app_admin',
    'active',
    true,
    true
) ON CONFLICT (email) DO NOTHING;