/**
 * BrainFacade - фасад для модуля Brain
 * Координирует State Machine, Scene Selector и Effect Engine
 * Реализует data-driven подход с конфигурационными файлами
 */

import { defaultLogger } from '../utils/logger';
import { ConfigLoader } from '../utils/config';
import { 
  BrainFacadeConfig, 
  BrainFacadeState, 
  BrainState, 
  SceneState, 
  SceneDefinition, 
  SceneRule, 
  EffectDescriptor,
  GroupEffectState,
  SceneHistory,
  EffectRegistryEntry,
  SceneSelectorConfig,
  EffectEngineConfig,
  StateMachineConfig
} from './types';
import { RuntimeMetrics } from '../engine/types';
import { BrainOutput } from '../engine/types';

/**
 * Упрощённая State Machine для Phase 1
 */
class StateMachine {
  private logger = defaultLogger.child({ module: 'StateMachine' });
  private currentState: BrainState = 'Idle';
  private lastStateChange = Date.now();
  private config: StateMachineConfig;

  constructor(config: StateMachineConfig) {
    this.config = config;
    this.logger.info('StateMachine initialized', { config });
  }

  update(audioMetrics: any, runtimeMetrics: RuntimeMetrics): BrainState {
    // Упрощённая логика для Phase 1
    const energy = audioMetrics.energy || 0;
    
    let newState = this.currentState;
    
    if (this.currentState === 'Idle' && energy > this.config.energyThresholdLow) {
      newState = 'Chill';
    } else if (this.currentState === 'Chill' && energy > this.config.energyThresholdHigh) {
      newState = 'Party';
    } else if (this.currentState === 'Party' && energy < this.config.energyThresholdHigh - this.config.hysteresis) {
      newState = 'Chill';
    } else if (this.currentState === 'Chill' && energy < this.config.energyThresholdLow - this.config.hysteresis) {
      newState = 'Idle';
    }
    
    if (newState !== this.currentState) {
      this.logger.info('State transition', { 
        from: this.currentState, 
        to: newState, 
        energy,
        timestamp: Date.now()
      });
      this.currentState = newState;
      this.lastStateChange = Date.now();
    }
    
    return this.currentState;
  }

  updateSlow(now: number): void {
    // В Phase 1 ничего не делаем
  }

  getState(): BrainState {
    return this.currentState;
  }

  getLastStateChange(): number {
    return this.lastStateChange;
  }
}

/**
 * Упрощённый Scene Selector для Phase 1 с data-driven правилами
 */
class SceneSelector {
  private logger = defaultLogger.child({ module: 'SceneSelector' });
  private scenes: Map<string, SceneDefinition> = new Map();
  private rules: SceneRule[] = [];
  private sceneHistory: SceneHistory[] = [];
  private config: SceneSelectorConfig;
  private currentSceneId: string;

  constructor(config: SceneSelectorConfig) {
    this.config = config;
    this.currentSceneId = config.defaultSceneId;
    this.logger.info('SceneSelector initialized', { config });
  }

  loadScenes(scenes: SceneDefinition[]): void {
    this.scenes.clear();
    scenes.forEach(scene => {
      this.scenes.set(scene.id, scene);
    });
    this.logger.info('Scenes loaded', { count: scenes.length });
  }

  loadRules(rules: SceneRule[]): void {
    this.rules = rules;
    this.logger.info('Scene rules loaded', { count: rules.length });
  }

