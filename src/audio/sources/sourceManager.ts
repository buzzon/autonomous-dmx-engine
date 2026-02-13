/**
 * Audio Source Manager
 * Manages multiple audio sources and provides real-time switching between them
 */

import { defaultLogger } from '../../utils/logger';
import { AudioSource, AudioSourceStats, BaseAudioSource } from './audioSource';
import { AudioSourceConfig, AudioSourceType, AudioFrame } from '../types';

export interface SourceManagerConfig {
  defaultSource?: string;
  autoSwitchOnFailure: boolean;
  healthCheckInterval: number;
  maxSwitchLatency: number;
  bufferFrames: number;
}

export interface SourceManagerStats {
  totalFrames: number;
  sourceSwitches: number;
  currentSource: string | null;
  sources: Record<string, AudioSourceStats>;
  lastSwitchTime: number;
  switchLatency: number;
}

export class AudioSourceManager {
  private logger = defaultLogger.child({ module: 'AudioSourceManager' });
  private sources: Map<string, AudioSource> = new Map();
  private activeSource: AudioSource | null = null;
  private config: SourceManagerConfig;
  private stats: SourceManagerStats;
  private isInitialized = false;
  private healthCheckInterval?: NodeJS.Timeout;
  private frameBuffer: AudioFrame[] = [];
  
  constructor(config: Partial<SourceManagerConfig> = {}) {
    this.config = {
      defaultSource: config.defaultSource,
      autoSwitchOnFailure: config.autoSwitchOnFailure ?? true,
      healthCheckInterval: config.healthCheckInterval ?? 5000,
      maxSwitchLatency: config.maxSwitchLatency ?? 100,
      bufferFrames: config.bufferFrames ?? 10
    };
    
    this.stats = {
      totalFrames: 0,
      sourceSwitches: 0,
      currentSource: null,
      sources: {},
      lastSwitchTime: 0,
      switchLatency: 0
    };
    
    this.logger.info('AudioSourceManager initialized', { config: this.config });
  }
  
  /**
   * Initialize the source manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn('AudioSourceManager is already initialized');
      return;
    }
    
    this.logger.info('Initializing AudioSourceManager...');
    
    // Start health check interval
    this.healthCheckInterval = setInterval(
      () => this.checkSourcesHealth(),
      this.config.healthCheckInterval
    );
    
    this.isInitialized = true;
    this.logger.info('AudioSourceManager initialized successfully');
  }
  
  /**
   * Register a new audio source
   */
  registerSource(source: AudioSource): void {
    if (this.sources.has(source.name)) {
      this.logger.warn('Audio source already registered', { name: source.name });
      return;
    }
    
    this.sources.set(source.name, source);
    this.stats.sources[source.name] = source.getStats();
    
    this.logger.info('Audio source registered', {
      name: source.name,
      type: source.type,
      totalSources: this.sources.size
    });
    
    // If this is the first source or it's the default source, activate it
    if (!this.activeSource || source.name === this.config.defaultSource) {
      this.switchSource(source.name).catch(error => {
        this.logger.error('Failed to switch to newly registered source', {
          source: source.name,
          error
        });
      });
    }
  }
  
  /**
   * Unregister an audio source
   */
  unregisterSource(name: string): void {
    const source = this.sources.get(name);
    if (!source) {
      this.logger.warn('Audio source not found', { name });
      return;
    }
    
    // If this is the active source, switch to another source first
    if (this.activeSource === source) {
      const otherSources = Array.from(this.sources.values())
        .filter(s => s !== source);
      
      if (otherSources.length > 0) {
        this.switchSource(otherSources[0].name).catch(error => {
          this.logger.error('Failed to switch from unregistered source', { error });
        });
      } else {
        this.activeSource = null;
        this.stats.currentSource = null;
      }
    }
    
    // Cleanup and remove the source
    source.cleanup().catch(error => {
      this.logger.error('Error cleaning up audio source', { name, error });
    });
    
    this.sources.delete(name);
    delete this.stats.sources[name];
    
    this.logger.info('Audio source unregistered', { name });
  }
  
