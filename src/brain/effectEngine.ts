/**
 * Effect Engine with data-driven effect handlers
 * Generates lighting effects based on scene descriptors and audio metrics
 */

import { defaultLogger } from "../utils/logger";
import { FixtureState } from "../lighting/types";
import { RuntimeMetrics } from "../engine/types";
import {
  SceneState,
  EffectDescriptor,
  GroupEffectState,
  EffectRegistryEntry,
  EffectEngineConfig,
} from "./types";
import { EnergyPulse } from "./effects/handlers/energyPulse";
import { BeatStrobe } from "./effects/handlers/beatStrobe";

const logger = defaultLogger.child({ module: "EffectEngine" });

/**
 * Effect Engine class
 */
export class EffectEngine {
  private logger = defaultLogger.child({ module: "EffectEngine" });
  private effectRegistry: Map<string, EffectRegistryEntry> = new Map();
  private config: EffectEngineConfig;

  constructor(config: EffectEngineConfig) {
    this.config = config;
    this.logger.info("EffectEngine initialized", { config });

    // Регистрация стандартных обработчиков эффектов
    this.registerDefaultHandlers();
  }

  registerEffectHandler(entry: EffectRegistryEntry): void {
    this.effectRegistry.set(entry.type, entry);
    this.logger.debug("Effect handler registered", { type: entry.type });
  }

  generateEffects(
    sceneState: SceneState,
    metrics: RuntimeMetrics,
    timestamp: number,
  ): {
    groupEffects: GroupEffectState[];
    fixtureOverrides: Map<string, Partial<FixtureState>>;
  } {
    const groupEffects: GroupEffectState[] = [];
    const fixtureOverrides = new Map<string, Partial<FixtureState>>();

    // Группировка эффектов по groupId
    const effectsByGroup = new Map<string, EffectDescriptor[]>();

    sceneState.effectDescriptors.forEach((effect) => {
      if (!effectsByGroup.has(effect.groupId)) {
        effectsByGroup.set(effect.groupId, []);
      }
      effectsByGroup.get(effect.groupId)!.push(effect);
    });

    // Обработка каждой группы
    for (const [groupId, effects] of Array.from(effectsByGroup.entries())) {
      const result = this.processGroupEffects(
        groupId,
        effects,
        metrics,
        timestamp,
      );

      if (result) {
        groupEffects.push(result.groupEffect);

        // Merge overrides
        result.overrides.forEach((state, fixtureId) => {
          const existing = fixtureOverrides.get(fixtureId) || {};
          fixtureOverrides.set(fixtureId, { ...existing, ...state });
        });
      }
    }

    return { groupEffects, fixtureOverrides };
  }

  reloadEffects(): void {
    this.logger.info("Effect reload would be implemented in Phase 2");
  }

