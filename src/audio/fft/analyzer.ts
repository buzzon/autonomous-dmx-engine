/**
 * FFT Analyzer for spectral analysis
 * Performs Fast Fourier Transform on audio frames to extract frequency domain features
 */

import { SimpleFFT } from "./simple-fft";
import { defaultLogger } from "../../utils/logger";

export interface FFTAnalyzerConfig {
  sampleRate: number;
  fftSize: number; // Size of FFT (must be power of 2)
  windowType: WindowType; // Type of window function
  frequencyBands: number; // Number of frequency bands for analysis
  minFrequency: number; // Minimum frequency to analyze (Hz)
  maxFrequency: number; // Maximum frequency to analyze (Hz)
  smoothingAlpha: number; // Smoothing factor for spectral features
}

export type WindowType = "hann" | "hamming" | "blackman" | "rectangular";

export interface SpectralFeatures {
  timestamp: number;
  spectrum: Float32Array; // Magnitude spectrum
  spectralCentroid: number; // Brightness (0-1)
  spectralFlux: number; // Spectral change rate (0-1)
  spectralRolloff: number; // Frequency below which 85% of energy is contained (0-1)
  spectralFlatness: number; // Noisiness vs tonalness (0-1)
  bands: Float32Array; // Energy per frequency band
  bandsNormalized: Float32Array; // Normalized band energies (0-1)
  peakFrequency: number; // Frequency with maximum energy (Hz)
  peakMagnitude: number; // Magnitude at peak frequency
}

export interface FFTAnalyzerState {
  config: FFTAnalyzerConfig;
  previousSpectrum: Float32Array | null;
  smoothedBands: Float32Array | null;
  framesProcessed: number;
  averageProcessingTime: number;
}

export class FFTAnalyzer {
  private logger = defaultLogger.child({ module: "FFTAnalyzer" });
  private config: FFTAnalyzerConfig;
  private state: FFTAnalyzerState;
  private fft: SimpleFFT;
  private window: Float32Array;
  private frequencyResolution: number;
  private bandFrequencies: number[];

  constructor(config: Partial<FFTAnalyzerConfig> = {}) {
    this.config = {
      sampleRate: config.sampleRate || 44100,
      fftSize: this.getValidFFTSize(config.fftSize || 2048),
      windowType: config.windowType || "hann",
      frequencyBands: config.frequencyBands || 8,
      minFrequency: config.minFrequency || 20,
      maxFrequency: config.maxFrequency || 20000,
      smoothingAlpha: config.smoothingAlpha || 0.3,
    };

    // Initialize FFT
    this.fft = new SimpleFFT(this.config.fftSize);

    // Create window function
    this.window = this.createWindow(
      this.config.windowType,
      this.config.fftSize,
    );

    // Calculate frequency resolution
    this.frequencyResolution = this.config.sampleRate / this.config.fftSize;

    // Calculate band frequencies
    this.bandFrequencies = this.calculateBandFrequencies();

    this.state = {
      config: { ...this.config },
      previousSpectrum: null,
      smoothedBands: null,
      framesProcessed: 0,
      averageProcessingTime: 0,
    };

    this.logger.info("FFT Analyzer initialized", {
      fftSize: this.config.fftSize,
      sampleRate: this.config.sampleRate,
      frequencyBands: this.config.frequencyBands,
      frequencyResolution: this.frequencyResolution.toFixed(2),
    });
  }

  /**
   * Analyze audio frame and extract spectral features
   */
  analyze(samples: Float32Array, timestamp: number): SpectralFeatures {
    const startTime = performance.now();

    // Ensure input is correct size (pad or truncate if needed)
    const processedSamples = this.prepareSamples(samples);

    // Apply window function
    const windowedSamples = this.applyWindow(processedSamples);

    // Perform FFT
    const spectrum = this.computeSpectrum(windowedSamples);

    // Extract spectral features
    const features = this.extractFeatures(spectrum, timestamp);

    // Update state
    this.state.previousSpectrum = spectrum;
    this.state.framesProcessed++;

    // Update processing time statistics
    const processingTime = performance.now() - startTime;
    this.state.averageProcessingTime =
      (this.state.averageProcessingTime * (this.state.framesProcessed - 1) +
        processingTime) /
      this.state.framesProcessed;

    return features;
  }

