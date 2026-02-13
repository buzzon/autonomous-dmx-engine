/**
 * Tests for Audio Source Manager
 */

import { AudioSourceManager } from '../../../src/audio/sources/sourceManager';
import { BaseAudioSource } from '../../../src/audio/sources/audioSource';
import { AudioSourceConfig, AudioFrame, AudioSourceType } from '../../../src/audio/types';

// Mock audio source for testing
class MockAudioSource extends BaseAudioSource {
  private frames: AudioFrame[] = [];
  private currentFrameIndex = 0;
  
  constructor(name: string, type: AudioSourceType = 'synthetic') {
    const initialConfig: AudioSourceConfig = {
      type,
      bufferSize: 1024,
      channels: 2
    };
    
    super(name, type, initialConfig);
    
    // Generate some test frames
    for (let i = 0; i < 10; i++) {
      this.frames.push({
        samples: new Float32Array(1024).fill(Math.random() * 0.1),
        timestamp: Date.now() + i * 100,
        sampleRate: 44100,
        channels: 2
      });
    }
  }
  
  async initialize(config: AudioSourceConfig): Promise<void> {
    // In mock, just update config
    await this.updateConfig(config);
  }
  
  async start(): Promise<void> {
    (this as any).active = true; // Access protected property
    this.emit('started');
  }
  
  async stop(): Promise<void> {
    (this as any).active = false; // Access protected property
    this.emit('stopped');
  }
  
  async getNextFrame(): Promise<AudioFrame | null> {
    if (this.currentFrameIndex >= this.frames.length) {
      return null;
    }
    
    const frame = this.frames[this.currentFrameIndex];
    this.currentFrameIndex++;
    
    // Update stats
    (this as any).updateStatsWithFrame(10); // 10ms latency
    
    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 10));
    
    return frame;
  }
  
  async cleanup(): Promise<void> {
    (this as any).active = false; // Access protected property
  }
}

describe('AudioSourceManager', () => {
  let manager: AudioSourceManager;
  
  beforeEach(() => {
    manager = new AudioSourceManager();
  });
  
  afterEach(async () => {
    await manager.shutdown();
  });
  
  test('should initialize without errors', async () => {
    await expect(manager.initialize()).resolves.not.toThrow();
  });
  
  test('should register and unregister sources', async () => {
    const source1 = new MockAudioSource('source1');
    const source2 = new MockAudioSource('source2');
    
    // Register sources
    manager.registerSource(source1);
    manager.registerSource(source2);
    
    // Try to switch to a source
    await expect(manager.switchSource('source1')).resolves.not.toThrow();
    
    // Unregister source
    manager.unregisterSource('source2');
    
    // Try to switch to unregistered source should fail
    await expect(manager.switchSource('source2')).rejects.toThrow();
  });
  
  test('should switch between sources', async () => {
    const source1 = new MockAudioSource('source1');
    const source2 = new MockAudioSource('source2');
    
    manager.registerSource(source1);
    manager.registerSource(source2);
    
    // Switch to source1
    await manager.switchSource('source1');
    expect(manager.getActiveSource()?.name).toBe('source1');
    
    // Switch to source2
    await manager.switchSource('source2');
    expect(manager.getActiveSource()?.name).toBe('source2');
  });
  
  test('should get frames from active source', async () => {
    const source = new MockAudioSource('test-source');
    manager.registerSource(source);
    
    await manager.switchSource('test-source');
    
    // Get a frame
    const frame = await manager.getNextFrame();
    expect(frame).toBeDefined();
    expect(frame).not.toBeNull();
    
    if (frame) {
      expect(frame.samples).toBeInstanceOf(Float32Array);
      expect(frame.samples.length).toBe(1024);
      expect(frame.timestamp).toBeDefined();
      expect(frame.sampleRate).toBe(44100);
      expect(frame.channels).toBe(2);
    }
  });
  
  test('should handle source failures gracefully', async () => {
    const failingSource = new MockAudioSource('failing-source');
    
    // Override getNextFrame to throw error
    failingSource.getNextFrame = async () => {
      throw new Error('Source failure');
    };
    
    manager.registerSource(failingSource);
    await manager.switchSource('failing-source');
    
    // Should handle the error without crashing
    const frame = await manager.getNextFrame();
    expect(frame).toBeNull();
  });
  
  test('should update configuration', () => {
    const newConfig = {
      bufferFrames: 20,
      healthCheckInterval: 5000,
      autoSwitchOnFailure: false
    };
    
    manager.updateConfig(newConfig);
    
    // Verify config was updated
    const config = manager.getConfig();
    expect(config.bufferFrames).toBe(20);
    expect(config.healthCheckInterval).toBe(5000);
    expect(config.autoSwitchOnFailure).toBe(false);
  });
  
  test('should provide statistics', () => {
    const stats = manager.getStats();
    
    expect(stats).toBeDefined();
    expect(stats.totalFrames).toBe(0);
    expect(stats.sourceSwitches).toBe(0);
    expect(stats.currentSource).toBeNull();
    expect(stats.sources).toEqual({});
    expect(stats.lastSwitchTime).toBe(0);
    expect(stats.switchLatency).toBe(0);
  });
  
  test('should get all registered sources', () => {
    const source1 = new MockAudioSource('source1');
    const source2 = new MockAudioSource('source2');
    
    manager.registerSource(source1);
    manager.registerSource(source2);
    
    const sources = manager.getAllSources();
    expect(sources).toHaveLength(2);
    expect(sources.map(s => s.name)).toEqual(['source1', 'source2']);
  });
  
  test('should get source by name', () => {
    const source = new MockAudioSource('test-source');
    manager.registerSource(source);
    
    const retrievedSource = manager.getSource('test-source');
    expect(retrievedSource).toBe(source);
    
    const nonExistentSource = manager.getSource('non-existent');
    expect(nonExistentSource).toBeUndefined();
  });
  
  test('should buffer frames', async () => {
    const source = new MockAudioSource('test-source');
    manager.registerSource(source);
    
    await manager.switchSource('test-source');
    
    // Get several frames
    for (let i = 0; i < 5; i++) {
      await manager.getNextFrame();
    }
    
    const bufferedFrames = manager.getBufferedFrames();
    expect(bufferedFrames.length).toBeGreaterThan(0);
    expect(bufferedFrames.length).toBeLessThanOrEqual(10); // Default buffer size
  });
});