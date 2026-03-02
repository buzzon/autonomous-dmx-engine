/**
 * JWT Authentication Middleware for REST API
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { defaultLogger } from '../../utils/logger';
import { UserRole, PermissionLevel } from '../types';

const logger = defaultLogger.child({ module: 'Auth' });

/**
 * Extended Request interface with user property
 */
export interface AuthRequest extends Request {
  user?: {
    userId: string;
    role: UserRole;
    permissions: PermissionLevel[];
  };
}

/**
 * Authentication middleware
 */
export function authMiddleware(jwtSecret?: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: 'No authorization header',
        timestamp: Date.now(),
      });
    }
    
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({
        success: false,
        error: 'Invalid authorization format. Expected: Bearer <token>',
        timestamp: Date.now(),
      });
    }
    
    const token = parts[1];
    
    try {
      if (!jwtSecret) {
        logger.warn('JWT secret not configured, using demo secret');
        // For development only
        const decoded = jwt.verify(token, 'demo-secret-change-in-production') as any;
        req.user = {
          userId: decoded.userId || 'demo-user',
          role: {
            id: 'operator',
            name: 'Operator',
            permissions: ['view', 'control'],
            description: 'Demo operator role',
          },
          permissions: ['view', 'control'],
        };
        return next();
      }
      
      const decoded = jwt.verify(token, jwtSecret) as any;
      
      // Validate token structure
      if (!decoded.userId || !decoded.role) {
        throw new Error('Invalid token payload');
      }
      
      req.user = {
        userId: decoded.userId,
        role: decoded.role,
        permissions: decoded.permissions || [],
      };
      
      logger.debug('User authenticated', { userId: decoded.userId });
      next();
    } catch (error) {
      logger.warn('Authentication failed', { error: error.message });
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
        timestamp: Date.now(),
      });
    }
  };
}

/**
 * Role-based authorization middleware
 */
export function requireRole(allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        timestamp: Date.now(),
      });
    }
    
    if (!allowedRoles.includes(req.user.role.id)) {
      logger.warn('Role authorization failed', {
        userId: req.user.userId,
        role: req.user.role.id,
        allowedRoles,
      });
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        timestamp: Date.now(),
      });
    }
    
    next();
  };
}

/**
 * Permission-based authorization middleware
 */
export function requirePermission(requiredPermission: PermissionLevel) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        timestamp: Date.now(),
      });
    }
    
    if (!req.user.permissions.includes(requiredPermission)) {
      logger.warn('Permission check failed', {
        userId: req.user.userId,
        permissions: req.user.permissions,
        required: requiredPermission,
      });
      return res.status(403).json({
        success: false,
        error: `Permission '${requiredPermission}' required`,
        timestamp: Date.now(),
      });
    }
    
    next();
  };
}

/**
 * Generate JWT token for a user
 */
export function generateToken(
  userId: string,
  role: UserRole,
  jwtSecret: string,
  expiresIn: string = '24h'
): string {
  const payload = {
    userId,
    role,
    permissions: role.permissions,
    iat: Math.floor(Date.now() / 1000),
  };
  
  return jwt.sign(payload, jwtSecret, { expiresIn });
}

/**
 * Demo authentication for development
 */
export function demoAuthMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  // For development only - creates a demo user
  req.user = {
    userId: 'demo-user',
    role: {
      id: 'operator',
      name: 'Operator',
      permissions: ['view', 'control', 'admin'],
      description: 'Demo operator role',
    },
    permissions: ['view', 'control', 'admin'],
  };
  
  logger.debug('Demo authentication applied');
  next();
}