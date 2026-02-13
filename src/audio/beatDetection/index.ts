/**
 * Beat Detection Module Index
 * Exports beat detection algorithms and utilities
 */

import { BeatDetector, BeatDetectionConfig, BeatDetectionResult, BeatDetectionState } from './detector';

export { BeatDetector, BeatDetectionConfig, BeatDetectionResult, BeatDetectionState };

/**
 * Default beat detection configuration
 */
export const defaultBeatDetectionConfig: BeatDetectionConfig = {
  sampleRate: 44100,
  frameSize: 1024,
  hopSize: 512,
  
  energyThresholdCoeff: 1.5,
  minBeatInterval: 100,
  energyHistorySize: 43,
  
  useSpectralFlux: true,
  spectralFluxThreshold: 0.1,
  spectralFluxHistorySize: 21,
  
  combinedThreshold: 0.6,
  confidenceSmoothing: 0.3,
  
  onsetThreshold: 0.15,
  onsetDecayRate: 0.95
};

/**
 * Create beat detector with default configuration
 */
export function createBeatDetector(config: Partial<BeatDetectionConfig> = {}): BeatDetector {
  return new BeatDetector({ ...defaultBeatDetectionConfig, ...config });
}

/**
 * Beat detection utilities
 */
export const BeatDetectionUtils = {
  /**
   * Calculate energy of audio frame
   */
  calculateEnergy(samples: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      sum += samples[i] * samples[i];
    }
    return Math.sqrt(sum / samples.length);
  },

  /**
   * Calculate spectral flux between two spectra
   */
  calculateSpectralFlux(currentSpectrum: Float32Array, previousSpectrum: Float32Array | null): number {
    if (!previousSpectrum || currentSpectrum.length !== previousSpectrum.length) {
      return 0;
    }
    
    let flux = 0;
    for (let i = 0; i < currentSpectrum.length; i++) {
      const diff = currentSpectrum[i] - previousSpectrum[i];
      flux += diff > 0 ? diff : 0; // Only positive differences
    }
    
    return flux / currentSpectrum.length;
  },

  /**
   * Calculate onset detection score
   */
  calculateOnsetScore(currentEnergy: number, previousEnergy: number, threshold: number = 0.15): number {
    if (previousEnergy === 0) return 1;
    
    const increase = (currentEnergy - previousEnergy) / previousEnergy;
    return Math.min(1, Math.max(0, increase / threshold));
  },

  /**
   * Calculate adaptive threshold from history
   */
  calculateAdaptiveThreshold(history: number[], coefficient: number = 1.5): number {
    if (history.length === 0) return 0;
    
    let sum = 0;
    for (const value of history) {
      sum += value;
    }
    
    return (sum / history.length) * coefficient;
  },

  /**
   * Convert interval in ms to BPM
   */
  intervalToBPM(intervalMs: number): number {
    if (intervalMs === 0) return 0;
    return 60000 / intervalMs;
  },

  /**
   * Convert BPM to interval in ms
   */
  bpmToInterval(bpm: number): number {
    if (bpm === 0) return 0;
    return 60000 / bpm;
  },

  /**
   * Check if interval is consistent with expected BPM
   */
  isIntervalConsistent(intervalMs: number, expectedBpm: number, tolerance: number = 0.2): boolean {
    const expectedInterval = this.bpmToInterval(expectedBpm);
    const deviation = Math.abs(intervalMs - expectedInterval) / expectedInterval;
    return deviation <= tolerance;
  },

  /**
   * Calculate beat confidence based on multiple factors
   */
  calculateBeatConfidence(
    energyScore: number,
    spectralScore: number,
    onsetScore: number,
    weights: { energy: number; spectral: number; onset: number } = { energy: 0.4, spectral: 0.4, onset: 0.2 }
  ): number {
    const totalWeight = weights.energy + weights.spectral + weights.onset;
    const weightedScore = 
      (energyScore * weights.energy + 
       spectralScore * weights.spectral + 
       onsetScore * weights.onset) / totalWeight;
    
    return Math.min(1, Math.max(0, weightedScore));
  }
};