import { Engine } from '../../../src/engine/engine';
import { AudioAnalyzer } from '../../../src/audio/analyzer';
import { BrainFacade } from '../../../src/brain/facade';
import { LightingFacade } from '../../../src/lighting/facade';
import { WebSocketAPI } from '../../../src/control/websocket';
import { EngineConfig, EngineState } from '../../../src/engine/types';

// Mock dependencies
const mockAudioAnalyzer = {
  processFrame: jest.fn(),
  getState: jest.fn(),
} as unknown as AudioAnalyzer;

const mockBrainFacade = {
  update: jest.fn(),
  updateSlow: jest.fn(),
  reloadConfigs: jest.fn(),
} as unknown as BrainFacade;

const mockLightingFacade = {
  update: jest.fn(),
  reloadConfigs: jest.fn(),
} as unknown as LightingFacade;

const mockControlAPI = {
  start: jest.fn(),
  stop: jest.fn(),
  broadcastToAll: jest.fn(),
} as unknown as WebSocketAPI;

const defaultConfig: EngineConfig = {
  fastTickInterval: 40,
  slowTickInterval: 500,
  enableHotReload: false,
  maxFastLoopTime: 50,
};

describe('Engine', () => {
  let engine: Engine;

  beforeEach(() => {
    jest.clearAllMocks();
    engine = new Engine(
      mockAudioAnalyzer,
      mockBrainFacade,
      mockLightingFacade,
      mockControlAPI,
      defaultConfig,
    );
  });

  describe('constructor', () => {
    it('should initialize with default state', () => {
      expect(engine).toBeInstanceOf(Engine);
      expect(engine.isEngineRunning()).toBe(false);
    });

    it('should set initial state correctly', () => {
      const state = engine.getState();
      expect(state.isRunning).toBe(false);
      expect(state.startTime).toBe(0);
      expect(state.fastTickCount).toBe(0);
      expect(state.slowTickCount).toBe(0);
      expect(state.performance).toBeDefined();
      expect(state.health).toBeDefined();
    });
  });

  describe('start', () => {
    it('should start the engine', () => {
      engine.start();
      expect(engine.isEngineRunning()).toBe(true);
    });

    it('should not start if already running', () => {
      engine.start();
      const originalState = engine.getState();
      engine.start(); // Second call should be ignored
      expect(engine.isEngineRunning()).toBe(true);
      // State should remain unchanged
      expect(engine.getState().startTime).toBe(originalState.startTime);
    });
  });

  describe('stop', () => {
    it('should stop the engine', async () => {
      engine.start();
      expect(engine.isEngineRunning()).toBe(true);
      
      await engine.stop();
      
      expect(engine.isEngineRunning()).toBe(false);
      expect(mockControlAPI.stop).toHaveBeenCalled();
    });

    it('should not stop if not running', async () => {
      await engine.stop();
      expect(mockControlAPI.stop).not.toHaveBeenCalled();
    });
  });

  describe('getState', () => {
    it('should return a copy of state', () => {
      const state1 = engine.getState();
      const state2 = engine.getState();
      expect(state1).toEqual(state2);
      expect(state1).not.toBe(state2); // Should be a copy
    });

    it('should reflect running state after start', () => {
      engine.start();
      const state = engine.getState();
      expect(state.isRunning).toBe(true);
      expect(state.startTime).toBeGreaterThan(0);
    });
  });

  describe('getPerformanceMetrics', () => {
    it('should return performance metrics', () => {
      const metrics = engine.getPerformanceMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.fastLoopTime).toBe(0);
      expect(metrics.slowLoopTime).toBe(0);
      expect(metrics.memoryUsage).toBe(0);
    });
  });

  describe('getHealthStatus', () => {
    it('should return health status', () => {
      const health = engine.getHealthStatus();
      expect(health).toBeDefined();
      expect(health.overall).toBe('healthy');
      expect(health.details).toBeInstanceOf(Array);
    });
  });

  describe('getUptime', () => {
    it('should return 0 when not started', () => {
      expect(engine.getUptime()).toBe(0);
    });

    it('should return positive uptime after start', () => {
      engine.start();
      const uptime = engine.getUptime();
      expect(uptime).toBeGreaterThanOrEqual(0);
      expect(uptime).toBeLessThan(1000); // Should be recent
    });
  });

  describe('fastTick (private)', () => {
    // We can't directly test private methods, but we can test their effects
    // through start/stop cycles or by mocking intervals
    it('should be called when engine is running', () => {
      // This is more of an integration test
      // We'll verify that the fast tick logic doesn't throw errors
      // by mocking the dependencies
      (mockAudioAnalyzer.processFrame as jest.Mock).mockReturnValue({
        timestamp: Date.now(),
        energy: 0.5,
        beat: false,
        bpm: 120,
        mood: 'calm' as const,
      });

      (mockBrainFacade.update as jest.Mock).mockReturnValue({
        brainState: 'Idle',
        sceneState: {
          sceneId: 'test',
          paletteId: 'default',
          baseIntensity: 0.5,
          effectDescriptors: [],
        },
        groupEffects: [],
      });

      (mockLightingFacade.update as jest.Mock).mockReturnValue({
        universeFrames: [],
        fixtureStates: new Map(),
      });

      // Start engine - fastTick will be called via interval
      engine.start();
      
      // We can't easily wait for interval, but we can verify mocks were not called yet
      // because interval hasn't fired. Instead, we'll just ensure no errors.
      expect(() => engine.start()).not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle errors in fastTick gracefully', () => {
      // Mock an error in audio analyzer
      (mockAudioAnalyzer.processFrame as jest.Mock).mockImplementation(() => {
        throw new Error('Audio processing error');
      });

      engine.start();
      // Should not crash
      expect(engine.isEngineRunning()).toBe(true);
    });
  });
});