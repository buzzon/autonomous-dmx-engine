/**
 * Real Audio Analyzer
 * Integrates FFT analysis, beat detection, and BPM estimation
 */

import { AudioMetrics, AudioAnalyzerState, AudioAnalyzerConfig, Mood } from './types';
import { defaultLogger } from '../utils/logger';
import { FFTAnalyzer, SpectralFeatures } from './fft/analyzer';
import { BeatDetector, BeatDetectionResult } from './beatDetection/detector';
import { BPMEstimator, BPMEstimation } from './features/bpmEstimator';

export class AudioAnalyzer {
  private logger = defaultLogger.child({ module: 'AudioAnalyzer' });
  private config: AudioAnalyzerConfig;
  private state: AudioAnalyzerState;
  
  // Component instances
  private fftAnalyzer: FFTAnalyzer;
  private beatDetector: BeatDetector;
  private bpmEstimator: BPMEstimator;
  
  // State
  private previousSpectrum: Float32Array | null = null;
  private spectralFluxHistory: number[] = [];
  private moodUpdateCounter = 0;

  constructor(config: AudioAnalyzerConfig) {
    this.config = config;
    
    // Initialize FFT analyzer
    this.fftAnalyzer = new FFTAnalyzer({
      sampleRate: config.sampleRate,
      fftSize: config.frameSize,
      windowType: 'hann',
      frequencyBands: 8,
      minFrequency: 20,
      maxFrequency: config.sampleRate / 2,
      smoothingAlpha: config.energySmoothingAlpha
    });
    
    // Initialize beat detector
    this.beatDetector = new BeatDetector({
      sampleRate: config.sampleRate,
      frameSize: config.frameSize,
      hopSize: config.hopSize,
      energyThresholdCoeff: config.beatThresholdCoeff,
      minBeatInterval: config.minBeatInterval,
      energyHistorySize: config.historySize,
      useSpectralFlux: true,
      spectralFluxThreshold: 0.1,
      spectralFluxHistorySize: Math.floor(config.historySize / 2),
      combinedThreshold: 0.6,
      confidenceSmoothing: 0.3,
      onsetThreshold: 0.15,
      onsetDecayRate: 0.95
    });
    
    // Initialize BPM estimator
    this.bpmEstimator = new BPMEstimator({
      minBPM: 60,
      maxBPM: 180,
      historySize: config.historySize,
      smoothingBeta: config.bpmSmoothingBeta,
      confidenceThreshold: 0.7,
      stabilityWindow: 5,
      doubleTimeDetection: true,
      allowedMultipliers: [0.5, 1, 2]
    });
    
    // Initialize state
    this.state = {
      sampleRate: config.sampleRate,
      frameSize: config.frameSize,
      hopSize: config.hopSize,
      energyHistory: [],
      energyAvg: 0,
      energyPeak: 0,
      lastBeats: [],
      bpm: null,
      lastBeatTime: 0,
      mood: 'calm',
      moodHistory: [],
      lastUpdateTimestamp: 0,
      lastMoodUpdate: 0,
      framesProcessed: 0,
      averageProcessingTime: 0
    };
    
    this.logger.info('Audio Analyzer initialized', {
      sampleRate: config.sampleRate,
      frameSize: config.frameSize,
      hopSize: config.hopSize
    });
  }

