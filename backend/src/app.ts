import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { logger } from './utils/logger';
import { testConnection, runMigrations, createIndexes, seedDatabase } from './config/migrations';
import authRoutes from './routes/auth';
import serviceRoutes from './routes/services';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Project Reliance Backend API is running',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/services', serviceRoutes);

// Placeholder routes for other endpoints
app.use('/api/users', (req, res) => {
  res.json({ message: 'User routes coming soon' });
});

app.use('/api/vendors', (req, res) => {
  res.json({ message: 'Vendor routes coming soon' });
});

app.use('/api/bookings', (req, res) => {
  res.json({ message: 'Booking routes coming soon' });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Initialize database and start server
const initializeApp = async () => {
  try {
    // Test database connection
    const isConnected = await testConnection();
    if (!isConnected) {
      logger.error('Failed to connect to database. Please check your configuration.');
      process.exit(1);
    }

    // Run migrations
    await runMigrations();
    
    // Create indexes
    await createIndexes();
    
    // Seed database with sample data (only in development)
    if (process.env.NODE_ENV === 'development') {
      await seedDatabase();
    }

    // Start server
    app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📊 Health check: http://localhost:${PORT}/health`);
      logger.info(`🔗 API Base URL: http://localhost:${PORT}/api`);
      logger.info(`🔐 Auth endpoints: http://localhost:${PORT}/api/auth`);
      logger.info(`🛠️ Service endpoints: http://localhost:${PORT}/api/services`);
    });
  } catch (error) {
    logger.error('Failed to initialize application:', error);
    process.exit(1);
  }
};

// Start the application
initializeApp();

export default app; 