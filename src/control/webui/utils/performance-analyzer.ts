/**
 * Performance Analyzer for Phase 3 UI
 * Monitors and optimizes runtime performance
 */

export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  memoryUsage: number;
  domNodes: number;
  eventListeners: number;
  renderTime: number;
  updateTime: number;
}

export interface PerformanceThresholds {
  minFPS: number;
  maxFrameTime: number;
  maxMemoryMB: number;
  maxDOMNodes: number;
  maxEventListeners: number;
}

export class PerformanceAnalyzer {
  private metrics: PerformanceMetrics = {
    fps: 0,
    frameTime: 0,
    memoryUsage: 0,
    domNodes: 0,
    eventListeners: 0,
    renderTime: 0,
    updateTime: 0,
  };
  
  private thresholds: PerformanceThresholds = {
    minFPS: 30,
    maxFrameTime: 33, // 30fps = 33ms per frame
    maxMemoryMB: 100,
    maxDOMNodes: 5000,
    maxEventListeners: 1000,
  };
  
  private frameCount = 0;
  private lastFrameTime = 0;
  private fpsUpdateInterval = 1000; // Update FPS every second
  private lastFPSUpdate = 0;
  
  private warnings: string[] = [];
  private optimizations: string[] = [];
  
  constructor(options?: Partial<PerformanceThresholds>) {
    if (options) {
      this.thresholds = { ...this.thresholds, ...options };
    }
    
    this.startMonitoring();
  }
  
  /**
   * Start performance monitoring
   */
  startMonitoring(): void {
    if (typeof window !== 'undefined') {
      // Start frame monitoring
      this.lastFrameTime = performance.now();
      requestAnimationFrame(this.monitorFrame.bind(this));
      
      // Start periodic checks
      setInterval(() => this.checkPerformance(), 5000);
      
      console.log('🚀 Performance Analyzer started');
    }
  }
  
  /**
   * Monitor frame performance
   */
  private monitorFrame(timestamp: number): void {
    const frameTime = timestamp - this.lastFrameTime;
    this.lastFrameTime = timestamp;
    
    this.frameCount++;
    
    // Update FPS every second
    if (timestamp - this.lastFPSUpdate >= this.fpsUpdateInterval) {
      this.metrics.fps = Math.round((this.frameCount * 1000) / (timestamp - this.lastFPSUpdate));
      this.metrics.frameTime = frameTime;
      this.frameCount = 0;
      this.lastFPSUpdate = timestamp;
      
      // Check frame performance
      this.checkFramePerformance(frameTime);
    }
    
    // Continue monitoring
    requestAnimationFrame(this.monitorFrame.bind(this));
  }
  
  /**
   * Check frame performance
   */
  private checkFramePerformance(frameTime: number): void {
    if (frameTime > this.thresholds.maxFrameTime) {
      this.addWarning(`High frame time: ${frameTime.toFixed(1)}ms (target: <${this.thresholds.maxFrameTime}ms)`);
    }
    
    if (this.metrics.fps < this.thresholds.minFPS) {
      this.addWarning(`Low FPS: ${this.metrics.fps} (target: >${this.thresholds.minFPS})`);
    }
  }
  
  /**
   * Perform comprehensive performance check
   */
  private checkPerformance(): void {
    this.updateMemoryUsage();
    this.updateDOMStats();
    this.checkMemoryUsage();
    this.checkDOMComplexity();
    this.checkEventListeners();
    
    // Log warnings if any
    if (this.warnings.length > 0) {
      console.warn('⚠️ Performance warnings:', this.warnings);
      this.warnings = []; // Clear after logging
    }
    
    // Log optimizations if any
    if (this.optimizations.length > 0) {
      console.log('✅ Performance optimizations:', this.optimizations);
      this.optimizations = [];
    }
  }
  
  /**
   * Update memory usage metrics
   */
  private updateMemoryUsage(): void {
    if ((performance as any).memory) {
      const memory = (performance as any).memory;
      this.metrics.memoryUsage = Math.round(memory.usedJSHeapSize / (1024 * 1024));
    }
  }
  