  selectScene(
    brainState: BrainState,
    metrics: RuntimeMetrics,
    history: SceneHistory[]
  ): SceneState {
    // Фильтрация сцен по текущему состоянию
    const availableScenes = Array.from(this.scenes.values()).filter(
      scene => scene.allowedStates.includes(brainState)
    );

    if (availableScenes.length === 0) {
      this.logger.warn('No scenes available for brain state', { brainState });
      return this.createDefaultSceneState();
    }

    // Применение data-driven правил
    const applicableRules = this.rules.filter(rule => {
      const conditions = rule.conditions;
      
      // Проверка состояния
      if (conditions.brainState) {
        const allowedStates = Array.isArray(conditions.brainState) 
          ? conditions.brainState 
          : [conditions.brainState];
        if (!allowedStates.includes(brainState)) return false;
      }
      
      // Проверка энергии
      const energy = metrics.audio.energy || 0;
      if (conditions.energyMin !== undefined && energy < conditions.energyMin) return false;
      if (conditions.energyMax !== undefined && energy > conditions.energyMax) return false;
      
      // Проверка BPM
      const bpm = metrics.audio.bpm || 0;
      if (conditions.bpmMin !== undefined && bpm < conditions.bpmMin) return false;
      if (conditions.bpmMax !== undefined && bpm > conditions.bpmMax) return false;
      
      // Проверка настроения
      if (conditions.mood && metrics.audio.mood) {
        const allowedMoods = Array.isArray(conditions.mood) 
          ? conditions.mood 
          : [conditions.mood];
        if (!allowedMoods.includes(metrics.audio.mood)) return false;
      }
      
      // Проверка кулдауна
      if (rule.cooldown) {
        const lastActivation = history
          .filter(h => h.sceneId === rule.sceneId && h.endTime)
          .sort((a, b) => b.endTime! - a.endTime!)[0];
        
        if (lastActivation && Date.now() - lastActivation.endTime! < rule.cooldown) {
          return false;
        }
      }
      
      return true;
    });

    // Выбор сцены на основе правил или случайно
    let selectedSceneId: string = this.config.defaultSceneId;
    
    if (applicableRules.length > 0) {
      // Взвешенный случайный выбор на основе weight
      const totalWeight = applicableRules.reduce((sum, rule) => sum + rule.weight, 0);
      let random = Math.random() * totalWeight;
      
      for (const rule of applicableRules) {
        random -= rule.weight;
        if (random <= 0) {
          selectedSceneId = rule.sceneId;
          break;
        }
      }
    } else if (availableScenes.length > 0) {
      // Случайный выбор из доступных сцен
      const randomIndex = Math.floor(Math.random() * availableScenes.length);
      selectedSceneId = availableScenes[randomIndex].id;
    }

    // Получение определения сцены
    const sceneDef = this.scenes.get(selectedSceneId);
    if (!sceneDef) {
      this.logger.error('Selected scene not found', { sceneId: selectedSceneId });
      return this.createDefaultSceneState();
    }

    // Создание состояния сцены
    const sceneState: SceneState = {
      sceneId: sceneDef.id,
      paletteId: sceneDef.paletteId,
      baseIntensity: sceneDef.baseIntensity,
      effectDescriptors: sceneDef.effectDescriptors
    };

    // Обновление истории
    this.sceneHistory.push({
      sceneId: sceneDef.id,
      startTime: Date.now(),
      brainState,
      metrics
    });

    // Ограничение размера истории
    if (this.sceneHistory.length > this.config.historySize) {
      this.sceneHistory = this.sceneHistory.slice(-this.config.historySize);
    }

    this.currentSceneId = sceneDef.id;
    return sceneState;
  }

  updateSlow(now: number): void {
    // Обновление истории (завершение старых записей)
    const activeDuration = 30000; // 30 секунд активности
    this.sceneHistory.forEach(entry => {
      if (!entry.endTime && now - entry.startTime > activeDuration) {
        entry.endTime = now;
      }
    });
  }

  reloadScenes(): void {
    this.logger.info('Scene reload would be implemented in Phase 2');
  }

  private createDefaultSceneState(): SceneState {
    return {
      sceneId: 'default',
      paletteId: 'neutral',
      baseIntensity: 0.5,
      effectDescriptors: []
    };
  }
}

/**
 * Упрощённый Effect Engine для Phase 1 с data-driven эффектами
 */
class EffectEngine {
  private logger = defaultLogger.child({ module: 'EffectEngine' });
  private effectRegistry: Map<string, EffectRegistryEntry> = new Map();
  private config: EffectEngineConfig;

