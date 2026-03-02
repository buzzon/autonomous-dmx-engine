/**
 * Scene Selector with data-driven rules
 * Selects scenes based on brain state, audio metrics, and configurable rules
 */

import { defaultLogger } from "../utils/logger";
import { RuntimeMetrics } from "../engine/types";
import {
  BrainState,
  SceneState,
  SceneDefinition,
  SceneRule,
  SceneHistory,
  SceneSelectorConfig,
} from "./types";

const logger = defaultLogger.child({ module: "SceneSelector" });

/**
 * Scene Selector class
 */
export class SceneSelector {
  private logger = defaultLogger.child({ module: "SceneSelector" });
  private scenes: Map<string, SceneDefinition> = new Map();
  private rules: SceneRule[] = [];
  private sceneHistory: SceneHistory[] = [];
  private config: SceneSelectorConfig;
  private currentSceneId: string;

  constructor(config: SceneSelectorConfig) {
    this.config = config;
    this.currentSceneId = config.defaultSceneId;
    this.logger.info("SceneSelector initialized", { config });
  }

  loadScenes(scenes: SceneDefinition[]): void {
    this.scenes.clear();
    scenes.forEach((scene) => {
      this.scenes.set(scene.id, scene);
    });
    this.logger.info("Scenes loaded", { count: scenes.length });
  }

  loadRules(rules: SceneRule[]): void {
    this.rules = rules;
    this.logger.info("Scene rules loaded", { count: rules.length });
  }

  selectScene(
    brainState: BrainState,
    metrics: RuntimeMetrics,
    history: SceneHistory[],
  ): SceneState {
    // Фильтрация сцен по текущему состоянию
    const availableScenes = Array.from(this.scenes.values()).filter((scene) =>
      scene.allowedStates.includes(brainState),
    );

    if (availableScenes.length === 0) {
      this.logger.warn("No scenes available for brain state", { brainState });
      return this.createDefaultSceneState();
    }

    // Применение data-driven правил
    const applicableRules = this.rules.filter((rule) => {
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
      if (conditions.energyMin !== undefined && energy < conditions.energyMin)
        return false;
      if (conditions.energyMax !== undefined && energy > conditions.energyMax)
        return false;

      // Проверка BPM
      const bpm = metrics.audio.bpm || 0;
      if (conditions.bpmMin !== undefined && bpm < conditions.bpmMin)
        return false;
      if (conditions.bpmMax !== undefined && bpm > conditions.bpmMax)
        return false;

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
          .filter((h) => h.sceneId === rule.sceneId && h.endTime)
          .sort((a, b) => b.endTime! - a.endTime!)[0];

        if (
          lastActivation &&
          Date.now() - lastActivation.endTime! < rule.cooldown
        ) {
          return false;
        }
      }

      return true;
    });

    // Выбор сцены на основе правил или случайно
    let selectedSceneId: string = this.config.defaultSceneId;

    if (applicableRules.length > 0) {
      // Взвешенный случайный выбор на основе weight
      const totalWeight = applicableRules.reduce(
        (sum, rule) => sum + rule.weight,
        0,
      );
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
      this.logger.error("Selected scene not found", {
        sceneId: selectedSceneId,
      });
      return this.createDefaultSceneState();
    }

    // Создание состояния сцены
    const sceneState: SceneState = {
      sceneId: sceneDef.id,
      paletteId: sceneDef.paletteId,
      baseIntensity: sceneDef.baseIntensity,
      effectDescriptors: sceneDef.effectDescriptors,
    };

    // Обновление истории
    this.sceneHistory.push({
      sceneId: sceneDef.id,
      startTime: Date.now(),
      brainState,
      metrics,
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
    this.sceneHistory.forEach((entry) => {
      if (!entry.endTime && now - entry.startTime > activeDuration) {
        entry.endTime = now;
      }
    });
  }

  reloadScenes(): void {
    this.logger.info("Scene reload would be implemented in Phase 2");
  }

  private createDefaultSceneState(): SceneState {
    return {
      sceneId: "default",
      paletteId: "neutral",
      baseIntensity: 0.5,
      effectDescriptors: [],
    };
  }
}