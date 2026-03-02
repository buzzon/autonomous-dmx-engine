/**
 * REST API Server for Autonomous DMX Engine
 * Express-based REST API with JWT authentication and OpenAPI documentation
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { defaultLogger } from '../../utils/logger';
import { ControlAPIConfig } from '../types';
import { authMiddleware } from './auth';
import { setupEndpoints } from './endpoints';
import { setupOpenAPI } from './openapi';

const logger = defaultLogger.child({ module: 'RESTServer' });

/**
 * Simple in-memory rate limiter
 */
class RateLimiter {
  private requests = new Map<string, { count: number; resetTime: number }>();
  private windowMs: number;
  private maxRequests: number;

  constructor(windowMs: number, maxRequests: number) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  check(ip: string): boolean {
    const now = Date.now();
    const record = this.requests.get(ip);
    
    if (!record || now > record.resetTime) {
      // New window
      this.requests.set(ip, { count: 1, resetTime: now + this.windowMs });
      return true;
    }
    
    if (record.count >= this.maxRequests) {
      return false;
    }
    
    record.count++;
    return true;
  }
}

/**
 * REST API Server class
 */
export class RESTServer {
  private app: Express;
  private config: ControlAPIConfig;
  private isRunning = false;
  private server: any = null;
  private rateLimiter: RateLimiter;

  constructor(config: ControlAPIConfig) {
    this.config = config;
    this.app = express();
    this.rateLimiter = new RateLimiter(
      config.rateLimit.windowMs,
      config.rateLimit.maxRequests
    );
    
    this.setupMiddleware();
    this.setupRoutes();
    
    logger.info('REST server initialized', { port: config.port });
  }

  /**
   * Setup middleware
   */
  private setupMiddleware(): void {
    // Basic security headers
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      next();
    });
    
    // CORS
    this.app.use(cors({
      origin: this.config.corsOrigins,
      credentials: true,
    }));
    
    // JSON body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    
    // Rate limiting middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      if (!this.rateLimiter.check(ip)) {
        res.status(429).json({
          success: false,
          error: 'Too many requests, please try again later.',
          timestamp: Date.now(),
        });
        return;
      }
      next();
    });
    
    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      logger.debug('HTTP request', {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });
      next();
    });
    
    // Authentication middleware (if enabled)
    if (this.config.authentication?.enabled) {
      this.app.use(authMiddleware(this.config.authentication.jwtSecret));
      logger.info('JWT authentication enabled');
    }
  }

  /**
   * Setup routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'ok',
        timestamp: Date.now(),
        service: 'autonomous-dmx-engine',
        version: process.env.npm_package_version || '0.1.0',
      });
    });
    
    // API endpoints
    setupEndpoints(this.app);
    
    // OpenAPI documentation
    if (process.env.NODE_ENV !== 'production') {
      setupOpenAPI(this.app);
    }
    
    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        error: `Route ${req.method} ${req.path} not found`,
        timestamp: Date.now(),
      });
    });
    
    // Error handler
    this.app.use((err: any, req: Request, res: Response, next: NextFunction) => {
      logger.error('Unhandled error in REST API', { error: err.message, stack: err.stack });
      res.status(err.status || 500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
        timestamp: Date.now(),
      });
    });
  }

  /**
   * Start the REST server
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('REST server is already running');
      return;
    }
    
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.config.port, () => {
          this.isRunning = true;
          logger.info('REST server started successfully', { port: this.config.port });
          resolve();
        });
        
        this.server.on('error', (err: any) => {
          logger.error('Failed to start REST server', { error: err });
          reject(err);
        });
      } catch (error) {
        logger.error('Error starting REST server', { error });
        reject(error);
      }
    });
  }

  /**
   * Stop the REST server
   */
  async stop(): Promise<void> {
    if (!this.isRunning || !this.server) {
      logger.warn('REST server is not running');
      return;
    }
    
    return new Promise((resolve, reject) => {
      this.server.close((err: any) => {
        if (err) {
          logger.error('Error stopping REST server', { error: err });
          reject(err);
        } else {
          this.isRunning = false;
          this.server = null;
          logger.info('REST server stopped successfully');
          resolve();
        }
      });
    });
  }

  /**
   * Get Express app instance (for testing)
   */
  getApp(): Express {
    return this.app;
  }

  /**
   * Check if server is running
   */
  isServerRunning(): boolean {
    return this.isRunning;
  }
}

/**
 * Create a REST server instance with default configuration
 */
export function createRESTServer(config?: Partial<ControlAPIConfig>): RESTServer {
  const defaultConfig: ControlAPIConfig = {
    port: 3000,
    enableWebSocket: true,
    enableREST: true,
    enableOSC: false,
    corsOrigins: ['http://localhost:8080', 'http://localhost:3000'],
    rateLimit: {
      windowMs: 60000,
      maxRequests: 100,
    },
    authentication: {
      enabled: false,
    },
  };
  
  const mergedConfig: ControlAPIConfig = {
    ...defaultConfig,
    ...config,
    rateLimit: {
      ...defaultConfig.rateLimit,
      ...config?.rateLimit,
    },
    authentication: {
      enabled: config?.authentication?.enabled ?? defaultConfig.authentication.enabled,
      jwtSecret: config?.authentication?.jwtSecret ?? defaultConfig.authentication.jwtSecret,
    },
  };
  
  return new RESTServer(mergedConfig);
}