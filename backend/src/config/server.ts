import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { stream } from './logging';

/**
 * Configure and create Express application
 */
export function setupExpressApp(): express.Application {
  const app = express();

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    crossOriginEmbedderPolicy: false
  }));

  // CORS configuration
  app.use(cors({
    origin: getCorsOrigins(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  }));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX || '100'), // Limit each IP to 100 requests per windowMs
    message: {
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false
  });

  // Apply rate limiting to API routes
  app.use('/api/', limiter);

  // Trust proxy (important for rate limiting and IP detection)
  app.set('trust proxy', 1);

  // Body parsing middleware
  app.use(express.json({
    limit: process.env.BODY_SIZE_LIMIT || '10mb',
    verify: (req: any, res, buf) => {
      req.rawBody = buf;
    }
  }));

  app.use(express.urlencoded({
    extended: true,
    limit: process.env.BODY_SIZE_LIMIT || '10mb'
  }));

  // Compression middleware
  app.use(compression());

  // HTTP request logging
  app.use(morgan(
    process.env.NODE_ENV === 'production' ? 'combined' : 'dev',
    { stream }
  ));

  // Request ID middleware
  app.use((req, res, next) => {
    req.id = generateRequestId();
    next();
  });

  // Health check middleware (early response for load balancers)
  app.use('/health', (req, res, next) => {
    res.set('Cache-Control', 'no-cache');
    next();
  });

  // Add security headers to all responses
  app.use((req, res, next) => {
    // Prevent clickjacking
    res.set('X-Frame-Options', 'DENY');
    
    // Prevent MIME type sniffing
    res.set('X-Content-Type-Options', 'nosniff');
    
    // Referrer policy
    res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Permissions policy
    res.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    
    next();
  });

  return app;
}

/**
 * Get CORS origins from environment or default to localhost
 */
function getCorsOrigins(): string[] {
  if (process.env.CORS_ORIGINS) {
    return process.env.CORS_ORIGINS.split(',').map(origin => origin.trim());
  }
  
  // Default origins for development
  return [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173', // Vite default
    'http://127.0.0.1:5173'
  ];
}

/**
 * Generate unique request ID for tracing
 */
function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `req_${timestamp}_${random}`;
}

/**
 * Error handling middleware (should be added after routes)
 */
export function setupErrorHandling(app: express.Application): void {
  // 404 handler
  app.use((req, res, next) => {
    res.status(404).json({
      error: 'Not Found',
      message: `Route ${req.method} ${req.path} not found`,
      requestId: req.id
    });
  });

  // Global error handler
  app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    const { logger } = require('./logging');
    
    logger.error('Unhandled error:', {
      error: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
      requestId: req.id,
      ip: req.ip
    });

    // Don't leak error details in production
    if (process.env.NODE_ENV === 'production') {
      return res.status(500).json({
        error: 'Internal Server Error',
        requestId: req.id
      });
    }

    res.status(error.status || 500).json({
      error: error.message,
      stack: error.stack,
      requestId: req.id
    });
  });
}

// Export express for type usage
export { express };