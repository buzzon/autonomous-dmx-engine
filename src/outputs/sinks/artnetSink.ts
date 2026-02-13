/**
 * Art-Net DMX Output Sink
 * Sends DMX data via Art-Net protocol to lighting equipment
 */

import { OutputSink, DMXOutputConfig, DMXOutputData } from '../types';
import { UniverseFrame } from '../../lighting/types';
import { defaultLogger } from '../../utils/logger';

// Art-Net library
const artnet = require('artnet');

export interface ArtNetSinkConfig {
  // Art-Net specific configuration
  protocol: 'artnet';
  net?: number;        // Art-Net Net (0-127)
  subnet?: number;     // Art-Net Subnet (0-15)
  universe: number;    // Art-Net Universe (0-15)
  host: string;        // Art-Net node IP address
  port: number;        // Art-Net port (default: 6454)
  refreshRate: number; // DMX refresh rate (Hz)
  maxRetries: number;  // Maximum retry attempts
  failover?: {
    enabled: boolean;
    secondaryHost: string;
    secondaryPort: number;
  };
  // DMX channel configuration
  channelOffset?: number; // Offset for DMX channels (0-511)
  gammaCorrection?: number; // Gamma correction value (1.0-2.8)
  // Monitoring
  monitorInterval?: number; // Health check interval (ms)
}

export class ArtNetSink implements OutputSink {
  readonly name = 'artnet-dmx';
  readonly type = 'dmx' as const;
  
  private logger = defaultLogger.child({ module: 'ArtNetSink' });
  private config: ArtNetSinkConfig;
  private artnetClient: any = null;
  private secondaryClient: any = null;
  private isInitialized = false;
  private healthStatus = false;
  private lastSuccessTime = 0;
  private lastError: string | null = null;
  private retryCount = 0;
  private stats = {
    framesSent: 0,
    framesFailed: 0,
    totalBytes: 0,
    averageLatency: 0,
    lastLatency: 0
  };
  private healthCheckInterval?: NodeJS.Timeout;
  private currentUniverseData: Map<number, Uint8Array> = new Map();
  
  constructor(config: ArtNetSinkConfig) {
    this.config = {
      protocol: 'artnet',
      host: config.host,
      port: config.port || 6454,
      universe: config.universe || 0,
      refreshRate: config.refreshRate || 30,
      maxRetries: config.maxRetries || 3,
      failover: config.failover,
      net: config.net || 0,
      subnet: config.subnet || 0,
      channelOffset: config.channelOffset || 0,
      gammaCorrection: config.gammaCorrection || 2.2,
      monitorInterval: config.monitorInterval || 5000
    };
    
    this.logger.info('Art-Net sink created', {
      host: this.config.host,
      port: this.config.port,
      universe: this.config.universe,
      refreshRate: this.config.refreshRate
    });
  }
  
