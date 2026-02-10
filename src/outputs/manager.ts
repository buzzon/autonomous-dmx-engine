/**
 * OutputSinkManager - менеджер выходных каналов
 * Управляет отправкой данных в различные выходные каналы (DMX, визуализация, логирование и т.д.)
 * Реализует расширяемую архитектуру для Phase 1
 */

import { defaultLogger } from '../utils/logger';
import { 
  OutputSink, 
  OutputSinkType,
  OutputSinkConfig,
  OutputSinkManagerConfig,
  OutputData,
  OutputStatistics,
  OutputSinkHealth,
  DMXOutputData,
  VisualizationOutputData
} from './types';
import { UniverseFrame } from '../lighting/types';
import { LightingOutput } from '../engine/types';

/**
 * Менеджер выходных каналов
 */
export class OutputSinkManager {
  private logger = defaultLogger.child({ module: 'OutputSinkManager' });
  private sinks: Map<string, OutputSink> = new Map();
  private config: OutputSinkManagerConfig;
  private statistics: OutputStatistics = {
    totalSent: 0,
    failed: 0,
    averageLatency: 0,
    lastSent: 0,
    throughput: 0,
    sinkStats: {}
  };
  private isInitialized = false;

  constructor(config: OutputSinkManagerConfig) {
    this.config = config;
    this.logger.info('OutputSinkManager initialized', { config });
  }

  /**
   * Инициализация менеджера
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn('OutputSinkManager is already initialized');
      return;
    }

    try {
      this.logger.info('Initializing OutputSinkManager...');
      
      // В Phase 1 регистрируем только базовые выходные каналы
      // В будущих фазах будет загрузка из конфигурации
      await this.registerBuiltinSinks();
      
      this.isInitialized = true;
      this.logger.info('OutputSinkManager initialized successfully', {
        sinkCount: this.sinks.size
      });
      
    } catch (error) {
      this.logger.error('Error initializing OutputSinkManager', { error });
      throw error;
    }
  }

  /**
   * Регистрация выходного канала
   */
  registerSink(sink: OutputSink): void {
    if (this.sinks.has(sink.name)) {
      this.logger.warn('Output sink already registered', { name: sink.name });
      return;
    }
    
    this.sinks.set(sink.name, sink);
    this.statistics.sinkStats[sink.name] = {
      sent: 0,
      failed: 0,
      latency: 0
    };
    
    this.logger.info('Output sink registered', { 
      name: sink.name,
      type: sink.type
    });
  }

  /**
   * Удаление выходного канала
   */
  unregisterSink(name: string): void {
    if (!this.sinks.has(name)) {
      this.logger.warn('Output sink not found', { name });
      return;
    }
    
    this.sinks.delete(name);
    delete this.statistics.sinkStats[name];
    
    this.logger.info('Output sink unregistered', { name });
  }

  /**
   * Отправка DMX данных
   */
  async sendDMX(universeFrames: UniverseFrame[]): Promise<void> {
    if (!this.isInitialized) {
      this.logger.error('OutputSinkManager not initialized');
      return;
    }

    const dmxData: DMXOutputData = {
      universeFrames,
      timestamp: Date.now(),
      priority: 1
    };

    await this.sendToSinks('dmx', dmxData);
  }

  /**
   * Отправка данных визуализации
   */
  async sendVisualization(fixtureStates: Map<string, any>, metrics: any): Promise<void> {
    if (!this.isInitialized) {
      this.logger.error('OutputSinkManager not initialized');
      return;
    }

    const vizData: VisualizationOutputData = {
      fixtureStates,
      metrics,
      timestamp: Date.now(),
      view: '2d'
    };

    await this.sendToSinks('visualization', vizData);
  }

  /**
   * Отправка lighting output
   */
  async sendLightingOutput(lightingOutput: LightingOutput): Promise<void> {
    if (!this.isInitialized) {
      this.logger.error('OutputSinkManager not initialized');
      return;
    }

    // Отправка DMX данных
    if (lightingOutput.universeFrames.length > 0) {
      await this.sendDMX(lightingOutput.universeFrames);
    }

    // Отправка данных визуализации
    await this.sendVisualization(lightingOutput.fixtureStates, {});
  }

