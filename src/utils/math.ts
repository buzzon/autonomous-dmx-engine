/**
 * Math utilities for the autonomous DMX engine
 * Common mathematical operations used throughout the system
 */

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Linear interpolation between a and b
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Map a value from one range to another
 */
export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  return ((value - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin;
}

/**
 * Normalize a value to 0..1 range based on min/max
 */
export function normalize(value: number, min: number, max: number): number {
  return (value - min) / (max - min);
}

/**
 * Calculate mean (average) of an array of numbers
 */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculate standard deviation of an array of numbers
 */
export function std(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = mean(values);
  const squareDiffs = values.map(value => Math.pow(value - avg, 2));
  return Math.sqrt(mean(squareDiffs));
}

/**
 * Calculate median of an array of numbers
 */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  
  return sorted[middle];
}

/**
 * Smooth a value using exponential moving average
 */
export function exponentialMovingAverage(
  current: number,
  previous: number,
  alpha: number
): number {
  return alpha * current + (1 - alpha) * previous;
}

/**
 * Calculate root mean square (RMS) of an array of numbers
 */
export function rms(values: number[]): number {
  if (values.length === 0) return 0;
  const squares = values.map(value => value * value);
  return Math.sqrt(mean(squares));
}

/**
 * Wrap a value around a range (like modulo but for floating point)
 */
export function wrap(value: number, min: number, max: number): number {
  const range = max - min;
  return ((value - min) % range + range) % range + min;
}

/**
 * Convert degrees to radians
 */
export function degToRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Convert radians to degrees
 */
export function radToDeg(radians: number): number {
  return radians * (180 / Math.PI);
}

/**
 * Calculate distance between two points in 2D
 */
export function distance2D(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

/**
 * Calculate distance between two points in 3D
 */
export function distance3D(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number): number {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2) + Math.pow(z2 - z1, 2));
}

/**
 * Generate a sine wave value at given phase
 */
export function sineWave(phase: number, amplitude: number = 1, offset: number = 0): number {
  return Math.sin(phase) * amplitude + offset;
}

/**
 * Generate a triangle wave value at given phase
 */
export function triangleWave(phase: number, amplitude: number = 1, offset: number = 0): number {
  const normalizedPhase = (phase % (2 * Math.PI)) / (2 * Math.PI);
  const value = 2 * Math.abs(2 * normalizedPhase - 1) - 1;
  return value * amplitude + offset;
}

/**
 * Generate a sawtooth wave value at given phase
 */
export function sawtoothWave(phase: number, amplitude: number = 1, offset: number = 0): number {
  const normalizedPhase = (phase % (2 * Math.PI)) / (2 * Math.PI);
  return (2 * normalizedPhase - 1) * amplitude + offset;
}

/**
 * Generate a square wave value at given phase
 */
export function squareWave(phase: number, amplitude: number = 1, offset: number = 0, dutyCycle: number = 0.5): number {
  const normalizedPhase = (phase % (2 * Math.PI)) / (2 * Math.PI);
  return (normalizedPhase < dutyCycle ? 1 : -1) * amplitude + offset;
}

/**
 * Calculate BPM from beat interval in milliseconds
 */
export function bpmFromInterval(intervalMs: number): number {
  if (intervalMs <= 0) return 0;
  return 60000 / intervalMs;
}

/**
 * Calculate beat interval in milliseconds from BPM
 */
export function intervalFromBpm(bpm: number): number {
  if (bpm <= 0) return 0;
  return 60000 / bpm;
}

/**
 * Smoothly transition between values using ease-in-out
 */
export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

/**
 * Calculate energy of audio samples (RMS normalized to 0..1)
 */
export function calculateAudioEnergy(samples: Float32Array, maxAmplitude: number = 1): number {
  if (samples.length === 0) return 0;
  
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }
  
  const rmsValue = Math.sqrt(sum / samples.length);
  return clamp(rmsValue / maxAmplitude, 0, 1);
}

/**
 * Lookup table for fast trigonometric operations
 */
export class LookupTable {
  private sinTable: Float32Array;
  private cosTable: Float32Array;
  private resolution: number;

  constructor(resolution: number = 1024) {
    this.resolution = resolution;
    this.sinTable = new Float32Array(resolution);
    this.cosTable = new Float32Array(resolution);
    
    for (let i = 0; i < resolution; i++) {
      const angle = (i / resolution) * 2 * Math.PI;
      this.sinTable[i] = Math.sin(angle);
      this.cosTable[i] = Math.cos(angle);
    }
  }

  fastSin(phase: number): number {
    const normalizedPhase = phase % (2 * Math.PI);
    const index = Math.floor((normalizedPhase / (2 * Math.PI)) * this.resolution) % this.resolution;
    return this.sinTable[index];
  }

  fastCos(phase: number): number {
    const normalizedPhase = phase % (2 * Math.PI);
    const index = Math.floor((normalizedPhase / (2 * Math.PI)) * this.resolution) % this.resolution;
    return this.cosTable[index];
  }
}

/**
 * Default lookup table instance
 */
export const defaultLookupTable = new LookupTable();