/**
 * PluginManager - менеджер плагинов
 * Управляет загрузкой, инициализацией и жизненным циклом плагинов
 * Реализует расширяемую архитектуру для Phase 1
 */

import { defaultLogger } from '../utils/logger';
import { 
  Plugin,
  PluginManifest,
  PluginContext,
  PluginConfig,
  PluginManagerConfig,
  PluginLoadResult,
  PluginHealth,
  PluginState,
  PluginLifecycleState,
  BuiltinPluginType,
  BuiltinPluginConfig
} from './types';
import { MetricSourceManager } from '../metrics/manager';
import { OutputSinkManager } from '../outputs/manager';

/**
 * Менеджер плагинов
 */
export class PluginManager {
  private logger = defaultLogger.child({ module: 'PluginManager' });
  private plugins: Map<string, Plugin> = new Map();
  private pluginStates: Map<string, PluginState> = new Map();
  private pluginConfigs: Map<string, PluginConfig> = new Map();
  private config: PluginManagerConfig;
  private metricSourceManager?: MetricSourceManager;
  private outputSinkManager?: OutputSinkManager;
  private isInitialized = false;

  constructor(config: PluginManagerConfig) {
    this.config = config;
    this.logger.info('PluginManager initialized', { config });
  }

  /**
   * Инициализация менеджера
   */
  async initialize(
    metricSourceManager?: MetricSourceManager,
    outputSinkManager?: OutputSinkManager
  ): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn('PluginManager is already initialized');
      return;
    }

    try {
      this.logger.info('Initializing PluginManager...');
      
      // Сохранение ссылок на менеджеры
      this.metricSourceManager = metricSourceManager;
      this.outputSinkManager = outputSinkManager;
      
      // В Phase 1 загружаем только встроенные плагины
      // В будущих фазах будет загрузка из директории
      await this.loadBuiltinPlugins();
      
      this.isInitialized = true;
      this.logger.info('PluginManager initialized successfully', {
        pluginCount: this.plugins.size
      });
      
    } catch (error) {
      this.logger.error('Error initializing PluginManager', { error });
      throw error;
    }
  }

  /**
   * Загрузка плагина
   */
  async loadPlugin(pluginPath: string): Promise<PluginLoadResult> {
    const startTime = performance.now();
    
    try {
      this.logger.info('Loading plugin', { path: pluginPath });
      
      // В Phase 1 просто логируем
      // В будущих фазах будет реальная загрузка из файла
      this.logger.info('Plugin loading would be implemented in Phase 2', { path: pluginPath });
      
      const loadTime = performance.now() - startTime;
      
      return {
        plugin: null as any, // В Phase 1 возвращаем null
        manifest: null as any,
        loaded: false,
        error: 'Plugin loading not implemented in Phase 1',
        loadTime
      };
      
    } catch (error) {
      const loadTime = performance.now() - startTime;
      
      this.logger.error('Error loading plugin', { path: pluginPath, error });
      
      return {
        plugin: null as any,
        manifest: null as any,
        loaded: false,
        error: error instanceof Error ? error.message : String(error),
        loadTime
      };
    }
  }

  /**
   * Регистрация плагина
   */
  async registerPlugin(plugin: Plugin, config: PluginConfig): Promise<void> {
    const pluginId = plugin.manifest.id;
    
    if (this.plugins.has(pluginId)) {
      this.logger.warn('Plugin already registered', { pluginId });
      return;
    }
    
    try {
      this.logger.info('Registering plugin', { 
        pluginId,
        name: plugin.manifest.name,
        version: plugin.manifest.version
      });
      
      // Сохранение плагина и конфигурации
      this.plugins.set(pluginId, plugin);
      this.pluginConfigs.set(pluginId, config);
      
      // Инициализация состояния плагина
      this.pluginStates.set(pluginId, {
        pluginId,
        state: 'loaded',
        since: Date.now(),
        metrics: {
          loadCount: 1,
          errorCount: 0,
          totalUptime: 0,
          lastLoadTime: Date.now()
        }
      });
      
      // Если плагин должен запускаться автоматически
      if (config.autoStart && config.enabled) {
        await this.enablePlugin(pluginId);
      }
      
      this.logger.info('Plugin registered successfully', { pluginId });
      
    } catch (error) {
      this.logger.error('Error registering plugin', { pluginId, error });
      throw error;
    }
  }

  /**
   * Включение плагина
   */
  async enablePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    const config = this.pluginConfigs.get(pluginId);
    const state = this.pluginStates.get(pluginId);
    
    if (!plugin || !config || !state) {
      this.logger.error('Plugin not found', { pluginId });
      throw new Error(`Plugin not found: ${pluginId}`);
    }
    
    if (!config.enabled) {
      this.logger.error('Plugin is disabled in configuration', { pluginId });
      throw new Error(`Plugin is disabled: ${pluginId}`);
    }
    
    try {
      this.logger.info('Enabling plugin', { pluginId });
      
      // Обновление состояния
      state.state = 'enabling';
      this.pluginStates.set(pluginId, state);
      
      // Создание контекста плагина
      const context = this.createPluginContext(pluginId);
      
      // Инициализация плагина
      await plugin.initialize(context);
      
      // Вызов хука onEnable если есть
      if (plugin.onEnable) {
        await plugin.onEnable();
      }
      
      // Обновление состояния
      state.state = 'enabled';
      state.since = Date.now();
      this.pluginStates.set(pluginId, state);
      
      this.logger.info('Plugin enabled successfully', { pluginId });
      
    } catch (error) {
      // Обновление состояния при ошибке
      if (state) {
        state.state = 'error';
        state.error = error instanceof Error ? error.message : String(error);
        state.metrics.errorCount++;
        this.pluginStates.set(pluginId, state);
      }
      
      this.logger.error('Error enabling plugin', { pluginId, error });
      throw error;
    }
  }

  /**
   * Отключение плагина
   */
  async disablePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    const state = this.pluginStates.get(pluginId);
    
    if (!plugin || !state) {
      this.logger.error('Plugin not found', { pluginId });
      throw new Error(`Plugin not found: ${pluginId}`);
    }
    
    if (state.state !== 'enabled') {
      this.logger.warn('Plugin is not enabled', { pluginId, state: state.state });
      return;
    }
    
    try {
      this.logger.info('Disabling plugin', { pluginId });
      
      // Обновление состояния
      state.state = 'disabling';
      this.pluginStates.set(pluginId, state);
      
      // Вызов хука onDisable если есть
      if (plugin.onDisable) {
        await plugin.onDisable();
      }
      
      // Завершение работы плагина
      await plugin.shutdown();
      
      // Обновление состояния и метрик
      state.state = 'disabled';
      state.metrics.totalUptime += Date.now() - state.since;
      this.pluginStates.set(pluginId, state);
      
      this.logger.info('Plugin disabled successfully', { pluginId });
      
    } catch (error) {
      // Обновление состояния при ошибке
      state.state = 'error';
      state.error = error instanceof Error ? error.message : String(error);
      state.metrics.errorCount++;
      this.pluginStates.set(pluginId, state);
      
      this.logger.error('Error disabling plugin', { pluginId, error });
      throw error;
    }
  }

  /**
   * Удаление плагина
   */
  async unregisterPlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    const state = this.pluginStates.get(pluginId);
    
    if (!plugin) {
      this.logger.warn('Plugin not found', { pluginId });
      return;
    }
    
    try {
      this.logger.info('Unregistering plugin', { pluginId });
      
      // Отключение плагина если он включен
      if (state && state.state === 'enabled') {
        await this.disablePlugin(pluginId);
      }
      
      // Удаление плагина
      this.plugins.delete(pluginId);
      this.pluginConfigs.delete(pluginId);
      this.pluginStates.delete(pluginId);
      
      this.logger.info('Plugin unregistered successfully', { pluginId });
      
    } catch (error) {
      this.logger.error('Error unregistering plugin', { pluginId, error });
      throw error;
    }
  }

  /**
   * Получение плагина по ID
   */
  getPlugin(pluginId: string): Plugin | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * Получение состояния плагина
   */
  getPluginState(pluginId: string): PluginState | undefined {
    return this.pluginStates.get(pluginId);
  }

  /**
   * Получение всех зарегистрированных плагинов
   */
  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Получение всех состояний плагинов
   */
  getAllPluginStates(): PluginState[] {
    return Array.from(this.pluginStates.values());
  }

  /**
   * Проверка здоровья всех плагинов
   */
  async checkHealth(): Promise<PluginHealth[]> {
    const healthChecks: PluginHealth[] = [];
    
    for (const [pluginId, plugin] of this.plugins) {
      const state = this.pluginStates.get(pluginId);
      
      if (!state) {
        healthChecks.push({
          pluginId,
          healthy: false,
          lastCheck: Date.now(),
          error: 'Plugin state not found',
          metrics: {
            loadTime: 0,
            memoryUsage: 0,
            uptime: 0
          }
        });
        continue;
      }
      
      try {
        // В Phase 1 простая проверка
        // В будущих фазах будет реальная проверка здоровья
        const healthy = state.state === 'enabled' || state.state === 'disabled';
        
        healthChecks.push({
          pluginId,
          healthy,
          lastCheck: Date.now(),
          metrics: {
            loadTime: state.metrics.lastLoadTime,
            memoryUsage: 0, // В Phase 1 не измеряем
            uptime: state.metrics.totalUptime
          }
        });
        
      } catch (error) {
        healthChecks.push({
          pluginId,
          healthy: false,
          lastCheck: Date.now(),
          error: error instanceof Error ? error.message : String(error),
          metrics: {
            loadTime: state.metrics.lastLoadTime,
            memoryUsage: 0,
            uptime: state.metrics.totalUptime
          }
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
   * Загрузка встроенных плагинов для Phase 1
   */
  private async loadBuiltinPlugins(): Promise<void> {
    // В Phase 1 создаём mock встроенные плагины
    // В будущих фазах будут реальные плагины
    
    const coreAudioPlugin: Plugin = {
      manifest: {
        id: 'core-audio',
        name: 'Core Audio Plugin',
        version: '1.0.0',
        description: 'Core audio processing plugin',
        author: 'Autonomous DMX Engine',
        license: 'MIT',
        provides: {
          metricSources: ['audio'],
          effectHandlers: ['audio-reactive']
        },
        engineVersion: '1.0.0',
        apiVersion: '1.0.0'
      },
      
      initialize: async (context: PluginContext): Promise<void> => {
        this.logger.debug('Core audio plugin initialized', { context });
      },
      
      shutdown: async (): Promise<void> => {
        this.logger.debug('Core audio plugin shutdown');
      }
    };

    const coreDMXPlugin: Plugin = {
      manifest: {
        id: 'core-dmx',
        name: 'Core DMX Plugin',
        version: '1.0.0',
        description: 'Core DMX output plugin',
        author: 'Autonomous DMX Engine',
        license: 'MIT',
        provides: {
          outputSinks: ['dmx']
        },
        engineVersion: '1.0.0',
        apiVersion: '1.0.0'
      },
      
      initialize: async (context: PluginContext): Promise<void> => {
        this.logger.debug('Core DMX plugin initialized', { context });
      },
      
      shutdown: async (): Promise<void> => {
        this.logger.debug('Core DMX plugin shutdown');
      }
    };

    const coreMetricsPlugin: Plugin = {
      manifest: {
        id: 'core-metrics',
        name: 'Core Metrics Plugin',
        version: '1.0.0',
        description: 'Core metrics collection plugin',
        author: 'Autonomous DMX Engine',
        license: 'MIT',
        provides: {
          metricSources: ['system', 'performance']
        },
        engineVersion: '1.0.0',
        apiVersion: '1.0.0'
      },
      
      initialize: async (context: PluginContext): Promise<void> => {
        this.logger.debug('Core metrics plugin initialized', { context });
      },
      
      shutdown: async (): Promise<void> => {
        this.logger.debug('Core metrics plugin shutdown');
      }
    };

    // Регистрация встроенных плагинов
    await this.registerPlugin(coreAudioPlugin, {
      enabled: true,
      config: {},
      autoStart: true,
      hotReload: false
    });

    await this.registerPlugin(coreDMXPlugin, {
      enabled: true,
      config: {},
      autoStart: true,
      hotReload: false
    });

    await this.registerPlugin(coreMetricsPlugin, {
      enabled: true,
      config: {},
      autoStart: true,
      hotReload: false
    });

    this.logger.info('Built-in plugins registered', {
      count: 3
    });
  }

  /**
   * Создание контекста плагина
   */
  private createPluginContext(pluginId: string): PluginContext {
    return {
      metricSourceManager: this.metricSourceManager,
      outputSinkManager: this.outputSinkManager,
      effectRegistry: null, // В Phase 1 не реализовано
      sceneRuleRegistry: null, // В Phase 1 не реализовано
      fixtureProfileRegistry: null, // В Phase 1 не реализовано
      
      config: this.pluginConfigs.get(pluginId)?.config || {},
      
      logger: defaultLogger.child({ plugin: pluginId }),
      
      events: {
        emit: (event: string, data?: any) => {
          this.logger.debug('Plugin event', { pluginId, event, data });
        }
      },
      
      api: {
        registerMetricSource: (name: string, source: any) => {
          this.logger.info('Plugin registering metric source', { pluginId, name });
          // В Phase 1 просто логируем
          // В будущих фазах будет реальная регистрация
        },
        
        registerOutputSink: (name: string, sink: any) => {
          this.logger.info('Plugin registering output sink', { pluginId, name });
          // В Phase 1 просто логируем
          // В будущих фазах будет реальная регистрация
        },
        
        registerEffectHandler: (type: string, handler: any) => {
          this.logger.info('Plugin registering effect handler', { pluginId, type });
          // В Phase 1 просто логируем
          // В будущих фазах будет реальная регистрация
        },
        
        registerSceneRule: (rule: any) => {
          this.logger.info('Plugin registering scene rule', { pluginId });
          // В Phase 1 просто логируем
          // В будущих фазах будет реальная регистрация
        },
        
        registerFixtureProfile: (profile: any) => {
          this.logger.info('Plugin registering fixture profile', { pluginId });
          // В Phase 1 просто логируем
          // В будущих фазах будет реальная регистрация
        },
        
        registerColorPalette: (palette: any) => {
          this.logger.info('Plugin registering color palette', { pluginId });
          // В Phase 1 просто логируем
          // В будущих фазах будет реальная регистрация
        },
        
        registerStyle: (style: any) => {
          this.logger.info('Plugin registering style', { pluginId });
          // В Phase 1 просто логируем
          // В будущих фазах будет реальная регистрация
        },
        
        getConfig: () => {
          return this.pluginConfigs.get(pluginId)?.config || {};
        },
        
        setConfig: (config: any) => {
          const pluginConfig = this.pluginConfigs.get(pluginId);
          if (pluginConfig) {
            pluginConfig.config = config;
            this.pluginConfigs.set(pluginId, pluginConfig);
            
            // Вызов хука onConfigChange если есть
            const plugin = this.plugins.get(pluginId);
            if (plugin && plugin.onConfigChange) {
              plugin.onConfigChange(config).catch(error => {
                this.logger.error('Error in plugin onConfigChange', { pluginId, error });
              });
            }
          }
        },
        
        log: (level: string, message: string, data?: any) => {
          const logger = defaultLogger.child({ plugin: pluginId });
          switch (level) {
            case 'debug':
              logger.debug(message, data);
              break;
            case 'info':
              logger.info(message, data);
              break;
            case 'warn':
              logger.warn(message, data);
              break;
            case 'error':
              logger.error(message, data);
              break;
            default:
              logger.info(message, data);
          }
        },
        
        emit: (event: string, data?: any) => {
          this.logger.debug('Plugin event emitted', { pluginId, event, data });
          // В Phase 1 просто логируем
          // В будущих фазах будет реальная система событий
        }
      }
    };
  }

  /**
   * Очистка и освобождение ресурсов
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down PluginManager...');
    
    try {
      // Отключение всех плагинов
      const disablePromises = Array.from(this.plugins.keys()).map(
        pluginId => this.disablePlugin(pluginId).catch(error => {
          this.logger.error('Error disabling plugin during shutdown', {
            pluginId,
            error
          });
        })
      );
      
      await Promise.all(disablePromises);
      
      this.plugins.clear();
      this.pluginConfigs.clear();
      this.pluginStates.clear();
      this.isInitialized = false;
      
      this.logger.info('PluginManager shutdown complete');
      
    } catch (error) {
      this.logger.error('Error during PluginManager shutdown', { error });
      throw error;
    }
  }

  /**
   * Обновление конфигурации плагина
   */
  async updatePluginConfig(pluginId: string, config: any): Promise<void> {
    const pluginConfig = this.pluginConfigs.get(pluginId);
    if (!pluginConfig) {
      this.logger.error('Plugin config not found', { pluginId });
      throw new Error(`Plugin config not found: ${pluginId}`);
    }
    
    try {
      this.logger.info('Updating plugin config', { pluginId });
      
      // Обновление конфигурации
      pluginConfig.config = config;
      this.pluginConfigs.set(pluginId, pluginConfig);
      
      // Вызов хука onConfigChange если плагин включен
      const plugin = this.plugins.get(pluginId);
      const state = this.pluginStates.get(pluginId);
      
      if (plugin && plugin.onConfigChange && state && state.state === 'enabled') {
        await plugin.onConfigChange(config);
      }
      
      this.logger.info('Plugin config updated successfully', { pluginId });
      
    } catch (error) {
      this.logger.error('Error updating plugin config', { pluginId, error });
      throw error;
    }
  }

  /**
   * Получение конфигурации плагина
   */
  getPluginConfig(pluginId: string): PluginConfig | undefined {
    return this.pluginConfigs.get(pluginId);
  }

  /**
   * Получение манифеста плагина
   */
  getPluginManifest(pluginId: string): PluginManifest | undefined {
    const plugin = this.plugins.get(pluginId);
    return plugin?.manifest;
  }

  /**
   * Проверка зависимости плагинов
   */
  checkDependencies(pluginId: string): { satisfied: boolean; missing: string[] } {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return { satisfied: false, missing: [`Plugin ${pluginId} not found`] };
    }
    
    const missing: string[] = [];
    
    // Проверка зависимостей
    if (plugin.manifest.dependencies) {
      for (const dep of plugin.manifest.dependencies) {
        const depPlugin = this.plugins.get(dep);
        const depState = this.pluginStates.get(dep);
        
        if (!depPlugin || !depState || depState.state !== 'enabled') {
          missing.push(dep);
        }
      }
    }
    
    return {
      satisfied: missing.length === 0,
      missing
    };
  }
}