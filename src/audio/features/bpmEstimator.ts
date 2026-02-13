/**
 * BPM Estimation Algorithm
 * Estimates tempo (BPM) from beat intervals using multiple methods
 */

import { defaultLogger } from '../../utils/logger';

export interface BPMEstimatorConfig {
  minBPM: number;           // Minimum detectable BPM
  maxBPM: number;           // Maximum detectable BPM
  historySize: number;      // Number of beat intervals to keep in history
  smoothingBeta: number;    // Smoothing factor for BPM updates (0-1)
  confidenceThreshold: number; // Minimum confidence to consider estimation valid
  stabilityWindow: number;  // Number of consistent intervals required for stability
  doubleTimeDetection: boolean; // Whether to detect double-time/half-time
  allowedMultipliers: number[]; // Allowed BPM multipliers for correction
}

export interface BPMEstimation {
  bpm: number | null;       // Estimated BPM (null if not enough data)
  confidence: number;       // Confidence in estimation (0-1)
  isStable: boolean;        // Whether estimation is stable
  method: 'interval' | 'autocorrelation' | 'combined'; // Estimation method used
  timestamp: number;        // Time of last update
  rawIntervals: number[];   // Raw beat intervals (ms)
  filteredIntervals: number[]; // Filtered beat intervals
  possibleBPMs: Array<{ bpm: number; confidence: number }>; // Multiple possible BPMs
}

export interface BPMEstimatorState {
  config: BPMEstimatorConfig;
  beatIntervals: number[];  // History of beat intervals (ms)
  beatTimes: number[];      // History of beat timestamps
  currentEstimation: BPMEstimation;
  lastUpdateTime: number;
  updateCount: number;
}

export class BPMEstimator {
  private logger = defaultLogger.child({ module: 'BPMEstimator' });
  private config: BPMEstimatorConfig;
  private state: BPMEstimatorState;
  
  constructor(config: Partial<BPMEstimatorConfig> = {}) {
    this.config = {
      minBPM: config.minBPM || 60,
      maxBPM: config.maxBPM || 180,
      historySize: config.historySize || 20,
      smoothingBeta: config.smoothingBeta || 0.3,
      confidenceThreshold: config.confidenceThreshold || 0.7,
      stabilityWindow: config.stabilityWindow || 5,
      doubleTimeDetection: config.doubleTimeDetection ?? true,
      allowedMultipliers: config.allowedMultipliers || [0.5, 1, 2] // half, normal, double
    };
    
    this.state = {
      config: { ...this.config },
      beatIntervals: [],
      beatTimes: [],
      currentEstimation: this.createEmptyEstimation(),
      lastUpdateTime: 0,
      updateCount: 0
    };
    
    this.logger.info('BPM Estimator initialized', {
      minBPM: this.config.minBPM,
      maxBPM: this.config.maxBPM,
      historySize: this.config.historySize
    });
  }
  
  /**
   * Update estimator with new beat detection
   */
  update(beatDetection: { isBeat: boolean; timestamp: number; interval: number | null }): BPMEstimation {
    if (!beatDetection.isBeat) {
      return this.state.currentEstimation;
    }
    
    const now = Date.now();
    this.state.lastUpdateTime = now;
    this.state.updateCount++;
    
    // Add beat timestamp
    this.state.beatTimes.push(beatDetection.timestamp);
    
    // Keep history size limited
    if (this.state.beatTimes.length > this.config.historySize * 2) {
      this.state.beatTimes.shift();
    }
    
    // Calculate interval if provided, otherwise calculate from timestamps
    let interval = beatDetection.interval;
    if (interval === null && this.state.beatTimes.length >= 2) {
      const lastIndex = this.state.beatTimes.length - 1;
      interval = this.state.beatTimes[lastIndex] - this.state.beatTimes[lastIndex - 1];
    }
    
    if (interval !== null && interval > 0) {
      // Add interval to history
      this.state.beatIntervals.push(interval);
      
      // Keep history size limited
      if (this.state.beatIntervals.length > this.config.historySize) {
        this.state.beatIntervals.shift();
      }
      
      // Update estimation
      this.updateEstimation();
    }
    
    return this.state.currentEstimation;
  }
  
