/**
 * Microphone audio source
 * Captures audio from system microphone
 */

import { BaseAudioSource } from './audioSource';
import { AudioSourceConfig, AudioSourceType, AudioFrame } from '../types';

export class MicrophoneSource extends BaseAudioSource {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private mediaStreamSource: MediaStreamAudioSourceNode | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private frameQueue: AudioFrame[] = [];
  private isCapturing = false;
  
  constructor(name: string, config: AudioSourceConfig) {
    super(name, 'microphone', config);
    this.logger = this.logger.child({ source: 'microphone' });
  }
  
  async initialize(config: AudioSourceConfig): Promise<void> {
    this.config = { ...this.config, ...config };
    
    // Check if browser supports Web Audio API
    if (typeof window === 'undefined' || !window.AudioContext) {
      throw new Error('Web Audio API not supported in this environment');
    }
    
    this.logger.info('Microphone source initialized', { config: this.config });
  }
  
  async start(): Promise<void> {
    if (this.isCapturing) {
      this.logger.warn('Microphone is already capturing');
      return;
    }
    
    try {
      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: this.config.deviceId ? { exact: this.config.deviceId } : undefined,
          channelCount: this.config.channels || 1,
          sampleRate: this.config.bufferSize || 44100,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });
      
      // Create audio context
      this.audioContext = new AudioContext({
        sampleRate: this.config.bufferSize || 44100,
        latencyHint: 'interactive'
      });
      
      // Create media stream source
      this.mediaStreamSource = this.audioContext.createMediaStreamSource(this.mediaStream);
      
      // Create script processor for capturing audio data
      this.scriptProcessor = this.audioContext.createScriptProcessor(
        4096, // buffer size
        this.config.channels || 1,
        this.config.channels || 1
      );
      
      // Set up audio processing
      this.scriptProcessor.onaudioprocess = (event) => {
        this.handleAudioProcess(event);
      };
      
      // Connect nodes
      this.mediaStreamSource.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.audioContext.destination);
      
      this.isCapturing = true;
      this.active = true;
      this.stats.isRunning = true;
      
      this.logger.info('Microphone started capturing', {
        sampleRate: this.audioContext.sampleRate,
        channels: this.config.channels || 1
      });
      
      this.emit('started');
      
    } catch (error) {
      this.logger.error('Failed to start microphone', { error });
      await this.cleanup();
      throw error;
    }
  }
  
  async stop(): Promise<void> {
    if (!this.isCapturing) {
      return;
    }
    
    this.logger.info('Stopping microphone capture...');
    
    // Disconnect audio nodes
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor.onaudioprocess = null;
      this.scriptProcessor = null;
    }
    
    if (this.mediaStreamSource) {
      this.mediaStreamSource.disconnect();
      this.mediaStreamSource = null;
    }
    
    // Stop media stream tracks
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    
    // Close audio context
    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close();
      this.audioContext = null;
    }
    
    this.isCapturing = false;
    this.active = false;
    this.stats.isRunning = false;
    this.frameQueue = [];
    
    this.logger.info('Microphone stopped');
    this.emit('stopped');
  }
  
  async getNextFrame(): Promise<AudioFrame | null> {
    if (!this.isCapturing || this.frameQueue.length === 0) {
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
    this.logger.info('Microphone source cleaned up');
  }
  
  /**
   * Handle audio processing event
   */
  private handleAudioProcess(event: AudioProcessingEvent): void {
    if (!this.isCapturing) return;
    
    const inputBuffer = event.inputBuffer;
    const channelCount = inputBuffer.numberOfChannels;
    const frameSize = inputBuffer.length;
    
    // Combine channels if stereo (average left and right)
    const samples = new Float32Array(frameSize);
    
    if (channelCount === 1) {
      const channelData = inputBuffer.getChannelData(0);
      samples.set(channelData);
    } else {
      // Mix down to mono by averaging channels
      for (let i = 0; i < frameSize; i++) {
        let sum = 0;
        for (let channel = 0; channel < channelCount; channel++) {
          sum += inputBuffer.getChannelData(channel)[i];
        }
        samples[i] = sum / channelCount;
      }
    }
    
    const frame: AudioFrame = {
      samples,
      timestamp: Date.now(),
      sampleRate: inputBuffer.sampleRate,
      channels: channelCount
    };
    
    this.frameQueue.push(frame);
    
    // Limit queue size to prevent memory issues
    if (this.frameQueue.length > 100) {
      this.frameQueue.shift();
      this.stats.framesDropped++;
    }
  }
  
  /**
   * Get available audio input devices
   */
  static async getAvailableDevices(): Promise<MediaDeviceInfo[]> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      return [];
    }
    
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(device => device.kind === 'audioinput');
    } catch (error) {
      console.error('Error getting audio devices:', error);
      return [];
    }
  }
  
  /**
   * Check if microphone access is available
   */
  static async isAvailable(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      return false;
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch {
      return false;
    }
  }
}