/**
 * WebSocket API for real-time control and monitoring
 * Uses socket.io for bidirectional communication
 */

import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import { defaultLogger } from '../utils/logger';
import { VenueConfigManager, VenueConfig } from '../config/venue';
import { 
  UserCommand, 
  SystemState, 
  WebSocketMessage, 
  ApiResponse,
  UserCommandType,
  UserSession,
  AuthToken,
  UserRole
} from './types';

/**
 * WebSocket connection information
 */
interface WebSocketConnection {
  socketId: string;
  userId?: string;
  userRole?: UserRole;
  connectedAt: number;
  lastActivity: number;
  ipAddress: string;
  userAgent?: string;
}

/**
 * WebSocket API server
 */
export class WebSocketAPI {
  private logger = defaultLogger.child({ module: 'WebSocketAPI' });
  private io: SocketServer | null = null;
  private connections: Map<string, WebSocketConnection> = new Map();
  private venueManager: VenueConfigManager;
  private systemState: SystemState;
  private isRunning = false;
  private port: number;
  
  // Event handlers
  private commandHandlers: Map<UserCommandType, (command: UserCommand, socket: Socket) => Promise<ApiResponse>> = new Map();
  private stateUpdateCallbacks: Array<(state: SystemState) => void> = [];
  
  constructor(port: number = 3001, venueManager?: VenueConfigManager) {
    this.port = port;
    this.venueManager = venueManager || new VenueConfigManager();
    this.systemState = {
      mode: 'auto',
      globalIntensity: 1.0,
      blackout: false,
      manualOverrides: new Map(),
      lastUserActivity: Date.now()
    };
    
    this.registerDefaultHandlers();
    this.logger.info('WebSocketAPI initialized', { port });
  }
  
