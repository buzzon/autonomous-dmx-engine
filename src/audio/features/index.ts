/**
 * Audio Features Module Index
 * Exports BPM estimation and other audio feature extraction utilities
 */

import { BPMEstimator, BPMEstimatorConfig, BPMEstimation, BPMEstimatorState } from './bpmEstimator';

export { BPMEstimator, BPMEstimatorConfig, BPMEstimation, BPMEstimatorState };

/**
 * Default BPM estimator configuration
 */
export const defaultBPMEstimatorConfig: BPMEstimatorConfig = {
  minBPM: 60,
  maxBPM: 180,
  historySize: 20,
  smoothingBeta: 0.3,
  confidenceThreshold: 0.7,
  stabilityWindow: 5,
  doubleTimeDetection: true,
  allowedMultipliers: [0.5, 1, 2]
};

/**
 * Create BPM estimator with default configuration
 */
export function createBPMEstimator(config: Partial<BPMEstimatorConfig> = {}): BPMEstimator {
  return new BPMEstimator({ ...defaultBPMEstimatorConfig, ...config });
}

/**
 * Audio feature extraction utilities
 */
export const AudioFeatureUtils = {
  /**
   * Calculate tempo (BPM) from beat intervals
   */
  calculateTempoFromIntervals(intervals: number[]): { bpm: number; confidence: number } {
    if (intervals.length === 0) {
      return { bpm: 0, confidence: 0 };
    }
    
    // Calculate average interval
    const averageInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    
    // Calculate BPM
    const bpm = 60000 / averageInterval;
    
    // Calculate confidence based on interval consistency
    let variance = 0;
    for (const interval of intervals) {
      variance += Math.pow(interval - averageInterval, 2);
    }
    variance /= intervals.length;
    
    const maxAllowedVariance = averageInterval * 0.3; // Allow 30% variance
    const confidence = Math.max(0, 1 - (variance / maxAllowedVariance));
    
    return { bpm, confidence };
  },

  /**
   * Detect double-time or half-time tempo
   */
  detectTempoMultiplier(
    detectedBPM: number, 
    expectedRange: { min: number; max: number } = { min: 80, max: 140 }
  ): { bpm: number; multiplier: number } {
    let bestBPM = detectedBPM;
    let bestMultiplier = 1;
    
    const multipliers = [0.5, 1, 2];
    
    for (const multiplier of multipliers) {
      const candidateBPM = detectedBPM * multiplier;
      
      if (candidateBPM >= expectedRange.min && candidateBPM <= expectedRange.max) {
        // Prefer multipliers that bring BPM closer to the middle of expected range
        const rangeMiddle = (expectedRange.min + expectedRange.max) / 2;
        const distanceToMiddle = Math.abs(candidateBPM - rangeMiddle);
        
        if (distanceToMiddle < Math.abs(bestBPM - rangeMiddle)) {
          bestBPM = candidateBPM;
          bestMultiplier = multiplier;
        }
      }
    }
    
    return { bpm: bestBPM, multiplier: bestMultiplier };
  },

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
   * Calculate zero-crossing rate (noisiness)
   */
  calculateZeroCrossingRate(samples: Float32Array): number {
    if (samples.length < 2) return 0;
    
    let crossings = 0;
    for (let i = 1; i < samples.length; i++) {
      if (samples[i] * samples[i - 1] < 0) {
        crossings++;
      }
    }
    
    return crossings / (samples.length - 1);
  },

  /**
   * Calculate spectral centroid (brightness)
   */
  calculateSpectralCentroid(spectrum: Float32Array, sampleRate: number, fftSize: number): number {
    let weightedSum = 0;
    let sum = 0;
    const frequencyResolution = sampleRate / fftSize;
    
    for (let i = 0; i < spectrum.length; i++) {
      const frequency = i * frequencyResolution;
      const magnitude = spectrum[i];
      
      weightedSum += frequency * magnitude;
      sum += magnitude;
    }
    
    if (sum === 0) return 0;
    
    const centroid = weightedSum / sum;
    
    // Normalize to 0-1 range (assuming max frequency is sampleRate/2)
    return centroid / (sampleRate / 2);
  },

  /**
   * Calculate spectral flux (change between spectra)
   */
  calculateSpectralFlux(currentSpectrum: Float32Array, previousSpectrum: Float32Array): number {
    if (currentSpectrum.length !== previousSpectrum.length) {
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
   * Calculate spectral rolloff (frequency below which 85% of energy is contained)
   */
  calculateSpectralRolloff(spectrum: Float32Array, sampleRate: number, fftSize: number): number {
    const threshold = 0.85; // 85%
    let totalEnergy = 0;
    
    // Calculate total energy
    for (let i = 0; i < spectrum.length; i++) {
      totalEnergy += spectrum[i];
    }
    
    if (totalEnergy === 0) return 0;
    
    const targetEnergy = totalEnergy * threshold;
    let accumulatedEnergy = 0;
    let rolloffBin = 0;
    
    // Find bin where accumulated energy reaches threshold
    for (let i = 0; i < spectrum.length; i++) {
      accumulatedEnergy += spectrum[i];
      if (accumulatedEnergy >= targetEnergy) {
        rolloffBin = i;
        break;
      }
    }
    
    const frequencyResolution = sampleRate / fftSize;
    const rolloffFrequency = rolloffBin * frequencyResolution;
    
    // Normalize to 0-1 range
    return rolloffFrequency / (sampleRate / 2);
  },

  /**
   * Calculate spectral flatness (noisiness vs tonalness)
   */
  calculateSpectralFlatness(spectrum: Float32Array): number {
    let geometricMean = 0;
    let arithmeticMean = 0;
    
    // Use logarithms to avoid numerical issues
    let logSum = 0;
    let sum = 0;
    let count = 0;
    
    for (let i = 0; i < spectrum.length; i++) {
      const value = spectrum[i];
      if (value > 0) {
        logSum += Math.log(value);
        sum += value;
        count++;
      }
    }
    
    if (count === 0) return 0;
    
    geometricMean = Math.exp(logSum / count);
    arithmeticMean = sum / count;
    
    if (arithmeticMean === 0) return 0;
    
    const flatness = geometricMean / arithmeticMean;
    
    // Clamp to 0-1 range
    return Math.max(0, Math.min(1, flatness));
  },

  /**
   * Extract frequency bands from spectrum
   */
  extractFrequencyBands(
    spectrum: Float32Array, 
    sampleRate: number, 
    fftSize: number,
    bands: number = 8
  ): Float32Array {
    const bandEnergies = new Float32Array(bands);
    const frequencyResolution = sampleRate / fftSize;
    
    // Logarithmic band edges (more bands in lower frequencies)
    const minFreq = 20;
    const maxFreq = sampleRate / 2;
    const logMin = Math.log10(minFreq);
    const logMax = Math.log10(maxFreq);
    const logRange = logMax - logMin;
    
    for (let band = 0; band < bands; band++) {
      const startLog = logMin + (logRange * band) / bands;
      const endLog = logMin + (logRange * (band + 1)) / bands;
      
      const startFreq = Math.pow(10, startLog);
      const endFreq = Math.pow(10, endLog);
      
      const startBin = Math.floor(startFreq / frequencyResolution);
      const endBin = Math.min(Math.ceil(endFreq / frequencyResolution), spectrum.length);
      
      let bandEnergy = 0;
      for (let bin = startBin; bin < endBin; bin++) {
        bandEnergy += spectrum[bin];
      }
      
      bandEnergies[band] = bandEnergy;
    }
    
    return bandEnergies;
  },

  /**
   * Normalize array to 0-1 range
   */
  normalizeArray(values: Float32Array): Float32Array {
    const normalized = new Float32Array(values.length);
    
    // Find min and max
    let min = values[0];
    let max = values[0];
    
    for (let i = 1; i < values.length; i++) {
      if (values[i] < min) min = values[i];
      if (values[i] > max) max = values[i];
    }
    
    const range = max - min;
    
    if (range === 0) {
      // All values are the same, set to 0.5
      for (let i = 0; i < values.length; i++) {
        normalized[i] = 0.5;
      }
    } else {
      // Normalize to 0-1
      for (let i = 0; i < values.length; i++) {
        normalized[i] = (values[i] - min) / range;
      }
    }
    
    return normalized;
  }
};