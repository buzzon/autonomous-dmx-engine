/**
 * MetricSourceManager - менеджер источников метрик
 * Управляет регистрацией и сбором метрик из различных источников
 * Реализует расширяемую архитектуру для Phase 1
 */

import { defaultLogger } from '../utils/logger';
import { 
  MetricSource, 
  MetricValue, 
  SystemMetrics,
  MetricSourceConfig
} from './types';
import { RuntimeMetrics } from '../engine/types';

/**
 * Менеджер источников метрик
 */
export class MetricSourceManager {
  private logger = defaultLogger.child({ module: 'MetricSourceManager' });
  private sources: Map<string, MetricSource> = new Map();
  private config: MetricSourceConfig;
  private isInitialized = false;

  constructor(config: MetricSourceConfig) {
    this.config = config;
    this.logger.info('MetricSourceManager initialized', { config });
  }

  /**
   * Инициализация менеджера
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn('MetricSourceManager is already initialized');
      return;
    }

    try {
      this.logger.info('Initializing MetricSourceManager...');
      
      // В Phase 1 регистрируем только базовые источники
      // В будущих фазах будет загрузка из конфигурации
      await this.registerBuiltinSources();
      
      this.isInitialized = true;
      this.logger.info('MetricSourceManager initialized successfully', {
        sourceCount: this.sources.size
      });
      
    } catch (error) {
      this.logger.error('Error initializing MetricSourceManager', { error });
      throw error;
    }
  }

  /**
   * Регистрация источника метрик
   */
  registerSource(source: MetricSource): void {
    if (this.sources.has(source.name)) {
      this.logger.warn('Metric source already registered', { name: source.name });
      return;
    }
    
    this.sources.set(source.name, source);
    this.logger.info('Metric source registered', {
      name: source.name,
      type: source.type
    });
  }

  /**
   * Удаление источника метрик
   */
  unregisterSource(name: string): void {
    if (!this.sources.has(name)) {
      this.logger.warn('Metric source not found', { name });
      return;
    }
    
    this.sources.delete(name);
    this.logger.info('Metric source unregistered', { name });
  }

  /**
   * Сбор всех метрик
   */
  async collectAllMetrics(): Promise<RuntimeMetrics> {
    const startTime = performance.now();
    const metrics: RuntimeMetrics = {
      audio: null as any, // будет заполнено AudioAnalyzer
      timestamp: Date.now()
    };

    try {
      // Сбор метрик из всех зарегистрированных источников
      const collectionPromises = Array.from(this.sources.values()).map(
        async source => {
          try {
            const sourceMetrics = await source.getMetrics();
            this.logger.debug('Metrics collected from source', {
              source: source.name,
              metricCount: Object.keys(sourceMetrics).length
            });
            
            // Преобразование в MetricValue[]
            const metricValues: MetricValue[] = Object.entries(sourceMetrics).map(([name, value]) => ({
              name,
              value: typeof value === 'number' ? value : 0,
              timestamp: Date.now()
            }));
            
            return metricValues;
          } catch (error) {
            this.logger.error('Error collecting metrics from source', {
              source: source.name,
              error
            });
            return [];
          }
        }
      );

      const allMetrics = await Promise.all(collectionPromises);
      const flatMetrics = allMetrics.flat();

      // Обработка собранных метрик
      this.processMetrics(flatMetrics, metrics);

      const collectionTime = performance.now() - startTime;
      this.logger.debug('All metrics collected', {
        sourceCount: this.sources.size,
        metricCount: flatMetrics.length,
        collectionTime: collectionTime.toFixed(2)
      });

    } catch (error) {
      this.logger.error('Error collecting all metrics', { error });
    }

    return metrics;
  }

  /**
   * Получение источника по имени
   */
  getSource(name: string): MetricSource | undefined {
    return this.sources.get(name);
  }

  /**
   * Получение всех зарегистрированных источников
   */
  getAllSources(): MetricSource[] {
    return Array.from(this.sources.values());
  }

  /**
   * Проверка, инициализирован ли менеджер
   */
  isManagerInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Регистрация встроенных источников для Phase 1
   */
  private async registerBuiltinSources(): Promise<void> {
    // В Phase 1 создаём mock источники
    // В будущих фазах будут реальные источники (AudioAnalyzer, VisionAnalyzer и т.д.)
    
    const mockSystemSource: MetricSource = {
      name: 'system',
      type: 'system',
      
      initialize: async (config: any): Promise<void> => {
        this.logger.debug('Mock system source initialized', { config });
      },
      
      getMetrics: async (): Promise<Record<string, any>> => {
        return {
          'cpu.usage': Math.random() * 0.3, // 0-30%
          'memory.usage': Math.random() * 0.5, // 0-50%
          'uptime': Date.now() - (Date.now() - 10000) // 10 секунд
        };
      },
      
      isHealthy: async (): Promise<boolean> => {
        return true;
      },
      
      shutdown: async (): Promise<void> => {
        this.logger.debug('Mock system source shutdown');
      }
    };

    const mockPerformanceSource: MetricSource = {
      name: 'performance',
      type: 'system', // Используем 'system' так как 'performance' нет в MetricSourceType
      
      initialize: async (config: any): Promise<void> => {
        this.logger.debug('Mock performance source initialized', { config });
      },
      
      getMetrics: async (): Promise<Record<string, any>> => {
        return {
          'fastLoop.time': Math.random() * 10, // 0-10ms
          'slowLoop.time': Math.random() * 100, // 0-100ms
          'dmx.latency': Math.random() * 5 // 0-5ms
        };
      },
      
      isHealthy: async (): Promise<boolean> => {
        return true;
      },
      
      shutdown: async (): Promise<void> => {
        this.logger.debug('Mock performance source shutdown');
      }
    };

    // Регистрация mock источников
    this.registerSource(mockSystemSource);
    this.registerSource(mockPerformanceSource);

    this.logger.info('Built-in metric sources registered', {
      count: 2
    });
  }

  /**
   * Обработка собранных метрик
   */
  private processMetrics(metrics: MetricValue[], runtimeMetrics: RuntimeMetrics): void {
    // В Phase 1 просто логируем метрики
    // В будущих фазах будет реальная обработка и агрегация
    
    metrics.forEach(metric => {
      this.logger.debug('Metric processed', {
        name: metric.name,
        value: metric.value,
        timestamp: metric.timestamp
      });
    });
  }

  /**
   * Очистка и освобождение ресурсов
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down MetricSourceManager...');
    
    try {
      // Завершение работы всех источников
      const shutdownPromises = Array.from(this.sources.values()).map(
        source => source.shutdown().catch(error => {
          this.logger.error('Error shutting down source', {
            source: source.name,
            error
          });
        })
      );
      
      await Promise.all(shutdownPromises);
      
      this.sources.clear();
      this.isInitialized = false;
      
      this.logger.info('MetricSourceManager shutdown complete');
      
    } catch (error) {
      this.logger.error('Error during MetricSourceManager shutdown', { error });
      throw error;
    }
  }
}