  /**
   * Get current analyzer state
   */
  getState(): FFTAnalyzerState {
    return { ...this.state };
  }

  /**
   * Get analyzer configuration
   */
  getConfig(): FFTAnalyzerConfig {
    return { ...this.config };
  }

  /**
   * Update analyzer configuration
   */
  updateConfig(config: Partial<FFTAnalyzerConfig>): void {
    const oldConfig = { ...this.config };

    if (config.fftSize && config.fftSize !== this.config.fftSize) {
      this.config.fftSize = this.getValidFFTSize(config.fftSize);
      this.fft = new SimpleFFT(this.config.fftSize);
      this.window = this.createWindow(
        this.config.windowType,
        this.config.fftSize,
      );
      this.frequencyResolution = this.config.sampleRate / this.config.fftSize;
      this.bandFrequencies = this.calculateBandFrequencies();
      this.state.previousSpectrum = null;
      this.state.smoothedBands = null;
    }

    if (config.sampleRate) {
      this.config.sampleRate = config.sampleRate;
      this.frequencyResolution = this.config.sampleRate / this.config.fftSize;
      this.bandFrequencies = this.calculateBandFrequencies();
    }

    if (config.windowType) {
      this.config.windowType = config.windowType;
      this.window = this.createWindow(
        this.config.windowType,
        this.config.fftSize,
      );
    }

    if (config.frequencyBands) {
      this.config.frequencyBands = config.frequencyBands;
      this.bandFrequencies = this.calculateBandFrequencies();
    }

    if (config.minFrequency !== undefined) {
      this.config.minFrequency = config.minFrequency;
      this.bandFrequencies = this.calculateBandFrequencies();
    }

    if (config.maxFrequency !== undefined) {
      this.config.maxFrequency = config.maxFrequency;
      this.bandFrequencies = this.calculateBandFrequencies();
    }

    if (config.smoothingAlpha !== undefined) {
      this.config.smoothingAlpha = config.smoothingAlpha;
    }

    this.state.config = { ...this.config };

    this.logger.info("FFT Analyzer configuration updated", {
      oldConfig,
      newConfig: this.config,
    });
  }

  /**
   * Reset analyzer state
   */
  reset(): void {
    this.state.previousSpectrum = null;
    this.state.smoothedBands = null;
    this.state.framesProcessed = 0;
    this.state.averageProcessingTime = 0;

    this.logger.info("FFT Analyzer reset");
  }

  /**
   * Prepare samples for FFT (pad or truncate to fftSize)
   */
  private prepareSamples(samples: Float32Array): Float32Array {
    if (samples.length === this.config.fftSize) {
      return samples;
    }

    const result = new Float32Array(this.config.fftSize);

    if (samples.length > this.config.fftSize) {
      // Truncate
      result.set(samples.slice(0, this.config.fftSize));
    } else {
      // Pad with zeros
      result.set(samples);
    }

    return result;
  }

  /**
   * Apply window function to samples
   */
  private applyWindow(samples: Float32Array): Float32Array {
    const windowed = new Float32Array(samples.length);

    for (let i = 0; i < samples.length; i++) {
      windowed[i] = samples[i] * this.window[i];
    }

    return windowed;
  }

  /**
   * Compute magnitude spectrum from windowed samples
   */
  private computeSpectrum(samples: Float32Array): Float32Array {
    // Create complex array (real, imag)
    const complex = this.fft.createComplexArray();

    // Copy real samples to complex array (imaginary part is zero)
    for (let i = 0; i < samples.length; i++) {
      complex[2 * i] = samples[i];
      complex[2 * i + 1] = 0;
    }

    // Perform FFT (in-place)
    this.fft.transform(complex);

    // Compute magnitude spectrum (only first half due to symmetry)
    const spectrumSize = this.config.fftSize / 2;
    const spectrum = new Float32Array(spectrumSize);

    for (let i = 0; i < spectrumSize; i++) {
      const real = complex[2 * i];
      const imag = complex[2 * i + 1];
      spectrum[i] = Math.sqrt(real * real + imag * imag);
    }

    return spectrum;
  }

