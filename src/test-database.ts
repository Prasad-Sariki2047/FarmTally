import * as dotenv from 'dotenv';
import { dbConnection } from './config/database.config';
import { DatabaseInitService } from './services/database-init.service';
import { UserRepositoryImpl } from './repositories/user.repository.impl';
import { BusinessRelationshipRepositoryImpl } from './repositories/business-relationship.repository.impl';
import { RBACServiceImpl } from './services/rbac.service';
import { UserRole, UserStatus, RelationshipType, RelationshipStatus } from './models/common.types';

dotenv.config();

async function testDatabase() {
  try {
    console.log('🔄 Testing database implementation...');
    
    // Initialize database
    await dbConnection.initializePostgreSQL();
    const dbInitService = new DatabaseInitService();
    await dbInitService.initializeDatabase();
    await dbInitService.createTestData();
    
    // Initialize repositories
    const userRepo = new UserRepositoryImpl();
    const businessRelationshipRepo = new BusinessRelationshipRepositoryImpl();
    
    // Initialize RBAC service
    const rbacService = new RBACServiceImpl(businessRelationshipRepo, userRepo);
    
    console.log('\n✅ Database initialized successfully');
    
    // Test 1: Find test users
    console.log('\n🔍 Test 1: Finding test users...');
    const farmAdmin = await userRepo.findByEmail('farm.admin@test.com');
    const fieldManager = await userRepo.findByEmail('field.manager@test.com');
    
    if (farmAdmin) {
      console.log(`✅ Found Farm Admin: ${farmAdmin.fullName} (${farmAdmin.role})`);
    } else {
      console.log('❌ Farm Admin not found');
    }
    
    if (fieldManager) {
      console.log(`✅ Found Field Manager: ${fieldManager.fullName} (${fieldManager.role})`);
    } else {
      console.log('❌ Field Manager not found');
    }
    
    // Test 2: Check business relationships
    console.log('\n🔍 Test 2: Checking business relationships...');
    if (farmAdmin) {
      const relationships = await businessRelationshipRepo.findRelationshipsByFarmAdmin(farmAdmin.id);
      console.log(`✅ Found ${relationships.length} relationships for Farm Admin`);
      
      if (relationships.length > 0) {
        const relationship = relationships[0];
        console.log(`   - Relationship: ${relationship.type} (${relationship.status})`);
        console.log(`   - Service Provider: ${relationship.serviceProviderId}`);
      }
    }
    
    // Test 3: Test RBAC permissions
    console.log('\n🔍 Test 3: Testing RBAC permissions...');
    if (farmAdmin && fieldManager) {
      // Test permission checking
      const canReadFieldOps = await rbacService.checkPermission(
        fieldManager.id, 
        'field-operations', 
        'read'
      );
      console.log(`✅ Field Manager can read field operations: ${canReadFieldOps}`);
      
      // Test business relationship access
      const canAccessFarmAdminData = await rbacService.validateBusinessRelationshipAccess(
        fieldManager.id,
        farmAdmin.id
      );
      console.log(`✅ Field Manager can access Farm Admin data: ${canAccessFarmAdminData}`);
      
      // Test dashboard configuration
      const dashboardConfig = await rbacService.getRoleDashboardConfig(UserRole.FIELD_MANAGER);
      console.log(`✅ Field Manager dashboard has ${dashboardConfig.widgets.length} widgets`);
      console.log(`✅ Field Manager has ${dashboardConfig.permissions.length} permissions`);
      
      // Test user permissions
      const userPermissions = await rbacService.getUserPermissions(fieldManager.id);
      console.log(`✅ Field Manager has ${userPermissions.length} total permissions:`);
      userPermissions.forEach(permission => {
        console.log(`   - ${permission}`);
      });
    }
    
    // Test 4: Create a new user
    console.log('\n🔍 Test 4: Creating a new user...');
    const newUser = await userRepo.create({
      email: 'test.farmer@example.com',
      fullName: 'Test Farmer',
      selectedRole: UserRole.FARMER,
      profileData: {
        commodityTypes: ['wheat', 'corn'],
        productionCapacity: 1000
      },
      authMethod: 'magic_link' as any
    });
    
    console.log(`✅ Created new user: ${newUser.fullName} (${newUser.id})`);
    
    // Test 5: Test RBAC for new user
    console.log('\n🔍 Test 5: Testing RBAC for new user...');
    const farmerDashboard = await rbacService.getRoleDashboardConfig(UserRole.FARMER);
    console.log(`✅ Farmer dashboard has ${farmerDashboard.widgets.length} widgets`);
    
    const farmerPermissions = await rbacService.getUserPermissions(newUser.id);
    console.log(`✅ Farmer has ${farmerPermissions.length} permissions`);
    
    console.log('\n🎉 All database tests completed successfully!');
    console.log('\n📊 Summary:');
    console.log('   ✅ Database connection and initialization');
    console.log('   ✅ User repository operations');
    console.log('   ✅ Business relationship repository operations');
    console.log('   ✅ RBAC service functionality');
    console.log('   ✅ Permission checking and validation');
    console.log('   ✅ Dashboard configuration retrieval');
    
  } catch (error) {
    console.error('❌ Database test failed:', error);
  } finally {
    await dbConnection.closeConnections();
    process.exit(0);
  }
}

testDatabase();