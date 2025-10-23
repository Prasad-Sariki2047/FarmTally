import express from 'express';
import * as dotenv from 'dotenv';
import { dbConnection } from './config/database.config';
import { DatabaseInitService } from './services/database-init.service';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic API routes (controllers will be implemented later)
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