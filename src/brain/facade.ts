/**
 * BrainFacade - фасад для модуля Brain
 * Координирует State Machine, Scene Selector и Effect Engine
 * Реализует data-driven подход с конфигурационными файлами
 */

import { defaultLogger } from "../utils/logger";
import { ConfigLoader } from "../utils/config";
import { FixtureState } from "../lighting/types";
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
  StateMachineConfig,
} from "./types";
import { RuntimeMetrics } from "../engine/types";
import { BrainOutput } from "../engine/types";
import { EnergyPulse } from "./effects/handlers/energyPulse";
import { BeatStrobe } from "./effects/handlers/beatStrobe";
import { SceneSelector } from "./sceneSelector";
import { EffectEngine } from "./effectEngine";

/**
 * Упрощённая State Machine для Phase 1
 */
class StateMachine {
  private logger = defaultLogger.child({ module: "StateMachine" });
  private currentState: BrainState = "Idle";
  private lastStateChange = Date.now();
  private config: StateMachineConfig;

  constructor(config: StateMachineConfig) {
    this.config = config;
    this.logger.info("StateMachine initialized", { config });
  }

  update(audioMetrics: any, runtimeMetrics: RuntimeMetrics): BrainState {
    // Упрощённая логика для Phase 1
    const energy = audioMetrics.energy || 0;

    let newState = this.currentState;

    if (
      this.currentState === "Idle" &&
      energy > this.config.energyThresholdLow
    ) {
      newState = "Chill";
    } else if (
      this.currentState === "Chill" &&
      energy > this.config.energyThresholdHigh
    ) {
      newState = "Party";
    } else if (
      this.currentState === "Party" &&
      energy < this.config.energyThresholdHigh - this.config.hysteresis
    ) {
      newState = "Chill";
    } else if (
      this.currentState === "Chill" &&
      energy < this.config.energyThresholdLow - this.config.hysteresis
    ) {
      newState = "Idle";
    }

    if (newState !== this.currentState) {
      this.logger.info("State transition", {
        from: this.currentState,
        to: newState,
        energy,
        timestamp: Date.now(),
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
 * BrainFacade - главный фасад модуля Brain
 */
export class BrainFacade {
  private logger = defaultLogger.child({ module: "BrainFacade" });
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
      currentBrainState: "Idle",
      currentScene: {
        sceneId: "default",
        paletteId: "neutral",
        baseIntensity: 0.5,
        effectDescriptors: [],
      },
      history: {
        brainStates: [],
        scenes: [],
        timestamps: [],
      },
      lastStateChange: Date.now(),
      lastSceneChange: Date.now(),
    };

    this.logger.info("BrainFacade initialized", { config });
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
        this.state.history.scenes,
      );

      // 3. Генерация эффектов через EffectEngine
      const { groupEffects, fixtureOverrides } =
        this.effectEngine.generateEffects(
          sceneState,
          metrics,
          metrics.timestamp,
        );

      // 4. Обновление истории
      this.updateHistory(brainState, sceneState.sceneId, metrics.timestamp);

      // 5. Обновление внутреннего состояния
      this.state.currentBrainState = brainState;
      this.state.currentScene = sceneState;

      const processingTime = performance.now() - startTime;
      this.logger.debug("Brain processing complete", {
        brainState,
        sceneId: sceneState.sceneId,
        effectCount: groupEffects.length,
        overrideCount: fixtureOverrides.size,
        processingTime: processingTime.toFixed(2),
      });

      return {
        brainState,
        sceneState,
        groupEffects,
        fixtureOverrides,
      };
    } catch (error) {
      this.logger.error("Error in brain processing", { error });

      // Возврат безопасного состояния при ошибке
      return {
        brainState: this.state.currentBrainState,
        sceneState: this.state.currentScene,
        groupEffects: [],
        fixtureOverrides: new Map(),
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
      this.logger.error("Error in slow brain update", { error });
    }
  }

  /**
   * Перезагрузка конфигураций
   */
  async reloadConfigs(): Promise<void> {
    this.logger.debug("Reloading brain configurations...");

    try {
      // В Phase 1 просто логируем
      // В будущих фазах будет реальная перезагрузка из файлов
      this.logger.debug("Config reload would be implemented in Phase 2");
    } catch (error) {
      this.logger.error("Error reloading configs", { error });
    }
  }

  /**
   * Обновление истории
   */
  private updateHistory(
    brainState: BrainState,
    sceneId: string,
    timestamp: number,
  ): void {
    // Добавление записи о состоянии
    this.state.history.brainStates.push({
      state: brainState,
      timestamp,
    });

    // Ограничение размера истории
    if (this.state.history.brainStates.length > 100) {
      this.state.history.brainStates =
        this.state.history.brainStates.slice(-100);
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
      (entry) => now - entry.timestamp < maxAge,
    );

    // Очистка истории сцен
    this.state.history.scenes = this.state.history.scenes.filter(
      (scene) => now - scene.startTime < maxAge,
    );

    // Очистка временных меток
    this.state.history.timestamps = this.state.history.timestamps.filter(
      (ts) => now - ts < maxAge,
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
        timestamps: [...this.state.history.timestamps],
      },
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
    this.logger.info("Brain state manually set", { state });
  }

  /**
   * Принудительная установка сцены (для тестирования)
   */
  setScene(sceneId: string): void {
    // В Phase 1 просто логируем
    // В будущих фазах будет загрузка сцены из конфигурации
    this.logger.info("Scene manually set", { sceneId });
  }
}
