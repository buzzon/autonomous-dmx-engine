/**
 * Real Audio Analyzer (Worker-based)
 * Integrates FFT analysis, beat detection, and BPM estimation via a separate worker thread
 */

import {
  AudioMetrics,
  AudioAnalyzerConfig,
  Mood,
  AudioAnalyzerState,
} from "./types";
import { defaultLogger } from "../utils/logger";
import { Worker } from "worker_threads";
import { resolve } from "path";

export class AudioAnalyzer {
  private logger = defaultLogger.child({ module: "AudioAnalyzer" });
  private worker: Worker | null = null;
  private latestMetrics: AudioMetrics | null = null;
  private config: AudioAnalyzerConfig;

  constructor(config: AudioAnalyzerConfig) {
    this.config = config;
    this.initializeWorker();
  }

  private initializeWorker() {
    try {
      // In a real environment, we'd handle .ts vs .js resolution robustly.
      // For now, assuming ts-node execution environment.
      const workerPath = resolve(__dirname, "./worker.ts");

      this.worker = new Worker(workerPath, {
        workerData: { config: this.config } as any,
        execArgv: ["-r", "ts-node/register"], // Required for running .ts worker
      });

      this.worker.on("message", (message) => {
        if (message.type === "metrics") {
          this.latestMetrics = message.data;
          // In the future, we can emit events here via Global EventBus
          // globalEventBus.emit('audio:processed', this.latestMetrics);
        }
      });

      this.worker.on("error", (err) => {
        this.logger.error("Audio Worker error", err);
      });

      this.worker.on("exit", (code) => {
        if (code !== 0) {
          this.logger.error(`Audio Worker stopped with exit code ${code}`);
          // TODO: Implement restart logic
        }
      });

      this.logger.info("Audio Worker initialized", { workerPath });
    } catch (error) {
      this.logger.error("Failed to initialize Audio Worker", { error });
    }
  }

  /**
   * Process audio frame (Asynchronous/Non-blocking)
   * Sends data to worker and returns immediately.
   */
  public processFrame(samples: Float32Array, timestamp: number): AudioMetrics {
    if (this.worker) {
      // Post buffer to worker
      // Transferring ownership of the Float32Array buffer would be more performant
      // but requires careful memory management. Cloning is safer for now.
      this.worker.postMessage({
        type: "process",
        data: { samples, timestamp },
      });
    }

    // Return latest available metrics immediately
    // usage of Null Object pattern to avoid null checks downstream
    return this.latestMetrics || this.createEmptyMetrics(timestamp);
  }

  private createEmptyMetrics(timestamp: number): AudioMetrics {
    return {
      timestamp,
      energy: 0,
      bpm: 0,
      beat: false,
      mood: "calm",
      spectralCentroid: 0,
      spectralFlux: 0,
      zeroCrossingRate: 0,
    };
  }

  public stop() {
    if (this.worker) {
      this.worker.terminate();
      this.logger.info("Audio Worker terminated");
    }
  }

  // Methods required by facade/existing interface
  // These might need to be implemented via async requests to worker or removed from interface if possible

  public updateConfig(config: Partial<AudioAnalyzerConfig>): void {
    this.config = { ...this.config, ...config };
    if (this.worker) {
      this.worker.postMessage({ type: "config", data: config });
    }
  }

  public reset(): void {
    this.latestMetrics = null;
    // We might want to send a reset signal to the worker
  }

  // Stubs for methods used in debugging/logging that relied on internal state
  // If these are critical, we need to request state from worker or cache it
  public getState(): AudioAnalyzerState {
    // Return a basic state or cached state
    return {
      sampleRate: this.config.sampleRate,
      frameSize: this.config.frameSize,
      hopSize: this.config.hopSize,
      energyHistory: [],
      energyAvg: 0,
      energyPeak: 0,
      lastBeats: [],
      bpm: this.latestMetrics?.bpm || null,
      lastBeatTime: 0,
      mood: this.latestMetrics?.mood || "calm",
      moodHistory: [],
      lastUpdateTimestamp: this.latestMetrics?.timestamp || 0,
      lastMoodUpdate: 0,
      framesProcessed: 0,
      averageProcessingTime: 0,
    };
  }
}
