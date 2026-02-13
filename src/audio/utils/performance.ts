/**
 * Performance monitoring utilities for audio processing
 */

export interface PerformanceMetrics {
  frameCount: number;
  averageProcessingTime: number;
  maxProcessingTime: number;
  minProcessingTime: number;
  fps: number;
  memoryAllocations: number;
  bufferPoolStats?: any;
}

/**
 * Simple performance monitor for audio processing pipeline
 */
export class AudioPerformanceMonitor {
  private metrics: PerformanceMetrics = {
    frameCount: 0,
    averageProcessingTime: 0,
    maxProcessingTime: 0,
    minProcessingTime: Infinity,
    fps: 0,
    memoryAllocations: 0,
  };

  private lastFrameTime = 0;
  private frameTimes: number[] = [];
  private readonly maxFrameSamples = 100;

  /**
   * Start measuring processing time for a frame
   */
  startFrame(): number {
    return performance.now();
  }

  /**
   * End measurement for a frame and update metrics
   */
  endFrame(startTime: number): void {
    const processingTime = performance.now() - startTime;
    const now = Date.now();

    // Update frame timing
    this.metrics.frameCount++;
    this.frameTimes.push(processingTime);

    // Keep only recent samples
    if (this.frameTimes.length > this.maxFrameSamples) {
      this.frameTimes.shift();
    }

    // Calculate statistics
    const sum = this.frameTimes.reduce((a, b) => a + b, 0);
    this.metrics.averageProcessingTime = sum / this.frameTimes.length;
    this.metrics.maxProcessingTime = Math.max(this.metrics.maxProcessingTime, processingTime);
    this.metrics.minProcessingTime = Math.min(this.metrics.minProcessingTime, processingTime);

    // Calculate FPS (frames per second)
    if (this.lastFrameTime > 0) {
      const frameInterval = now - this.lastFrameTime;
      if (frameInterval > 0) {
        this.metrics.fps = 1000 / frameInterval;
      }
    }

    this.lastFrameTime = now;
  }

  /**
   * Record a memory allocation
   */
  recordAllocation(): void {
    this.metrics.memoryAllocations++;
  }

  /**
   * Update buffer pool statistics
   */
  updateBufferPoolStats(stats: any): void {
    this.metrics.bufferPoolStats = stats;
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics = {
      frameCount: 0,
      averageProcessingTime: 0,
      maxProcessingTime: 0,
      minProcessingTime: Infinity,
      fps: 0,
      memoryAllocations: 0,
    };
    this.frameTimes = [];
    this.lastFrameTime = 0;
  }

  /**
   * Get a summary string of performance metrics
   */
  getSummary(): string {
    const m = this.metrics;
    return `Audio Performance: ${m.fps.toFixed(1)} FPS, ` +
           `Avg: ${m.averageProcessingTime.toFixed(2)}ms, ` +
           `Min: ${m.minProcessingTime.toFixed(2)}ms, ` +
           `Max: ${m.maxProcessingTime.toFixed(2)}ms, ` +
           `Frames: ${m.frameCount}`;
  }
}

/**
 * Global performance monitor instance
 */
export const audioPerformance = new AudioPerformanceMonitor();