  /**
   * Отправка данных в логи
   */
  async sendLog(data: any): Promise<void> {
    if (!this.isInitialized) {
      this.logger.error('OutputSinkManager not initialized');
      return;
    }

    const logData: OutputData = {
      type: 'logging',
      timestamp: Date.now(),
      data,
      metadata: { level: 'info' }
    };

    await this.sendToSinks('logging', logData);
  }

  /**
   * Получение выходного канала по имени
   */
  getSink(name: string): OutputSink | undefined {
    return this.sinks.get(name);
  }

  /**
   * Получение всех зарегистрированных выходных каналов
   */
  getAllSinks(): OutputSink[] {
    return Array.from(this.sinks.values());
  }

  /**
   * Получение статистики
   */
  getStatistics(): OutputStatistics {
    return { ...this.statistics };
  }

  /**
   * Сброс статистики
   */
  resetStatistics(): void {
    this.statistics = {
      totalSent: 0,
      failed: 0,
      averageLatency: 0,
      lastSent: 0,
      throughput: 0,
      sinkStats: Object.keys(this.statistics.sinkStats).reduce((acc, name) => {
        acc[name] = { sent: 0, failed: 0, latency: 0 };
        return acc;
      }, {} as Record<string, { sent: number; failed: number; latency: number }>)
    };
    
    this.logger.info('Output statistics reset');
  }

  /**
   * Проверка здоровья всех выходных каналов
   */
  async checkHealth(): Promise<OutputSinkHealth[]> {
    const healthChecks: OutputSinkHealth[] = [];
    
    for (const [name, sink] of this.sinks) {
      try {
        const startTime = performance.now();
        const healthy = await sink.isHealthy();
        const latency = performance.now() - startTime;
        
        healthChecks.push({
          name,
          healthy,
          lastSuccess: healthy ? Date.now() : 0,
          latency,
          throughput: this.statistics.sinkStats[name]?.sent || 0
        });
        
      } catch (error) {
        healthChecks.push({
          name,
          healthy: false,
          lastSuccess: 0,
          error: error instanceof Error ? error.message : String(error),
          latency: 0,
          throughput: 0
        });
      }
    }
    
    return healthChecks;
  }

  /**
   * Проверка, инициализирован ли менеджер
   */
  isManagerInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Регистрация встроенных выходных каналов для Phase 1
   */
  private async registerBuiltinSinks(): Promise<void> {
    // В Phase 1 создаём mock выходные каналы
    // В будущих фазах будут реальные каналы (Art-Net, WebSocket, OSC и т.д.)
    
    const mockLoggingSink: OutputSink = {
      name: 'console-logger',
      type: 'logging',
      
      initialize: async (config: any): Promise<void> => {
        this.logger.debug('Mock logging sink initialized', { config });
      },
      
      send: async (data: any): Promise<void> => {
        // Просто логируем в консоль для Phase 1
        this.logger.debug('Output sent to logging sink', { data });
      },
      
      isHealthy: async (): Promise<boolean> => {
        return true; // Консоль всегда доступна
      },
      
      shutdown: async (): Promise<void> => {
        this.logger.debug('Mock logging sink shutdown');
      }
    };

    const mockDMXSink: OutputSink = {
      name: 'mock-dmx',
      type: 'dmx',
      
      initialize: async (config: any): Promise<void> => {
        this.logger.debug('Mock DMX sink initialized', { config });
      },
      
      send: async (data: any): Promise<void> => {
        // В Phase 1 просто логируем DMX данные
        if (data.universeFrames && Array.isArray(data.universeFrames)) {
          this.logger.debug('DMX output simulated', {
            universeCount: data.universeFrames.length,
            timestamp: data.timestamp
          });
        }
      },
      
      isHealthy: async (): Promise<boolean> => {
        return true; // Mock DMX всегда доступен
      },
      
      shutdown: async (): Promise<void> => {
        this.logger.debug('Mock DMX sink shutdown');
      }
    };

    const mockVisualizationSink: OutputSink = {
      name: 'mock-visualization',
      type: 'visualization',
      
      initialize: async (config: any): Promise<void> => {
        this.logger.debug('Mock visualization sink initialized', { config });
      },
      
      send: async (data: any): Promise<void> => {
        // В Phase 1 просто логируем данные визуализации
        this.logger.debug('Visualization output simulated', {
          fixtureCount: data.fixtureStates?.size || 0,
          timestamp: data.timestamp
        });
      },
      
      isHealthy: async (): Promise<boolean> => {
        return true; // Mock визуализация всегда доступна
      },
      
      shutdown: async (): Promise<void> => {
        this.logger.debug('Mock visualization sink shutdown');
      }
    };

    // Регистрация mock выходных каналов
    this.registerSink(mockLoggingSink);
    this.registerSink(mockDMXSink);
    this.registerSink(mockVisualizationSink);

    this.logger.info('Built-in output sinks registered', {
      count: 3
    });
  }