  /**
   * Process audio frame and extract metrics
   */
  processFrame(samples: Float32Array, timestamp: number): AudioMetrics {
    const startTime = performance.now();
    
    // 1. Calculate frame energy
    const energy = this.calculateEnergy(samples);
    
    // 2. Update energy history and statistics
    this.updateEnergyHistory(energy);
    
    // 3. Perform FFT analysis
    const spectralFeatures = this.fftAnalyzer.analyze(samples, timestamp);
    
    // 4. Update spectral flux history
    this.updateSpectralFluxHistory(spectralFeatures.spectralFlux);
    
    // 5. Detect beat
    const beatResult = this.beatDetector.detect(
      samples,
      spectralFeatures.spectralFlux,
      timestamp
    );
    
    // 6. Update BPM estimation
    const bpmEstimation = this.bpmEstimator.update({
      isBeat: beatResult.isBeat,
      timestamp,
      interval: beatResult.interval
    });
    
    // 7. Update mood classification
    this.updateMood(energy, bpmEstimation, timestamp);
    
    // 8. Update beat history
    if (beatResult.isBeat) {
      this.updateBeatHistory(timestamp, beatResult);
    }
    
    // 9. Update processing statistics
    this.updateProcessingStatistics(startTime);
    
    // 10. Create metrics object
    const metrics: AudioMetrics = {
      timestamp,
      energy: this.normalizeEnergy(energy),
      beat: beatResult.isBeat,
      bpm: bpmEstimation.bpm,
      mood: this.state.mood,
      spectralCentroid: spectralFeatures.spectralCentroid,
      spectralFlux: spectralFeatures.spectralFlux,
      zeroCrossingRate: this.calculateZeroCrossingRate(samples)
    };
    
    // Store previous spectrum for next frame
    this.previousSpectrum = spectralFeatures.spectrum;
    
    return metrics;
  }

