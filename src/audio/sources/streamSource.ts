/**
 * Stream audio source
 * Captures audio from network streams (HTTP, WebSocket, etc.)
 */

import { BaseAudioSource } from './audioSource';
import { AudioSourceConfig, AudioSourceType, AudioFrame } from '../types';
import { defaultLogger } from '../../utils/logger';

export class StreamSource extends BaseAudioSource {
  private streamUrl: string;
  private isConnected = false;
  private frameQueue: AudioFrame[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000;
  private connectionTimeout = 10000;
  private bufferSize: number;
  private sampleRate: number;
  private channels: number;
  
  // WebSocket or HTTP stream connection
  private wsConnection: WebSocket | null = null;
  private httpStream: any = null;
  private audioContext: AudioContext | null = null;
  private mediaSource: MediaSource | null = null;
  
  constructor(name: string, config: AudioSourceConfig) {
    super(name, 'stream', config);
    this.logger = this.logger.child({ source: 'stream' });
    this.streamUrl = config.streamUrl || '';
    this.bufferSize = config.bufferSize || 1024;
    this.sampleRate = 44100; // Default, will be updated from stream
    this.channels = config.channels || 2;
  }
  
  async initialize(config: AudioSourceConfig): Promise<void> {
    this.config = { ...this.config, ...config };
    
    if (config.streamUrl) {
      this.streamUrl = config.streamUrl;
    }
    
    if (!this.streamUrl) {
      throw new Error('Stream URL is required for stream audio source');
    }
    
    if (config.bufferSize) {
      this.bufferSize = config.bufferSize;
    }
    
    if (config.channels) {
      this.channels = config.channels;
    }
    
    this.stats.sampleRate = this.sampleRate;
    this.stats.channels = this.channels;
    this.stats.bufferSize = this.bufferSize;
    
    this.logger.info('Stream source initialized', { 
      streamUrl: this.streamUrl,
      bufferSize: this.bufferSize,
      channels: this.channels
    });
  }
  
  async start(): Promise<void> {
    if (this.isConnected) {
      this.logger.warn('Stream is already connected');
      return;
    }
    
    this.logger.info('Connecting to audio stream...', { streamUrl: this.streamUrl });
    
    try {
      await this.connectToStream();
      this.isConnected = true;
      this.active = true;
      this.stats.isRunning = true;
      
      this.logger.info('Stream connected successfully');
      this.emit('started');
      
    } catch (error) {
      this.logger.error('Failed to connect to stream', { error });
      
      // Try to reconnect if configured
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        this.logger.info('Scheduling reconnect attempt', {
          attempt: this.reconnectAttempts,
          delay: this.reconnectDelay
        });
        
        setTimeout(() => {
          this.start().catch(err => {
            this.logger.error('Reconnect failed', { error: err });
          });
        }, this.reconnectDelay);
      } else {
        throw error;
      }
    }
  }
  
  async stop(): Promise<void> {
    if (!this.isConnected) {
      return;
    }
    
    this.logger.info('Disconnecting from audio stream...');
    
    // Close WebSocket connection
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = null;
    }
    
    // Close HTTP stream
    if (this.httpStream) {
      // Implementation depends on the HTTP streaming library used
      this.httpStream = null;
    }
    