  constructor(config: EffectEngineConfig) {
    this.config = config;
    this.logger.info('EffectEngine initialized', { config });
    
    // Регистрация стандартных обработчиков эффектов
    this.registerDefaultHandlers();
  }

  registerEffectHandler(entry: EffectRegistryEntry): void {
    this.effectRegistry.set(entry.type, entry);
    this.logger.debug('Effect handler registered', { type: entry.type });
  }

  generateEffects(
    sceneState: SceneState,
    metrics: RuntimeMetrics,
    timestamp: number
  ): GroupEffectState[] {
    const groupEffects: GroupEffectState[] = [];
    
    // Группировка эффектов по groupId
    const effectsByGroup = new Map<string, EffectDescriptor[]>();
    
    sceneState.effectDescriptors.forEach(effect => {
      if (!effectsByGroup.has(effect.groupId)) {
        effectsByGroup.set(effect.groupId, []);
      }
      effectsByGroup.get(effect.groupId)!.push(effect);
    });
    
    // Обработка каждой группы
    for (const [groupId, effects] of effectsByGroup) {
      const groupEffect = this.processGroupEffects(groupId, effects, metrics, timestamp);
      if (groupEffect) {
        groupEffects.push(groupEffect);
      }
    }
    
    return groupEffects;
  }

  reloadEffects(): void {
    this.logger.info('Effect reload would be implemented in Phase 2');
  }

  private processGroupEffects(
    groupId: string,
    effects: EffectDescriptor[],
    metrics: RuntimeMetrics,
    timestamp: number
  ): GroupEffectState | null {
    // Создание базового состояния группы
    const groupEffect: GroupEffectState = {
      groupId,
      dimEffect: { type: 'none', speed: 0, depth: 0, phaseOffset: 0 },
      posEffect: { type: 'none', speed: 0, size: 0, centerPan: 0.5, centerTilt: 0.5 },
      colorEffect: { type: 'none', speed: 0, colors: [] }
    };
    
    // Применение каждого эффекта
    for (const effect of effects) {
      const handler = this.effectRegistry.get(effect.type);
      if (!handler) {
        this.logger.warn('Effect handler not found', { type: effect.type });
        continue;
      }
      
      // В Phase 1 просто применяем параметры напрямую
      // В будущих фазах будет реальная обработка через handler
      this.applyEffectParams(groupEffect, effect);
    }
    
    return groupEffect;
  }

  private applyEffectParams(
    groupEffect: GroupEffectState,
    effect: EffectDescriptor
  ): void {
    // Упрощённая логика для Phase 1
    if (effect.type.startsWith('dim/')) {
      const dimType = effect.type.split('/')[1];
      groupEffect.dimEffect.type = dimType as any;
      Object.assign(groupEffect.dimEffect, effect.params);
    } else if (effect.type.startsWith('pos/')) {
      const posType = effect.type.split('/')[1];
      groupEffect.posEffect.type = posType as any;
      Object.assign(groupEffect.posEffect, effect.params);
    } else if (effect.type.startsWith('color/')) {
      const colorType = effect.type.split('/')[1];
      groupEffect.colorEffect.type = colorType as any;
      Object.assign(groupEffect.colorEffect, effect.params);
    }
  }

