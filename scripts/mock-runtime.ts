#!/usr/bin/env ts-node

/**
 * Mock runtime for testing the autonomous DMX engine
 * Provides a complete end-to-end testing environment with mock data
 */

import { defaultLogger } from '../src/utils/logger';
import { defaultConfigLoader } from '../src/utils/config';
import { AudioAnalyzer } from '../src/audio/analyzer';
import { BrainFacade } from '../src/brain/facade';
import { LightingFacade } from '../src/lighting/facade';
import { ControlAPI } from '../src/control/api';
import { Engine } from '../src/engine/engine';

const logger = defaultLogger.child({ module: 'MockRuntime' });

/**
 * Mock audio analyzer for testing
 */
class MockAudioAnalyzer extends AudioAnalyzer {
  private mockFrameCount = 0;
  
  constructor() {
    super({
      sampleRate: 44100,
      frameSize: 1024,
      hopSize: 512,
      beatThresholdCoeff: 1.5,
      minBeatInterval: 100,
      bpmSmoothingBeta: 0.9,
      energySmoothingAlpha: 0.9,
      moodUpdateInterval: 1000,
      historySize: 100,
      moodEnergyThresholdLow: 0.3,
      moodEnergyThresholdHigh: 0.7,
      moodBpmThresholdLow: 80,
      moodBpmThresholdHigh: 140
    });
  }
  
  processFrame(samples: Float32Array, timestamp: number): any {
    this.mockFrameCount++;
    
    // Generate mock audio metrics with some variation
    const energy = 0.3 + 0.4 * Math.sin(this.mockFrameCount * 0.1);
    const beat = this.mockFrameCount % 20 === 0; // Beat every 20 frames
    const bpm = beat ? 120 + Math.sin(this.mockFrameCount * 0.01) * 20 : null;
    const mood = energy < 0.4 ? 'calm' : energy < 0.7 ? 'medium' : 'hard';
    
    return {
      timestamp,
      energy: Math.min(1, Math.max(0, energy)),
      beat,
      bpm,
      mood
    };
  }
  
  generateMockAudioFrame(): Float32Array {
    const frameSize = 1024;
    const samples = new Float32Array(frameSize);
    
    // Generate simple sine wave for testing
    for (let i = 0; i < frameSize; i++) {
      const time = (this.mockFrameCount * frameSize + i) / 44100;
      samples[i] = 0.5 * Math.sin(2 * Math.PI * 440 * time); // 440 Hz sine wave
    }
    
    return samples;
  }
}

/**
 * Mock metric source manager
 */
class MockMetricSourceManager {
  constructor() {
    logger.info('MockMetricSourceManager initialized');
  }
  
  async collectAllMetrics(): Promise<any> {
    return {
      audio: {
        energy: 0.5,
        beat: false,
        bpm: 120,
        mood: 'medium',
        timestamp: Date.now()
      },
      system: {
        cpu: { usage: 0.3 },
        memory: { usage: 0.5 },
        timestamp: Date.now()
      },
      timestamp: Date.now()
    };
  }
}

/**
 * Mock output sink manager
 */
class MockOutputSinkManager {
  constructor() {
    logger.info('MockOutputSinkManager initialized');
  }
  
  async sendToAll(data: Record<string, any>): Promise<void> {
    if (data.dmx) {
      logger.debug('Mock DMX output', { 
        universeFrames: data.dmx.universeFrames?.length || 0 
      });
    }
    
    if (data.console) {
      logger.info('Console output', data.console);
    }
  }
}

/**
 * Mock plugin manager
 */
class MockPluginManager {
  constructor() {
    logger.info('MockPluginManager initialized');
  }
  
  async loadPlugin(pluginPath: string): Promise<any> {
    logger.debug(`Mock plugin loading: ${pluginPath}`);
    return { success: true, plugin: { name: 'mock-plugin' } };
  }
}

/**
 * Main mock runtime function
 */
