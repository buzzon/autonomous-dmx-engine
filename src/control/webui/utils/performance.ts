/**
 * Performance monitoring and optimization utilities
 * for Phase 3 Dashboard
 */

import { store } from '../store/store';

export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  renderTime: number;
  updateTime: number;
  memoryUsage?: number;
  drawCalls?: number;
}

export class PerformanceMonitor {
  private frameCount = 0;
  private lastFpsUpdate = 0;
  private currentFps = 0;
  private frameTimes: number[] = [];
  private maxFrameTimeHistory = 60;
  
  private renderStartTime = 0;
  private updateStartTime = 0;
  
  private metrics: PerformanceMetrics = {
    fps: 0,
    frameTime: 0,
    renderTime: 0,
    updateTime: 0
  };
  
  constructor() {
    // Initialize performance monitoring
    if (typeof performance !== 'undefined') {
      this.lastFpsUpdate = performance.now();
    } else {
      this.lastFpsUpdate = Date.now();
    }
  }
  
  startFrame(): void {
    this.frameCount++;
    
    // Start update timing
    if (typeof performance !== 'undefined') {
      this.updateStartTime = performance.now();
    } else {
      this.updateStartTime = Date.now();
    }
  }
  
  startRender(): void {
    // End update timing, start render timing
    if (typeof performance !== 'undefined') {
      const updateEndTime = performance.now();
      this.metrics.updateTime = updateEndTime - this.updateStartTime;
      this.renderStartTime = performance.now();
    } else {
      const updateEndTime = Date.now();
      this.metrics.updateTime = updateEndTime - this.updateStartTime;
      this.renderStartTime = Date.now();
    }
  }
  
  endFrame(): void {
    // End render timing
    let frameEndTime;
    if (typeof performance !== 'undefined') {
      frameEndTime = performance.now();
      this.metrics.renderTime = frameEndTime - this.renderStartTime;
    } else {
      frameEndTime = Date.now();
      this.metrics.renderTime = frameEndTime - this.renderStartTime;
    }
    
    // Calculate frame time
    this.metrics.frameTime = this.metrics.updateTime + this.metrics.renderTime;
    this.frameTimes.push(this.metrics.frameTime);
    
    // Keep only recent frame times
    if (this.frameTimes.length > this.maxFrameTimeHistory) {
      this.frameTimes.shift();
    }
    
    // Update FPS every second
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - this.lastFpsUpdate >= 1000) {
      this.currentFps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsUpdate = now;
      
      this.metrics.fps = this.currentFps;
      
      // Update store with performance metrics
      store.updateSystemMetrics({
        fps: this.currentFps,
        cpu: this.getAverageFrameTime(),
        memory: this.getMemoryUsage()
      });
    }
  }
  
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }
  
  getAverageFrameTime(): number {
    if (this.frameTimes.length === 0) return 0;
    const sum = this.frameTimes.reduce((a, b) => a + b, 0);
    return sum / this.frameTimes.length;
  }
  
  getMemoryUsage(): number {
    // Browser memory usage (if available)
    if ((performance as any).memory) {
      const memory = (performance as any).memory;
      return (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100;
    }
    return 0;
  }
  
  isPerformanceAcceptable(): boolean {
    return this.currentFps >= 30 && this.getAverageFrameTime() < 33;
  }
  
  getPerformanceReport(): string {
    const avgFrameTime = this.getAverageFrameTime();
    const memoryUsage = this.getMemoryUsage();
    
    return `FPS: ${this.currentFps} | Frame: ${avgFrameTime.toFixed(1)}ms | ` +
           `Update: ${this.metrics.updateTime.toFixed(1)}ms | ` +
           `Render: ${this.metrics.renderTime.toFixed(1)}ms | ` +
           `Memory: ${memoryUsage.toFixed(1)}%`;
  }
}

// Optimization utilities
export class PerformanceOptimizer {
  static shouldSkipRender(lastRenderTime: number, targetFps: number = 60): boolean {
    const frameInterval = 1000 / targetFps;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    return (now - lastRenderTime) < frameInterval;
  }
  
  static throttleUpdate(updateFunction: Function, minInterval: number): Function {
    let lastUpdate = 0;
    return (...args: any[]) => {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (now - lastUpdate >= minInterval) {
        lastUpdate = now;
        updateFunction(...args);
      }
    };
  }
  
  static debounceRender(renderFunction: Function, delay: number): Function {
    let timeoutId: number;
    return (...args: any[]) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        renderFunction(...args);
      }, delay) as unknown as number;
    };
  }
  
  static createVirtualScroll(
    itemCount: number,
    containerHeight: number,
    itemHeight: number,
    renderItem: (index: number) => void
  ): (scrollTop: number) => void {
    return (scrollTop: number) => {
      const startIndex = Math.floor(scrollTop / itemHeight);
      const endIndex = Math.min(
        itemCount - 1,
        Math.floor((scrollTop + containerHeight) / itemHeight)
      );
      
      // Only render visible items
      for (let i = startIndex; i <= endIndex; i++) {
        renderItem(i);
      }
    };
  }
}

// Memory management
export class MemoryManager {
  private static cache = new Map<string, any>();
  private static cacheSize = 0;
  private static maxCacheSize = 50 * 1024 * 1024; // 50MB
  
  static set(key: string, value: any, sizeEstimate: number = 0): void {
    if (this.cacheSize + sizeEstimate > this.maxCacheSize) {
      this.evictOldest();
    }
    
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      size: sizeEstimate
    });
    
    this.cacheSize += sizeEstimate;
  }
  
  static get(key: string): any {
    const entry = this.cache.get(key);
    if (entry) {
      entry.timestamp = Date.now(); // Update access time
      return entry.value;
    }
    return null;
  }
  
  static clear(): void {
    this.cache.clear();
    this.cacheSize = 0;
  }
  
  private static evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      const entry = this.cache.get(oldestKey)!;
      this.cacheSize -= entry.size;
      this.cache.delete(oldestKey);
    }
  }
  
  static getCacheStats(): { size: number; count: number; maxSize: number } {
    return {
      size: this.cacheSize,
      count: this.cache.size,
      maxSize: this.maxCacheSize
    };
  }
}

// Real-time data optimization
export class DataStreamOptimizer {
  private static sampleRates = new Map<string, number>();
  private static lastSampleTimes = new Map<string, number>();
  
  static setSampleRate(streamId: string, samplesPerSecond: number): void {
    this.sampleRates.set(streamId, samplesPerSecond);
  }
  
  static shouldSample(streamId: string): boolean {
    const sampleRate = this.sampleRates.get(streamId);
    if (!sampleRate) return true;
    
    const now = Date.now();
    const lastTime = this.lastSampleTimes.get(streamId) || 0;
    const interval = 1000 / sampleRate;
    
    if (now - lastTime >= interval) {
      this.lastSampleTimes.set(streamId, now);
      return true;
    }
    
    return false;
  }
  
  static downsampleArray(data: number[], targetLength: number): number[] {
    if (data.length <= targetLength) return data;
    
    const result: number[] = [];
    const step = data.length / targetLength;
    
    for (let i = 0; i < targetLength; i++) {
      const start = Math.floor(i * step);
      const end = Math.floor((i + 1) * step);
      let sum = 0;
      
      for (let j = start; j < end; j++) {
        sum += data[j];
      }
      
      result.push(sum / (end - start));
    }
    
    return result;
  }
}

// Export singleton instances
export const performanceMonitor = new PerformanceMonitor();
export const performanceOptimizer = new PerformanceOptimizer();
export const memoryManager = MemoryManager;
export const dataStreamOptimizer = DataStreamOptimizer;