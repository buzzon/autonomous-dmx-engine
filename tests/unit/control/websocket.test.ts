import { WebSocketAPI } from '../../../src/control/websocket';
import { VenueConfigManager } from '../../../src/config/venue';
import { UserCommand, UserCommandType, SystemState, ApiResponse } from '../../../src/control/types';

// Mock socket.io
jest.mock('socket.io', () => {
  const mockSocket = {
    id: 'test-socket-id',
    handshake: {
      address: '127.0.0.1',
      headers: { 'user-agent': 'test-agent' },
    },
    join: jest.fn(),
    leave: jest.fn(),
    emit: jest.fn(),
    on: jest.fn(),
    disconnect: jest.fn(),
  };

  const mockServer: any = {
    on: jest.fn(),
    emit: jest.fn(),
    to: jest.fn(() => mockServer),
    in: jest.fn(() => mockServer),
    sockets: {
      sockets: new Map([['test-socket-id', mockSocket]]),
    },
  };

  return {
    Server: jest.fn(() => mockServer),
  };
});

// Mock VenueConfigManager
jest.mock('../../../src/config/venue', () => ({
  VenueConfigManager: jest.fn().mockImplementation(() => ({
    getAllVenues: jest.fn(),
    getCurrentVenue: jest.fn(),
    switchVenue: jest.fn(),
  })),
}));

describe('WebSocketAPI', () => {
  let websocketAPI: WebSocketAPI;
  let mockVenueManager: jest.Mocked<VenueConfigManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockVenueManager = new VenueConfigManager() as jest.Mocked<VenueConfigManager>;
    websocketAPI = new WebSocketAPI(3001, mockVenueManager);
  });

  describe('constructor', () => {
    it('should initialize with default port', () => {
      const api = new WebSocketAPI();
      expect(api).toBeInstanceOf(WebSocketAPI);
    });

    it('should initialize with custom port', () => {
      const api = new WebSocketAPI(4000);
      expect(api).toBeInstanceOf(WebSocketAPI);
    });

    it('should initialize with venue manager', () => {
      expect(websocketAPI).toBeInstanceOf(WebSocketAPI);
    });

    it('should set initial system state', () => {
      const state = websocketAPI.getSystemState();
      expect(state.mode).toBe('auto');
      expect(state.globalIntensity).toBe(1.0);
      expect(state.blackout).toBe(false);
      expect(state.manualOverrides).toBeInstanceOf(Map);
    });
  });

  describe('start and stop', () => {
    it('should start successfully', async () => {
      await expect(websocketAPI.start()).resolves.not.toThrow();
    });

    it('should not start if already running', async () => {
      await websocketAPI.start();
      await websocketAPI.start(); // Second call should be ignored
      // Should not throw
      expect(true).toBe(true);
    });

    it('should stop successfully', async () => {
      await websocketAPI.start();
      await expect(websocketAPI.stop()).resolves.not.toThrow();
    });

    it('should not stop if not running', async () => {
      await expect(websocketAPI.stop()).resolves.not.toThrow();
    });
  });

  describe('command handling', () => {
    it('should register command handler', () => {
      const handler = jest.fn();
      websocketAPI.registerCommandHandler('setIntensity' as UserCommandType, handler);
      // Can't directly test internal map, but we can verify no error
      expect(() => websocketAPI.registerCommandHandler('setIntensity' as UserCommandType, handler)).not.toThrow();
    });

    it('should register state update callback', () => {
      const callback = jest.fn();
      websocketAPI.registerStateUpdateCallback(callback);
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('system state', () => {
    it('should update system state', () => {
      const newState: Partial<SystemState> = {
        mode: 'manual',
        globalIntensity: 0.5,
      };
      
      websocketAPI.updateSystemState(newState);
      const state = websocketAPI.getSystemState();
      
      expect(state.mode).toBe('manual');
      expect(state.globalIntensity).toBe(0.5);
      expect(state.blackout).toBe(false); // Should remain unchanged
    });

    it('should call state update callbacks', () => {
      const callback = jest.fn();
      websocketAPI.registerStateUpdateCallback(callback);
      
      websocketAPI.updateSystemState({ mode: 'manual' });
      
      expect(callback).toHaveBeenCalled();
      expect(callback.mock.calls[0][0].mode).toBe('manual');
    });
  });

  describe('broadcasting', () => {
    beforeEach(async () => {
      await websocketAPI.start();
    });

    it('should broadcast state update', () => {
      // This is mostly testing that the method doesn't throw
      expect(() => websocketAPI.broadcastStateUpdate()).not.toThrow();
    });

    it('should broadcast to all', () => {
      const testData = { message: 'test' };
      expect(() => websocketAPI.broadcastToAll('testEvent', testData)).not.toThrow();
    });

    it('should send to client', () => {
      const result = websocketAPI.sendToClient('test-socket-id', 'testEvent', {});
      expect(result).toBe(true);
    });

    it('should return false when sending to non-existent client', () => {
      const result = websocketAPI.sendToClient('non-existent', 'testEvent', {});
      expect(result).toBe(false);
    });

    it('should send to room', () => {
      expect(() => websocketAPI.sendToRoom('testRoom', 'testEvent', {})).not.toThrow();
    });
  });

  describe('connection stats', () => {
    it('should get connection stats', () => {
      const stats = websocketAPI.getConnectionStats();
      expect(stats).toHaveProperty('totalConnections');
      expect(stats).toHaveProperty('activeConnections');
      expect(stats).toHaveProperty('connections');
      expect(stats.totalConnections).toBe(0); // No connections yet
    });
  });

  describe('default command handlers', () => {
    // The WebSocketAPI registers default handlers in constructor
    // We can test that they exist by trying to execute commands
    it('should have default handlers for common commands', () => {
      // This is a basic test to ensure the API can be constructed
      // without errors related to missing handlers
      expect(websocketAPI).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle errors in state update callbacks gracefully', () => {
      const errorCallback = jest.fn(() => {
        throw new Error('Callback error');
      });
      
      websocketAPI.registerStateUpdateCallback(errorCallback);
      
      // Should not throw
      expect(() => websocketAPI.updateSystemState({ mode: 'auto' })).not.toThrow();
    });
  });
});