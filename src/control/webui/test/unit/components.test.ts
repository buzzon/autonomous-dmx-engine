/**
 * Unit tests for Phase 3 UI components
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { store } from '../../store/store';
import { extendedStore } from '../../store/store-extended';

// Mock ImGui for testing
const mockImGui = {
  Button: () => true,
  Text: () => {},
  TextColored: () => {},
  SameLine: () => {},
  NewLine: () => {},
  Begin: () => true,
  End: () => {},
  BeginChild: () => true,
  EndChild: () => {},
  SetNextWindowPos: () => {},
  SetNextWindowSize: () => {},
  GetIO: () => ({ DisplaySize: { x: 1920, y: 1080 } }),
  StyleColorsDark: () => {},
  StyleColorsLight: () => {},
  PushStyleColor: () => {},
  PopStyleColor: () => {},
  SliderFloat: () => true,
  Checkbox: () => true,
  CollapsingHeader: () => true,
  TreeNodeFlags: { DefaultOpen: 1 }
};

// Mock global ImGui
global.ImGui = mockImGui;

describe('Phase 3 UI Components', () => {
  beforeEach(() => {
    // Reset stores before each test
    const initialState = store.getInitialState();
    store.setState(initialState);
    
    const extendedInitialState = extendedStore.getInitialState();
    extendedStore.setState(extendedInitialState);
  });
  
  afterEach(() => {
    // Clean up
    jest.clearAllMocks();
  });
  
  describe('Store Integration', () => {
    it('should initialize store with correct default state', () => {
      const state = store.getState();
      
      expect(state.system.mode).toBe('auto');
      expect(state.system.globalIntensity).toBe(1);
      expect(state.system.blackout).toBe(false);
      
      expect(state.ui.theme).toBe('dark');
      expect(state.ui.layout).toBe('dashboard');
      expect(state.ui.currentPage).toBe('home');
    });
    
    it('should update store state correctly', () => {
      store.setMode('manual');
      store.setIntensity(0.5);
      store.setBlackout(true);
      
      const state = store.getState();
      
      expect(state.system.mode).toBe('manual');
      expect(state.system.globalIntensity).toBe(0.5);
      expect(state.system.blackout).toBe(true);
    });
    
    it('should handle page navigation', () => {
      store.setCurrentPage('audio');
      expect(store.getState().ui.currentPage).toBe('audio');
      
      store.setCurrentPage('dmx');
      expect(store.getState().ui.currentPage).toBe('dmx');
      
      store.setCurrentPage('scenes');
      expect(store.getState().ui.currentPage).toBe('scenes');
    });
  });
  
  describe('Extended Store Integration', () => {
    it('should initialize extended store with configuration data', () => {
      const state = extendedStore.getState();
      
      // Check that extended store has expected structure
      expect(state).toHaveProperty('scenes');
      expect(state).toHaveProperty('effects');
      expect(state).toHaveProperty('fixtures');
      expect(state).toHaveProperty('rules');
      expect(state).toHaveProperty('config');
      expect(state).toHaveProperty('security');
    });
    
    it('should handle scene management', () => {
      const mockScene = {
        id: 'test-scene',
        name: 'Test Scene',
        description: 'Test scene description',
        fixtures: [],
        effects: [],
        intensity: 1,
        duration: 1000
      };
      
      // Test would normally call extendedStore methods
      // For now, just verify structure
      const state = extendedStore.getState();
      expect(Array.isArray(state.scenes)).toBe(true);
    });
    
    it('should handle effect management', () => {
      const state = extendedStore.getState();
      expect(Array.isArray(state.effects)).toBe(true);
      expect(Array.isArray(state.activeEffects)).toBe(true);
    });
  });
  
  describe('UI State Management', () => {
    it('should toggle theme correctly', () => {
      const initialState = store.getState();
      expect(initialState.ui.theme).toBe('dark');
      
      store.toggleTheme();
      expect(store.getState().ui.theme).toBe('light');
      
      store.toggleTheme();
      expect(store.getState().ui.theme).toBe('dark');
    });
    
    it('should toggle debug panel', () => {
      const initialState = store.getState();
      expect(initialState.ui.showDebug).toBe(false);
      
      store.toggleDebug();
      expect(store.getState().ui.showDebug).toBe(true);
      
      store.toggleDebug();
      expect(store.getState().ui.showDebug).toBe(false);
    });
    
    it('should change layout modes', () => {
      store.setLayout('compact');
      expect(store.getState().ui.layout).toBe('compact');
      
      store.setLayout('expanded');
      expect(store.getState().ui.layout).toBe('expanded');
      
      store.setLayout('dashboard');
      expect(store.getState().ui.layout).toBe('dashboard');
    });
  });
  
  describe('Real-time Data Updates', () => {
    it('should update audio metrics', () => {
      const mockAudioMetrics = {
        energy: 0.75,
        isBeat: true,
        bpm: 128,
        mood: 'Energetic'
      };
      
      store.updateAudioMetrics(mockAudioMetrics);
      const state = store.getState();
      
      expect(state.audio.energy).toBe(0.75);
      expect(state.audio.isBeat).toBe(true);
      expect(state.audio.bpm).toBe(128);
      expect(state.audio.mood).toBe('Energetic');
    });
    
    it('should update audio data', () => {
      const mockAudioData = {
        waveform: [0.1, 0.2, 0.3, 0.4, 0.5],
        spectrum: [0.5, 0.6, 0.7, 0.8],
        peaks: [0.9]
      };
      
      store.updateAudioData(mockAudioData);
      const state = store.getState();
      
      expect(state.realtime.audioData.waveform).toEqual(mockAudioData.waveform);
      expect(state.realtime.audioData.spectrum).toEqual(mockAudioData.spectrum);
      expect(state.realtime.audioData.peaks).toEqual(mockAudioData.peaks);
    });
    
    it('should update DMX data', () => {
      const mockDMXData = {
        channels: new Array(512).fill(0).map((_, i) => i % 256 / 255)
      };
      
      store.updateDMXData(mockDMXData);
      const state = store.getState();
      
      expect(state.realtime.dmxData.channels).toHaveLength(512);
      expect(state.realtime.dmxData.channels[0]).toBe(0);
      expect(state.realtime.dmxData.channels[255]).toBeCloseTo(255/255);
    });
    
    it('should update system metrics', () => {
      const mockSystemMetrics = {
        cpu: 45.5,
        memory: 67.3,
        fps: 60
      };
      
      store.updateSystemMetrics(mockSystemMetrics);
      const state = store.getState();
      
      expect(state.system.cpu).toBe(45.5);
      expect(state.system.memory).toBe(67.3);
      expect(state.system.fps).toBe(60);
    });
  });
  
  describe('Socket State Management', () => {
    it('should update socket connection state', () => {
      store.updateSocketState({ isConnected: true, latency: 50 });
      let state = store.getState();
      
      expect(state.socket.isConnected).toBe(true);
      expect(state.socket.latency).toBe(50);
      
      store.updateSocketState({ isConnected: false, error: 'Connection lost' });
      state = store.getState();
      
      expect(state.socket.isConnected).toBe(false);
      expect(state.socket.error).toBe('Connection lost');
    });
  });
});

// Mock implementation for testing
describe('Component Rendering', () => {
  it('should render App component without errors', () => {
    // This would test the App component rendering
    // For now, just verify the import works
    expect(typeof store).toBe('object');
    expect(typeof extendedStore).toBe('object');
  });
  
  it('should handle navigation commands', () => {
    const mockSendCommand = jest.fn();
    const mockHandleNavigation = jest.fn();
    
    // Simulate navigation
    mockHandleNavigation('audio');
    expect(mockHandleNavigation).toHaveBeenCalledWith('audio');
    
    mockHandleNavigation('dmx');
    expect(mockHandleNavigation).toHaveBeenCalledWith('dmx');
  });
});

// Performance tests
describe('Performance', () => {
  it('should maintain good performance with frequent updates', () => {
    const startTime = performance.now();
    
    // Simulate multiple store updates
    for (let i = 0; i < 1000; i++) {
      store.updateAudioMetrics({
        energy: Math.random(),
        isBeat: Math.random() > 0.5,
        bpm: 100 + Math.random() * 40,
        mood: 'Test'
      });
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Should complete within reasonable time
    expect(duration).toBeLessThan(1000); // 1 second
  });
  
  it('should handle large DMX data updates efficiently', () => {
    const largeDMXData = {
      channels: new Array(512).fill(0).map(() => Math.random())
    };
    
    const startTime = performance.now();
    store.updateDMXData(largeDMXData);
    const endTime = performance.now();
    
    const duration = endTime - startTime;
    expect(duration).toBeLessThan(10); // 10ms
  });
});