async function runMockRuntime() {
  logger.info('Starting mock runtime with expandable architecture...');
  
  try {
    // Load data-driven configs
    logger.info('Loading configuration files...');
    const configLoader = defaultConfigLoader;
    const configs = await configLoader.loadAll();
    
    logger.info('Configuration loaded successfully', {
      scenes: configs.scenes?.scenes?.length || 0,
      rules: configs.scenesRules?.rules?.length || 0,
      effects: configs.effects?.handlers ? Object.keys(configs.effects.handlers).length : 0,
      plugins: configs.plugins?.enabled?.length || 0
    });
    
    // Initialize managers for expandability
    logger.info('Initializing expandability managers...');
    const metricSourceManager = new MockMetricSourceManager();
    const outputSinkManager = new MockOutputSinkManager();
    const pluginManager = new MockPluginManager();
    
    // Initialize AudioAnalyzer (mock version)
    logger.info('Initializing AudioAnalyzer...');
    const audioAnalyzer = new MockAudioAnalyzer();
    
    // Initialize BrainFacade (simplified for Phase 1)
    logger.info('Initializing BrainFacade...');
    const brainFacade = new BrainFacade({
      stateMachine: {
        energyThresholdLow: 0.3,
        energyThresholdHigh: 0.7,
        hysteresis: 0.1,
        manualOverrideTimeout: 30000 // 30 seconds
      },
      sceneSelector: {
        defaultSceneId: 'IdleWarmStatic',
        historySize: 10,
        cooldownEnabled: true,
        randomSelection: true
      },
      effectEngine: {
        defaultEffectHandlers: {},
        effectRegistryPath: './config/effects.json'
      }
    });
    
    // Load scenes into BrainFacade (simplified for Phase 1)
    logger.info('Loading scenes into BrainFacade...');
    // Note: In Phase 1, we're not actually loading scenes from config
    // This would be implemented in Phase 2
    
    // Initialize LightingFacade (simplified for Phase 1)
    logger.info('Initializing LightingFacade...');
    const lightingFacade = new LightingFacade({
      artNet: {
        host: '127.0.0.1',
        port: 6454,
        universe: 1,
        refreshRate: 40
      },
      mergeRules: {
        priority: ['base', 'effects', 'overrides'],
        blendModes: { dim: 'multiply', color: 'replace', position: 'replace' },
        globalDim: 1,
        blackout: false
      },
      defaultAttributes: {
        dim: 0,
        colorIndex: 0,
        panNorm: 0,
        tiltNorm: 0,
        strobe: 0
      },
      enableDMXOutput: false
    });
    
    // Initialize LightingFacade
    logger.info('Initializing LightingFacade components...');
    await lightingFacade.initialize();
    
    // Initialize ControlAPI
    logger.info('Initializing ControlAPI...');
    const controlAPI = new ControlAPI({
      port: configs.plugins?.plugins?.['core-webui']?.config?.port || 8080,
      enableWebSocket: true,
      enableREST: true,
      enableOSC: false,
      corsOrigins: ['http://localhost:8080'],
      rateLimit: {
        windowMs: 60000,
        maxRequests: 100
      },
      authentication: {
        enabled: false
      }
    });
    
    // Create Engine with full set of dependencies
    logger.info('Creating Engine...');
    const engine = new Engine(
      audioAnalyzer,
      brainFacade,
      lightingFacade,
      controlAPI,
      {
        fastTickInterval: 40,
        slowTickInterval: 500,
        enableHotReload: true,
        maxFastLoopTime: 20
      }
    );
    
    // Start the engine
    logger.info('Starting Engine...');
    engine.start();
    
    // Set up graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Shutting down mock runtime...');
      await engine.stop();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      logger.info('Terminating mock runtime...');
      await engine.stop();
      process.exit(0);
    });
    
    logger.info('Mock runtime started successfully!');
    logger.info('Press Ctrl+C to stop.');
    
    // Run for a while to demonstrate functionality
    setTimeout(() => {
      logger.info('Mock runtime demonstration complete.');
    }, 30000);
    
  } catch (error) {
    logger.error('Failed to start mock runtime', { error });
    process.exit(1);
  }
}

// Run the mock runtime
if (require.main === module) {
  runMockRuntime().catch(error => {
    console.error('Unhandled error in mock runtime:', error);
    process.exit(1);
  });
}

export { runMockRuntime };