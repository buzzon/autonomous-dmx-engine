/**
 * FFT Module Index
 * Exports FFT analyzer and related utilities
 */

import { FFTAnalyzer, FFTAnalyzerConfig, WindowType, SpectralFeatures, FFTAnalyzerState } from './analyzer';

export { FFTAnalyzer, FFTAnalyzerConfig, WindowType, SpectralFeatures, FFTAnalyzerState };

/**
 * Default FFT analyzer configuration
 */
export const defaultFFTConfig = {
  sampleRate: 44100,
  fftSize: 2048,
  windowType: 'hann' as const,
  frequencyBands: 8,
  minFrequency: 20,
  maxFrequency: 20000,
  smoothingAlpha: 0.3
};

/**
 * Create FFT analyzer with default configuration
 */
export function createFFTAnalyzer(config: Partial<FFTAnalyzerConfig> = {}): FFTAnalyzer {
  return new FFTAnalyzer({ ...defaultFFTConfig, ...config });
}

/**
 * Utility functions for FFT analysis
 */
export const FFTUtils = {
  /**
   * Convert frequency to bin index
   */
  frequencyToBin(frequency: number, sampleRate: number, fftSize: number): number {
    return Math.floor(frequency * fftSize / sampleRate);
  },

  /**
   * Convert bin index to frequency
   */
  binToFrequency(bin: number, sampleRate: number, fftSize: number): number {
    return bin * sampleRate / fftSize;
  },

  /**
   * Calculate frequency resolution
   */
  getFrequencyResolution(sampleRate: number, fftSize: number): number {
    return sampleRate / fftSize;
  },

  /**
   * Apply window function to samples
   */
  applyWindow(samples: Float32Array, windowType: WindowType = 'hann'): Float32Array {
    const windowed = new Float32Array(samples.length);
    
    switch (windowType) {
      case 'hann':
        for (let i = 0; i < samples.length; i++) {
          windowed[i] = samples[i] * 0.5 * (1 - Math.cos(2 * Math.PI * i / (samples.length - 1)));
        }
        break;
        
      case 'hamming':
        for (let i = 0; i < samples.length; i++) {
          windowed[i] = samples[i] * (0.54 - 0.46 * Math.cos(2 * Math.PI * i / (samples.length - 1)));
        }
        break;
        
      case 'rectangular':
      default:
        windowed.set(samples);
        break;
    }
    
    return windowed;
  },

  /**
   * Normalize spectrum to 0-1 range
   */
  normalizeSpectrum(spectrum: Float32Array): Float32Array {
    const normalized = new Float32Array(spectrum.length);
    let max = 0;
    
    for (let i = 0; i < spectrum.length; i++) {
      if (spectrum[i] > max) max = spectrum[i];
    }
    
    if (max === 0) return normalized;
    
    for (let i = 0; i < spectrum.length; i++) {
      normalized[i] = spectrum[i] / max;
    }
    
    return normalized;
  },

  /**
   * Convert linear frequency scale to mel scale
   */
  linearToMel(frequency: number): number {
    return 2595 * Math.log10(1 + frequency / 700);
  },

  /**
   * Convert mel scale to linear frequency
   */
  melToLinear(mel: number): number {
    return 700 * (Math.pow(10, mel / 2595) - 1);
  }
};