  /**
   * Update BPM estimation based on current interval history
   */
  private updateEstimation(): void {
    if (this.state.beatIntervals.length < 2) {
      this.state.currentEstimation = this.createEmptyEstimation();
      return;
    }
    
    // Calculate BPM using multiple methods
    const intervalEstimation = this.estimateFromIntervals();
    const autocorrelationEstimation = this.estimateFromAutocorrelation();
    
    // Combine estimations
    const combinedEstimation = this.combineEstimations(intervalEstimation, autocorrelationEstimation);
    
    // Apply smoothing
    const smoothedEstimation = this.smoothEstimation(combinedEstimation);
    
    // Update state
    this.state.currentEstimation = smoothedEstimation;
  }
  
  /**
   * Estimate BPM from beat intervals
   */
  private estimateFromIntervals(): BPMEstimation {
    const intervals = this.state.beatIntervals;
    
    if (intervals.length < 2) {
      return this.createEmptyEstimation();
    }
    
    // Calculate average interval
    let sum = 0;
    for (const interval of intervals) {
      sum += interval;
    }
    const averageInterval = sum / intervals.length;
    
    // Calculate interval variance (for confidence)
    let variance = 0;
    for (const interval of intervals) {
      variance += Math.pow(interval - averageInterval, 2);
    }
    variance /= intervals.length;
    
    // Convert to BPM
    const rawBPM = 60000 / averageInterval;
    
    // Check if BPM is within valid range
    const isValidBPM = rawBPM >= this.config.minBPM && rawBPM <= this.config.maxBPM;
    
    // Calculate confidence based on variance
    const maxVariance = averageInterval * 0.5; // Allow 50% variance
    const varianceConfidence = Math.max(0, 1 - (variance / maxVariance));
    
    // Calculate stability
    const isStable = this.checkStability(intervals);
    
    // Apply double-time/half-time correction if enabled
    let finalBPM = rawBPM;
    let confidence = varianceConfidence;
    let method: BPMEstimation['method'] = 'interval';
    
    if (this.config.doubleTimeDetection && isValidBPM) {
      const corrected = this.applyMultiplierCorrection(rawBPM, varianceConfidence);
      finalBPM = corrected.bpm;
      confidence = corrected.confidence;
    }
    
    // Generate possible BPMs
    const possibleBPMs = this.generatePossibleBPMs(intervals);
    
    return {
      bpm: isValidBPM ? finalBPM : null,
      confidence,
      isStable,
      method,
      timestamp: Date.now(),
      rawIntervals: [...intervals],
      filteredIntervals: this.filterOutliers(intervals),
      possibleBPMs
    };
  }
  
  /**
   * Estimate BPM using autocorrelation of energy signal
   * (Simplified implementation - in practice would use FFT of onset detection function)
   */
  private estimateFromAutocorrelation(): BPMEstimation {
    // This is a simplified placeholder
    // In a full implementation, we would:
    // 1. Collect energy values over time
    // 2. Compute autocorrelation function
    // 3. Find peaks in autocorrelation
    // 4. Convert peak positions to BPM
    
    // For now, return empty estimation
    return this.createEmptyEstimation();
  }
  