  private registerDefaultHandlers(): void {
    // Базовые обработчики для Phase 1
    // Возвращаем Partial<FixtureState> для совместимости с типом
    this.registerEffectHandler({
      type: 'dim/none',
      handler: () => ({}),
      description: 'No dimming effect',
      defaultParams: {}
    });
    
    this.registerEffectHandler({
      type: 'dim/pulse',
      handler: (params) => {
        // Для Phase 1 возвращаем упрощённое состояние
        // В реальной реализации это будет вычислять dim на основе времени
        const time = Date.now() / 1000;
        const speed = params.speed || 1.0;
        const depth = params.depth || 0.5;
        const phase = params.phase || 0;
        
        // Простая пульсация синусом
        const dim = 0.5 + depth * Math.sin(time * speed * 2 * Math.PI + phase);
        
        return { dim: Math.max(0, Math.min(1, dim)) };
      },
      description: 'Pulsing dim effect',
      defaultParams: { speed: 1.0, depth: 0.5, phase: 0 }
    });
    
    this.registerEffectHandler({
      type: 'pos/none',
      handler: () => ({}),
      description: 'No position effect',
      defaultParams: {}
    });
    
    this.registerEffectHandler({
      type: 'pos/circle',
      handler: (params) => {
        // Для Phase 1 возвращаем упрощённое состояние
        // В реальной реализации это будет вычислять pan/tilt на основе времени
        const time = Date.now() / 1000;
        const speed = params.speed || 1.0;
        const size = params.size || 0.5;
        const centerPan = params.centerPan || 0.5;
        const centerTilt = params.centerTilt || 0.5;
        
        // Круговое движение
        const angle = time * speed * 2 * Math.PI;
        const pan = centerPan + size * Math.cos(angle);
        const tilt = centerTilt + size * Math.sin(angle);
        
        return {
          panNorm: Math.max(-1, Math.min(1, pan * 2 - 1)), // Конвертация 0..1 в -1..1
          tiltNorm: Math.max(-1, Math.min(1, tilt * 2 - 1))
        };
      },
      description: 'Circular position effect',
      defaultParams: { speed: 1.0, size: 0.5, centerPan: 0.5, centerTilt: 0.5 }
    });
    
    this.registerEffectHandler({
      type: 'color/cycle',
      handler: (params) => {
        // Для Phase 1 возвращаем упрощённое состояние
        // В реальной реализации это будет циклически менять colorIndex
        const time = Date.now() / 1000;
        const speed = params.speed || 1.0;
        const colors = params.colors || [0, 1, 2];
        
        // Циклический выбор цвета
        const colorIndex = Math.floor((time * speed) % colors.length);
        
        return { colorIndex: colors[colorIndex] || 0 };
      },
      description: 'Color cycling effect',
      defaultParams: { speed: 1.0, colors: [0, 1, 2] }
    });
  }
}

/**
 * BrainFacade - главный фасад модуля Brain
 */
export class BrainFacade {
  private logger = defaultLogger.child({ module: 'BrainFacade' });
  private stateMachine: StateMachine;
  private sceneSelector: SceneSelector;
  private effectEngine: EffectEngine;
  private config: BrainFacadeConfig;
  private state: BrainFacadeState;
  private configLoader: ConfigLoader;

  constructor(config: BrainFacadeConfig) {
    this.config = config;
    this.configLoader = new ConfigLoader();
    
    // Инициализация компонентов
    this.stateMachine = new StateMachine(config.stateMachine);
    this.sceneSelector = new SceneSelector(config.sceneSelector);
    this.effectEngine = new EffectEngine(config.effectEngine);
    
    // Инициализация состояния
    this.state = {
      currentBrainState: 'Idle',
      currentScene: {
        sceneId: 'default',
        paletteId: 'neutral',
        baseIntensity: 0.5,
        effectDescriptors: []
      },
      history: {
        brainStates: [],
        scenes: [],
        timestamps: []
      },
      lastStateChange: Date.now(),
      lastSceneChange: Date.now()
    };
    
    this.logger.info('BrainFacade initialized', { config });
  }