  /**
   * Calculate energy of audio frame
   */
  private calculateEnergy(samples: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      sum += samples[i] * samples[i];
    }
    return Math.sqrt(sum / samples.length);
  }

  /**
   * Update energy history and statistics
   */
  private updateEnergyHistory(energy: number): void {
    // Add to history
    this.state.energyHistory.push(energy);
    
    // Keep history size limited
    if (this.state.energyHistory.length > this.config.historySize) {
      this.state.energyHistory.shift();
    }
    
    // Update average energy
    let sum = 0;
    for (const e of this.state.energyHistory) {
      sum += e;
    }
    this.state.energyAvg = sum / this.state.energyHistory.length;
    
    // Update peak energy
    if (energy > this.state.energyPeak) {
      this.state.energyPeak = energy;
    }
    
    // Decay peak energy over time
    this.state.energyPeak *= 0.999;
  }

  /**
   * Update spectral flux history
   */
  private updateSpectralFluxHistory(spectralFlux: number): void {
    this.spectralFluxHistory.push(spectralFlux);
    
    // Keep history size limited
    if (this.spectralFluxHistory.length > this.config.historySize) {
      this.spectralFluxHistory.shift();
    }
  }

  /**
   * Update mood classification
   */
  private updateMood(energy: number, bpmEstimation: BPMEstimation, timestamp: number): void {
    // Only update mood periodically
    const timeSinceLastUpdate = timestamp - this.state.lastMoodUpdate;
    if (timeSinceLastUpdate < this.config.moodUpdateInterval) {
      return;
    }
    
    this.moodUpdateCounter++;
    
    // Calculate normalized energy
    const normalizedEnergy = this.normalizeEnergy(energy);
    
    // Get BPM (use 120 as default if no estimation)
    const bpm = bpmEstimation.bpm || 120;
    
    // Classify mood based on energy and BPM
    let newMood: Mood = 'calm';
    
    if (normalizedEnergy > this.config.moodEnergyThresholdHigh &&
        bpm > this.config.moodBpmThresholdHigh) {
      newMood = 'hard';
    } else if (normalizedEnergy > this.config.moodEnergyThresholdLow ||
               bpm > this.config.moodBpmThresholdLow) {
      newMood = 'medium';
    } else {
      newMood = 'calm';
    }
    
    // Update mood history
    this.state.moodHistory.push(newMood);
    if (this.state.moodHistory.length > 10) {
      this.state.moodHistory.shift();
    }
    
    // Determine final mood (majority vote from history)
    const moodCounts: Record<Mood, number> = { calm: 0, medium: 0, hard: 0 };
    for (const mood of this.state.moodHistory) {
      moodCounts[mood]++;
    }
    
    let finalMood: Mood = 'calm';
    let maxCount = 0;
    for (const [mood, count] of Object.entries(moodCounts)) {
      if (count > maxCount) {
        maxCount = count;
        finalMood = mood as Mood;
      }
    }
    
    this.state.mood = finalMood;
    this.state.lastMoodUpdate = timestamp;
    
    // Log mood change if it changed
    if (this.moodUpdateCounter % 10 === 0) {
      this.logger.debug('Mood updated', {
        mood: finalMood,
        energy: normalizedEnergy,
        bpm,
        history: this.state.moodHistory
      });
    }
  }

  /**
   * Update beat history
   */
  private updateBeatHistory(timestamp: number, beatResult: BeatDetectionResult): void {
    this.state.lastBeats.push(timestamp);
    this.state.lastBeatTime = timestamp;
    
    // Keep only recent beats (last 10 seconds)
    const tenSecondsAgo = timestamp - 10000;
    this.state.lastBeats = this.state.lastBeats.filter(beatTime => beatTime > tenSecondsAgo);
    
    // Log beat detection
    if (this.state.lastBeats.length % 5 === 0) {
      this.logger.debug('Beat detected', {
        confidence: beatResult.confidence,
        strength: beatResult.strength,
        type: beatResult.type,
        totalBeats: this.state.lastBeats.length
      });
    }
  }

  /**
   * Update processing statistics
   */
  private updateProcessingStatistics(startTime: number): void {
    const processingTime = performance.now() - startTime;
    this.state.framesProcessed++;
    
    // Update average processing time
    this.state.averageProcessingTime =
      (this.state.averageProcessingTime * (this.state.framesProcessed - 1) + processingTime) /
      this.state.framesProcessed;
    
    this.state.lastUpdateTimestamp = Date.now();
  }

  /**
   * Normalize energy to 0-1 range
   */
  private normalizeEnergy(energy: number): number {
    if (this.state.energyPeak === 0) return 0;
    return Math.min(1, energy / this.state.energyPeak);
  }

  /**
   * Calculate zero-crossing rate
   */
  private calculateZeroCrossingRate(samples: Float32Array): number {
    if (samples.length < 2) return 0;
    
    let crossings = 0;
    for (let i = 1; i < samples.length; i++) {
      if (samples[i] * samples[i - 1] < 0) {
        crossings++;
      }
    }
    
    return crossings / (samples.length - 1);
  }

  /**
   * Get current analyzer state
   */
  getState(): AudioAnalyzerState {
    return { ...this.state };
  }

  /**
   * Get component states
   */
  getComponentStates(): {
    fft: any;
    beatDetector: any;
    bpmEstimator: any;
  } {
    return {
      fft: this.fftAnalyzer.getState(),
      beatDetector: this.beatDetector.getState(),
      bpmEstimator: this.bpmEstimator.getState()
    };
  }

  /**
   * Reset analyzer state
   */
  reset(): void {
    this.state.energyHistory = [];
    this.state.lastBeats = [];
    this.state.moodHistory = [];
    this.state.energyAvg = 0;
    this.state.energyPeak = 0;
    this.state.bpm = null;
    this.state.lastBeatTime = 0;
    this.state.mood = 'calm';
    this.state.lastUpdateTimestamp = 0;
    this.state.lastMoodUpdate = 0;
    this.state.framesProcessed = 0;
    this.state.averageProcessingTime = 0;
    
    this.previousSpectrum = null;
    this.spectralFluxHistory = [];
    this.moodUpdateCounter = 0;
    
    // Reset components
    this.fftAnalyzer.reset();
    this.beatDetector.reset();
    this.bpmEstimator.reset();
    
    this.logger.info('Audio Analyzer reset');
  }

  /**
   * Update analyzer configuration
   */
  updateConfig(config: Partial<AudioAnalyzerConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...config };
    
    // Update component configurations
    this.fftAnalyzer.updateConfig({
      sampleRate: this.config.sampleRate,
      fftSize: this.config.frameSize,
      smoothingAlpha: this.config.energySmoothingAlpha
    });
    
    this.beatDetector.updateConfig({
      sampleRate: this.config.sampleRate,
      frameSize: this.config.frameSize,
      hopSize: this.config.hopSize,
      energyThresholdCoeff: this.config.beatThresholdCoeff,
      minBeatInterval: this.config.minBeatInterval,
      energyHistorySize: this.config.historySize
    });
    
    this.logger.info('Audio Analyzer configuration updated', {
      oldConfig,
      newConfig: this.config
    });
  }
}
