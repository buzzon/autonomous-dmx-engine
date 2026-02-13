import { parentPort, workerData } from "worker_threads";
import { FFTAnalyzer } from "./fft/analyzer";

// Initialize analyzer within the worker
// We can pass config via workerData
// Note: workerData might be undefined in some test contexts, handle gracefully
const config = workerData?.config || {
  sampleRate: 44100,
  fftSize: 1024,
};

const analyzer = new FFTAnalyzer(config);

if (parentPort) {
  parentPort.on("message", (message) => {
    if (message.type === "process") {
      try {
        const { samples, timestamp } = message.data;

        // Convert back to Float32Array if transferred as ArrayBuffer or regular array
        // samples might already be Float32Array or a plain object depending on transfer
        const audioData =
          samples instanceof Float32Array
            ? samples
            : Float32Array.from(Object.values(samples));

        // Process frame
        const spectralFeatures = analyzer.analyze(audioData, timestamp);

        // Construct basic metrics based on spectral features
        // In a full implementation, we would also run BeatDetector and BPMEstimator here
        // For now, we map spectral features to the AudioMetrics structure

        parentPort?.postMessage({
          type: "metrics",
          data: {
            timestamp,
            // Energy is effectively the RMS or similar, but spectralCentroid is a feature.
            // We need to calculate RMS or use what FFT provides.
            // FFTAnalyzer doesn't output RMS directly, so let's calc it or use a proxy.
            // For now, let's calculate RMS quickly here or use spectral sum.
            energy: calculateRMS(audioData),

            spectralCentroid: spectralFeatures.spectralCentroid,
            spectralFlux: spectralFeatures.spectralFlux,

            // Placeholders for things not yet moved to worker
            bpm: 120,
            beat: false,
            mood: "calm",
            zeroCrossingRate: 0,

            // Send raw features for debugging or advanced use
            // features: spectralFeatures
          },
        });
      } catch (error) {
        // console.error('Worker error', error);
      }
    } else if (message.type === "config") {
      analyzer.updateConfig(message.data);
    }
  });
}

function calculateRMS(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }
  return Math.sqrt(sum / samples.length);
}