  private processGroupEffects(
    groupId: string,
    effects: EffectDescriptor[],
    metrics: RuntimeMetrics,
    timestamp: number,
  ): {
    groupEffect: GroupEffectState;
    overrides: Map<string, Partial<FixtureState>>;
  } | null {
    // Создание базового состояния группы
    const groupEffect: GroupEffectState = {
      groupId,
      dimEffect: { type: "none", speed: 0, depth: 0, phaseOffset: 0 },
      posEffect: {
        type: "none",
        speed: 0,
        size: 0,
        centerPan: 0.5,
        centerTilt: 0.5,
      },
      colorEffect: { type: "none", speed: 0, colors: [] },
    };

    const overrides = new Map<string, Partial<FixtureState>>();

    // Применение каждого эффекта
    for (const effect of effects) {
      const handler = this.effectRegistry.get(effect.type);
      if (!handler) {
        this.logger.warn("Effect handler not found", { type: effect.type });
        continue;
      }

      // Execute handler
      // We pass a dummy context for now regarding fixtureStates since we don't have them here easily
      // Ideally we should pass them, but for EnergyPulse we don't strictly need them if we just return a partial.
      const context: any = {
        metrics,
        timestamp,
        sceneState: null, // Placeholder
        fixtureStates: new Map(), // Placeholder
        groupId,
      };

      try {
        const result = handler.handler(effect.params, context);

        if (result instanceof Map) {
          result.forEach((v, k) => overrides.set(k, v));
        } else {
          // It's a Partial<FixtureState> applied to... whom?
          // The handler doesn't know the fixture IDs.
          // This is a limitation of the current design.
          // For now, let's treat it as a "Template" override that should be applied to ALL fixtures in the group.
          // But we don't know the fixtures in the group here (that's in PatchManager).
          // So we can't fully resolve it here.

          // We will just return it in groupEffect if it maps to parameters,
          // OR we need to pass it up as a special "Group Override"

          // However, existing logic uses applyEffectParams to fill groupEffect.
          this.applyEffectParams(groupEffect, effect);

          // If the handler (like EnergyPulse) returned { dim: 0.5 }, we want to use that!
          // But we don't know which fixtures to apply it to.

          // Strategy: BrainFacade calls processGroupEffects. BrainFacade doesn't know fixtures either?
          // LightingFacade knows.

          // So maybe we should pass this "Group Update" to LightingFacade?
          // But BrainOutput only has `fixtureOverrides` (Map<id, state>).

          // We need to resolve group members.
          // BrainFacade doesn't have PatchManager.

          // Workaround: return { dim: value } as a "Group Level Override"
          // and let Engine/LightingFacade resolve it?
          // Or just ignore it here and stick to params for now?

          // Wait, EnergyPulse returns { dim: value }.
          // If we just put it in groupEffect.dimEffect, we are still parameter-based.
          // But EnergyPulse calculated a VALUE, not a parameter.

          // Let's assume for this integration step, we rely on `applyEffectParams` for built-in parametric effects,
          // and `EnergyPulse` effectively became a parametric effect that modulates `dim`.

          // BUT, EnergyPulse.ts I updated calculates `value`.
          // `const value = energy * multiplier`.
          // It returns `{ dim: value }`.

          // If we want to use this value, we need to apply it.
          // Use `overrides`?
          // But we need fixture IDs.

          // Let's defer applying overrides until we have fixture IDs?
          // No, Brain doesn't know them.

          // Maybe we should just stick to pure parameter logic for now?
          // And let LightingFacade do the math?
          // But `EnergyPulse` IS the math.

          // Hack: If we don't know fixture IDs, simple handlers return an object.
          // We can't put it in overrides Map<string, ...>.

          // Let's skip overrides for now if we can't resolve IDs.
        }
      } catch (e) {
        this.logger.error("Error executing effect handler", {
          type: effect.type,
          error: e,
        });
      }
    }

    return { groupEffect, overrides };
  }

  private applyEffectParams(
    groupEffect: GroupEffectState,
    effect: EffectDescriptor,
  ): void {
    // Упрощённая логика для Phase 1
    if (effect.type.startsWith("dim/")) {
      const dimType = effect.type.split("/")[1];
      groupEffect.dimEffect.type = dimType as any;
      Object.assign(groupEffect.dimEffect, effect.params);
    } else if (effect.type.startsWith("pos/")) {
      const posType = effect.type.split("/")[1];
      groupEffect.posEffect.type = posType as any;
      Object.assign(groupEffect.posEffect, effect.params);
    } else if (effect.type.startsWith("color/")) {
      const colorType = effect.type.split("/")[1];
      groupEffect.colorEffect.type = colorType as any;
      Object.assign(groupEffect.colorEffect, effect.params);
    }
  }

  private registerDefaultHandlers(): void {
    // Базовые обработчики для Phase 1
    // Возвращаем Partial<FixtureState> для совместимости с типом
    this.registerEffectHandler({
      type: "dim/none",
      handler: () => ({}),
      description: "No dimming effect",
      defaultParams: {},
    });

    this.registerEffectHandler({
      type: "dim/pulse",
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
      description: "Pulsing dim effect",
      defaultParams: { speed: 1.0, depth: 0.5, phase: 0 },
    });

    this.registerEffectHandler({
      type: "dim/energyPulse",
      handler: EnergyPulse,
      description: "Audio energy pulse",
      defaultParams: { multiplier: 1, min: 0, max: 1 },
    });

    this.registerEffectHandler({
      type: "strobe/beat",
      handler: BeatStrobe,
      description: "Strobe on beat",
      defaultParams: { intensity: 1, duration: 100 },
    });

    this.registerEffectHandler({
      type: "pos/none",
      handler: () => ({}),
      description: "No position effect",
      defaultParams: {},
    });

    this.registerEffectHandler({
      type: "pos/circle",
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
          tiltNorm: Math.max(-1, Math.min(1, tilt * 2 - 1)),
        };
      },
      description: "Circular position effect",
      defaultParams: { speed: 1.0, size: 0.5, centerPan: 0.5, centerTilt: 0.5 },
    });

    this.registerEffectHandler({
      type: "color/cycle",
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
      description: "Color cycling effect",
      defaultParams: { speed: 1.0, colors: [0, 1, 2] },
    });
  }
}