  /**
   * Отправка данных в выходные каналы указанного типа
   */
  private async sendToSinks(type: OutputSinkType, data: any): Promise<void> {
    const startTime = performance.now();
    let successCount = 0;
    let failCount = 0;

    try {
      // Фильтрация каналов по типу и приоритету
      const sinksToUse = Array.from(this.sinks.values())
        .filter(sink => sink.type === type)
        .sort((a, b) => {
          // В Phase 1 используем простую сортировку
          // В будущих фазах будет учёт приоритета из конфигурации
          return a.name.localeCompare(b.name);
        });

      if (sinksToUse.length === 0) {
        this.logger.warn(`No output sinks available for type: ${type}`);
        return;
      }

      // Отправка данных в каждый канал
      const sendPromises = sinksToUse.map(async sink => {
        const sinkStartTime = performance.now();
        
        try {
          await sink.send(data);
          const latency = performance.now() - sinkStartTime;
          
          // Обновление статистики
          this.updateStatistics(sink.name, true, latency);
          successCount++;
          
          this.logger.debug('Data sent successfully', {
            sink: sink.name,
            type: sink.type,
            latency: latency.toFixed(2)
          });
          
        } catch (error) {
          const latency = performance.now() - sinkStartTime;
          
          // Обновление статистики
          this.updateStatistics(sink.name, false, latency);
          failCount++;
          
          this.logger.error('Error sending data to sink', {
            sink: sink.name,
            type: sink.type,
            error
          });
          
          // В Phase 1 просто логируем ошибку
          // В будущих фазах будет обработка failover
          if (this.config.failoverEnabled) {
            this.logger.warn('Failover would be implemented in Phase 2', {
              sink: sink.name
            });
          }
        }
      });

      await Promise.all(sendPromises);

      const totalTime = performance.now() - startTime;
      this.logger.debug('Data sent to all sinks', {
        type,
        sinkCount: sinksToUse.length,
        successCount,
        failCount,
        totalTime: totalTime.toFixed(2)
      });

    } catch (error) {
      this.logger.error('Error in sendToSinks', { type, error });
    }
  }

  /**
   * Обновление статистики
   */
  private updateStatistics(sinkName: string, success: boolean, latency: number): void {
    this.statistics.totalSent++;
    this.statistics.lastSent = Date.now();
    
    if (!success) {
      this.statistics.failed++;
    }
    
    // Обновление статистики для конкретного канала
    if (this.statistics.sinkStats[sinkName]) {
      const sinkStats = this.statistics.sinkStats[sinkName];
      sinkStats.sent++;
      
      if (!success) {
        sinkStats.failed++;
      }
      
      // Обновление средней задержки
      sinkStats.latency = (sinkStats.latency * (sinkStats.sent - 1) + latency) / sinkStats.sent;
    }
    
    // Обновление общей средней задержки
    this.statistics.averageLatency = 
      (this.statistics.averageLatency * (this.statistics.totalSent - 1) + latency) / 
      this.statistics.totalSent;
    
    // Обновление throughput (сообщений в секунду)
    const timeWindow = 10000; // 10 секунд
    const recentSent = this.statistics.totalSent; // Упрощённо
    this.statistics.throughput = (recentSent / timeWindow) * 1000;
  }

  /**
   * Очистка и освобождение ресурсов
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down OutputSinkManager...');
    
    try {
      // Завершение работы всех выходных каналов
      const shutdownPromises = Array.from(this.sinks.values()).map(
        sink => sink.shutdown().catch(error => {
          this.logger.error('Error shutting down sink', {
            sink: sink.name,
            error
          });
        })
      );
      
      await Promise.all(shutdownPromises);
      
      this.sinks.clear();
      this.isInitialized = false;
      
      this.logger.info('OutputSinkManager shutdown complete');
      
    } catch (error) {
      this.logger.error('Error during OutputSinkManager shutdown', { error });
      throw error;
    }
  }
}
