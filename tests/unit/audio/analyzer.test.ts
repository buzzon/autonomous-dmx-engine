/**
 * Tests for AudioAnalyzer
 */

import { AudioAnalyzer } from '../../../src/audio/analyzer';
import { AudioAnalyzerConfig } from '../../../src/audio/types';

// Mock worker_threads
jest.mock('worker_threads', () => {
  const mockWorker = {
    on: jest.fn(),
    postMessage: jest.fn(),
    terminate: jest.fn(),
  };
  return {
    Worker: jest.fn(() => mockWorker),
  };
});

// Mock path resolution
jest.mock('path', () => ({
  resolve: jest.fn(() => '/mock/path/worker.ts'),
}));

describe('AudioAnalyzer', () => {
  let analyzer: AudioAnalyzer;
  const mockConfig: AudioAnalyzerConfig = {
    sampleRate: 44100,
    frameSize: 1024,
    hopSize: 512,
    beatThresholdCoeff: 1.5,
    minBeatInterval: 100,
    bpmSmoothingBeta: 0.9,
    energySmoothingAlpha: 0.8,
    moodUpdateInterval: 5000,
    historySize: 100,
    moodEnergyThresholdLow: 0.3,
    moodEnergyThresholdHigh: 0.7,
    moodBpmThresholdLow: 80,
    moodBpmThresholdHigh: 140,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    analyzer = new AudioAnalyzer(mockConfig);
  });

  describe('constructor', () => {
    it('should initialize with config', () => {
      expect(analyzer).toBeInstanceOf(AudioAnalyzer);
      // Worker should be created
      const { Worker } = require('worker_threads');
      expect(Worker).toHaveBeenCalled();
    });

    it('should set up worker event listeners', () => {
      const { Worker } = require('worker_threads');
      const mockWorker = Worker.mock.results[0].value;
      expect(mockWorker.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockWorker.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockWorker.on).toHaveBeenCalledWith('exit', expect.any(Function));
    });
  });

  describe('processFrame', () => {
    it('should return latest metrics when available', () => {
      // Simulate worker sending metrics
      const { Worker } = require('worker_threads');
      const mockWorker = Worker.mock.results[0].value;
      // Trigger message handler
      const messageHandler = mockWorker.on.mock.calls.find((call: any[]) => call[0] === 'message')[1];
      const mockMetrics = {
        timestamp: Date.now(),
        energy: 0.8,
        beat: true,
        bpm: 120,
        mood: 'hard' as const,
        spectralCentroid: 1000,
        spectralFlatness: 0.5,
        spectralRolloff: 5000,
      };
      messageHandler({ type: 'metrics', data: mockMetrics });

      const result = analyzer.processFrame(new Float32Array(1024), Date.now());
      expect(result).toEqual(mockMetrics);
    });

    it('should return default metrics when no metrics available', () => {
      // No metrics received yet
      const result = analyzer.processFrame(new Float32Array(1024), Date.now());
      expect(result.timestamp).toBeLessThanOrEqual(Date.now());
      expect(result.energy).toBe(0);
      expect(result.beat).toBe(false);
      expect(result.bpm).toBe(0);
      expect(result.mood).toBe('calm');
    });
  });

  describe('getState', () => {
    it('should return current state', () => {
      const state = analyzer.getState();
      expect(state).toHaveProperty('sampleRate');
      expect(state).toHaveProperty('frameSize');
      expect(state).toHaveProperty('hopSize');
      expect(state).toHaveProperty('bpm');
      expect(state).toHaveProperty('mood');
    });
  });

  // Note: There's no public cleanup method in AudioAnalyzer
  // Worker termination is handled internally on exit
});