  /**
   * Combine multiple estimation methods
   */
  private combineEstimations(
    intervalEstimation: BPMEstimation,
    autocorrelationEstimation: BPMEstimation
  ): BPMEstimation {
    // If only one method has valid estimation, use it
    if (intervalEstimation.bpm === null && autocorrelationEstimation.bpm === null) {
      return this.createEmptyEstimation();
    }
    
    if (intervalEstimation.bpm !== null && autocorrelationEstimation.bpm === null) {
      return intervalEstimation;
    }
    
    if (intervalEstimation.bpm === null && autocorrelationEstimation.bpm !== null) {
      return autocorrelationEstimation;
    }
    
    // Both methods have valid estimations - combine them
    const intervalBPM = intervalEstimation.bpm!;
    const autocorrelationBPM = autocorrelationEstimation.bpm!;
    
    // Weighted average based on confidence
    const intervalWeight = intervalEstimation.confidence;
    const autocorrelationWeight = autocorrelationEstimation.confidence;
    const totalWeight = intervalWeight + autocorrelationWeight;
    
    const combinedBPM = (intervalBPM * intervalWeight + autocorrelationBPM * autocorrelationWeight) / totalWeight;
    const combinedConfidence = (intervalEstimation.confidence + autocorrelationEstimation.confidence) / 2;
    
    // Check stability (both must be stable)
    const isStable = intervalEstimation.isStable && autocorrelationEstimation.isStable;
    
    // Combine possible BPMs
    const possibleBPMs = [...intervalEstimation.possibleBPMs, ...autocorrelationEstimation.possibleBPMs]
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5); // Keep top 5
    
