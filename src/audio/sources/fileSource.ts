/**
 * File audio source
 * Plays audio from files (MP3, WAV, etc.)
 */

import { BaseAudioSource } from './audioSource';
import { AudioSourceConfig, AudioSourceType, AudioFrame, AudioBuffer as AudioBufferType } from '../types';
import { defaultLogger } from '../../utils/logger';

// Import audio-decode for file decoding
const audioDecode = require('audio-decode');

// Local interface for decoded audio data
interface DecodedAudioData {
  sampleRate: number;
  length: number;
  numberOfChannels: number;
  getChannelData(channel: number): Float32Array;
}

// Local interface for file audio buffer
interface FileAudioBuffer {
  frames: AudioFrame[];
  maxSize: number;
  currentIndex: number;
}

export class FileSource extends BaseAudioSource {
  private audioBuffer: FileAudioBuffer | null = null;
  private isPlaying = false;
  private playStartTime = 0;
  private currentPosition = 0;
  private frameQueue: AudioFrame[] = [];
  private playInterval?: NodeJS.Timeout;
  private filePath: string;
  
  constructor(name: string, config: AudioSourceConfig) {
    super(name, 'file', config);
    this.logger = this.logger.child({ source: 'file' });
    this.filePath = config.filePath || '';
  }
  
  async initialize(config: AudioSourceConfig): Promise<void> {
    this.config = { ...this.config, ...config };
    
    if (config.filePath) {
      this.filePath = config.filePath;
    }
    
    if (!this.filePath) {
      throw new Error('File path is required for file audio source');
    }
    
    try {
      this.logger.info('Loading audio file...', { filePath: this.filePath });
      
      // Decode audio file
      const audioData: DecodedAudioData = await audioDecode(this.filePath);
      
      this.audioBuffer = {
        frames: [],
        maxSize: Math.ceil(audioData.length / (this.config.bufferSize || 1024)),
        currentIndex: 0
      };
      
      // Convert decoded audio to frames
      const sampleRate = audioData.sampleRate;
      const channels = audioData.numberOfChannels;
      const bufferSize = this.config.bufferSize || 1024;
      
      // Create frames from audio data
      const totalSamples = audioData.length;
      const frameCount = Math.ceil(totalSamples / bufferSize);
      
      for (let i = 0; i < frameCount; i++) {
        const start = i * bufferSize;
        const end = Math.min(start + bufferSize, totalSamples);
        const frameSamples = new Float32Array(bufferSize);
        
        // Copy samples (assuming mono or mixing down to mono)
        if (channels === 1) {
          for (let j = start; j < end; j++) {
            frameSamples[j - start] = audioData.getChannelData(0)[j];
          }
        } else {
          // Mix down to mono by averaging channels
          for (let j = start; j < end; j++) {
            let sum = 0;
            for (let channel = 0; channel < channels; channel++) {
              sum += audioData.getChannelData(channel)[j];
            }
            frameSamples[j - start] = sum / channels;
          }
        }
        
        const frame: AudioFrame = {
          samples: frameSamples,
          timestamp: 0, // Will be set during playback
          sampleRate,
          channels: 1 // Mixed down to mono
        };
        
        this.audioBuffer.frames.push(frame);
      }
      
      this.stats.sampleRate = sampleRate;
      this.stats.channels = 1;
      this.stats.bufferSize = bufferSize;
      
      this.logger.info('Audio file loaded successfully', {
        filePath: this.filePath,
        duration: totalSamples / sampleRate,
        sampleRate,
        channels,
        frames: frameCount,
        bufferSize
      });
      
    } catch (error) {
      this.logger.error('Failed to load audio file', {
        filePath: this.filePath,
        error
      });
      throw error;
    }
  }
  