  /**
   * Initialize the Art-Net sink
   */
  async initialize(config: any): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn('Art-Net sink already initialized');
      return;
    }
    
    // Merge provided config with existing config
    this.config = { ...this.config, ...config };
    
    this.logger.info('Initializing Art-Net sink...', {
      host: this.config.host,
      port: this.config.port,
      universe: this.config.universe
    });
    
    try {
      // Create primary Art-Net client
      this.artnetClient = artnet({
        host: this.config.host,
        port: this.config.port,
        refresh: this.config.refreshRate * 1000, // Convert Hz to ms
        sendAll: true // Send all 512 channels
      });
      
      this.logger.info('Primary Art-Net client created', {
        host: this.config.host,
        port: this.config.port
      });
      
      // Create secondary client if failover is enabled
      if (this.config.failover?.enabled) {
        this.secondaryClient = artnet({
          host: this.config.failover.secondaryHost,
          port: this.config.failover.secondaryPort || this.config.port,
          refresh: this.config.refreshRate * 1000,
          sendAll: true
        });
        
        this.logger.info('Secondary Art-Net client created for failover', {
          host: this.config.failover.secondaryHost,
          port: this.config.failover.secondaryPort
        });
      }
      
      // Test connection
      await this.testConnection();
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      this.isInitialized = true;
      this.healthStatus = true;
      this.lastSuccessTime = Date.now();
      
      this.logger.info('Art-Net sink initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize Art-Net sink', { error });
      this.healthStatus = false;
      this.lastError = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }
  
  /**
   * Send DMX data
   */
  async send(data: any): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Art-Net sink not initialized');
    }
    
    const startTime = Date.now();
    
    try {
      // Validate data format
      const dmxData = this.validateDMXData(data);
      
      // Apply gamma correction if configured
      const processedData = this.applyGammaCorrection(dmxData);
      
      // Apply channel offset if configured
      const offsetData = this.applyChannelOffset(processedData);
      
      // Send DMX data
      await this.sendDMXData(offsetData);
      
      // Update statistics
      this.updateStatistics(true, Date.now() - startTime, dmxData.universeFrames);
      
      this.healthStatus = true;
      this.lastSuccessTime = Date.now();
      this.retryCount = 0;
      this.lastError = null;
      
    } catch (error) {
      // Update statistics
      this.updateStatistics(false, Date.now() - startTime);
      
      this.healthStatus = false;
      this.lastError = error instanceof Error ? error.message : String(error);
      this.retryCount++;
      
      this.logger.error('Failed to send DMX data', {
        error: this.lastError,
        retryCount: this.retryCount
      });
      
      // Try failover if configured
      if (this.config.failover?.enabled && this.retryCount >= this.config.maxRetries) {
        await this.tryFailover(data);
      } else {
        throw error;
      }
    }
  }
  
  /**
   * Validate DMX data format
   */
  private validateDMXData(data: any): DMXOutputData {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid DMX data: data must be an object');
    }
    
    if (!Array.isArray(data.universeFrames)) {
      throw new Error('Invalid DMX data: universeFrames must be an array');
    }
    
    // Validate each universe frame
    for (const frame of data.universeFrames) {
      if (!frame || typeof frame !== 'object') {
        throw new Error('Invalid universe frame: must be an object');
      }
      
      if (typeof frame.universe !== 'number' || frame.universe < 0 || frame.universe > 63999) {
        throw new Error(`Invalid universe number: ${frame.universe}`);
      }
      
      if (!(frame.data instanceof Uint8Array) && !Array.isArray(frame.data)) {
        throw new Error('Invalid DMX data: must be Uint8Array or array');
      }
      
      if (frame.data.length > 512) {
        throw new Error(`DMX data too long: ${frame.data.length} channels (max 512)`);
      }
    }
    
    return data as DMXOutputData;
  }
  
  /**
   * Apply gamma correction to DMX values
   */
  private applyGammaCorrection(dmxData: DMXOutputData): DMXOutputData {
    const gamma = this.config.gammaCorrection || 2.2;
    
    if (gamma === 1.0) {
      return dmxData; // No correction needed
    }
    
    const correctedFrames = dmxData.universeFrames.map(frame => {
      const correctedData = new Uint8Array(frame.data.length);
      
      for (let i = 0; i < frame.data.length; i++) {
        const normalized = frame.data[i] / 255;
        const corrected = Math.pow(normalized, 1 / gamma);
        correctedData[i] = Math.round(corrected * 255);
      }
      
      return {
        ...frame,
        data: correctedData
      };
    });
    
    return {
      ...dmxData,
      universeFrames: correctedFrames
    };
  }
  
  /**
   * Apply channel offset to DMX data
   */
  private applyChannelOffset(dmxData: DMXOutputData): DMXOutputData {
    const offset = this.config.channelOffset || 0;
    
    if (offset === 0) {
      return dmxData; // No offset needed
    }
    
    const offsetFrames = dmxData.universeFrames.map(frame => {
      // Create new array with offset
      const offsetData = new Uint8Array(512); // Always 512 channels for DMX
      
      for (let i = 0; i < frame.data.length; i++) {
        const targetChannel = i + offset;
        if (targetChannel < 512) {
          offsetData[targetChannel] = frame.data[i];
        }
      }
      
      return {
        ...frame,
        data: offsetData
      };
    });
    
    return {
      ...dmxData,
      universeFrames: offsetFrames
    };
  }
  
  /**
   * Send DMX data via Art-Net
   */
  private async sendDMXData(dmxData: DMXOutputData): Promise<void> {
    // Update current universe data for monitoring
    for (const frame of dmxData.universeFrames) {
      this.currentUniverseData.set(frame.universe, frame.data);
    }
    
    // Send each universe frame
    const sendPromises = dmxData.universeFrames.map(async (frame) => {
      // Convert Uint8Array to regular array for artnet library
      const dmxValues = Array.from(frame.data);
      
      // Calculate Art-Net universe (0-32767)
      // Art-Net uses: Universe = (Net * 16 + Subnet) * 16 + Universe
      const artnetUniverse = 
        (this.config.net || 0) * 256 + 
        (this.config.subnet || 0) * 16 + 
        (frame.universe % 16);
      
      // Send DMX data
      return new Promise<void>((resolve, reject) => {
        try {
          this.artnetClient.set(artnetUniverse, dmxValues, (error: any) => {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          });
        } catch (error) {
          reject(error);
        }
      });
    });
    
    await Promise.all(sendPromises);
  }
  
  /**
   * Try failover to secondary Art-Net node
   */
  private async tryFailover(data: any): Promise<void> {
    if (!this.secondaryClient) {
      throw new Error('No secondary Art-Net client available for failover');
    }
    
    this.logger.warn('Attempting failover to secondary Art-Net node');
    
    try {
      // Swap clients
      [this.artnetClient, this.secondaryClient] = [this.secondaryClient, this.artnetClient];
      
      // Update config to use secondary host
      const oldHost = this.config.host;
      this.config.host = this.config.failover!.secondaryHost;
      this.config.port = this.config.failover!.secondaryPort || this.config.port;
      
      this.logger.info('Failover successful', {
        oldHost,
        newHost: this.config.host,
        newPort: this.config.port
      });
      
      // Retry sending data
      await this.send(data);
      
    } catch (error) {
      this.logger.error('Failover failed', { error });
      throw new Error(`Failover failed: ${error}`);
    }
  }
  
  /**
   * Test Art-Net connection
   */
  private async testConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Send test packet (all channels to 0)
      const testData = new Array(512).fill(0);
      
      this.artnetClient.set(0, testData, (error: any) => {
        if (error) {
          reject(new Error(`Art-Net connection test failed: ${error}`));
        } else {
          this.logger.debug('Art-Net connection test successful');
          resolve();
        }
      });
    });
  }
  
  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    this.healthCheckInterval = setInterval(() => {
      this.checkHealth().catch(error => {
        this.logger.error('Health check failed', { error });
      });
    }, this.config.monitorInterval || 5000);
  }
  
  /**
   * Check Art-Net connection health
   */
  private async checkHealth(): Promise<void> {
    if (!this.isInitialized) return;
    
    try {
      await this.testConnection();
      this.healthStatus = true;
      this.lastError = null;
    } catch (error) {
      this.healthStatus = false;
      this.lastError = error instanceof Error ? error.message : String(error);
      this.logger.warn('Art-Net health check failed', { error: this.lastError });
    }
  }
  
  /**
   * Update statistics
   */
  private updateStatistics(success: boolean, latency: number, frames?: UniverseFrame[]): void {
    if (success) {
      this.stats.framesSent++;
      this.stats.lastLatency = latency;
      
      // Update average latency
      this.stats.averageLatency = 
        (this.stats.averageLatency * (this.stats.framesSent - 1) + latency) / 
        this.stats.framesSent;
      
      // Update total bytes
      if (frames) {
        for (const frame of frames) {
          this.stats.totalBytes += frame.data.length;
        }
      }
    } else {
      this.stats.framesFailed++;
    }
  }
  
  /**
   * Check if sink is healthy
   */
  async isHealthy(): Promise<boolean> {
    if (!this.isInitialized) return false;
    
    // Check if we've had recent successes
    const timeSinceLastSuccess = Date.now() - this.lastSuccessTime;
    const maxTimeWithoutSuccess = 10000; // 10 seconds
    
    return this.healthStatus && timeSinceLastSuccess < maxTimeWithoutSuccess;
  }
  
  /**
   * Get sink statistics
   */
  getStats(): any {
    return {
      ...this.stats,
      isHealthy: this.healthStatus,
      lastError: this.lastError,
      retryCount: this.retryCount,
      lastSuccessTime: this.lastSuccessTime,
      currentUniverses: Array.from(this.currentUniverseData.keys())
    };
  }
  
  /**
   * Get current DMX values for a universe
   */
  getUniverseData(universe: number): Uint8Array | null {
    return this.currentUniverseData.get(universe) || null;
  }
  
  /**
   * Get all current universe data
   */
  getAllUniverseData(): Map<number, Uint8Array> {
    return new Map(this.currentUniverseData);
  }
  
  /**
   * Shutdown the Art-Net sink
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Art-Net sink...');
    
    // Clear health check interval
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
    
    // Send blackout (all channels to 0)
    try {
      const blackoutData = new Array(512).fill(0);
      
      if (this.artnetClient) {
        this.artnetClient.set(0, blackoutData, () => {
          // Ignore callback errors during shutdown
        });
      }
      
      if (this.secondaryClient) {
        this.secondaryClient.set(0, blackoutData, () => {
          // Ignore callback errors during shutdown
        });
      }
      
      // Wait a bit for blackout to be sent
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      this.logger.warn('Error during Art-Net shutdown blackout', { error });
    }
    
    // Close connections
    if (this.artnetClient) {
      try {
        this.artnetClient.close();
      } catch (error) {
        this.logger.warn('Error closing primary Art-Net client', { error });
      }
      this.artnetClient = null;
    }
    
    if (this.secondaryClient) {
      try {
        this.secondaryClient.close();
      } catch (error) {
        this.logger.warn('Error closing secondary Art-Net client', { error });
      }
      this.secondaryClient = null;
    }
    
    this.isInitialized = false;
    this.healthStatus = false;
    this.currentUniverseData.clear();
    
    this.logger.info('Art-Net sink shutdown complete');
  }
  
  /**
   * Get sink configuration
   */
  getConfig(): ArtNetSinkConfig {
    return { ...this.config };
  }
  
  /**
   * Update sink configuration
   */
  async updateConfig(config: Partial<ArtNetSinkConfig>): Promise<void> {
    const oldConfig = { ...this.config };
    
    // Merge new configuration
    this.config = { ...this.config, ...config };
    
    this.logger.info('Updating Art-Net sink configuration', {
      changes: Object.keys(config),
      oldHost: oldConfig.host,
      newHost: this.config.host,
      oldPort: oldConfig.port,
      newPort: this.config.port
    });
    
    // If host or port changed, we need to reinitialize
    if (config.host || config.port) {
      this.logger.info('Host or port changed, reinitializing Art-Net sink...');
      
      // Store current state
      const wasInitialized = this.isInitialized;
      
      // Shutdown existing connections
      if (this.isInitialized) {
        await this.shutdown();
      }
      
      // Reinitialize with new configuration
      if (wasInitialized) {
        await this.initialize(this.config);
      }
    }
    
    // Update refresh rate if changed
    if (config.refreshRate && this.artnetClient) {
      this.artnetClient.refresh = config.refreshRate * 1000;
      if (this.secondaryClient) {
        this.secondaryClient.refresh = config.refreshRate * 1000;
      }
    }
  }
}