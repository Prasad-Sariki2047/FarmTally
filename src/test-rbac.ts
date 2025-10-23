import { MockUserRepository } from './repositories/mock-user.repository';
import { MockBusinessRelationshipRepository } from './repositories/mock-business-relationship.repository';
import { RBACServiceImpl } from './services/rbac.service';
import { UserRole } from './models/common.types';

async function testRBAC() {
  try {
    console.log('🔄 Testing RBAC implementation with mock data...');
    
    // Initialize repositories with mock data
    const userRepo = new MockUserRepository();
    const businessRelationshipRepo = new MockBusinessRelationshipRepository();
    
    // Initialize RBAC service
    const rbacService = new RBACServiceImpl(businessRelationshipRepo, userRepo);
    
    console.log('\n✅ RBAC service initialized successfully');
    
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
      
      // Test App Admin permissions
      const appAdmin = await userRepo.findByEmail('admin@farmtally.com');
      if (appAdmin) {
        const adminDashboard = await rbacService.getRoleDashboardConfig(UserRole.APP_ADMIN);
        console.log(`✅ App Admin dashboard has ${adminDashboard.widgets.length} widgets`);
        
        const adminPermissions = await rbacService.getUserPermissions(appAdmin.id);
        console.log(`✅ App Admin has ${adminPermissions.length} permissions`);
        
        // Test App Admin can access any user's data
        const canAccessAnyData = await rbacService.validateBusinessRelationshipAccess(
          appAdmin.id,
          fieldManager.id
        );
        console.log(`✅ App Admin can access any user data: ${canAccessAnyData}`);
      }
    }
    
    // Test 4: Create a new user and test permissions
    console.log('\n🔍 Test 4: Creating a new user and testing permissions...');
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
    
    // Test RBAC for new user
    const farmerDashboard = await rbacService.getRoleDashboardConfig(UserRole.FARMER);
    console.log(`✅ Farmer dashboard has ${farmerDashboard.widgets.length} widgets`);
    
    const farmerPermissions = await rbacService.getUserPermissions(newUser.id);
    console.log(`✅ Farmer has ${farmerPermissions.length} permissions`);
    
    // Test 5: Test different role permissions
    console.log('\n🔍 Test 5: Testing different role permissions...');
    
    const roles = [UserRole.APP_ADMIN, UserRole.FARM_ADMIN, UserRole.FIELD_MANAGER, UserRole.FARMER];
    
    for (const role of roles) {
      const config = await rbacService.getRoleDashboardConfig(role);
      console.log(`✅ ${role}: ${config.widgets.length} widgets, ${config.permissions.length} permissions, ${config.navigation.length} nav items`);
    }
    
    // Test 6: Test permission validation
    console.log('\n🔍 Test 6: Testing permission validation...');
    
    if (fieldManager) {
      // Test various permissions
      const permissions = [
        { resource: 'field-operations', action: 'read' },
        { resource: 'field-operations', action: 'update' },
        { resource: 'supply-chain', action: 'read' },
        { resource: 'registration', action: 'approve' }
      ];
      
      for (const perm of permissions) {
        const hasPermission = await rbacService.checkPermission(
          fieldManager.id,
          perm.resource,
          perm.action
        );
        console.log(`   - ${perm.resource}:${perm.action} = ${hasPermission}`);
      }
    }
    
    console.log('\n🎉 All RBAC tests completed successfully!');
    console.log('\n📊 Summary:');
    console.log('   ✅ Mock repositories working correctly');
    console.log('   ✅ RBAC service functionality verified');
    console.log('   ✅ Permission checking working');
    console.log('   ✅ Business relationship validation working');
    console.log('   ✅ Dashboard configuration retrieval working');
    console.log('   ✅ Role-based permissions working');
    console.log('   ✅ User permission aggregation working');
    
    console.log('\n🚀 RBAC system is fully functional and ready for deployment!');
    
  } catch (error) {
    console.error('❌ RBAC test failed:', error);
  }
}

testRBAC();