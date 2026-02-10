/**
 * Control module types and interfaces
 * Types for Control API, Web UI, and user commands
 */

import { SystemMode } from '../engine/types';
import { BrainState } from '../brain/types';

/**
 * User command types
 */
export type UserCommandType = 
  | 'setMode'
  | 'setIntensity'
  | 'setBlackout'
  | 'setStyle'
  | 'setScene'
  | 'setManualFixture'
  | 'savePreset'
  | 'loadPreset'
  | 'toggleEffect'
  | 'reloadConfigs';

/**
 * User command
 */
export interface UserCommand {
  type: UserCommandType;
  payload: any;
  timestamp: number;
  source: 'web' | 'osc' | 'api' | 'cli';
  userId?: string;
  sessionId?: string;
}

/**
 * System state for control
 */
export interface SystemState {
  mode: SystemMode;
  globalIntensity: number;  // 0..1
  blackout: boolean;
  activeStyleId?: string;
  activeSceneId?: string;
  manualOverrides: Map<string, any>;  // fixtureId -> override state
  lastUserActivity: number;
}

/**
 * WebSocket message types
 */
export type WebSocketMessageType = 
  | 'stateUpdate'
  | 'command'
  | 'error'
  | 'log'
  | 'metrics'
  | 'configUpdate'
  | 'healthCheck';

/**
 * WebSocket message
 */
export interface WebSocketMessage {
  type: WebSocketMessageType;
  data: any;
  timestamp: number;
  id?: string;
}

/**
 * API response
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
  requestId?: string;
}

/**
 * Control API configuration
 */
export interface ControlAPIConfig {
  port: number;
  enableWebSocket: boolean;
  enableREST: boolean;
  enableOSC: boolean;
  corsOrigins: string[];
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  authentication?: {
    enabled: boolean;
    jwtSecret?: string;
  };
}

/**
 * Web UI configuration
 */
export interface WebUIConfig {
  title: string;
  theme: 'dark' | 'light' | 'auto';
  defaultView: 'dashboard' | 'fixtures' | 'scenes' | 'metrics';
  enableLivePreview: boolean;
  updateInterval: number;  // ms
}

/**
 * OSC configuration
 */
export interface OSCConfig {
  enabled: boolean;
  receivePort: number;
  sendPort: number;
  sendHost: string;
  addressPatterns: Record<string, string>;
}

/**
 * Preset definition
 */
export interface Preset {
  id: string;
  name: string;
  description?: string;
  systemState: Partial<SystemState>;
  sceneOverrides?: Record<string, any>;
  fixtureStates?: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

/**
 * User session
 */
export interface UserSession {
  id: string;
  userId?: string;
  startedAt: number;
  lastActivity: number;
  ipAddress?: string;
  userAgent?: string;
  commands: UserCommand[];
}

/**
 * Control API state
 */
export interface ControlAPIState {
  isRunning: boolean;
  startTime: number;
  connectedClients: number;
  webSocketConnections: number;
  totalCommands: number;
  lastCommand?: UserCommand;
  errors: Array<{ timestamp: number; error: string }>;
}

/**
 * REST API endpoint definition
 */
export interface ApiEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  handler: string;
  description: string;
  requiresAuth: boolean;
  rateLimit?: number;
}

/**
 * Command validation result
 */
export interface CommandValidation {
  valid: boolean;
  errors: string[];
  normalizedCommand?: UserCommand;
}

/**
 * Rate limit info
 */
export interface RateLimitInfo {
  remaining: number;
  reset: number;
  limit: number;
  windowMs: number;
}

/**
 * Authentication token
 */
export interface AuthToken {
  token: string;
  expiresAt: number;
  userId?: string;
  permissions: string[];
}

/**
 * Permission levels
 */
export type PermissionLevel = 'view' | 'control' | 'admin' | 'super';

/**
 * User role
 */
export interface UserRole {
  id: string;
  name: string;
  permissions: PermissionLevel[];
  description?: string;
}
