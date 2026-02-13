/**
 * Audio Processing Worker
 * Runs audio analysis in a separate thread to avoid blocking main thread
 */

import { parentPort, workerData } from "worker_threads";
import { FFTAnalyzer } from "./fft/analyzer";
import { createBeatDetector, defaultBeatDetectionConfig } from "./beatDetection";
import { createBPMEstimator, defaultBPMEstimatorConfig } from "./features";
import { MoodClassifier, defaultMoodClassifierConfig } from "./features/moodClassifier";
import { AudioMetrics } from "./types";
import { AudioPerformanceMonitor } from "./utils/performance";

// Configuration passed from main thread
const config = workerData?.config || {
  sampleRate: 44100,
  fftSize: 1024,
  // Mood classification thresholds
  moodEnergyThresholdLow: 0.3,
  moodEnergyThresholdHigh: 0.7,
  moodBpmThresholdLow: 80,
  moodBpmThresholdHigh: 140,
  moodUpdateInterval: 1000,
};

// Initialize analyzers
const fftAnalyzer = new FFTAnalyzer({
  sampleRate: config.sampleRate,
  fftSize: config.fftSize,
  windowType: "hann",
  frequencyBands: 8,
  minFrequency: 20,
  maxFrequency: config.sampleRate / 2,
  smoothingAlpha: 0.8,
});

const beatDetector = createBeatDetector({
  sampleRate: config.sampleRate,
  frameSize: config.fftSize,
  hopSize: config.fftSize / 2,
  energyThresholdCoeff: 1.5,
  minBeatInterval: 100,
});

const bpmEstimator = createBPMEstimator({
  minBPM: 60,
  maxBPM: 180,
  historySize: 20,
  smoothingBeta: 0.3,
});

const moodClassifier = new MoodClassifier({
  energyThresholdLow: config.moodEnergyThresholdLow,
  energyThresholdHigh: config.moodEnergyThresholdHigh,
  bpmThresholdLow: config.moodBpmThresholdLow,
  bpmThresholdHigh: config.moodBpmThresholdHigh,
  centroidThreshold: 0.5,
  historySize: 10,
  moodUpdateInterval: config.moodUpdateInterval,
});

// Performance monitoring
const performanceMonitor = new AudioPerformanceMonitor();

// State
let lastTimestamp = 0;
let lastSpectrum: Float32Array | null = null;

/**
 * Calculate RMS energy of audio samples
 */
function calculateRMS(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }
  return Math.sqrt(sum / samples.length);
}

/**
 * Calculate zero-crossing rate
 */
function calculateZeroCrossingRate(samples: Float32Array): number {
  if (samples.length < 2) return 0;
  let crossings = 0;
  for (let i = 1; i < samples.length; i++) {
    if (samples[i] * samples[i - 1] < 0) crossings++;
  }
  return crossings / (samples.length - 1);
}

if (parentPort) {
  parentPort.on("message", (message) => {
    if (message.type === "process") {
      try {
        const { samples, timestamp } = message.data;

        // Start performance measurement
        const startTime = performanceMonitor.startFrame();

        // Convert samples to Float32Array if needed
        const audioData =
          samples instanceof Float32Array
            ? samples
            : Float32Array.from(Object.values(samples));

        // 1. Calculate basic time-domain features
        const energy = calculateRMS(audioData);
        const zeroCrossingRate = calculateZeroCrossingRate(audioData);

        // 2. Perform spectral analysis
        const spectralFeatures = fftAnalyzer.analyze(audioData, timestamp);

        // 3. Beat detection
        const beatResult = beatDetector.detect(
          audioData,
          spectralFeatures.spectralFlux,
          timestamp
        );

        // 4. BPM estimation (update with beat intervals)
        let bpmEstimation;
        if (beatResult.isBeat) {
          bpmEstimation = bpmEstimator.update({
            isBeat: true,
            timestamp,
            interval: beatResult.interval,
          });
        } else {
          bpmEstimation = bpmEstimator.update({
            isBeat: false,
            timestamp,
            interval: null,
          });
        }

        // 5. Mood classification
        const mood = moodClassifier.classifyWithSmoothing(
          {
            energy,
            bpm: bpmEstimation.bpm,
            spectralCentroid: spectralFeatures.spectralCentroid,
            spectralFlux: spectralFeatures.spectralFlux,
            spectralRolloff: spectralFeatures.spectralRolloff,
            spectralFlatness: spectralFeatures.spectralFlatness,
            zeroCrossingRate,
            bands: spectralFeatures.bands,
          },
          timestamp
        );

        // 6. Construct AudioMetrics
        const metrics: AudioMetrics = {
          timestamp,
          energy,
          beat: beatResult.isBeat,
          bpm: bpmEstimation.bpm,
          mood,
          spectralCentroid: spectralFeatures.spectralCentroid,
          spectralFlux: spectralFeatures.spectralFlux,
          spectralRolloff: spectralFeatures.spectralRolloff,
          spectralFlatness: spectralFeatures.spectralFlatness,
          zeroCrossingRate,
        };

        // Send metrics back to main thread
        parentPort?.postMessage({
          type: "metrics",
          data: metrics,
        });

        // End performance measurement
        performanceMonitor.endFrame(startTime);

        // Send performance metrics periodically (every 100 frames)
        if (performanceMonitor.getMetrics().frameCount % 100 === 0) {
          parentPort?.postMessage({
            type: "performance",
            data: performanceMonitor.getMetrics(),
          });
        }

      } catch (error) {
        // Log error but don't crash worker
        console.error("Audio Worker error:", error);
      }
    } else if (message.type === "config") {
      // Update configuration
      const newConfig = message.data;
      if (newConfig.sampleRate || newConfig.fftSize) {
        fftAnalyzer.updateConfig(newConfig);
      }
      if (newConfig.moodEnergyThresholdLow !== undefined) {
        moodClassifier.updateConfig(newConfig);
      }
      // Beat detector and BPM estimator config updates could be added here
    }
  });
}