  /**
   * Update DOM statistics
   */
  private updateDOMStats(): void {
    if (typeof document !== 'undefined') {
      this.metrics.domNodes = document.getElementsByTagName('*').length;
      
      // Count event listeners (approximate)
      this.metrics.eventListeners = this.countEventListeners();
    }
  }
  
  /**
   * Count approximate number of event listeners
   */
  private countEventListeners(): number {
    let count = 0;
    
    // This is an approximation - actual counting requires browser APIs
    const elements = document.querySelectorAll('*');
    elements.forEach(element => {
      // We can't directly access event listeners, so we estimate
      // based on common patterns
      if (element.hasAttribute('onclick') || 
          element.hasAttribute('onchange') ||
          element.hasAttribute('oninput')) {
        count++;
      }
    });
    
    return count;
  }
  
  /**
   * Check memory usage
   */
  private checkMemoryUsage(): void {
    if (this.metrics.memoryUsage > this.thresholds.maxMemoryMB) {
      this.addWarning(`High memory usage: ${this.metrics.memoryUsage}MB (limit: ${this.thresholds.maxMemoryMB}MB)`);
      this.addOptimization('Consider implementing virtual scrolling for large lists');
      this.addOptimization('Review memory leaks in component lifecycle');
    }
  }
  
  /**
   * Check DOM complexity
   */
  private checkDOMComplexity(): void {
    if (this.metrics.domNodes > this.thresholds.maxDOMNodes) {
      this.addWarning(`High DOM node count: ${this.metrics.domNodes} (limit: ${this.thresholds.maxDOMNodes})`);
      this.addOptimization('Reduce DOM depth and complexity');
      this.addOptimization('Use CSS instead of nested divs for layout');
      this.addOptimization('Implement component lazy loading');
    }
  }
  
  /**
   * Check event listeners
   */
  private checkEventListeners(): void {
    if (this.metrics.eventListeners > this.thresholds.maxEventListeners) {
      this.addWarning(`High event listener count: ${this.metrics.eventListeners} (limit: ${this.thresholds.maxEventListeners})`);
      this.addOptimization('Use event delegation instead of individual listeners');
      this.addOptimization('Remove event listeners in component cleanup');
      this.addOptimization('Use passive event listeners for scroll/touch events');
    }
  }
  
  /**
   * Add performance warning
   */
  private addWarning(warning: string): void {
    if (!this.warnings.includes(warning)) {
      this.warnings.push(warning);
    }
  }
  
