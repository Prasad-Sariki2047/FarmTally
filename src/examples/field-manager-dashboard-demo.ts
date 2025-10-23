import { FieldManagerDashboardComponentImpl, FieldOperationStatus, FieldOperationUpdateData } from '../components/field-manager-dashboard.component';
import { FieldManagerRoutesImpl } from '../api/field-manager-routes';
import { DashboardControllerImpl } from '../api/dashboard.controller';
import { BusinessRelationshipService } from '../services/business-relationship.service';
import { SupplyChainRepository } from '../repositories/supply-chain.repository';
import { WidgetRendererImpl } from '../services/widget-renderer.service';

/**
 * Field Manager Dashboard Demo
 * Demonstrates the complete Field Manager dashboard functionality
 * Requirements: 6.1, 6.2, 6.3, 6.4 - Field Manager dashboard interface and operations
 */

// Mock service instances for demonstration
const mockDashboardController = new DashboardControllerImpl({} as any, {} as any, {} as any);
const mockBusinessRelationshipService = new BusinessRelationshipService({} as any, {} as any, {} as any);
const mockSupplyChainRepository = {} as SupplyChainRepository;
const mockWidgetRenderer = new WidgetRendererImpl({} as any);

// Initialize Field Manager dashboard and routes
const fieldManagerDashboard = new FieldManagerDashboardComponentImpl(
    mockDashboardController,
    mockBusinessRelationshipService,
    mockSupplyChainRepository,
    mockWidgetRenderer
);

const fieldManagerRoutes = new FieldManagerRoutesImpl(
    mockDashboardController,
    mockBusinessRelationshipService,
    mockSupplyChainRepository,
    mockWidgetRenderer
);

/**
 * Demo: Field Manager Dashboard Loading
 * Requirements: 6.1 - Field Manager dashboard access and field operations interface
 */
export async function demoFieldManagerDashboardLoading() {
    console.log('=== Field Manager Dashboard Loading Demo ===');

    const fieldManagerId = 'fm-demo-001';

    try {
        // Load complete dashboard
        console.log('Loading Field Manager dashboard...');
        const dashboardResult = await fieldManagerRoutes.getDashboard(fieldManagerId);

        if (dashboardResult.success && dashboardResult.data) {
            const dashboard = dashboardResult.data;

            console.log('Dashboard loaded successfully!');
            console.log(`Farm Admin: ${dashboard.farmAdminConnection.farmAdmin.name}`);
            console.log(`Business: ${dashboard.farmAdminConnection.farmAdmin.businessName}`);
            console.log(`Farm Size: ${dashboard.farmAdminConnection.farmAdmin.farmSize} acres`);
            console.log(`Active Operations: ${dashboard.fieldOperations.overview.activeOperations}`);
            console.log(`Pending Updates: ${dashboard.fieldOperations.overview.pendingUpdates}`);
            console.log(`Widgets: ${dashboard.widgets.length}`);
            console.log(`Quick Actions: ${dashboard.quickActions.length}`);
            console.log(`Notifications: ${dashboard.notifications.length}`);

            // Display active operations
            console.log('\n--- Active Field Operations ---');
            dashboard.fieldOperations.activeOperations.forEach((operation: any) => {
                console.log(`${operation.title} (${operation.status})`);
                console.log(`  Location: ${operation.location}`);
                console.log(`  Progress: ${operation.progress}%`);
                console.log(`  Priority: ${operation.priority}`);
                console.log(`  Overdue: ${operation.isOverdue ? 'Yes' : 'No'}`);
            });

            // Display shared farm data
            console.log('\n--- Shared Farm Data ---');
            const farmData = dashboard.sharedData.farmData;
            console.log(`Total Acreage: ${farmData.farmOverview.totalAcreage}`);
            console.log(`Active Crops: ${farmData.farmOverview.activeCrops.join(', ')}`);
            console.log(`Weather: ${farmData.farmOverview.weatherConditions}`);
            console.log(`Fields: ${farmData.fieldData.length}`);
            console.log(`Equipment: ${farmData.equipmentStatus.length}`);
            console.log(`Inventory Items: ${farmData.inputInventory.length}`);

        } else {
            console.error('Failed to load dashboard:', dashboardResult.error);
        }
    } catch (error) {
        console.error('Error in dashboard loading demo:', error);
    }
}

/**
 * Demo: Field Operation Status Updates
 * Requirements: 6.3 - Field operation status update functionality
 */