    // Close audio context
    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close();
      this.audioContext = null;
    }
    
    this.isConnected = false;
    this.active = false;
    this.stats.isRunning = false;
    this.frameQueue = [];
    this.reconnectAttempts = 0;
    
    this.logger.info('Stream disconnected');
    this.emit('stopped');
  }
  
  async getNextFrame(): Promise<AudioFrame | null> {
    if (!this.isConnected || this.frameQueue.length === 0) {
      return null;
    }
    
    const frame = this.frameQueue.shift()!;
    const latency = Date.now() - frame.timestamp;
    
    this.updateStatsWithFrame(latency);
    this.emit('frame', { frame });
    
    return frame;
  }
  
  async cleanup(): Promise<void> {
    await this.stop();
    this.logger.info('Stream source cleaned up');
  }
  
  /**
   * Connect to the audio stream based on URL protocol
   */
  private async connectToStream(): Promise<void> {
    const url = this.streamUrl.toLowerCase();
    
    if (url.startsWith('ws://') || url.startsWith('wss://')) {
      await this.connectWebSocket();
    } else if (url.startsWith('http://') || url.startsWith('https://')) {
      await this.connectHttpStream();
    } else {
      throw new Error(`Unsupported stream protocol: ${this.streamUrl}`);
    }
  }
  
  /**
   * Connect to WebSocket audio stream
   */
  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, this.connectionTimeout);
      
      try {
        this.wsConnection = new WebSocket(this.streamUrl);
        
        this.wsConnection.onopen = () => {
          clearTimeout(timeout);
          this.logger.info('WebSocket connection established');
          
          // Request audio stream configuration
          this.wsConnection?.send(JSON.stringify({
            type: 'config',
            bufferSize: this.bufferSize,
            sampleRate: this.sampleRate,
            channels: this.channels
          }));
          
          resolve();
        };
        
        this.wsConnection.onmessage = (event) => {
          this.handleStreamMessage(event.data);
        };
        
        this.wsConnection.onerror = (error) => {
          clearTimeout(timeout);
          this.logger.error('WebSocket connection error', { error });
          reject(error);
        };
        
        this.wsConnection.onclose = (event) => {
          this.logger.info('WebSocket connection closed', {
            code: event.code,
            reason: event.reason
          });
          
          if (this.isConnected) {
            this.logger.warn('WebSocket disconnected unexpectedly');
            this.handleDisconnection();
          }
        };
        
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }
  
  /**
   * Connect to HTTP audio stream
   */
  private async connectHttpStream(): Promise<void> {
    // This is a simplified implementation
    // In a real implementation, you would use fetch or another HTTP client
    // with streaming support
    
    this.logger.info('HTTP stream connection (simplified implementation)');
    
    // For now, we'll simulate an HTTP stream connection
    // In Phase 2, this would be extended with actual HTTP streaming
    
    // Simulate successful connection
    return Promise.resolve();
  }
  
  /**
   * Handle incoming stream messages/data
   */
  private handleStreamMessage(data: any): void {
    try {
      // Parse the message based on expected format
      // This could be binary audio data or JSON with audio frames
      
      if (typeof data === 'string') {
        // JSON message
        const message = JSON.parse(data);
        
        if (message.type === 'audio') {
          this.processAudioData(message.data, message.timestamp);
        } else if (message.type === 'config') {
          this.updateStreamConfig(message);
        } else if (message.type === 'error') {
          this.logger.error('Stream error received', { error: message.error });
        }
        
      } else if (data instanceof ArrayBuffer) {
        // Binary audio data
        this.processBinaryAudioData(data);
      }
      
    } catch (error) {
      this.logger.error('Error processing stream message', { error });
    }
  }
  
  /**
   * Process audio data from stream
   */
  private processAudioData(audioData: any, timestamp: number): void {
    // Convert audio data to Float32Array
    // This depends on the stream format
    
    let samples: Float32Array;
    
    if (Array.isArray(audioData)) {
      samples = new Float32Array(audioData);
    } else if (audioData instanceof ArrayBuffer) {
      samples = new Float32Array(audioData);
    } else {
      this.logger.warn('Unsupported audio data format');
      return;
    }
    
    // Ensure correct buffer size
    if (samples.length !== this.bufferSize) {
      this.logger.warn('Audio frame size mismatch', {
        expected: this.bufferSize,
        actual: samples.length
      });
      
      // Resample or truncate if needed
      if (samples.length > this.bufferSize) {
        samples = samples.slice(0, this.bufferSize);
      } else {
        const resized = new Float32Array(this.bufferSize);
        resized.set(samples);
        samples = resized;
      }
    }
    
    const frame: AudioFrame = {
      samples,
      timestamp: timestamp || Date.now(),
      sampleRate: this.sampleRate,
      channels: this.channels
    };
    
    this.frameQueue.push(frame);
    
    // Limit queue size
    if (this.frameQueue.length > 100) {
      this.frameQueue.shift();
      this.stats.framesDropped++;
    }
  }
  
  /**
   * Process binary audio data
   */
  private processBinaryAudioData(buffer: ArrayBuffer): void {
    // Convert binary data to audio samples
    // This is a simplified implementation
    
    const dataView = new DataView(buffer);
    const samples = new Float32Array(this.bufferSize);
    
    // Simple conversion (assuming 16-bit PCM)
    for (let i = 0; i < Math.min(this.bufferSize, buffer.byteLength / 2); i++) {
      const int16 = dataView.getInt16(i * 2, true); // Little-endian
      samples[i] = int16 / 32768.0; // Normalize to [-1, 1]
    }
    
    const frame: AudioFrame = {
      samples,
      timestamp: Date.now(),
      sampleRate: this.sampleRate,
      channels: this.channels
    };
    
    this.frameQueue.push(frame);
    
    // Limit queue size
    if (this.frameQueue.length > 100) {
      this.frameQueue.shift();
      this.stats.framesDropped++;
    }
  }
  
  /**
   * Update stream configuration from server
   */
  private updateStreamConfig(config: any): void {
    if (config.sampleRate) {
      this.sampleRate = config.sampleRate;
      this.stats.sampleRate = this.sampleRate;
    }
    
    if (config.channels) {
      this.channels = config.channels;
      this.stats.channels = this.channels;
    }
    
    if (config.bufferSize) {
      this.bufferSize = config.bufferSize;
      this.stats.bufferSize = this.bufferSize;
    }
    
    this.logger.info('Stream configuration updated', {
      sampleRate: this.sampleRate,
      channels: this.channels,
      bufferSize: this.bufferSize
    });
  }
  
  /**
   * Handle unexpected disconnection
   */
  private handleDisconnection(): void {
    this.isConnected = false;
    this.active = false;
    this.stats.isRunning = false;
    
    // Try to reconnect
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      this.logger.info('Scheduling reconnect after disconnection', {
        attempt: this.reconnectAttempts
      });
      
      setTimeout(() => {
        this.start().catch(err => {
          this.logger.error('Reconnect after disconnection failed', { error: err });
        });
      }, this.reconnectDelay);
    }
  }
  
  /**
   * Get stream connection status
   */
  getConnectionStatus(): {
    isConnected: boolean;
    url: string;
    reconnectAttempts: number;
    latency: number;
  } {
    return {
      isConnected: this.isConnected,
      url: this.streamUrl,
      reconnectAttempts: this.reconnectAttempts,
      latency: this.stats.currentLatency
    };
  }
  
  /**
   * Test if a stream URL is reachable
   */
  static async testStream(url: string, timeout = 5000): Promise<boolean> {
    return new Promise((resolve) => {
      const testWs = new WebSocket(url);
      const timer = setTimeout(() => {
        testWs.close();
        resolve(false);
      }, timeout);
      
      testWs.onopen = () => {
        clearTimeout(timer);
        testWs.close();
        resolve(true);
      };
      
      testWs.onerror = () => {
        clearTimeout(timer);
        resolve(false);
      };
    });
  }
}