  async start(): Promise<void> {
    if (this.isPlaying) {
      this.logger.warn('File is already playing');
      return;
    }
    
    if (!this.audioBuffer || this.audioBuffer.frames.length === 0) {
      throw new Error('Audio file not loaded or empty');
    }
    
    this.logger.info('Starting file playback...', {
      filePath: this.filePath,
      frames: this.audioBuffer.frames.length
    });
    
    this.isPlaying = true;
    this.active = true;
    this.stats.isRunning = true;
    this.playStartTime = Date.now();
    this.currentPosition = 0;
    this.frameQueue = [];
    
    // Calculate frame interval based on buffer size and sample rate
    const frameInterval = (this.config.bufferSize || 1024) / this.stats.sampleRate * 1000;
    
    // Start playback loop
    this.playInterval = setInterval(() => {
      this.playbackTick();
    }, frameInterval);
    
    this.logger.info('File playback started', {
      frameInterval,
      sampleRate: this.stats.sampleRate
    });
    
    this.emit('started');
  }
  
  async stop(): Promise<void> {
    if (!this.isPlaying) {
      return;
    }
    
    this.logger.info('Stopping file playback...');
    
    if (this.playInterval) {
      clearInterval(this.playInterval);
      this.playInterval = undefined;
    }
    
    this.isPlaying = false;
    this.active = false;
    this.stats.isRunning = false;
    this.frameQueue = [];
    
    this.logger.info('File playback stopped');
    this.emit('stopped');
  }
  
  async getNextFrame(): Promise<AudioFrame | null> {
    if (!this.isPlaying || this.frameQueue.length === 0) {
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
    this.audioBuffer = null;
    this.logger.info('File source cleaned up');
  }
  
  /**
   * Playback tick - generates frames at real-time rate
   */
  private playbackTick(): void {
    if (!this.isPlaying || !this.audioBuffer) return;
    
    if (this.currentPosition >= this.audioBuffer.frames.length) {
      // End of file reached
      this.logger.info('End of audio file reached');
      this.stop().catch(error => {
        this.logger.error('Error stopping at end of file', { error });
      });
      return;
    }
    
    const frame = this.audioBuffer.frames[this.currentPosition];
    const playbackFrame: AudioFrame = {
      ...frame,
      timestamp: Date.now()
    };
    
    this.frameQueue.push(playbackFrame);
    this.currentPosition++;
    
    // Limit queue size
    if (this.frameQueue.length > 100) {
      this.frameQueue.shift();
      this.stats.framesDropped++;
    }
    
    // Emit progress event every 10%
    if (this.currentPosition % Math.floor(this.audioBuffer.frames.length / 10) === 0) {
      const progress = (this.currentPosition / this.audioBuffer.frames.length) * 100;
      this.logger.debug('Playback progress', { progress: progress.toFixed(1) + '%' });
    }
  }
  
  /**
   * Get current playback position in seconds
   */
  getCurrentTime(): number {
    if (!this.audioBuffer) return 0;
    return (this.currentPosition * (this.config.bufferSize || 1024)) / this.stats.sampleRate;
  }
  
  /**
   * Get total duration in seconds
   */
  getDuration(): number {
    if (!this.audioBuffer) return 0;
    return (this.audioBuffer.frames.length * (this.config.bufferSize || 1024)) / this.stats.sampleRate;
  }
  
  /**
   * Seek to specific position in seconds
   */
  seek(timeInSeconds: number): void {
    if (!this.audioBuffer) return;
    
    const frameSize = this.config.bufferSize || 1024;
    const targetFrame = Math.floor((timeInSeconds * this.stats.sampleRate) / frameSize);
    
    if (targetFrame >= 0 && targetFrame < this.audioBuffer.frames.length) {
      this.currentPosition = targetFrame;
      this.frameQueue = []; // Clear queued frames
      
      this.logger.info('Seeked to position', {
        time: timeInSeconds,
        frame: targetFrame,
        totalFrames: this.audioBuffer.frames.length
      });
    }
  }
  
  /**
   * Check if file exists and is playable
   */
  static async isFilePlayable(filePath: string): Promise<boolean> {
    try {
      const fs = require('fs');
      const path = require('path');
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return false;
      }
      
      // Try to decode a small portion to check if it's a valid audio file
      const audioData = await audioDecode(filePath);
      return audioData && audioData.length > 0;
      
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Get supported audio file extensions
   */
  static getSupportedExtensions(): string[] {
    return ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac'];
  }
}