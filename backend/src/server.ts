import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

// Import routes
import aiRoutes from './routes/ai.routes.js';
import filesRoutes from './routes/files.routes.js';
import previewRoutes from './routes/preview.routes.js';

// Import services
import { Logger } from './utils/logger.js';
import { EventEmitter } from './utils/events.js';
import TransactionService from './services/txn.js';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const logger = Logger.getInstance();
const eventEmitter = EventEmitter.getInstance();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id']
}));

// Compression and parsing
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: {
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests, please try again later.',
    timestamp: new Date().toISOString()
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to API routes
app.use('/api/', apiLimiter);

// Correlation ID middleware
app.use((req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] as string || uuidv4();
  req.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  
  // Log request
  logger.info('Request received', {
    correlationId,
    method: req.method,
    url: req.url,
    userAgent: req.headers['user-agent'],
    ip: req.ip
  });
  
  next();
});

// Health check endpoint
app.get('/healthz', (req, res) => {
  const health = {
    status: 'healthy',
    service: 'vedxbuilder-backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    correlationId: req.correlationId,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    features: {
      aiService: !!process.env.OPENAI_API_KEY,
      fileSystem: true,
      buildManager: true,
      websockets: true,
      transactions: true
    },
    connections: {
      websocket: eventEmitter.getConnectionCount()
    }
  };
  
  res.json(health);
});

// API routes
app.use('/api/ai', aiRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/preview', previewRoutes);

// WebSocket setup for real-time events
const wss = new WebSocketServer({ 
  server,
  path: '/stream'
});

wss.on('connection', (ws, req) => {
  const correlationId = uuidv4();
  logger.info('WebSocket connection established', { correlationId });
  
  // Add connection to event emitter
  eventEmitter.addConnection(ws);
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connection.established',
    data: {
      correlationId,
      timestamp: new Date().toISOString(),
      features: ['ai.streaming', 'build.status', 'apply.progress']
    }
  }));
  
  // Handle incoming messages
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      logger.debug('WebSocket message received', { correlationId, type: message.type });
      
      // Handle ping/pong for connection health
      if (message.type === 'ping') {
        ws.send(JSON.stringify({
          type: 'pong',
          data: { timestamp: new Date().toISOString() }
        }));
      }
    } catch (error) {
      logger.warn('Invalid WebSocket message', { correlationId, error });
    }
  });
  
  ws.on('close', () => {
    logger.info('WebSocket connection closed', { correlationId });
  });
  
  ws.on('error', (error) => {
    logger.error('WebSocket error', { correlationId, error });
  });
});

// Error handling middleware
app.use((error: any, req: any, res: any, next: any) => {
  const correlationId = req.correlationId || uuidv4();
  
  logger.error('Unhandled error', {
    correlationId,
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method
  });
  
  res.status(error.status || 500).json({
    code: 'INTERNAL_SERVER_ERROR',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    correlationId,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  const correlationId = req.correlationId || uuidv4();
  
  res.status(404).json({
    code: 'ENDPOINT_NOT_FOUND',
    message: 'API endpoint not found',
    correlationId,
    timestamp: new Date().toISOString(),
    availableEndpoints: [
      'POST /api/ai/plan',
      'POST /api/ai/plan/:planId/apply',
      'GET /api/files',
      'GET /api/files/content',
      'POST /api/files/save',
      'POST /api/files/batch',
      'POST /api/preview/build',
      'GET /api/preview/status',
      'GET /healthz',
      'WebSocket: /stream'
    ]
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

// Cleanup old transactions periodically
const transactionService = new TransactionService();
setInterval(() => {
  transactionService.cleanupOldTransactions().catch(error => {
    logger.error('Transaction cleanup failed', { error });
  });
}, 60 * 60 * 1000); // Every hour

// Start server
const PORT = parseInt(process.env.PORT || '3001', 10);

server.listen(PORT, '0.0.0.0', () => {
  logger.info('VedxBuilder Backend Server started', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    features: {
      aiService: !!process.env.OPENAI_API_KEY,
      cors: process.env.CORS_ORIGIN,
      rateLimit: true,
      websockets: true,
      compression: true,
      security: true
    }
  });
  
  console.log(`🚀 VedxBuilder Backend running on port ${PORT}`);
  console.log(`🌐 API: http://localhost:${PORT}`);
  console.log(`🔌 WebSocket: ws://localhost:${PORT}/stream`);
  console.log(`🤖 AI Integration: ${process.env.OPENAI_API_KEY ? '✅ Enabled' : '❌ Demo Mode'}`);
});

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      correlationId: string;
    }
  }
}

export default app;