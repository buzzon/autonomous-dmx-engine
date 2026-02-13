/**
 * Audio module types and interfaces
 * Types for Audio Analyzer and audio processing
 */

/**
 * Mood classification
 */
export type Mood = 'calm' | 'medium' | 'hard';

/**
 * Audio metrics from a single frame
 */
export interface AudioMetrics {
  timestamp: number;   // ms
  energy: number;      // 0..1, normalized energy
  beat: boolean;       // Is there a beat in this frame
  bpm: number | null;  // Estimated BPM
  mood: Mood;          // Rough mood classification
  spectralCentroid?: number;  // 0..1, brightness of sound
  spectralFlux?: number;      // Spectral change rate
  spectralRolloff?: number;   // 0..1, frequency where 85% of energy is contained
  spectralFlatness?: number;  // 0..1, noisiness vs tonalness (0 = tonal, 1 = noisy)
  zeroCrossingRate?: number;  // 0..1, noisiness
}

/**
 * Audio Analyzer state
 */
export interface AudioAnalyzerState {
  sampleRate: number;
  frameSize: number;
  hopSize: number;

  energyHistory: number[];
  energyAvg: number;
  energyPeak: number;

  lastBeats: number[];  // timestamps
  bpm: number | null;
  lastBeatTime: number;

  mood: Mood;
  moodHistory: Mood[];

  lastUpdateTimestamp: number;
  lastMoodUpdate: number;

  // Statistics
  framesProcessed: number;
  averageProcessingTime: number;
}

/**
 * Audio Analyzer configuration
 */
export interface AudioAnalyzerConfig {
  sampleRate: number;
  frameSize: number;
  hopSize: number;
  beatThresholdCoeff: number;  // c for beat detection
  minBeatInterval: number;     // ms
  bpmSmoothingBeta: number;
  energySmoothingAlpha: number;
  moodUpdateInterval: number;  // ms
  historySize: number;
  
  // Mood thresholds
  moodEnergyThresholdLow: number;
  moodEnergyThresholdHigh: number;
  moodBpmThresholdLow: number;
  moodBpmThresholdHigh: number;
}

/**
 * Beat detection result
 */
export interface BeatDetection {
  isBeat: boolean;
  confidence: number;
  interval: number | null;  // ms since last beat
  strength: number;         // 0..1
}

/**
 * BPM estimation state
 */
export interface BPMEstimation {
  currentBpm: number | null;
  confidence: number;
  history: number[];
  lastUpdate: number;
  isStable: boolean;
}

/**
 * Spectral analysis
 */
export interface SpectralAnalysis {
  centroid: number;      // 0..1
  flux: number;          // 0..1
  rolloff: number;       // 0..1
  flatness: number;      // 0..1
  bands: number[];       // Energy per frequency band
}

/**
 * Audio source type
 */
export type AudioSourceType = 'microphone' | 'file' | 'stream' | 'synthetic';

/**
 * Audio source configuration
 */
export interface AudioSourceConfig {
  type: AudioSourceType;
  deviceId?: string;
  filePath?: string;
  streamUrl?: string;
  bufferSize?: number;
  channels?: number;
}

/**
 * Audio frame
 */
export interface AudioFrame {
  samples: Float32Array;
  timestamp: number;
  sampleRate: number;
  channels: number;
}

/**
 * Audio processing statistics
 */
export interface AudioProcessingStats {
  totalFrames: number;
  droppedFrames: number;
  averageLatency: number;
  maxLatency: number;
  currentLatency: number;
  processingTimes: number[];
}

/**
 * Audio feature extraction
 */
export interface AudioFeatures {
  tempo: number | null;
  key?: string;
  mode?: 'major' | 'minor';
  loudness: number;
  danceability?: number;
  energy: number;
  valence?: number;
}

/**
 * Audio event
 */
export interface AudioEvent {
  type: 'beat' | 'onset' | 'silence' | 'loud' | 'quiet';
  timestamp: number;
  strength: number;
  data?: any;
}

/**
 * Audio buffer for history
 */
export interface AudioBuffer {
  frames: AudioFrame[];
  maxSize: number;
  currentIndex: number;
}