  /**
   * Start WebSocket server
   */
  async start(httpServer?: HttpServer): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('WebSocketAPI is already running');
      return;
    }
    
    try {
      this.logger.info('Starting WebSocketAPI...');
      
      if (httpServer) {
        // Attach to existing HTTP server
        this.io = new SocketServer(httpServer, {
          cors: {
            origin: ['http://localhost:8080', 'http://localhost:3000'],
            methods: ['GET', 'POST']
          },
          path: '/ws'
        });
      } else {
        // Create standalone server
        this.io = new SocketServer(this.port, {
          cors: {
            origin: ['http://localhost:8080', 'http://localhost:3000'],
            methods: ['GET', 'POST']
          },
          path: '/ws'
        });
      }
      
      // Setup event handlers
      this.setupSocketHandlers();
      
      this.isRunning = true;
      this.logger.info('WebSocketAPI started successfully', { port: this.port });
      
    } catch (error) {
      this.logger.error('Failed to start WebSocketAPI', { error });
      throw error;
    }
  }
  
  /**
   * Stop WebSocket server
   */
  async stop(): Promise<void> {
    if (!this.isRunning || !this.io) {
      this.logger.warn('WebSocketAPI is not running');
      return;
    }
    
    try {
      this.logger.info('Stopping WebSocketAPI...');
      
      // Disconnect all clients
      this.io.sockets.sockets.forEach(socket => {
        socket.disconnect(true);
      });
      
      // Close server
      this.io.close();
      this.io = null;
      
      // Clear connections
      this.connections.clear();
      
      this.isRunning = false;
      this.logger.info('WebSocketAPI stopped successfully');
      
    } catch (error) {
      this.logger.error('Error stopping WebSocketAPI', { error });
    }
  }
  
  /**
   * Setup socket.io event handlers
   */
  private setupSocketHandlers(): void {
    if (!this.io) return;
    
    this.io.on('connection', (socket: Socket) => {
      const connectionInfo: WebSocketConnection = {
        socketId: socket.id,
        connectedAt: Date.now(),
        lastActivity: Date.now(),
        ipAddress: socket.handshake.address,
        userAgent: socket.handshake.headers['user-agent']
      };
      
      this.connections.set(socket.id, connectionInfo);
      
      this.logger.info('Client connected', {
        socketId: socket.id,
        ip: connectionInfo.ipAddress,
        totalConnections: this.connections.size
      });
      
      // Send initial state to client
      this.sendInitialState(socket);
      
      // Setup message handlers
      this.setupClientHandlers(socket);
      
      // Handle disconnection
      socket.on('disconnect', (reason) => {
        this.handleDisconnect(socket, reason);
      });
      
      // Handle errors
      socket.on('error', (error) => {
        this.logger.error('Socket error', { socketId: socket.id, error });
      });
    });
  }
  
  /**
   * Setup handlers for individual client
   */
  private setupClientHandlers(socket: Socket): void {
    // Handle command messages
    socket.on('command', async (data: any, callback?: (response: ApiResponse) => void) => {
      await this.handleCommandMessage(socket, data, callback);
    });
    
    // Handle authentication
    socket.on('authenticate', async (token: string, callback?: (response: ApiResponse) => void) => {
      await this.handleAuthentication(socket, token, callback);
    });
    
    // Handle ping/pong
    socket.on('ping', (callback: () => void) => {
      if (callback) callback();
      this.updateConnectionActivity(socket.id);
    });
    
    // Handle venue switching (custom event, not a UserCommandType)
    socket.on('switchVenue', async (venueId: string, callback?: (response: ApiResponse) => void) => {
      await this.handleVenueSwitch(socket, venueId, callback);
    });
    
    // Handle state subscription
    socket.on('subscribe', (topics: string[], callback?: (response: ApiResponse) => void) => {
      this.handleSubscription(socket, topics, callback);
    });
    
    // Handle state unsubscription
    socket.on('unsubscribe', (topics: string[], callback?: (response: ApiResponse) => void) => {
      this.handleUnsubscription(socket, topics, callback);
    });
  }
  
  /**
   * Send initial state to newly connected client
   */
  private sendInitialState(socket: Socket): void {
    const initialState = {
      type: 'initialState',
      data: {
        systemState: this.systemState,
        venue: this.venueManager.getCurrentVenue(),
        availableVenues: this.venueManager.getAllVenues(),
        serverTime: Date.now(),
        connectionId: socket.id
      }
    };
    
    socket.emit('message', initialState);
  }
  
  /**
   * Handle command message from client
   */
  private async handleCommandMessage(
    socket: Socket, 
    data: any, 
    callback?: (response: ApiResponse) => void
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      this.updateConnectionActivity(socket.id);
      
      // Validate command structure
      if (!data || typeof data !== 'object' || !data.type) {
        throw new Error('Invalid command format');
      }
      
      const command: UserCommand = {
        type: data.type as UserCommandType,
        payload: data.payload || {},
        timestamp: data.timestamp || Date.now(),
        source: 'web', // Default source for WebSocket commands
        userId: data.userId,
        sessionId: data.sessionId
      };
      
      this.logger.debug('Received command', { 
        socketId: socket.id, 
        commandType: command.type,
        payload: command.payload 
      });
      
      // Find handler for command type
      const handler = this.commandHandlers.get(command.type);
      if (!handler) {
        throw new Error(`No handler for command type: ${command.type}`);
      }
      
      // Execute command
      const response = await handler(command, socket);
      
      // Update system state
      this.systemState.lastUserActivity = Date.now();
      
      // Send response to client
      if (callback) {
        callback(response);
      } else {
        socket.emit('commandResponse', {
          commandId: data.commandId,
          ...response
        });
      }
      
      // Broadcast state update if needed
      if (response.success && this.shouldBroadcastStateUpdate(command.type)) {
        this.broadcastStateUpdate();
      }
      
      this.logger.debug('Command processed', {
        socketId: socket.id,
        commandType: command.type,
        processingTime: Date.now() - startTime
      });
      
    } catch (error) {
      this.logger.error('Error handling command', { socketId: socket.id, error, data });
      
      const errorResponse: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      };
      
      if (callback) {
        callback(errorResponse);
      } else {
        socket.emit('error', errorResponse);
      }
    }
  }
  
  /**
   * Handle client authentication
   */
  private async handleAuthentication(
    socket: Socket,
    token: string,
    callback?: (response: ApiResponse) => void
  ): Promise<void> {
    try {
      // In Phase 2, implement real authentication
      // For now, accept any token
      const connection = this.connections.get(socket.id);
      if (connection) {
        connection.userId = `user-${socket.id}`;
        connection.userRole = { 
          id: 'operator', 
          name: 'Operator', 
          permissions: ['view', 'control'],
          description: 'Default operator role'
        };
      }
      
      const response: ApiResponse = {
        success: true,
        data: {
          authenticated: true,
          userId: `user-${socket.id}`,
          userRole: 'operator',
          permissions: ['read', 'write', 'control']
        },
        timestamp: Date.now()
      };
      
      if (callback) {
        callback(response);
      }
      
      socket.emit('authenticated', response.data);
      
      this.logger.info('Client authenticated', { socketId: socket.id });
      
    } catch (error) {
      this.logger.error('Authentication error', { socketId: socket.id, error });
      
      const errorResponse: ApiResponse = {
        success: false,
        error: 'Authentication failed',
        timestamp: Date.now()
      };
      
      if (callback) {
        callback(errorResponse);
      }
    }
  }
  
  /**
   * Handle venue switching
   */
  private async handleVenueSwitch(
    socket: Socket,
    venueId: string,
    callback?: (response: ApiResponse) => void
  ): Promise<void> {
    try {
      const success = await this.venueManager.switchVenue(venueId);
      
      const response: ApiResponse = {
        success,
        data: {
          venueId,
          switched: success,
          venue: success ? this.venueManager.getCurrentVenue() : null
        },
        timestamp: Date.now()
      };
      
      if (callback) {
        callback(response);
      }
      
      // Broadcast venue change to all clients
      if (success) {
        this.broadcastToAll('venueChanged', {
          venueId,
          venue: this.venueManager.getCurrentVenue()
        });
      }

    } catch (error) {
      this.logger.error('Venue switch error', { socketId: socket.id, venueId, error });
      
      const errorResponse: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Venue switch failed',
        timestamp: Date.now()
      };
      
      if (callback) {
        callback(errorResponse);
      }
    }
  }
  
  /**
   * Handle topic subscription
   */
  private handleSubscription(
    socket: Socket,
    topics: string[],
    callback?: (response: ApiResponse) => void
  ): void {
    try {
      // Join socket.io rooms for each topic
      topics.forEach(topic => {
        socket.join(topic);
      });
      
      const response: ApiResponse = {
        success: true,
        data: {
          subscribed: topics,
          message: `Subscribed to ${topics.length} topic(s)`
        },
        timestamp: Date.now()
      };
      
      if (callback) {
        callback(response);
      }
      
      this.logger.debug('Client subscribed to topics', { socketId: socket.id, topics });
      
    } catch (error) {
      this.logger.error('Subscription error', { socketId: socket.id, topics, error });
      
      const errorResponse: ApiResponse = {
        success: false,
        error: 'Subscription failed',
        timestamp: Date.now()
      };
      
      if (callback) {
        callback(errorResponse);
      }
    }
  }
  
  /**
   * Handle topic unsubscription
   */
  private handleUnsubscription(
    socket: Socket,
    topics: string[],
    callback?: (response: ApiResponse) => void
  ): void {
    try {
      // Leave socket.io rooms for each topic
      topics.forEach(topic => {
        socket.leave(topic);
      });
      
      const response: ApiResponse = {
        success: true,
        data: {
          unsubscribed: topics,
          message: `Unsubscribed from ${topics.length} topic(s)`
        },
        timestamp: Date.now()
      };
      
      if (callback) {
        callback(response);
      }
      
      this.logger.debug('Client unsubscribed from topics', { socketId: socket.id, topics });
      
    } catch (error) {
      this.logger.error('Unsubscription error', { socketId: socket.id, topics, error });
      
      const errorResponse: ApiResponse = {
        success: false,
        error: 'Unsubscription failed',
        timestamp: Date.now()
      };
      
      if (callback) {
        callback(errorResponse);
      }
    }
  }
  
  /**
   * Handle client disconnection
   */
  private handleDisconnect(socket: Socket, reason: string): void {
    this.connections.delete(socket.id);
    
    this.logger.info('Client disconnected', {
      socketId: socket.id,
      reason,
      totalConnections: this.connections.size
    });
  }
  
  /**
   * Update connection activity timestamp
   */
  private updateConnectionActivity(socketId: string): void {
    const connection = this.connections.get(socketId);
    if (connection) {
      connection.lastActivity = Date.now();
    }
  }
  
  /**
   * Check if state should be broadcast after command
   */
  private shouldBroadcastStateUpdate(commandType: UserCommandType): boolean {
    const broadcastCommands: UserCommandType[] = [
      'setMode',
      'setIntensity',
      'setBlackout',
      'setScene'
    ];
    
    return broadcastCommands.includes(commandType);
  }
  
  /**
   * Broadcast state update to all connected clients
   */
  broadcastStateUpdate(): void {
    if (!this.io) return;
    
    const stateUpdate = {
      type: 'stateUpdate',
      data: {
        systemState: this.systemState,
        timestamp: Date.now()
      }
    };
    
    this.io.emit('message', stateUpdate);
  }
  
  /**
   * Broadcast message to all connected clients
   */
  broadcastToAll(event: string, data: any): void {
    if (!this.io) return;
    
    this.io.emit(event, data);
  }
  
  /**
   * Send message to specific client
   */
  sendToClient(socketId: string, event: string, data: any): boolean {
    if (!this.io) return false;
    
    const socket = this.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit(event, data);
      return true;
    }
    
    return false;
  }
  
  /**
   * Send message to clients in specific room/topic
   */
  sendToRoom(room: string, event: string, data: any): void {
    if (!this.io) return;
    
    this.io.to(room).emit(event, data);
  }
  
  /**
   * Register command handler
   */
  registerCommandHandler(
    type: UserCommandType, 
    handler: (command: UserCommand, socket: Socket) => Promise<ApiResponse>
  ): void {
    this.commandHandlers.set(type, handler);
    this.logger.debug('Command handler registered', { type });
  }
  
  /**
   * Register state update callback
   */
  registerStateUpdateCallback(callback: (state: SystemState) => void): void {
    this.stateUpdateCallbacks.push(callback);
  }
  
  /**
   * Update system state
   */
  updateSystemState(state: Partial<SystemState>): void {
    this.systemState = {
      ...this.systemState,
      ...state,
      lastUserActivity: Date.now()
    };
    
    // Notify callbacks
    this.stateUpdateCallbacks.forEach(callback => {
      try {
        callback(this.systemState);
      } catch (error) {
        this.logger.error('Error in state update callback', { error });
      }
    });
    
    // Broadcast update
    this.broadcastStateUpdate();
  }
  
  /**
   * Get current system state
   */
  getSystemState(): SystemState {
    return { ...this.systemState };
  }
  
  /**
   * Get connection statistics
   */
  getConnectionStats(): {
    totalConnections: number;
    activeConnections: number;
    connections: WebSocketConnection[];
  } {
    const now = Date.now();
    const activeConnections = Array.from(this.connections.values()).filter(
      conn => now - conn.lastActivity < 30000 // 30 seconds inactivity threshold
    );
    
    return {
      totalConnections: this.connections.size,
      activeConnections: activeConnections.length,
      connections: Array.from(this.connections.values())
    };
  }
  
  /**
   * Register default command handlers
   */
  private registerDefaultHandlers(): void {
    // Mode setting handler
    this.registerCommandHandler('setMode', async (command, socket) => {
      const mode = command.payload.mode;
      if (!['auto', 'manual', 'scene', 'test'].includes(mode)) {
        return {
          success: false,
          error: `Invalid mode: ${mode}`,
          timestamp: Date.now()
        };
      }
      
      this.systemState.mode = mode;
      this.logger.info('System mode changed', { mode, socketId: socket.id });
      
      return {
        success: true,
        data: { mode },
        timestamp: Date.now()
      };
    });
    
    // Intensity setting handler
    this.registerCommandHandler('setIntensity', async (command, socket) => {
      const intensity = command.payload.intensity;
      if (typeof intensity !== 'number' || intensity < 0 || intensity > 1) {
        return {
          success: false,
          error: 'Intensity must be a number between 0 and 1',
          timestamp: Date.now()
        };
      }
      
      this.systemState.globalIntensity = intensity;
      this.logger.info('Global intensity changed', { intensity, socketId: socket.id });
      
      return {
        success: true,
        data: { intensity },
        timestamp: Date.now()
      };
    });
    
    // Blackout handler
    this.registerCommandHandler('setBlackout', async (command, socket) => {
      const enable = command.payload.enable ?? true;
      this.systemState.blackout = enable;
      
      if (enable) {
        this.logger.warn('Blackout enabled', { socketId: socket.id });
      } else {
        this.logger.info('Blackout disabled', { socketId: socket.id });
      }
      
      return {
        success: true,
        data: { blackout: enable },
        timestamp: Date.now()
      };
    });
    
    // Style setting handler
    this.registerCommandHandler('setStyle', async (command, socket) => {
      const styleId = command.payload.styleId;
      if (!styleId || typeof styleId !== 'string') {
        return {
          success: false,
          error: 'Style ID is required',
          timestamp: Date.now()
        };
      }
      
      this.systemState.activeStyleId = styleId;
      this.logger.info('Active style changed', { styleId, socketId: socket.id });
      
      return {
        success: true,
        data: { styleId },
        timestamp: Date.now()
      };
    });
    
    // Scene setting handler
    this.registerCommandHandler('setScene', async (command, socket) => {
      const sceneId = command.payload.sceneId;
      if (!sceneId || typeof sceneId !== 'string') {
        return {
          success: false,
          error: 'Scene ID is required',
          timestamp: Date.now()
        };
      }
      
      this.systemState.activeSceneId = sceneId;
      this.logger.info('Active scene changed', { sceneId, socketId: socket.id });
      
      return {
        success: true,
        data: { sceneId },
        timestamp: Date.now()
      };
    });
    
    // Manual fixture control handler
    this.registerCommandHandler('setManualFixture', async (command, socket) => {
      const { fixtureId, state } = command.payload;
      
      if (!fixtureId || typeof fixtureId !== 'string') {
        return {
          success: false,
          error: 'Fixture ID is required',
          timestamp: Date.now()
        };
      }
      
      if (!state || typeof state !== 'object') {
        return {
          success: false,
          error: 'Fixture state object is required',
          timestamp: Date.now()
        };
      }
      
      // Store manual override
      this.systemState.manualOverrides.set(fixtureId, {
        ...state,
        timestamp: Date.now(),
        source: 'manual'
      });
      
      this.logger.info('Manual fixture override', { fixtureId, socketId: socket.id });
      
      return {
        success: true,
        data: { fixtureId, state },
        timestamp: Date.now()
      };
    });
    
    // Save preset handler
    this.registerCommandHandler('savePreset', async (command, socket) => {
      const { presetId, name, description } = command.payload;
      
      if (!presetId || typeof presetId !== 'string') {
        return {
          success: false,
          error: 'Preset ID is required',
          timestamp: Date.now()
        };
      }
      
      // In Phase 2, this would save to database
      // For now, just log and return success
      this.logger.info('Preset save requested', {
        presetId,
        name: name || presetId,
        socketId: socket.id
      });
      
      return {
        success: true,
        data: {
          presetId,
          saved: true,
          message: 'Preset saved (simulated in Phase 2)'
        },
        timestamp: Date.now()
      };
    });
    
    // Load preset handler
    this.registerCommandHandler('loadPreset', async (command, socket) => {
      const presetId = command.payload.presetId;
      
      if (!presetId || typeof presetId !== 'string') {
        return {
          success: false,
          error: 'Preset ID is required',
          timestamp: Date.now()
        };
      }
      
      // In Phase 2, this would load from database
      // For now, just log and return success
      this.logger.info('Preset load requested', { presetId, socketId: socket.id });
      
      // Simulate loading preset
      this.systemState.mode = 'manual';
      this.systemState.activeSceneId = `preset-${presetId}`;
      
      return {
        success: true,
        data: {
          presetId,
          loaded: true,
          message: 'Preset loaded (simulated in Phase 2)'
        },
        timestamp: Date.now()
      };
    });
    
    // Toggle effect handler
    this.registerCommandHandler('toggleEffect', async (command, socket) => {
      const { effectId, enabled } = command.payload;
      
      if (!effectId || typeof effectId !== 'string') {
        return {
          success: false,
          error: 'Effect ID is required',
          timestamp: Date.now()
        };
      }
      
      this.logger.info('Effect toggle requested', {
        effectId,
        enabled: enabled ?? 'toggle',
        socketId: socket.id
      });
      
      return {
        success: true,
        data: {
          effectId,
          toggled: true,
          message: 'Effect toggle simulated (Phase 2)'
        },
        timestamp: Date.now()
      };
    });
    
    // Reload configs handler
    this.registerCommandHandler('reloadConfigs', async (command, socket) => {
      this.logger.info('Config reload requested', { socketId: socket.id });
      
      // In Phase 2, this would trigger config reload
      // For now, just log and return success
      
      return {
        success: true,
        data: {
          reloaded: true,
          message: 'Config reload initiated (simulated in Phase 2)'
        },
        timestamp: Date.now()
      };
    });
  }
}
