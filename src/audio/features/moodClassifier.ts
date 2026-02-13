/**
 * Mood Classifier
 * Rule-based classification of music mood based on audio features
 */

import { Mood } from '../types';

export interface MoodClassifierConfig {
  // Energy thresholds (0-1)
  energyThresholdLow: number;   // below this -> calm
  energyThresholdHigh: number;  // above this -> hard
  // BPM thresholds
  bpmThresholdLow: number;      // below this -> calm
  bpmThresholdHigh: number;     // above this -> hard
  // Spectral centroid threshold (brightness)
  centroidThreshold: number;    // above this -> more energetic
  // History smoothing
  historySize: number;          // number of frames to consider for smoothing
  moodUpdateInterval: number;   // ms between mood updates
}

export interface AudioFeatures {
  energy: number;               // 0-1
  bpm: number | null;           // beats per minute
  spectralCentroid?: number;    // 0-1 - brightness
  spectralFlux?: number;        // 0-1 - spectral change rate
  spectralRolloff?: number;     // 0-1 - frequency where 85% of energy is contained
  spectralFlatness?: number;    // 0-1 - noisiness vs tonalness (0 = tonal, 1 = noisy)
  zeroCrossingRate?: number;    // 0-1 - rate of sign changes
  bands?: Float32Array;         // frequency band energies
}

/**
 * Simple rule-based mood classifier
 */
export class MoodClassifier {
  private config: MoodClassifierConfig;
  private history: Mood[] = [];
  private lastUpdateTime = 0;

  constructor(config: MoodClassifierConfig) {
    this.config = config;
  }

  /**
   * Classify mood based on current audio features
   */
  classify(features: AudioFeatures): Mood {
    const {
      energy,
      bpm,
      spectralCentroid,
      spectralFlux,
      spectralRolloff,
      spectralFlatness,
      zeroCrossingRate,
      bands
    } = features;
    
    // Default to calm if insufficient data
    if (energy === undefined) {
      return 'calm';
    }

    let energyScore = 0;
    let bpmScore = 0;
    let centroidScore = 0;
    let rolloffScore = 0;
    let flatnessScore = 0;
    let fluxScore = 0;

    // Energy scoring
    if (energy < this.config.energyThresholdLow) {
      energyScore = -1; // calm
    } else if (energy > this.config.energyThresholdHigh) {
      energyScore = 1; // hard
    } else {
      energyScore = 0; // medium
    }

    // BPM scoring (if available)
    if (bpm !== null && bpm > 0) {
      if (bpm < this.config.bpmThresholdLow) {
        bpmScore = -1;
      } else if (bpm > this.config.bpmThresholdHigh) {
        bpmScore = 1;
      } else {
        bpmScore = 0;
      }
    }

    // Spectral centroid scoring (brightness)
    if (spectralCentroid !== undefined) {
      if (spectralCentroid > this.config.centroidThreshold) {
        centroidScore = 1;
      } else {
        centroidScore = -1;
      }
    }

    // Spectral rolloff scoring (high rolloff = more high-frequency content)
    if (spectralRolloff !== undefined) {
      if (spectralRolloff > 0.6) { // High rolloff indicates more high-frequency energy
        rolloffScore = 1;
      } else if (spectralRolloff < 0.4) {
        rolloffScore = -1;
      } else {
        rolloffScore = 0;
      }
    }

    // Spectral flatness scoring (high flatness = noisy, low flatness = tonal)
    if (spectralFlatness !== undefined) {
      if (spectralFlatness > 0.7) { // Very noisy
        flatnessScore = 1; // Noisy sounds can be more energetic
      } else if (spectralFlatness < 0.3) {
        flatnessScore = -1; // Very tonal sounds are often calmer
      } else {
        flatnessScore = 0;
      }
    }

    // Spectral flux scoring (change in spectrum)
    if (spectralFlux !== undefined) {
      if (spectralFlux > 0.6) { // High spectral change
        fluxScore = 1;
      } else if (spectralFlux < 0.3) {
        fluxScore = -1;
      } else {
        fluxScore = 0;
      }
    }

    // Combine scores with updated weights
    const totalScore =
      energyScore * 0.35 +      // Energy is most important
      bpmScore * 0.25 +         // BPM is also important
      centroidScore * 0.15 +    // Brightness
      rolloffScore * 0.10 +     // High-frequency content
      flatnessScore * 0.08 +    // Noisiness vs tonalness
      fluxScore * 0.07;         // Spectral change rate

    // Determine mood based on total score
    if (totalScore < -0.4) {
      return 'calm';
    } else if (totalScore > 0.4) {
      return 'hard';
    } else {
      return 'medium';
    }
  }

  /**
   * Classify with temporal smoothing (consider recent history)
   */
  classifyWithSmoothing(features: AudioFeatures, timestamp: number): Mood {
    const currentMood = this.classify(features);
    
    // Update history
    this.history.push(currentMood);
    if (this.history.length > this.config.historySize) {
      this.history.shift();
    }

    // Only update mood if enough time has passed
    if (timestamp - this.lastUpdateTime < this.config.moodUpdateInterval) {
      // Return the most recent mood (could also return previous)
      return this.history[this.history.length - 1] || currentMood;
    }

    this.lastUpdateTime = timestamp;

    // Determine dominant mood in history
    const counts = { calm: 0, medium: 0, hard: 0 };
    for (const mood of this.history) {
      counts[mood]++;
    }

    let dominantMood: Mood = 'calm';
    let maxCount = 0;
    for (const [mood, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        dominantMood = mood as Mood;
      }
    }

    return dominantMood;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<MoodClassifierConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Reset history
   */
  reset(): void {
    this.history = [];
    this.lastUpdateTime = 0;
  }
}

/**
 * Default configuration for mood classifier
 */
export const defaultMoodClassifierConfig: MoodClassifierConfig = {
  energyThresholdLow: 0.3,
  energyThresholdHigh: 0.7,
  bpmThresholdLow: 80,
  bpmThresholdHigh: 140,
  centroidThreshold: 0.5,
  historySize: 10,
  moodUpdateInterval: 1000, // 1 second
};