  /**
   * Основной метод обновления - вызывается в fast loop
   */
  update(metrics: RuntimeMetrics): BrainOutput {
    const startTime = performance.now();
    
    try {
      // 1. Обновление State Machine
      const brainState = this.stateMachine.update(metrics.audio, metrics);
      
      // 2. Выбор сцены (data-driven подход)
      const sceneState = this.sceneSelector.selectScene(
        brainState,
        metrics,
        this.state.history.scenes
      );
      
      // 3. Генерация эффектов через EffectEngine
      const groupEffects = this.effectEngine.generateEffects(
        sceneState,
        metrics,
        metrics.timestamp
      );
      
      // 4. Обновление истории
      this.updateHistory(brainState, sceneState.sceneId, metrics.timestamp);
      
      // 5. Обновление внутреннего состояния
      this.state.currentBrainState = brainState;
      this.state.currentScene = sceneState;
      
      const processingTime = performance.now() - startTime;
      this.logger.debug('Brain processing complete', {
        brainState,
        sceneId: sceneState.sceneId,
        effectCount: groupEffects.length,
        processingTime: processingTime.toFixed(2)
      });
      
      return {
        brainState,
        sceneState,
        groupEffects
      };
      
    } catch (error) {
      this.logger.error('Error in brain processing', { error });
      
      // Возврат безопасного состояния при ошибке
      return {
        brainState: this.state.currentBrainState,
        sceneState: this.state.currentScene,
        groupEffects: []
      };
    }
  }

  /**
   * Медленное обновление - вызывается в slow loop
   */
  updateSlow(now: number): void {
    try {
      this.stateMachine.updateSlow(now);
      this.sceneSelector.updateSlow(now);
      
      // Очистка старой истории
      this.cleanupHistory(now);
      
    } catch (error) {
      this.logger.error('Error in slow brain update', { error });
    }
  }

  /**
   * Перезагрузка конфигураций
   */
  async reloadConfigs(): Promise<void> {
    this.logger.info('Reloading brain configurations...');
    
    try {
      // В Phase 1 просто логируем
      // В будущих фазах будет реальная перезагрузка из файлов
      this.logger.info('Config reload would be implemented in Phase 2');
      
    } catch (error) {
      this.logger.error('Error reloading configs', { error });
    }
  }

  /**
   * Обновление истории
   */
  private updateHistory(brainState: BrainState, sceneId: string, timestamp: number): void {
    // Добавление записи о состоянии
    this.state.history.brainStates.push({
      state: brainState,
      timestamp
    });
    
    // Ограничение размера истории
    if (this.state.history.brainStates.length > 100) {
      this.state.history.brainStates = this.state.history.brainStates.slice(-100);
    }
    
    // Обновление времени последнего изменения
    if (brainState !== this.state.currentBrainState) {
      this.state.lastStateChange = timestamp;
    }
    
    if (sceneId !== this.state.currentScene.sceneId) {
      this.state.lastSceneChange = timestamp;
    }
  }

  /**
   * Очистка истории
   */
  private cleanupHistory(now: number): void {
    const maxAge = 5 * 60 * 1000; // 5 минут
    
    // Очистка истории состояний
    this.state.history.brainStates = this.state.history.brainStates.filter(
      entry => now - entry.timestamp < maxAge
    );
    
    // Очистка истории сцен
    this.state.history.scenes = this.state.history.scenes.filter(
      scene => now - scene.startTime < maxAge
    );
    
    // Очистка временных меток
    this.state.history.timestamps = this.state.history.timestamps.filter(
      ts => now - ts < maxAge
    );
  }

  /**
   * Получение текущего состояния BrainFacade
   */
  getState(): BrainFacadeState {
    return {
      ...this.state,
      history: {
        brainStates: [...this.state.history.brainStates],
        scenes: [...this.state.history.scenes],
        timestamps: [...this.state.history.timestamps]
      }
    };
  }

  /**
   * Получение текущего состояния мозга
   */
  getCurrentBrainState(): BrainState {
    return this.state.currentBrainState;
  }

  /**
   * Получение текущей сцены
   */
  getCurrentScene(): SceneState {
    return { ...this.state.currentScene };
  }

  /**
   * Принудительная установка состояния (для тестирования)
   */
  setBrainState(state: BrainState): void {
    this.state.currentBrainState = state;
    this.state.lastStateChange = Date.now();
    this.logger.info('Brain state manually set', { state });
  }

  /**
   * Принудительная установка сцены (для тестирования)
   */
  setScene(sceneId: string): void {
    // В Phase 1 просто логируем
    // В будущих фазах будет загрузка сцены из конфигурации
    this.logger.info('Scene manually set', { sceneId });
  }
}