  /**
   * Extract spectral features from magnitude spectrum
   */
  private extractFeatures(
    spectrum: Float32Array,
    timestamp: number,
  ): SpectralFeatures {
    // Calculate spectral centroid (brightness)
    const spectralCentroid = this.calculateSpectralCentroid(spectrum);

    // Calculate spectral flux (change from previous spectrum)
    const spectralFlux = this.calculateSpectralFlux(spectrum);

    // Calculate spectral rolloff
    const spectralRolloff = this.calculateSpectralRolloff(spectrum);

    // Calculate spectral flatness
    const spectralFlatness = this.calculateSpectralFlatness(spectrum);

    // Calculate frequency bands
    const bands = this.calculateFrequencyBands(spectrum);

    // Normalize bands
    const bandsNormalized = this.normalizeBands(bands);

    // Find peak frequency
    const { peakFrequency, peakMagnitude } = this.findPeakFrequency(spectrum);

    // Smooth bands over time
    const smoothedBands = this.smoothBands(bandsNormalized);

    return {
      timestamp,
      spectrum,
      spectralCentroid,
      spectralFlux,
      spectralRolloff,
      spectralFlatness,
      bands,
      bandsNormalized: smoothedBands,
      peakFrequency,
      peakMagnitude,
    };
  }

  /**
   * Calculate spectral centroid (brightness)
   */
  private calculateSpectralCentroid(spectrum: Float32Array): number {
    let weightedSum = 0;
    let sum = 0;

    for (let i = 0; i < spectrum.length; i++) {
      const frequency = i * this.frequencyResolution;
      const magnitude = spectrum[i];

      weightedSum += frequency * magnitude;
      sum += magnitude;
    }

    if (sum === 0) return 0;

    const centroid = weightedSum / sum;

    // Normalize to 0-1 range (assuming max frequency is sampleRate/2)
    return centroid / (this.config.sampleRate / 2);
  }

  /**
   * Calculate spectral flux (change from previous spectrum)
   */
  private calculateSpectralFlux(spectrum: Float32Array): number {
    if (!this.state.previousSpectrum) {
      return 0;
    }

    let flux = 0;
    const minLength = Math.min(
      spectrum.length,
      this.state.previousSpectrum.length,
    );

    for (let i = 0; i < minLength; i++) {
      const diff = spectrum[i] - this.state.previousSpectrum[i];
      flux += diff > 0 ? diff : 0; // Only positive differences
    }

    // Normalize by spectrum length
    return flux / minLength;
  }

  /**
   * Calculate spectral rolloff (frequency below which 85% of energy is contained)
   */
  private calculateSpectralRolloff(spectrum: Float32Array): number {
    const threshold = 0.85; // 85%
    let totalEnergy = 0;

    // Calculate total energy
    for (let i = 0; i < spectrum.length; i++) {
      totalEnergy += spectrum[i];
    }

    if (totalEnergy === 0) return 0;

    const targetEnergy = totalEnergy * threshold;
    let accumulatedEnergy = 0;
    let rolloffBin = 0;

    // Find bin where accumulated energy reaches threshold
    for (let i = 0; i < spectrum.length; i++) {
      accumulatedEnergy += spectrum[i];
      if (accumulatedEnergy >= targetEnergy) {
        rolloffBin = i;
        break;
      }
    }

    const rolloffFrequency = rolloffBin * this.frequencyResolution;

    // Normalize to 0-1 range
    return rolloffFrequency / (this.config.sampleRate / 2);
  }

  /**
   * Calculate spectral flatness (noisiness vs tonalness)
   */
  private calculateSpectralFlatness(spectrum: Float32Array): number {
    let geometricMean = 0;
    let arithmeticMean = 0;

    // Use logarithms to avoid numerical issues
    let logSum = 0;
    let sum = 0;
    let count = 0;

    for (let i = 0; i < spectrum.length; i++) {
      const value = spectrum[i];
      if (value > 0) {
        logSum += Math.log(value);
        sum += value;
        count++;
      }
    }

    if (count === 0) return 0;

    geometricMean = Math.exp(logSum / count);
    arithmeticMean = sum / count;

    if (arithmeticMean === 0) return 0;

    const flatness = geometricMean / arithmeticMean;

    // Clamp to 0-1 range
    return Math.max(0, Math.min(1, flatness));
  }

