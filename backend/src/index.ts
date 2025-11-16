// backend-ts/src/index.ts
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

// Import configurations
import { setupExpressApp } from './config/server';
import { logger } from './config/logging';

// Import services
import { setupWebSocket } from './services/websocketService';
import { connectToSomnia } from './services/somniaService';
import { initializeContract } from './services/contractService';
import { loadMLModel } from './services/scoringService';

// Import controllers
import walletController from './controllers/walletController';
import systemController from './controllers/systemController';

class SoklinServer {
  private app: express.Application;
  private httpServer: any;
  private io: SocketIOServer;
  private port: number;

  constructor() {
    this.port = parseInt(process.env.PORT || '8000');
    this.app = setupExpressApp();
    this.httpServer = createServer(this.app);
    this.io = new SocketIOServer(this.httpServer, {
      cors: {
        origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
        methods: ['GET', 'POST']
      },
      // Add connection timeout and other configurations
      pingTimeout: 60000, // 60 seconds
      pingInterval: 25000, // 25 seconds
      upgradeTimeout: 30000, // 30 seconds for HTTP upgrade
      maxHttpBufferSize: 1e6, // 1MB
      transports: ['websocket', 'polling'], // Support both transports
      allowEIO3: true // Allow Engine.IO v3 clients for compatibility
    });

    this.setupRoutes();
    this.setupServices();
  }

  private setupRoutes(): void {
    // API Routes
    this.app.use('/api/wallets', walletController);
    this.app.use('/api/system', systemController);

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: '1.0.0'
      });
    });

    // Serve static files in production
    if (process.env.NODE_ENV === 'production') {
      this.app.use(express.static(path.join(__dirname, '../../frontend/dist')));
      
      this.app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
      });
    }

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl,
        method: req.method
      });
    });
  }

  private async setupServices(): Promise<void> {
    try {
      // Initialize WebSocket service
      setupWebSocket(this.io);

      // Initialize ML Model
      await loadMLModel();

      // Initialize Blockchain Services (continue if it fails)
      try {
        await initializeContract();
        logger.info('✅ Contract services initialized');
      } catch (contractError) {
        logger.error('❌ Contract services failed to initialize:', contractError);
      }

      // Connect to Somnia Network (if configured)
      try {
        if (process.env.SOMNIA_RPC_URL && process.env.SOMNIA_RPC_URL !== '') {
          await connectToSomnia();
          logger.info('✅ Connected to Somnia network');
        } else {
          logger.error('❌ SOMNIA_RPC_URL not configured - blockchain monitoring will not work');
          logger.error('📋 Please check your .env file and ensure SOMNIA_RPC_URL is set correctly');
        }
      } catch (somniaError) {
        logger.error('❌ Somnia connection failed:', somniaError);
        logger.error('📋 This will prevent transaction monitoring from working properly');
      }

      logger.info('✅ All available services initialized successfully');

    } catch (error) {
      logger.error('❌ Failed to initialize services:', error);
      process.exit(1);
    }
  }

  public start(): void {
    this.httpServer.listen(this.port, () => {
      logger.info(`🚀 Soklin Server running on port ${this.port}`);
      logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`🔗 API: http://localhost:${this.port}/api`);
      logger.info(`❤️  Health: http://localhost:${this.port}/health`);
      logger.info(`🔌 WebSocket: ws://localhost:${this.port}`);
      
      if (process.env.CONTRACT_ADDRESS) {
        logger.info(`📄 Contract: ${process.env.CONTRACT_ADDRESS}`);
      }
    });

    // Graceful shutdown
    this.setupGracefulShutdown();
  }

  private setupGracefulShutdown(): void {
    const shutdownSignals = ['SIGINT', 'SIGTERM', 'SIGQUIT'];

    shutdownSignals.forEach(signal => {
      process.on(signal, async () => {
        logger.info(`🛑 Received ${signal}, shutting down gracefully...`);
        
        // Close HTTP server
        this.httpServer.close(() => {
          logger.info('✅ HTTP server closed');
        });

        // Close WebSocket connections
        this.io.close(() => {
          logger.info('✅ WebSocket server closed');
        });

        // Additional cleanup can be added here
        logger.info('✅ Soklin Server shutdown complete');
        process.exit(0);
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('💥 Uncaught Exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
      if (reason instanceof Error) {
        logger.error('Error details:', {
          message: reason.message,
          stack: reason.stack,
          name: reason.name
        });
      }
      process.exit(1);
    });
  }

  // Getter for testing purposes
  public getApp(): express.Application {
    return this.app;
  }

  public getIO(): SocketIOServer {
    return this.io;
  }
}

// Start the server if this file is run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = new SoklinServer();
  server.start();
}

export default SoklinServer;