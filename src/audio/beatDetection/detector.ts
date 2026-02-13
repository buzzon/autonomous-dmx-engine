/**
 * Beat Detection Algorithm
 * Implements real-time beat detection using energy-based and spectral flux methods
 */

import { defaultLogger } from '../../utils/logger';

export interface BeatDetectionConfig {
  sampleRate: number;
  frameSize: number;
  hopSize: number;
  
  // Energy-based detection
  energyThresholdCoeff: number;    // Multiplier for adaptive threshold (c in DESIGN.md)
  minBeatInterval: number;         // Minimum time between beats (ms)
  energyHistorySize: number;       // Number of frames to keep in energy history
  
  // Spectral flux detection
  useSpectralFlux: boolean;        // Whether to use spectral flux for detection
  spectralFluxThreshold: number;   // Threshold for spectral flux detection
  spectralFluxHistorySize: number; // History size for spectral flux
  
  // Combined detection
  combinedThreshold: number;       // Threshold for combined detection score
  confidenceSmoothing: number;     // Smoothing factor for confidence (0-1)
  
  // Onset detection
  onsetThreshold: number;          // Threshold for onset detection
  onsetDecayRate: number;          // Decay rate for onset energy
}

export interface BeatDetectionResult {
  isBeat: boolean;
  confidence: number;              // 0-1 confidence level
  strength: number;                // 0-1 beat strength
  interval: number | null;         // ms since last beat
  type: 'energy' | 'spectral' | 'combined' | 'onset';
  timestamp: number;
  energy: number;
  spectralFlux: number;
}

export interface BeatDetectionState {
  config: BeatDetectionConfig;
  energyHistory: number[];
  spectralFluxHistory: number[];
  lastBeatTime: number;
  lastBeatInterval: number;
  beatCount: number;
  averageInterval: number;
  isBeatLocked: boolean;           // Whether beat detection is locked to a rhythm
  lockConfidence: number;          // Confidence in beat lock (0-1)
  onsetEnergy: number;             // Current onset energy
}

export class BeatDetector {
  private logger = defaultLogger.child({ module: 'BeatDetector' });
  private config: BeatDetectionConfig;
  private state: BeatDetectionState;
  
  constructor(config: Partial<BeatDetectionConfig> = {}) {
    this.config = {
      sampleRate: config.sampleRate || 44100,
      frameSize: config.frameSize || 1024,
      hopSize: config.hopSize || 512,
      
      energyThresholdCoeff: config.energyThresholdCoeff || 1.5,
      minBeatInterval: config.minBeatInterval || 100,
      energyHistorySize: config.energyHistorySize || 43, // ~1 second at 1024 samples, 44100 Hz
      
      useSpectralFlux: config.useSpectralFlux ?? true,
      spectralFluxThreshold: config.spectralFluxThreshold || 0.1,
      spectralFluxHistorySize: config.spectralFluxHistorySize || 21,
      
      combinedThreshold: config.combinedThreshold || 0.6,
      confidenceSmoothing: config.confidenceSmoothing || 0.3,
      
      onsetThreshold: config.onsetThreshold || 0.15,
      onsetDecayRate: config.onsetDecayRate || 0.95
    };
    
    this.state = {
      config: { ...this.config },
      energyHistory: [],
      spectralFluxHistory: [],
      lastBeatTime: 0,
      lastBeatInterval: 0,
      beatCount: 0,
      averageInterval: 0,
      isBeatLocked: false,
      lockConfidence: 0,
      onsetEnergy: 0
    };
    
    this.logger.info('Beat Detector initialized', {
      sampleRate: this.config.sampleRate,
      frameSize: this.config.frameSize,
      energyThresholdCoeff: this.config.energyThresholdCoeff
    });
  }
  
