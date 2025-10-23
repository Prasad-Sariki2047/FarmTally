import express from 'express';
import * as dotenv from 'dotenv';
import { dbConnection } from './config/database.config';
import { DatabaseInitService } from './services/database-init.service';
import { BusinessRelationshipService } from './services/business-relationship.service';
import { UserManagementService } from './services/user-management.service';
import { AuthenticationService } from './services/authentication.service';
import { RelationshipControllerImpl } from './api/relationship.controller';
import { UserRepositoryImpl } from './repositories/user.repository.impl';
import { BusinessRelationshipRepositoryImpl } from './repositories/business-relationship.repository.impl';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize services and controllers
const userRepository = new UserRepositoryImpl();
const businessRelationshipRepository = new BusinessRelationshipRepositoryImpl();
const userManagementService = new UserManagementService(userRepository);
const authenticationService = new AuthenticationService(userRepository);
const businessRelationshipService = new BusinessRelationshipService(businessRelationshipRepository, userRepository);
const relationshipController = new RelationshipControllerImpl(businessRelationshipService);

// Authentication Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, fullName, role, profileData } = req.body;
    
    if (!email || !fullName || !role) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: email, fullName, role' 
      });
    }

    const result = await userManagementService.registerUser({
      email,
      fullName,
      role,
      profileData: profileData || {}
    });

    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Registration failed' 
    });
  }
});

app.post('/api/auth/magic-link', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email is required' 
      });
    }

    const result = await authenticationService.sendMagicLink(email);
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to send magic link' 
    });
  }
});

app.post('/api/auth/verify-magic-link', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ 
        success: false, 
        error: 'Token is required' 
      });
    }

    const result = await authenticationService.verifyMagicLink(token);
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to verify magic link' 
    });
  }
});

app.post('/api/auth/otp/send', async (req, res) => {
  try {
    const { identifier, method } = req.body;
    
    if (!identifier || !method) {
      return res.status(400).json({ 
        success: false, 
        error: 'Identifier and method are required' 
      });
    }

    const result = await authenticationService.sendOTP(identifier, method);
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to send OTP' 
    });
  }
});

app.post('/api/auth/otp/verify', async (req, res) => {
  try {
    const { identifier, code } = req.body;
    
    if (!identifier || !code) {
      return res.status(400).json({ 
        success: false, 
        error: 'Identifier and code are required' 
      });
    }

    const result = await authenticationService.verifyOTP(identifier, code);
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to verify OTP' 
    });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  try {
    const { sessionToken } = req.body;
    
    if (!sessionToken) {
      return res.status(400).json({ 
        success: false, 
        error: 'Session token is required' 
      });
    }

    const result = await authenticationService.logout(sessionToken);
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Logout failed' 
    });
  }
});

// User Management Routes
app.get('/api/users', async (req, res) => {
  try {
    const { role, status } = req.query;
    const users = await userManagementService.getUsers({
      role: role as string,
      status: status as string
    });
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to get users' 
    });
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await userManagementService.getUserById(id);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }
    
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to get user' 
    });
  }
});

app.put('/api/users/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ 
        success: false, 
        error: 'Status is required' 
      });
    }

    const result = await userManagementService.updateUserStatus(id, status);
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to update user status' 
    });
  }
});

// Relationship Routes
app.post('/api/relationships', async (req, res) => {
  try {
    const { farmAdminId, serviceProviderId, type } = req.body;
    
    if (!farmAdminId || !serviceProviderId || !type) {
      return res.status(400).json({ 
        success: false, 
        error: 'farmAdminId, serviceProviderId, and type are required' 
      });
    }

    const result = await relationshipController.createRelationship(farmAdminId, serviceProviderId, type);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to create relationship' 
    });
  }
});

app.get('/api/relationships/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await relationshipController.getRelationships(userId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to get relationships' 
    });
  }
});

app.put('/api/relationships/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ 
        success: false, 
        error: 'Status is required' 
      });
    }

    const result = await relationshipController.updateRelationshipStatus(id, status);
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to update relationship status' 
    });
  }
});

app.delete('/api/relationships/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const result = await relationshipController.terminateRelationship(id, reason || 'No reason provided');
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to terminate relationship' 
    });
  }
});

// Invitation Routes
app.post('/api/invitations', async (req, res) => {
  try {
    const { farmAdminId, email } = req.body;
    
    if (!farmAdminId || !email) {
      return res.status(400).json({ 
        success: false, 
        error: 'farmAdminId and email are required' 
      });
    }

    const result = await relationshipController.inviteFieldManager(farmAdminId, email);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to send invitation' 
    });
  }
});

app.get('/api/invitations/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await relationshipController.getInvitations(userId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to get invitations' 
    });
  }
});

app.post('/api/invitations/:id/accept', async (req, res) => {
  try {
    const { id } = req.params;
    const userData = req.body;
    
    const result = await relationshipController.acceptInvitation(id, userData);
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to accept invitation' 
    });
  }
});

app.delete('/api/invitations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await relationshipController.cancelInvitation(id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to cancel invitation' 
    });
  }
});

// Health check routes
app.get('/api/auth/health', (req, res) => {
  res.json({ status: 'Auth service healthy' });
});

app.get('/api/relationships/health', (req, res) => {
  res.json({ status: 'Relationships service healthy' });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'FarmTally User Role Management'
  });
});

// Database initialization and server startup
async function startServer() {
  try {
    console.log('🔄 Starting FarmTally User Role Management Service...');
    
    // Initialize database connections
    await dbConnection.initializePostgreSQL();
    
    // Initialize Redis (optional - will continue without Redis if it fails)
    try {
      await dbConnection.initializeRedis();
    } catch (error) {
      console.warn('⚠️ Redis connection failed, continuing without cache:', (error as Error).message);
    }
    
    // Initialize database schema
    const dbInitService = new DatabaseInitService();
    await dbInitService.initializeDatabase();
    
    // Create test data in development
    if (process.env.NODE_ENV === 'development') {
      await dbInitService.createTestData();
    }
    
    // Start server
    app.listen(port, () => {
      console.log(`🚀 FarmTally User Role Management Service running on port ${port}`);
      console.log(`📊 Health check available at http://localhost:${port}/health`);
      console.log(`🗄️ Database: Connected and initialized`);
      console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🔄 Shutting down gracefully...');
  await dbConnection.closeConnections();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🔄 Shutting down gracefully...');
  await dbConnection.closeConnections();
  process.exit(0);
});

// Start the server
if (require.main === module) {
  startServer();
}

export default app;