  /**
   * Calculate energy per frequency band
   */
  private calculateFrequencyBands(spectrum: Float32Array): Float32Array {
    const bands = new Float32Array(this.config.frequencyBands);
    const bandEdges = this.bandFrequencies;

    for (let band = 0; band < this.config.frequencyBands; band++) {
      const startFreq = bandEdges[band];
      const endFreq = bandEdges[band + 1];

      const startBin = Math.floor(startFreq / this.frequencyResolution);
      const endBin = Math.min(
        Math.ceil(endFreq / this.frequencyResolution),
        spectrum.length,
      );

      let bandEnergy = 0;
      for (let bin = startBin; bin < endBin; bin++) {
        bandEnergy += spectrum[bin];
      }

      bands[band] = bandEnergy;
    }

    return bands;
  }

  /**
   * Normalize bands to 0-1 range
   */
  private normalizeBands(bands: Float32Array): Float32Array {
    const normalized = new Float32Array(bands.length);

    // Find maximum value
    let max = 0;
    for (let i = 0; i < bands.length; i++) {
      if (bands[i] > max) max = bands[i];
    }

    if (max === 0) return normalized;

    // Normalize
    for (let i = 0; i < bands.length; i++) {
      normalized[i] = bands[i] / max;
    }

    return normalized;
  }

  /**
   * Smooth bands over time using exponential moving average
   */
  private smoothBands(bands: Float32Array): Float32Array {
    if (!this.state.smoothedBands) {
      this.state.smoothedBands = new Float32Array(bands.length);
    }

    const smoothed = new Float32Array(bands.length);
    const alpha = this.config.smoothingAlpha;

    for (let i = 0; i < bands.length; i++) {
      smoothed[i] =
        alpha * bands[i] + (1 - alpha) * this.state.smoothedBands![i];
    }

    this.state.smoothedBands = smoothed;
    return smoothed;
  }

  /**
   * Find peak frequency and magnitude
   */
  private findPeakFrequency(spectrum: Float32Array): {
    peakFrequency: number;
    peakMagnitude: number;
  } {
    let maxMagnitude = 0;
    let peakBin = 0;

    for (let i = 0; i < spectrum.length; i++) {
      if (spectrum[i] > maxMagnitude) {
        maxMagnitude = spectrum[i];
        peakBin = i;
      }
    }

    const peakFrequency = peakBin * this.frequencyResolution;

    return {
      peakFrequency,
      peakMagnitude: maxMagnitude,
    };
  }

  /**
   * Create window function
   */
  private createWindow(type: WindowType, size: number): Float32Array {
    const window = new Float32Array(size);

    switch (type) {
      case "hann":
        for (let i = 0; i < size; i++) {
          window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
        }
        break;

      case "hamming":
        for (let i = 0; i < size; i++) {
          window[i] = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (size - 1));
        }
        break;

      case "blackman":
        for (let i = 0; i < size; i++) {
          const alpha = 0.16;
          const a0 = (1 - alpha) / 2;
          const a1 = 0.5;
          const a2 = alpha / 2;
          window[i] =
            a0 -
            a1 * Math.cos((2 * Math.PI * i) / (size - 1)) +
            a2 * Math.cos((4 * Math.PI * i) / (size - 1));
        }
        break;

      case "rectangular":
      default:
        for (let i = 0; i < size; i++) {
          window[i] = 1;
        }
        break;
    }

    return window;
  }

  /**
   * Get valid FFT size (next power of 2)
   */
  private getValidFFTSize(size: number): number {
    // Ensure size is power of 2
    let validSize = 1;
    while (validSize < size) {
      validSize <<= 1;
    }
    return validSize;
  }

  /**
   * Calculate frequency band edges
   */
  private calculateBandFrequencies(): number[] {
    const bands = this.config.frequencyBands;
    const minFreq = this.config.minFrequency;
    const maxFreq = this.config.maxFrequency;

    // Use logarithmic spacing for frequency bands (more bands in lower frequencies)
    const bandEdges: number[] = new Array(bands + 1);

    // Logarithmic spacing
    const logMin = Math.log10(minFreq);
    const logMax = Math.log10(maxFreq);
    const logRange = logMax - logMin;

    for (let i = 0; i <= bands; i++) {
      const logFreq = logMin + (logRange * i) / bands;
      bandEdges[i] = Math.pow(10, logFreq);
    }

    return bandEdges;
  }
}