export async function demoFieldOperationUpdates() {
    console.log('\n=== Field Operation Updates Demo ===');

    const fieldManagerId = 'fm-demo-001';
    const operationId = 'op-001';

    try {
        // Update operation status to in progress
        console.log('Updating operation status to IN_PROGRESS...');
        const statusResult = await fieldManagerRoutes.updateOperationStatus(
            fieldManagerId,
            operationId,
            FieldOperationStatus.IN_PROGRESS,
            'Started irrigation system setup in Field A-1'
        );

        if (statusResult.success) {
            console.log('Status update successful:', statusResult.message);
        } else {
            console.error('Status update failed:', statusResult.message);
        }

        // Create detailed operation update
        console.log('\nCreating detailed operation update...');
        const updateData: FieldOperationUpdateData = {
            operationId: operationId,
            status: FieldOperationStatus.IN_PROGRESS,
            progress: 75,
            notes: 'Irrigation system 75% complete. All sprinklers installed and tested. Final connections scheduled for tomorrow morning.',
            location: 'Field A-1, Section North',
            attachments: ['irrigation_progress_photo.jpg', 'pressure_test_results.pdf']
        };

        const updateResult = await fieldManagerRoutes.createOperationUpdate(fieldManagerId, updateData);

        if (updateResult.success) {
            console.log('Operation update created:', updateResult.message);
        } else {
            console.error('Operation update failed:', updateResult.message);
        }

        // Get operation history
        console.log('\nRetrieving operation history...');
        const historyResult = await fieldManagerRoutes.getOperationHistory(fieldManagerId, operationId);

        if (historyResult.success && historyResult.data) {
            console.log(`Operation history loaded: ${historyResult.data.count} updates`);
            historyResult.data.updates.forEach((update: any) => {
                console.log(`  ${update.timestamp.toISOString()}: ${update.description}`);
            });
        } else {
            console.error('Failed to load operation history:', historyResult.error);
        }

        // Complete the operation
        console.log('\nCompleting the operation...');
        const completionResult = await fieldManagerRoutes.updateOperationStatus(
            fieldManagerId,
            operationId,
            FieldOperationStatus.COMPLETED,
            'Irrigation system installation completed successfully. All systems tested and operational.'
        );

        if (completionResult.success) {
            console.log('Operation completed:', completionResult.message);
        } else {
            console.error('Operation completion failed:', completionResult.message);
        }

    } catch (error) {
        console.error('Error in operation updates demo:', error);
    }
}

/**
 * Demo: Shared Data Access
 * Requirements: 6.2 - Shared data access with Farm Admin
 */
export async function demoSharedDataAccess() {
    console.log('\n=== Shared Data Access Demo ===');

    const fieldManagerId = 'fm-demo-001';

    try {
        // Get Farm Admin connection info
        console.log('Retrieving Farm Admin connection...');
        const connectionResult = await fieldManagerRoutes.getFarmAdminConnection(fieldManagerId);

        if (connectionResult.success && connectionResult.data) {
            const connection = connectionResult.data;
            console.log('Farm Admin Connection:');
            console.log(`  Name: ${connection.farmAdmin.name}`);
            console.log(`  Business: ${connection.farmAdmin.businessName}`);
            console.log(`  Relationship Status: ${connection.relationshipStatus}`);
            console.log(`  Established: ${connection.establishedDate.toDateString()}`);
            console.log(`  Last Sync: ${connection.lastSync.toISOString()}`);
            console.log('  Permissions:');
            console.log(`    Read Farm Data: ${connection.permissions.canReadFarmData}`);
            console.log(`    Update Operations: ${connection.permissions.canUpdateFieldOperations}`);
            console.log(`    Create Reports: ${connection.permissions.canCreateReports}`);
            console.log(`    View Supply Chain: ${connection.permissions.canViewSupplyChain}`);
            console.log(`    Communicate: ${connection.permissions.canCommunicate}`);
        }

        // Get shared farm data
        console.log('\nRetrieving shared farm data...');
        const farmDataResult = await fieldManagerRoutes.getSharedFarmData(fieldManagerId);

        if (farmDataResult.success && farmDataResult.data) {
            const farmData = farmDataResult.data;
            console.log('Shared Farm Data:');
            console.log(`  Total Acreage: ${farmData.farmOverview.totalAcreage}`);
            console.log(`  Active Crops: ${farmData.farmOverview.activeCrops.join(', ')}`);
            console.log(`  Current Season: ${farmData.farmOverview.currentSeason}`);
            console.log(`  Weather: ${farmData.farmOverview.weatherConditions}`);

            console.log('\n  Field Details:');
            farmData.fieldData.forEach((field: any) => {
                console.log(`    ${field.name}: ${field.acreage} acres of ${field.cropType}`);
                console.log(`      Stage: ${field.currentStage}, Soil: ${field.soilCondition}`);
                console.log(`      Irrigation: ${field.irrigationStatus}`);
            });

            console.log('\n  Equipment Status:');
            farmData.equipmentStatus.forEach((equipment: any) => {
                console.log(`    ${equipment.name} (${equipment.type}): ${equipment.status}`);
                if (equipment.location) {
                    console.log(`      Location: ${equipment.location}`);
                }
            });

            console.log('\n  Input Inventory:');
            farmData.inputInventory.forEach((item: any) => {
                console.log(`    ${item.name}: ${item.quantity} ${item.unit}`);
                console.log(`      Type: ${item.type}, Location: ${item.location}`);
                if (item.isLowStock) {
                    console.log(`      ⚠️  LOW STOCK ALERT`);
                }
            });
        }

        // Get shared supply chain data
        console.log('\nRetrieving shared supply chain data...');
        const supplyChainResult = await fieldManagerRoutes.getSharedSupplyChainData(fieldManagerId);

        if (supplyChainResult.success && supplyChainResult.data) {
            const supplyChain = supplyChainResult.data;

            console.log('Supply Chain Data:');
            console.log('\n  Commodity Schedule:');
            supplyChain.commoditySchedule.forEach((item: any) => {
                console.log(`    ${item.cropType}: ${item.expectedQuantity} units`);
                console.log(`      Harvest: ${item.harvestDate.toDateString()}`);
                console.log(`      Delivery: ${item.deliveryDate.toDateString()}`);
                console.log(`      Buyer: ${item.buyer}, Status: ${item.status}`);
            });

            console.log('\n  Market Prices:');
            supplyChain.marketPrices.forEach((price: any) => {
                const changeSymbol = price.trend === 'up' ? '↗️' : price.trend === 'down' ? '↘️' : '➡️';
                console.log(`    ${price.cropType}: $${price.currentPrice} ${price.currency} ${changeSymbol}`);
                console.log(`      Change: ${price.priceChange > 0 ? '+' : ''}${price.priceChange}`);
            });
        }

    } catch (error) {
        console.error('Error in shared data access demo:', error);
    }
}

