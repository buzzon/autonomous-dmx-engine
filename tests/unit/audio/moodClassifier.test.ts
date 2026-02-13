/**
 * Unit tests for MoodClassifier
 */

import { MoodClassifier, defaultMoodClassifierConfig } from '../../../src/audio/features/moodClassifier';

describe('MoodClassifier', () => {
  let classifier: MoodClassifier;

  beforeEach(() => {
    classifier = new MoodClassifier(defaultMoodClassifierConfig);
  });

  describe('classify()', () => {
    it('should classify calm mood for low energy and low BPM', () => {
      const features = {
        energy: 0.2, // below thresholdLow (0.3)
        bpm: 70,     // below thresholdLow (80)
        spectralCentroid: 0.3 // below centroidThreshold (0.5)
      };

      const mood = classifier.classify(features);
      expect(mood).toBe('calm');
    });

    it('should classify hard mood for high energy and high BPM', () => {
      const features = {
        energy: 0.8, // above thresholdHigh (0.7)
        bpm: 150,    // above thresholdHigh (140)
        spectralCentroid: 0.7 // above centroidThreshold (0.5)
      };

      const mood = classifier.classify(features);
      expect(mood).toBe('hard');
    });

    it('should classify medium mood for moderate values', () => {
      const features = {
        energy: 0.5, // between thresholds (0.3-0.7)
        bpm: 110,    // between thresholds (80-140)
        spectralCentroid: 0.5 // at threshold
      };

      const mood = classifier.classify(features);
      expect(mood).toBe('medium');
    });

    it('should handle missing BPM (null)', () => {
      const features = {
        energy: 0.8,
        bpm: null,
        spectralCentroid: 0.7
      };

      const mood = classifier.classify(features);
      expect(mood).toBe('hard'); // Should still be hard due to high energy
    });

    it('should handle missing spectral centroid', () => {
      const features = {
        energy: 0.2,
        bpm: 70
        // spectralCentroid is undefined
      };

      const mood = classifier.classify(features);
      expect(mood).toBe('calm');
    });

    it('should handle edge cases', () => {
      // Test with very low energy, low BPM, and low centroid -> should be calm
      const calmFeatures = {
        energy: 0.01,
        bpm: 70,
        spectralCentroid: 0.3
      };

      const mood1 = classifier.classify(calmFeatures);
      expect(mood1).toBe('calm');

      // Test with very high energy, high BPM, and high centroid -> should be hard
      const hardFeatures = {
        energy: 0.99,
        bpm: 150,
        spectralCentroid: 0.8
      };

      const mood2 = classifier.classify(hardFeatures);
      expect(mood2).toBe('hard');
    });

    it('should respect custom configuration', () => {
      const customConfig = {
        ...defaultMoodClassifierConfig,
        energyThresholdLow: 0.1,
        energyThresholdHigh: 0.9,
        bpmThresholdLow: 60,
        bpmThresholdHigh: 160
      };

      const customClassifier = new MoodClassifier(customConfig);
      
      // With default config this would be calm, but with custom config it's medium
      const features = {
        energy: 0.2,
        bpm: 70,
        spectralCentroid: 0.3
      };

      const mood = customClassifier.classify(features);
      expect(mood).toBe('medium'); // Now within medium range
    });
  });

  describe('classifyWithSmoothing()', () => {
    it('should apply temporal smoothing', () => {
      const timestamp = 1000;
      
      // First classification - calm
      const calmFeatures = {
        energy: 0.2,
        bpm: 70,
        spectralCentroid: 0.3
      };
      
      const mood1 = classifier.classifyWithSmoothing(calmFeatures, timestamp);
      expect(mood1).toBe('calm');

      // Second classification - hard (but too soon for update)
      const hardFeatures = {
        energy: 0.8,
        bpm: 150,
        spectralCentroid: 0.7
      };
      
      const mood2 = classifier.classifyWithSmoothing(hardFeatures, timestamp + 500);
      expect(mood2).toBe('hard'); // Returns current mood (not smoothed yet)

      // Third classification - after update interval
      const mood3 = classifier.classifyWithSmoothing(hardFeatures, timestamp + 1500);
      // Should consider history: [calm, hard, hard] -> hard is dominant
      expect(mood3).toBe('hard');
    });

    it('should return dominant mood from history', () => {
      const timestamp = 1000;
      
      // Create a history with more calm than hard
      const calmFeatures = { energy: 0.2, bpm: 70, spectralCentroid: 0.3 };
      const hardFeatures = { energy: 0.8, bpm: 150, spectralCentroid: 0.7 };
      
      // Add 3 calm classifications
      classifier.classifyWithSmoothing(calmFeatures, timestamp);
      classifier.classifyWithSmoothing(calmFeatures, timestamp + 100);
      classifier.classifyWithSmoothing(calmFeatures, timestamp + 200);
      
      // Add 2 hard classifications
      classifier.classifyWithSmoothing(hardFeatures, timestamp + 300);
      classifier.classifyWithSmoothing(hardFeatures, timestamp + 400);
      
      // After update interval, should return calm (3 vs 2)
      const finalMood = classifier.classifyWithSmoothing(hardFeatures, timestamp + 2000);
      expect(finalMood).toBe('calm');
    });

    it('should respect moodUpdateInterval', () => {
      const timestamp = 1000;
      const calmFeatures = { energy: 0.2, bpm: 70, spectralCentroid: 0.3 };
      const hardFeatures = { energy: 0.8, bpm: 150, spectralCentroid: 0.7 };
      
      // First classification
      const mood1 = classifier.classifyWithSmoothing(calmFeatures, timestamp);
      
      // Second classification too soon (500ms < 1000ms interval)
      const mood2 = classifier.classifyWithSmoothing(hardFeatures, timestamp + 500);
      
      // Should return current mood, not recalculate dominant mood
      expect(mood2).toBe('hard');
    });
  });

  describe('updateConfig()', () => {
    it('should update configuration', () => {
      const features = {
        energy: 0.4,
        bpm: 90,
        spectralCentroid: 0.4
      };

      // With default config, this is medium
      const initialMood = classifier.classify(features);
      expect(initialMood).toBe('medium');

      // Update thresholds to make it calm
      classifier.updateConfig({
        energyThresholdLow: 0.5,  // Now 0.4 < 0.5 -> calm
        bpmThresholdLow: 100      // Now 90 < 100 -> calm
      });

      const updatedMood = classifier.classify(features);
      expect(updatedMood).toBe('calm');
    });
  });

  describe('reset()', () => {
    it('should clear history', () => {
      const timestamp = 1000;
      const features = { energy: 0.2, bpm: 70, spectralCentroid: 0.3 };
      
      // Add some history
      classifier.classifyWithSmoothing(features, timestamp);
      classifier.classifyWithSmoothing(features, timestamp + 100);
      
      // Reset
      classifier.reset();
      
      // After reset, history should be empty
      const mood = classifier.classifyWithSmoothing(features, timestamp + 2000);
      expect(mood).toBe('calm'); // Only one item in history
    });
  });
});