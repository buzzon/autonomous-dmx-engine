/**
 * Audio Sources Index
 * Exports all audio source implementations
 */

import { AudioSource, BaseAudioSource, AudioSourceStats, AudioSourceEvent, AudioSourceEventListener } from './audioSource';
import { AudioSourceManager, SourceManagerConfig, SourceManagerStats, defaultAudioSourceManager } from './sourceManager';
import { MicrophoneSource } from './microphoneSource';
import { FileSource } from './fileSource';
import { StreamSource } from './streamSource';

export { AudioSource, BaseAudioSource, AudioSourceStats, AudioSourceEvent, AudioSourceEventListener };
export { AudioSourceManager, SourceManagerConfig, SourceManagerStats, defaultAudioSourceManager };
export { MicrophoneSource };
export { FileSource };
export { StreamSource };

/**
 * Create audio source based on configuration
 */
export function createAudioSource(name: string, config: any): any {
  switch (config.type) {
    case 'microphone':
      return new MicrophoneSource(name, config);
    case 'file':
      return new FileSource(name, config);
    case 'stream':
      return new StreamSource(name, config);
    default:
      throw new Error(`Unsupported audio source type: ${config.type}`);
  }
}

/**
 * Get default audio source configuration
 */
export function getDefaultSourceConfig(type: string): any {
  const baseConfig = {
    bufferSize: 1024,
    channels: 2
  };

  switch (type) {
    case 'microphone':
      return {
        ...baseConfig,
        type: 'microphone',
        deviceId: undefined // Use default device
      };
    case 'file':
      return {
        ...baseConfig,
        type: 'file',
        filePath: '',
        loop: false
      };
    case 'stream':
      return {
        ...baseConfig,
        type: 'stream',
        streamUrl: '',
        reconnectAttempts: 5,
        reconnectDelay: 2000
      };
    default:
      return baseConfig;
  }
}