  /**
   * Switch to a different audio source
   */
  async switchSource(name: string): Promise<void> {
    const source = this.sources.get(name);
    if (!source) {
      throw new Error(`Audio source not found: ${name}`);
    }
    
    if (this.activeSource === source) {
      this.logger.debug('Already using requested audio source', { name });
      return;
    }
    
    const switchStartTime = Date.now();
    this.logger.info('Switching audio source', {
      from: this.activeSource?.name,
      to: name
    });
    
    try {
      // Stop current source if active
      if (this.activeSource && this.activeSource.isActive) {
        await this.activeSource.stop();
      }
      
      // Start new source
      await source.start();
      
      // Update active source
      this.activeSource = source;
      this.stats.currentSource = name;
      this.stats.sourceSwitches++;
      this.stats.lastSwitchTime = Date.now();
      this.stats.switchLatency = Date.now() - switchStartTime;
      
      // Clear frame buffer on source switch
      this.frameBuffer = [];
      
      this.logger.info('Audio source switched successfully', {
        source: name,
        latency: this.stats.switchLatency
      });
      
    } catch (error) {
      this.logger.error('Failed to switch audio source', {
        from: this.activeSource?.name,
        to: name,
        error
      });
      
      // Try to revert to previous source
      if (this.activeSource && this.activeSource !== source) {
        try {
          await this.activeSource.start();
        } catch (revertError) {
          this.logger.error('Failed to revert to previous audio source', {
            error: revertError
          });
          this.activeSource = null;
          this.stats.currentSource = null;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * Get the next audio frame from the active source
   */
  async getNextFrame(): Promise<AudioFrame | null> {
    if (!this.activeSource) {
      this.logger.warn('No active audio source');
      return null;
    }
    
    try {
      const frame = await this.activeSource.getNextFrame();
      
      if (frame) {
        this.stats.totalFrames++;
        this.stats.sources[this.activeSource.name] = this.activeSource.getStats();
        
        // Buffer frame for smooth transitions
        this.bufferFrame(frame);
      }
      
      return frame;
      
    } catch (error) {
      this.logger.error('Error getting audio frame', {
        source: this.activeSource.name,
        error
      });
      
      // Auto-switch on failure if configured
      if (this.config.autoSwitchOnFailure) {
        await this.autoSwitchOnFailure();
      }
      
      return null;
    }
  }
  
  /**
   * Get current active source
   */
  getActiveSource(): AudioSource | null {
    return this.activeSource;
  }
  
  /**
   * Get all registered sources
   */
  getAllSources(): AudioSource[] {
    return Array.from(this.sources.values());
  }
  
  /**
   * Get source by name
   */
  getSource(name: string): AudioSource | undefined {
    return this.sources.get(name);
  }
  
  /**
   * Get manager statistics
   */
  getStats(): SourceManagerStats {
    return { ...this.stats };
  }
  
  /**
   * Get manager configuration
   */
  getConfig(): SourceManagerConfig {
    return { ...this.config };
  }
  
  /**
   * Update manager configuration
   */
  updateConfig(config: Partial<SourceManagerConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...config };
    
    // Update health check interval if changed
    if (config.healthCheckInterval && this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = setInterval(
        () => this.checkSourcesHealth(),
        this.config.healthCheckInterval
      );
    }
    
    this.logger.info('Source manager config updated', {
      oldConfig,
      newConfig: this.config
    });
  }
  
  /**
   * Check health of all sources and auto-switch if needed
   */
  private async checkSourcesHealth(): Promise<void> {
    if (!this.config.autoSwitchOnFailure) return;
    
    for (const [name, source] of this.sources) {
      const isHealthy = source.isHealthy();
      
      if (!isHealthy && this.activeSource === source) {
        this.logger.warn('Active audio source is unhealthy', { name });
        await this.autoSwitchOnFailure();
        break;
      }
    }
  }
  
  /**
   * Automatically switch to a healthy source when current source fails
   */
  private async autoSwitchOnFailure(): Promise<void> {
    const healthySources = Array.from(this.sources.values())
      .filter(source => source !== this.activeSource && source.isHealthy());
    
    if (healthySources.length === 0) {
      this.logger.error('No healthy audio sources available');
      return;
    }
    
    // Try to switch to the first healthy source
    try {
      await this.switchSource(healthySources[0].name);
    } catch (error) {
      this.logger.error('Failed to auto-switch to healthy source', { error });
    }
  }
  
  /**
   * Buffer frame for smooth transitions
   */
  private bufferFrame(frame: AudioFrame): void {
    this.frameBuffer.push(frame);
    
    // Keep buffer size limited
    if (this.frameBuffer.length > this.config.bufferFrames) {
      this.frameBuffer.shift();
    }
  }
  
  /**
   * Get buffered frames (for smooth transitions)
   */
  getBufferedFrames(): AudioFrame[] {
    return [...this.frameBuffer];
  }
  
  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down AudioSourceManager...');
    
    // Clear health check interval
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
    
    // Stop all sources
    const stopPromises = Array.from(this.sources.values()).map(async source => {
      try {
        if (source.isActive) {
          await source.stop();
        }
        await source.cleanup();
      } catch (error) {
        this.logger.error('Error stopping audio source', {
          name: source.name,
          error
        });
      }
    });
    
    await Promise.all(stopPromises);
    
    this.sources.clear();
    this.activeSource = null;
    this.isInitialized = false;
    this.frameBuffer = [];
    
    this.logger.info('AudioSourceManager shutdown complete');
  }
  
  /**
   * Check if manager is initialized
   */
  isManagerInitialized(): boolean {
    return this.isInitialized;
  }
}

/**
 * Default instance of AudioSourceManager
 */
export const defaultAudioSourceManager = new AudioSourceManager();