  /**
   * Add optimization suggestion
   */
  private addOptimization(optimization: string): void {
    if (!this.optimizations.includes(optimization)) {
      this.optimizations.push(optimization);
    }
  }
  
  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }
  
  /**
   * Get performance report
   */
  getReport(): string {
    const metrics = this.getMetrics();
    const report = [
      '📊 Performance Report',
      '===================',
      `FPS: ${metrics.fps} (target: >${this.thresholds.minFPS})`,
      `Frame Time: ${metrics.frameTime.toFixed(1)}ms (target: <${this.thresholds.maxFrameTime}ms)`,
      `Memory: ${metrics.memoryUsage}MB (limit: ${this.thresholds.maxMemoryMB}MB)`,
      `DOM Nodes: ${metrics.domNodes} (limit: ${this.thresholds.maxDOMNodes})`,
      `Event Listeners: ${metrics.eventListeners} (limit: ${this.thresholds.maxEventListeners})`,
      `Render Time: ${metrics.renderTime.toFixed(1)}ms`,
      `Update Time: ${metrics.updateTime.toFixed(1)}ms`,
    ];
    
    return report.join('\n');
  }
  
  /**
   * Measure execution time of a function
   */
  measureExecution<T>(name: string, fn: () => T): T {
    const startTime = performance.now();
    const result = fn();
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    console.log(`⏱️ ${name}: ${duration.toFixed(2)}ms`);
    
    if (duration > 16) { // Longer than one frame at 60fps
      this.addWarning(`Slow execution: ${name} took ${duration.toFixed(2)}ms`);
    }
    
    return result;
  }
  
  /**
   * Start render timing
   */
  startRender(): void {
    this.metrics.renderTime = performance.now();
  }
  
  /**
   * End render timing
   */
  endRender(): void {
    this.metrics.renderTime = performance.now() - this.metrics.renderTime;
  }
  
  /**
   * Start update timing
   */
  startUpdate(): void {
    this.metrics.updateTime = performance.now();
  }
  
  /**
   * End update timing
   */
  endUpdate(): void {
    this.metrics.updateTime = performance.now() - this.metrics.updateTime;
  }
  
  /**
   * Get optimization recommendations
   */
  getOptimizations(): string[] {
    const recommendations: string[] = [];
    
    if (this.metrics.fps < 45) {
      recommendations.push(
        'Optimize render cycles with requestAnimationFrame',
        'Reduce complex calculations in render loop',
        'Implement object pooling for frequently created objects'
      );
    }
    
    if (this.metrics.memoryUsage > 50) {
      recommendations.push(
        'Implement garbage collection triggers',
        'Use WeakMap/WeakSet for cache references',
        'Review component unmounting and cleanup'
      );
    }
    
    if (this.metrics.domNodes > 2000) {
      recommendations.push(
        'Implement virtual DOM for large lists',
        'Use CSS Grid/Flexbox instead of nested divs',
        'Lazy load off-screen components'
      );
    }
    
    return recommendations;
  }
  
  /**
   * Export performance data for analytics
   */
  exportData(): any {
    return {
      timestamp: new Date().toISOString(),
      metrics: this.getMetrics(),
      thresholds: this.thresholds,
      userAgent: navigator.userAgent,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      deviceMemory: (navigator as any).deviceMemory || 'unknown',
      hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
    };
  }
}

// Singleton instance
let analyzerInstance: PerformanceAnalyzer | null = null;

/**
 * Get or create performance analyzer instance
 */
export function getPerformanceAnalyzer(options?: Partial<PerformanceThresholds>): PerformanceAnalyzer {
  if (!analyzerInstance) {
    analyzerInstance = new PerformanceAnalyzer(options);
  }
  return analyzerInstance;
}

/**
 * Performance optimization utilities
 */
export const performanceUtils = {
  /**
   * Debounce function for performance
   */
  debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;
    
    return (...args: Parameters<T>) => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  },
  
  /**
   * Throttle function for performance
   */
  throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  },
  
  /**
   * Memoize function for expensive calculations
   */
  memoize<T extends (...args: any[]) => any>(func: T): T {
    const cache = new Map<string, ReturnType<T>>();
    
    return ((...args: Parameters<T>) => {
      const key = JSON.stringify(args);
      
      if (cache.has(key)) {
        return cache.get(key);
      }
      
      const result = func(...args);
      cache.set(key, result);
      return result;
    }) as T;
  },
  
  /**
   * Batch DOM updates
   */
  batchUpdates(callback: () => void): void {
    if (typeof window !== 'undefined') {
      requestAnimationFrame(() => {
        callback();
      });
    } else {
      callback();
    }
  },
  
  /**
   * Check if element is in viewport
   */
  isInViewport(element: HTMLElement): boolean {
    if (typeof window === 'undefined') return true;
    
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  },
  
  /**
   * Lazy load images
   */
  lazyLoadImages(): void {
    if (typeof document === 'undefined') return;
    
    const images = document.querySelectorAll('img[data-src]');
    
    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          img.src = img.dataset.src || '';
          img.removeAttribute('data-src');
          imageObserver.unobserve(img);
        }
      });
    });
    
    images.forEach(img => imageObserver.observe(img));
  },
};

// Export for global use
if (typeof window !== 'undefined') {
  (window as any).PerformanceAnalyzer = PerformanceAnalyzer;
  (window as any).performanceUtils = performanceUtils;
}

console.log('📊 Phase 3 Performance Analyzer loaded');