  /**
   * Detect beat in audio frame
   */
  detect(
    samples: Float32Array, 
    spectralFlux: number = 0, 
    timestamp: number = Date.now()
  ): BeatDetectionResult {
    // Calculate frame energy
    const energy = this.calculateEnergy(samples);
    
    // Update energy history
    this.updateEnergyHistory(energy);
    
    // Calculate spectral flux (if provided)
    const flux = spectralFlux;
    if (this.config.useSpectralFlux) {
      this.updateSpectralFluxHistory(flux);
    }
    
    // Detect beat using multiple methods
    const energyBeat = this.detectEnergyBeat(energy, timestamp);
    const spectralBeat = this.config.useSpectralFlux ? this.detectSpectralBeat(flux, timestamp) : null;
    const onsetBeat = this.detectOnset(energy, timestamp);
    
    // Combine detections
    const combinedResult = this.combineDetections(energyBeat, spectralBeat, onsetBeat, timestamp);
    
    // Update beat statistics
    if (combinedResult.isBeat) {
      this.updateBeatStatistics(timestamp);
    }
    
    // Update onset energy
    this.updateOnsetEnergy(energy);
    
    return combinedResult;
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
   * Update energy history
   */
  private updateEnergyHistory(energy: number): void {
    this.state.energyHistory.push(energy);
    
    // Keep history size limited
    if (this.state.energyHistory.length > this.config.energyHistorySize) {
      this.state.energyHistory.shift();
    }
  }
  
  /**
   * Update spectral flux history
   */
  private updateSpectralFluxHistory(flux: number): void {
    this.state.spectralFluxHistory.push(flux);
    
    // Keep history size limited
    if (this.state.spectralFluxHistory.length > this.config.spectralFluxHistorySize) {
      this.state.spectralFluxHistory.shift();
    }
  }
  
  /**
   * Detect beat using energy-based method
   */
  private detectEnergyBeat(energy: number, timestamp: number): BeatDetectionResult {
    if (this.state.energyHistory.length < 2) {
      return this.createResult(false, 0, 0, 'energy', timestamp, energy, 0);
    }
    
    // Calculate adaptive threshold
    const threshold = this.calculateEnergyThreshold();
    
    // Check if enough time has passed since last beat
    const timeSinceLastBeat = timestamp - this.state.lastBeatTime;
    const minIntervalMet = timeSinceLastBeat >= this.config.minBeatInterval;
    
    // Detect beat
    const isBeat = energy > threshold && minIntervalMet;
    const confidence = isBeat ? this.calculateEnergyConfidence(energy, threshold) : 0;
    const strength = isBeat ? (energy - threshold) / (threshold * 2) : 0;
    
    return this.createResult(isBeat, confidence, strength, 'energy', timestamp, energy, 0);
  }
  
  /**
   * Calculate adaptive energy threshold
   */
  private calculateEnergyThreshold(): number {
    if (this.state.energyHistory.length === 0) return 0;
    
    // Calculate average energy
    let sum = 0;
    for (const e of this.state.energyHistory) {
      sum += e;
    }
    const average = sum / this.state.energyHistory.length;
    
    // Apply threshold coefficient (c from DESIGN.md)
    return average * this.config.energyThresholdCoeff;
  }
  
  /**
   * Calculate confidence for energy-based detection
   */
  private calculateEnergyConfidence(energy: number, threshold: number): number {
    const normalized = (energy - threshold) / threshold;
    return Math.min(1, Math.max(0, normalized));
  }
  
  /**
   * Detect beat using spectral flux method
   */
  private detectSpectralBeat(flux: number, timestamp: number): BeatDetectionResult {
    if (this.state.spectralFluxHistory.length < 2) {
      return this.createResult(false, 0, 0, 'spectral', timestamp, 0, flux);
    }
    
    // Calculate average spectral flux
    let sum = 0;
    for (const f of this.state.spectralFluxHistory) {
      sum += f;
    }
    const averageFlux = sum / this.state.spectralFluxHistory.length;
    
    // Check if enough time has passed since last beat
    const timeSinceLastBeat = timestamp - this.state.lastBeatTime;
    const minIntervalMet = timeSinceLastBeat >= this.config.minBeatInterval;
    
    // Detect beat
    const threshold = averageFlux * this.config.spectralFluxThreshold;
    const isBeat = flux > threshold && minIntervalMet;
    const confidence = isBeat ? this.calculateSpectralConfidence(flux, threshold) : 0;
    const strength = isBeat ? (flux - threshold) / (threshold * 2) : 0;
    
    return this.createResult(isBeat, confidence, strength, 'spectral', timestamp, 0, flux);
  }
  
  /**
   * Calculate confidence for spectral flux detection
   */
  private calculateSpectralConfidence(flux: number, threshold: number): number {
    const normalized = (flux - threshold) / threshold;
    return Math.min(1, Math.max(0, normalized));
  }
  
  /**
   * Detect onset (sudden increase in energy)
   */
  private detectOnset(energy: number, timestamp: number): BeatDetectionResult {
    // Calculate onset detection
    const onsetThreshold = this.config.onsetThreshold;
    const isOnset = energy > this.state.onsetEnergy * (1 + onsetThreshold);
    
    if (!isOnset) {
      return this.createResult(false, 0, 0, 'onset', timestamp, energy, 0);
    }
    
    // Check if enough time has passed since last beat
    const timeSinceLastBeat = timestamp - this.state.lastBeatTime;
    const minIntervalMet = timeSinceLastBeat >= this.config.minBeatInterval;
    
    if (!minIntervalMet) {
      return this.createResult(false, 0, 0, 'onset', timestamp, energy, 0);
    }
    
    const confidence = this.calculateOnsetConfidence(energy, this.state.onsetEnergy);
    const strength = confidence;
    
    return this.createResult(true, confidence, strength, 'onset', timestamp, energy, 0);
  }
  
  /**
   * Calculate confidence for onset detection
   */
  private calculateOnsetConfidence(currentEnergy: number, previousEnergy: number): number {
    if (previousEnergy === 0) return 1;
    
    const increase = (currentEnergy - previousEnergy) / previousEnergy;
    return Math.min(1, Math.max(0, increase / this.config.onsetThreshold));
  }
  
  /**
   * Update onset energy with decay
   */
  private updateOnsetEnergy(energy: number): void {
    // Apply decay to current onset energy
    this.state.onsetEnergy *= this.config.onsetDecayRate;
    
    // Update with current energy if higher
    if (energy > this.state.onsetEnergy) {
      this.state.onsetEnergy = energy;
    }
  }
  
  /**
   * Combine multiple detection methods
   */
  private combineDetections(
    energyBeat: BeatDetectionResult,
    spectralBeat: BeatDetectionResult | null,
    onsetBeat: BeatDetectionResult,
    timestamp: number
  ): BeatDetectionResult {
    // Calculate combined score
    let combinedScore = energyBeat.confidence;
    let methodCount = 1;
    
    if (spectralBeat && this.config.useSpectralFlux) {
      combinedScore += spectralBeat.confidence;
      methodCount++;
    }
    
    if (onsetBeat.isBeat) {
      combinedScore += onsetBeat.confidence;
      methodCount++;
    }
    
    const averageScore = combinedScore / methodCount;
    
    // Determine if combined detection indicates a beat
    const isBeat = averageScore >= this.config.combinedThreshold;
    
    // Calculate interval since last beat
    const interval = this.state.lastBeatTime > 0 ? timestamp - this.state.lastBeatTime : null;
    
    // Smooth confidence
    const smoothedConfidence = this.smoothConfidence(averageScore);
    
    return {
      isBeat,
      confidence: smoothedConfidence,
      strength: averageScore,
      interval,
      type: 'combined',
      timestamp,
      energy: energyBeat.energy,
      spectralFlux: spectralBeat?.spectralFlux || 0
    };
  }
  
  /**
   * Smooth confidence using exponential moving average
   */
  private smoothConfidence(newConfidence: number): number {
    const alpha = this.config.confidenceSmoothing;
    // For now, just return the new confidence (would need previous confidence state)
    return newConfidence;
  }
  
  /**
   * Update beat statistics
   */
  private updateBeatStatistics(timestamp: number): void {
    // Update last beat time and calculate interval
    if (this.state.lastBeatTime > 0) {
      this.state.lastBeatInterval = timestamp - this.state.lastBeatTime;
      
      // Update average interval
      this.state.beatCount++;
      this.state.averageInterval = 
        (this.state.averageInterval * (this.state.beatCount - 1) + this.state.lastBeatInterval) / 
        this.state.beatCount;
      
      // Update beat lock confidence
      this.updateBeatLock();
    }
    
    this.state.lastBeatTime = timestamp;
  }
  
  /**
   * Update beat lock (rhythm consistency)
   */
  private updateBeatLock(): void {
    if (this.state.beatCount < 3) {
      this.state.isBeatLocked = false;
      this.state.lockConfidence = 0;
      return;
    }
    
    // Calculate consistency of recent intervals
    const expectedInterval = this.state.averageInterval;
    const deviation = Math.abs(this.state.lastBeatInterval - expectedInterval) / expectedInterval;
    
    // High consistency = high lock confidence
    const consistency = 1 - Math.min(1, deviation * 2);
    this.state.lockConfidence = consistency;
    this.state.isBeatLocked = consistency > 0.7;
  }
  
  /**
   * Create beat detection result
   */
  private createResult(
    isBeat: boolean,
    confidence: number,
    strength: number,
    type: BeatDetectionResult['type'],
    timestamp: number,
    energy: number,
    spectralFlux: number
  ): BeatDetectionResult {
    const interval = this.state.lastBeatTime > 0 ? timestamp - this.state.lastBeatTime : null;
    
    return {
      isBeat,
      confidence: Math.min(1, Math.max(0, confidence)),
      strength: Math.min(1, Math.max(0, strength)),
      interval,
      type,
      timestamp,
      energy,
      spectralFlux
    };
  }
  
  /**
   * Get current detector state
   */
  getState(): BeatDetectionState {
    return { ...this.state };
  }
  
  /**
   * Get detector configuration
   */
  getConfig(): BeatDetectionConfig {
    return { ...this.config };
  }
  
  /**
   * Update detector configuration
   */
  updateConfig(config: Partial<BeatDetectionConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...config };
    this.state.config = { ...this.config };
    
    this.logger.info('Beat Detector configuration updated', {
      oldConfig,
      newConfig: this.config
    });
  }
  
  /**
   * Reset detector state
   */
  reset(): void {
    this.state.energyHistory = [];
    this.state.spectralFluxHistory = [];
    this.state.lastBeatTime = 0;
    this.state.lastBeatInterval = 0;
    this.state.beatCount = 0;
    this.state.averageInterval = 0;
    this.state.isBeatLocked = false;
    this.state.lockConfidence = 0;
    this.state.onsetEnergy = 0;
    
    this.logger.info('Beat Detector reset');
  }
  
  /**
   * Get current BPM estimate
   */
  getBPM(): number | null {
    if (this.state.averageInterval === 0) return null;
    return 60000 / this.state.averageInterval; // Convert ms per beat to BPM
  }
  
  /**
   * Get beat lock status
   */
  getBeatLock(): { isLocked: boolean; confidence: number; bpm: number | null } {
    return {
      isLocked: this.state.isBeatLocked,
      confidence: this.state.lockConfidence,
      bpm: this.getBPM()
    };
  }
}