/**
 * Demo: Communication Features
 * Requirements: 6.4 - Communication and collaboration features
 */
export async function demoCommunicationFeatures() {
    console.log('\n=== Communication Features Demo ===');

    const fieldManagerId = 'fm-demo-001';

    try {
        // Get current communications
        console.log('Retrieving communications...');
        const commResult = await fieldManagerRoutes.getCommunications(fieldManagerId);

        if (commResult.success && commResult.data) {
            const communications = commResult.data;
            console.log(`Communications loaded: ${communications.totalCount} total, ${communications.unreadCount} unread`);

            console.log('\n  Recent Communications:');
            communications.communications.forEach((comm: any) => {
                const unreadIndicator = comm.unreadCount > 0 ? '🔴' : '✅';
                console.log(`    ${unreadIndicator} ${comm.farmAdminName}: ${comm.lastMessage}`);
                console.log(`      Type: ${comm.type}, Time: ${comm.timestamp.toISOString()}`);
                if (comm.unreadCount > 0) {
                    console.log(`      Unread: ${comm.unreadCount}`);
                }
            });
        }

        // Send a message to Farm Admin
        console.log('\nSending message to Farm Admin...');
        const message = 'Irrigation system installation completed in Field A-1. All pressure tests passed. System is ready for operation. Please review the attached completion report.';

        const sendResult = await fieldManagerRoutes.sendMessage(fieldManagerId, message);

        if (sendResult.success) {
            console.log('Message sent successfully:', sendResult.message);
        } else {
            console.error('Message sending failed:', sendResult.message);
        }

        // Mark messages as read
        console.log('\nMarking messages as read...');
        const messageIds = ['comm-001', 'comm-002'];

        const readResult = await fieldManagerRoutes.markMessagesAsRead(fieldManagerId, messageIds);

        if (readResult.success) {
            console.log('Messages marked as read:', readResult.message);
        } else {
            console.error('Failed to mark messages as read:', readResult.message);
        }

    } catch (error) {
        console.error('Error in communication features demo:', error);
    }
}

/**
 * Demo: Complete Field Manager Workflow
 * Demonstrates a typical day in the life of a Field Manager
 */
export async function demoCompleteFieldManagerWorkflow() {
    console.log('\n=== Complete Field Manager Workflow Demo ===');
    console.log('Simulating a typical day for a Field Manager...\n');

    try {
        // Morning: Load dashboard and check status
        console.log('🌅 Morning: Loading dashboard and checking status...');
        await demoFieldManagerDashboardLoading();

        // Mid-morning: Check and respond to communications
        console.log('\n📱 Mid-morning: Checking communications...');
        await demoCommunicationFeatures();

        // Afternoon: Update field operations
        console.log('\n🚜 Afternoon: Updating field operations...');
        await demoFieldOperationUpdates();

        // Evening: Review shared data and plan for tomorrow
        console.log('\n📊 Evening: Reviewing shared data and planning...');
        await demoSharedDataAccess();

        console.log('\n✅ Field Manager workflow completed successfully!');
        console.log('All dashboard features demonstrated:');
        console.log('  ✓ Dashboard loading and data access');
        console.log('  ✓ Field operation status updates');
        console.log('  ✓ Shared data synchronization with Farm Admin');
        console.log('  ✓ Communication and collaboration features');

    } catch (error) {
        console.error('Error in complete workflow demo:', error);
    }
}

// Demo functions are already exported above

// Run complete demo if this file is executed directly
if (require.main === module) {
    demoCompleteFieldManagerWorkflow()
        .then(() => {
            console.log('\n🎉 Field Manager Dashboard Demo completed!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Demo failed:', error);
            process.exit(1);
        });
}