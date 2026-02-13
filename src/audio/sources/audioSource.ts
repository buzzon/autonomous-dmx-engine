/**
 * Audio Source interface
 * Defines the contract for audio sources (microphone, file, stream)
 */

import { AudioFrame, AudioSourceConfig, AudioSourceType } from '../types';
import { defaultLogger } from '../../utils/logger';

export interface AudioSource {
  readonly name: string;
  readonly type: AudioSourceType;
  readonly isActive: boolean;
  
  /**
   * Initialize the audio source
   */
  initialize(config: AudioSourceConfig): Promise<void>;
  
  /**
   * Start capturing/playing audio
   */
  start(): Promise<void>;
  
  /**
   * Stop capturing/playing audio
   */
  stop(): Promise<void>;
  
  /**
   * Get the next audio frame
   * Returns null if no frame is available
   */
  getNextFrame(): Promise<AudioFrame | null>;
  
  /**
   * Get current configuration
   */
  getConfig(): AudioSourceConfig;
  
  /**
   * Update configuration
   */
  updateConfig(config: Partial<AudioSourceConfig>): Promise<void>;
  
  /**
   * Get source statistics
   */
  getStats(): AudioSourceStats;
  
  /**
   * Check if source is healthy
   */
  isHealthy(): boolean;
  
  /**
   * Cleanup resources
   */
  cleanup(): Promise<void>;
}

/**
 * Audio source statistics
 */
export interface AudioSourceStats {
  framesCaptured: number;
  framesDropped: number;
  averageLatency: number;
  currentLatency: number;
  sampleRate: number;
  channels: number;
  bufferSize: number;
  isRunning: boolean;
  lastFrameTime: number;
  errors: number;
}

/**
 * Audio source event types
 */
export type AudioSourceEvent = 
  | 'started' 
  | 'stopped' 
  | 'error' 
  | 'frame' 
  | 'config-updated'
  | 'health-changed';

/**
 * Audio source event listener
 */
export type AudioSourceEventListener = (event: AudioSourceEvent, data?: any) => void;

/**
 * Base class for audio sources
 */
export abstract class BaseAudioSource implements AudioSource {
  protected logger = defaultLogger.child({ module: 'AudioSource' });
  protected config: AudioSourceConfig;
  protected stats: AudioSourceStats;
  protected active = false;
  protected listeners: Set<AudioSourceEventListener> = new Set();
  
  constructor(
    public readonly name: string,
    public readonly type: AudioSourceType,
    initialConfig: AudioSourceConfig
  ) {
    this.config = { ...initialConfig };
    this.stats = this.createDefaultStats();
  }
  
  abstract initialize(config: AudioSourceConfig): Promise<void>;
  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract getNextFrame(): Promise<AudioFrame | null>;
  abstract cleanup(): Promise<void>;
  
  get isActive(): boolean {
    return this.active;
  }
  
  getConfig(): AudioSourceConfig {
    return { ...this.config };
  }
  
  async updateConfig(config: Partial<AudioSourceConfig>): Promise<void> {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...config };
    
    this.logger.info('Audio source config updated', {
      name: this.name,
      oldConfig,
      newConfig: this.config
    });
    
    this.emit('config-updated', { oldConfig, newConfig: this.config });
  }
  
  getStats(): AudioSourceStats {
    return { ...this.stats };
  }
  
  isHealthy(): boolean {
    // Basic health check - source is healthy if it's active and has recent frames
    if (!this.active) return false;
    
    const timeSinceLastFrame = Date.now() - this.stats.lastFrameTime;
    return timeSinceLastFrame < 5000; // Consider unhealthy if no frames for 5 seconds
  }
  
  /**
   * Add event listener
   */
  addEventListener(listener: AudioSourceEventListener): void {
    this.listeners.add(listener);
  }
  
  /**
   * Remove event listener
   */
  removeEventListener(listener: AudioSourceEventListener): void {
    this.listeners.delete(listener);
  }
  
  /**
   * Emit event to all listeners
   */
  protected emit(event: AudioSourceEvent, data?: any): void {
    this.listeners.forEach(listener => {
      try {
        listener(event, data);
      } catch (error) {
        this.logger.error('Error in audio source event listener', { error });
      }
    });
  }
  
  /**
   * Update statistics with new frame
   */
  protected updateStatsWithFrame(latency: number): void {
    this.stats.framesCaptured++;
    this.stats.lastFrameTime = Date.now();
    
    // Update average latency
    this.stats.averageLatency = 
      (this.stats.averageLatency * (this.stats.framesCaptured - 1) + latency) / 
      this.stats.framesCaptured;
    
    this.stats.currentLatency = latency;
  }
  
  /**
   * Update statistics with error
   */
  protected updateStatsWithError(): void {
    this.stats.errors++;
  }
  
  /**
   * Create default statistics object
   */
  private createDefaultStats(): AudioSourceStats {
    return {
      framesCaptured: 0,
      framesDropped: 0,
      averageLatency: 0,
      currentLatency: 0,
      sampleRate: this.config.bufferSize || 44100,
      channels: this.config.channels || 2,
      bufferSize: this.config.bufferSize || 1024,
      isRunning: false,
      lastFrameTime: 0,
      errors: 0
    };
  }
}