    return {
      bpm: combinedBPM,
      confidence: combinedConfidence,
      isStable,
      method: 'combined',
      timestamp: Date.now(),
      rawIntervals: intervalEstimation.rawIntervals,
      filteredIntervals: intervalEstimation.filteredIntervals,
      possibleBPMs
    };
  }
  
  /**
   * Apply smoothing to BPM estimation
   */
  private smoothEstimation(newEstimation: BPMEstimation): BPMEstimation {
    const currentEstimation = this.state.currentEstimation;
    
    if (currentEstimation.bpm === null || newEstimation.bpm === null) {
      return newEstimation;
    }
    
    const beta = this.config.smoothingBeta;
    
    // Smooth BPM
    const smoothedBPM = currentEstimation.bpm * (1 - beta) + newEstimation.bpm * beta;
    
    // Smooth confidence
    const smoothedConfidence = currentEstimation.confidence * (1 - beta) + newEstimation.confidence * beta;
    
    // Use new stability (don't smooth boolean)
    const isStable = newEstimation.isStable;
    
    return {
      ...newEstimation,
      bpm: smoothedBPM,
      confidence: smoothedConfidence,
      isStable
    };
  }
  
  /**
   * Apply double-time/half-time correction
   */
  private applyMultiplierCorrection(rawBPM: number, baseConfidence: number): { bpm: number; confidence: number } {
    let bestBPM = rawBPM;
    let bestConfidence = baseConfidence;
    
    for (const multiplier of this.config.allowedMultipliers) {
      const candidateBPM = rawBPM * multiplier;
      
      // Check if candidate is within valid range
      if (candidateBPM >= this.config.minBPM && candidateBPM <= this.config.maxBPM) {
        // Calculate confidence for this multiplier
        // Multipliers closer to 1 get higher confidence
        const multiplierConfidence = 1 / (1 + Math.abs(multiplier - 1));
        const totalConfidence = baseConfidence * multiplierConfidence;
        
        if (totalConfidence > bestConfidence) {
          bestBPM = candidateBPM;
          bestConfidence = totalConfidence;
        }
      }
    }
    
    return { bpm: bestBPM, confidence: bestConfidence };
  }
  
  /**
   * Generate multiple possible BPMs from intervals
   */
  private generatePossibleBPMs(intervals: number[]): Array<{ bpm: number; confidence: number }> {
    if (intervals.length < 2) return [];
    
    const possibleBPMs: Array<{ bpm: number; confidence: number }> = [];
    
    // Calculate BPM from average interval
    const averageInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const baseBPM = 60000 / averageInterval;
    
    // Add base BPM
    possibleBPMs.push({
      bpm: baseBPM,
      confidence: 1.0
    });
    
    // Add possible double-time/half-time BPMs
    if (this.config.doubleTimeDetection) {
      for (const multiplier of this.config.allowedMultipliers) {
        if (multiplier === 1) continue; // Skip base
        
        const candidateBPM = baseBPM * multiplier;
        if (candidateBPM >= this.config.minBPM && candidateBPM <= this.config.maxBPM) {
          // Confidence decreases with distance from 1
          const confidence = 1 / (1 + Math.abs(multiplier - 1));
          possibleBPMs.push({
            bpm: candidateBPM,
            confidence: confidence * 0.8 // Slightly penalize non-base multipliers
          });
        }
      }
    }
    
    // Sort by confidence
    possibleBPMs.sort((a, b) => b.confidence - a.confidence);
    
    return possibleBPMs;
  }
  
  /**
   * Check if beat intervals are stable
   */
  private checkStability(intervals: number[]): boolean {
    if (intervals.length < this.config.stabilityWindow) {
      return false;
    }
    
    // Check last N intervals for consistency
    const recentIntervals = intervals.slice(-this.config.stabilityWindow);
    const averageInterval = recentIntervals.reduce((sum, interval) => sum + interval, 0) / recentIntervals.length;
    
    let maxDeviation = 0;
    for (const interval of recentIntervals) {
      const deviation = Math.abs(interval - averageInterval) / averageInterval;
      if (deviation > maxDeviation) {
        maxDeviation = deviation;
      }
    }
    
    // Consider stable if max deviation is less than 20%
    return maxDeviation <= 0.2;
  }
  
  /**
   * Filter outliers from intervals
   */
  private filterOutliers(intervals: number[]): number[] {
    if (intervals.length < 3) return intervals;
    
    // Calculate median and MAD (Median Absolute Deviation)
    const sorted = [...intervals].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    
    const deviations = sorted.map(interval => Math.abs(interval - median));
    const mad = deviations.sort((a, b) => a - b)[Math.floor(deviations.length / 2)];
    
    // Filter intervals within 3 MADs of median
    const threshold = 3 * mad;
    return intervals.filter(interval => Math.abs(interval - median) <= threshold);
  }
  
  /**
   * Create empty BPM estimation
   */
  private createEmptyEstimation(): BPMEstimation {
    return {
      bpm: null,
      confidence: 0,
      isStable: false,
      method: 'interval',
      timestamp: Date.now(),
      rawIntervals: [],
      filteredIntervals: [],
      possibleBPMs: []
    };
  }
  
  /**
   * Get current BPM estimation
   */
  getEstimation(): BPMEstimation {
    return { ...this.state.currentEstimation };
  }
  
  /**
   * Get estimator state
   */
  getState(): BPMEstimatorState {
    return { ...this.state };
  }
  
  /**
   * Get estimator configuration
   */
  getConfig(): BPMEstimatorConfig {
    return { ...this.config };
  }
  
  /**
   * Update estimator configuration
   */
  updateConfig(config: Partial<BPMEstimatorConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...config };
    this.state.config = { ...this.config };
    
    this.logger.info('BPM Estimator configuration updated', {
      oldConfig,
      newConfig: this.config
    });
  }
  
  /**
   * Reset estimator state
   */
  reset(): void {
    this.state.beatIntervals = [];
    this.state.beatTimes = [];
    this.state.currentEstimation = this.createEmptyEstimation();
    this.state.lastUpdateTime = 0;
    this.state.updateCount = 0;
    
    this.logger.info('BPM Estimator reset');
  }
  
  /**
   * Force BPM estimation (for manual override)
   */
  setBPM(bpm: number, confidence: number = 1.0): void {
    this.state.currentEstimation = {
      bpm,
      confidence,
      isStable: true,
      method: 'interval',
      timestamp: Date.now(),
      rawIntervals: this.state.beatIntervals,
      filteredIntervals: this.filterOutliers(this.state.beatIntervals),
      possibleBPMs: [{ bpm, confidence: 1.0 }]
    };
    
    this.logger.info('BPM manually set', { bpm, confidence });
  }
  
  /**
   * Check if estimation is valid (has enough confidence)
   */
  isValid(): boolean {
    return this.state.currentEstimation.bpm !== null && 
           this.state.currentEstimation.confidence >= this.config.confidenceThreshold;
  }
  
  /**
   * Get BPM rounded to nearest integer
   */
  getRoundedBPM(): number | null {
    const bpm = this.state.currentEstimation.bpm;
    return bpm !== null ? Math.round(bpm) : null;
  }
}