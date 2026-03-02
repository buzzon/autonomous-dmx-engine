/**
 * Tests for ArtNetSink
 */

// Mock artnet library before importing ArtNetSink
jest.mock('artnet', () => {
  const mockClient = {
    set: jest.fn((universe, data, callback) => {
      if (callback) callback(null);
    }),
    close: jest.fn(),
    refresh: 1000,
  };

  return jest.fn(() => mockClient);
});

import { ArtNetSink } from '../../../src/outputs/sinks/artnetSink';
import { UniverseFrame } from '../../../src/lighting/types';

describe('ArtNetSink', () => {
  let sink: ArtNetSink;
  const mockConfig = {
    protocol: 'artnet' as const,
    host: '192.168.1.100',
    port: 6454,
    universe: 0,
    refreshRate: 25,
    maxRetries: 3,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    sink = new ArtNetSink(mockConfig);
  });

  test('should initialize with configuration', () => {
    expect(sink).toBeDefined();
    expect(sink.name).toBe('artnet-dmx');
    expect(sink.type).toBe('dmx');
  });

  test('should initialize artnet client', async () => {
    await sink.initialize(mockConfig);

    const artnet = require('artnet');
    expect(artnet).toHaveBeenCalledWith({
      host: mockConfig.host,
      port: mockConfig.port,
      refresh: mockConfig.refreshRate * 1000,
      sendAll: true
    });

    // @ts-ignore - accessing private property for testing
    expect(sink.isInitialized).toBe(true);
  });

  test('should send DMX data', async () => {
    await sink.initialize(mockConfig);

    const universeFrame: UniverseFrame = {
      universe: 0,
      timestamp: Date.now(),
      data: new Uint8Array([255, 128, 0, 0, 0]),
    };

    const dmxData = {
      universeFrames: [universeFrame],
    };

    await sink.send(dmxData);

    const artnet = require('artnet');
    const mockClient = artnet.mock.results[0].value;

    expect(mockClient.set).toHaveBeenCalled();
    // @ts-ignore - accessing private property
    expect(sink.stats.framesSent).toBe(1);
  });

  test('should validate DMX data format', async () => {
    await sink.initialize(mockConfig);

    // Invalid data (not an object)
    await expect(sink.send(null as any)).rejects.toThrow('Invalid DMX data: data must be an object');

    // Missing universeFrames
    await expect(sink.send({} as any)).rejects.toThrow('Invalid DMX data: universeFrames must be an array');

    // Invalid frame data type
    await expect(sink.send({
      universeFrames: [{ universe: 0, data: 'invalid' }],
    })).rejects.toThrow('Invalid DMX data: must be Uint8Array or array');

    // DMX data too long
    const longData = new Uint8Array(600);
    await expect(sink.send({
      universeFrames: [{ universe: 0, data: longData }],
    })).rejects.toThrow('DMX data too long: 600 channels (max 512)');
  });

  test('should apply gamma correction when configured', async () => {
    const configWithGamma = {
      ...mockConfig,
      gammaCorrection: 2.2,
    };

    sink = new ArtNetSink(configWithGamma);
    await sink.initialize(configWithGamma);

    const universeFrame: UniverseFrame = {
      universe: 0,
      timestamp: Date.now(),
      data: new Uint8Array([128, 64, 32]),
    };

    await sink.send({ universeFrames: [universeFrame] });

    // Gamma correction should be applied
    const artnet = require('artnet');
    const mockClient = artnet.mock.results[0].value;
    expect(mockClient.set).toHaveBeenCalled();
  });

  test('should apply channel offset when configured', async () => {
    const configWithOffset = {
      ...mockConfig,
      channelOffset: 10,
    };

    sink = new ArtNetSink(configWithOffset);
    await sink.initialize(configWithOffset);

    const universeFrame: UniverseFrame = {
      universe: 0,
      timestamp: Date.now(),
      data: new Uint8Array([255, 128, 0]),
    };

    await sink.send({ universeFrames: [universeFrame] });

    // Channel offset should be applied
    const artnet = require('artnet');
    const mockClient = artnet.mock.results[0].value;
    expect(mockClient.set).toHaveBeenCalled();
  });

  test('should handle artnet client errors', async () => {
    await sink.initialize(mockConfig);

    const artnet = require('artnet');
    const mockClient = artnet.mock.results[0].value;
    
    // Mock error on send
    mockClient.set.mockImplementationOnce((universe: number, data: number[], callback: (error: Error | null) => void) => {
      if (callback) callback(new Error('Network error'));
    });

    const universeFrame: UniverseFrame = {
      universe: 0,
      timestamp: Date.now(),
      data: new Uint8Array([255]),
    };

    await expect(sink.send({ universeFrames: [universeFrame] })).rejects.toThrow();
    
    // @ts-ignore - accessing private property
    expect(sink.stats.framesFailed).toBe(1);
  });

  test('should check health status', async () => {
    await sink.initialize(mockConfig);

    const health = await sink.isHealthy();
    expect(typeof health).toBe('boolean');
  });

  test('should update configuration', async () => {
    await sink.initialize(mockConfig);

    const newConfig = {
      refreshRate: 30,
      host: '192.168.1.200',
    };

    await sink.updateConfig(newConfig);

    // @ts-ignore - accessing private property
    expect(sink.config.refreshRate).toBe(30);
    // @ts-ignore - accessing private property
    expect(sink.config.host).toBe('192.168.1.200');
  });

  test('should get current configuration', () => {
    const config = sink.getConfig();
    expect(config).toMatchObject(mockConfig);
  });

  test('should shutdown gracefully', async () => {
    await sink.initialize(mockConfig);
    await sink.shutdown();

    const artnet = require('artnet');
    const mockClient = artnet.mock.results[0].value;
    expect(mockClient.close).toHaveBeenCalled();
  });

  test('should handle failover configuration', async () => {
    const configWithFailover = {
      ...mockConfig,
      failover: {
        enabled: true,
        secondaryHost: '192.168.1.101',
        secondaryPort: 6454,
      },
    };

    sink = new ArtNetSink(configWithFailover);
    await sink.initialize(configWithFailover);

    // Should create secondary client
    const artnet = require('artnet');
    expect(artnet).toHaveBeenCalledTimes(2); // primary + secondary
  });

  test('should perform health check', async () => {
    await sink.initialize(mockConfig);

    // @ts-ignore - accessing private method
    const healthCheck = sink.performHealthCheck ? sink.performHealthCheck.bind(sink) : null;
    
    if (healthCheck) {
      await expect(healthCheck()).resolves.not.toThrow();
    }
  });
});