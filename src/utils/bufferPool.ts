/**
 * Buffer Pool for efficient memory management in audio processing
 * Reuses Float32Array buffers to reduce garbage collection
 */

export interface BufferPoolConfig {
  initialPoolSize?: number;
  maxPoolSize?: number;
  bufferSize: number;
}

/**
 * Simple buffer pool for Float32Array objects
 */
export class BufferPool {
  private pool: Float32Array[] = [];
  private config: Required<BufferPoolConfig>;
  private allocatedCount = 0;

  constructor(config: BufferPoolConfig) {
    this.config = {
      initialPoolSize: config.initialPoolSize || 5,
      maxPoolSize: config.maxPoolSize || 20,
      bufferSize: config.bufferSize,
    };

    // Initialize pool with some buffers
    for (let i = 0; i < this.config.initialPoolSize; i++) {
      this.pool.push(new Float32Array(this.config.bufferSize));
    }
  }

  /**
   * Get a buffer from the pool (or create a new one if pool is empty)
   */
  acquire(): Float32Array {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }

    // Pool is empty, create new buffer
    this.allocatedCount++;
    return new Float32Array(this.config.bufferSize);
  }

  /**
   * Return a buffer to the pool for reuse
   */
  release(buffer: Float32Array): void {
    // Clear the buffer (set all values to 0)
    buffer.fill(0);

    // Only keep buffer if pool is not full
    if (this.pool.length < this.config.maxPoolSize) {
      this.pool.push(buffer);
    } else {
      // Pool is full, let buffer be garbage collected
      this.allocatedCount--;
    }
  }

  /**
   * Get statistics about pool usage
   */
  getStats() {
    return {
      poolSize: this.pool.length,
      allocatedCount: this.allocatedCount,
      bufferSize: this.config.bufferSize,
      maxPoolSize: this.config.maxPoolSize,
    };
  }

  /**
   * Clear all buffers from pool
   */
  clear(): void {
    this.pool = [];
    this.allocatedCount = 0;
  }
}

/**
 * Global buffer pool manager for common buffer sizes
 */
export class BufferPoolManager {
  private static pools = new Map<number, BufferPool>();
  private static defaultConfig: Partial<BufferPoolConfig> = {
    initialPoolSize: 3,
    maxPoolSize: 10,
  };

  /**
   * Get or create a buffer pool for specific size
   */
  static getPool(bufferSize: number, config?: Partial<BufferPoolConfig>): BufferPool {
    if (!this.pools.has(bufferSize)) {
      const poolConfig: BufferPoolConfig = {
        ...this.defaultConfig,
        ...config,
        bufferSize,
      };
      this.pools.set(bufferSize, new BufferPool(poolConfig));
    }
    return this.pools.get(bufferSize)!;
  }

  /**
   * Acquire a buffer of specified size
   */
  static acquire(bufferSize: number): Float32Array {
    return this.getPool(bufferSize).acquire();
  }

  /**
   * Release a buffer back to appropriate pool
   */
  static release(buffer: Float32Array): void {
    const pool = this.pools.get(buffer.length);
    if (pool) {
      pool.release(buffer);
    }
    // If no pool exists for this size, let buffer be garbage collected
  }

  /**
   * Get statistics for all pools
   */
  static getStats() {
    const stats: Record<string, any> = {};
    for (const [size, pool] of this.pools.entries()) {
      stats[`bufferSize_${size}`] = pool.getStats();
    }
    return stats;
  }

  /**
   * Clear all pools
   */
  static clearAll(): void {
    this.pools.clear();
  }
}