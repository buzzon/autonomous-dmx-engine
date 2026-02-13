import { EffectHandler, EffectContext } from "../../types";
import { FixtureState } from "../../../lighting/types";

export const EnergyPulse: EffectHandler = (params, context) => {
  const energy = context.metrics.audio.energy || 0;
  const multiplier = params.multiplier || 1.0;
  const min = params.min || 0;
  const max = params.max || 1.0;
  const invert = params.invert || false;

  let value = energy * multiplier;

  if (invert) {
    value = 1.0 - value;
  }

  // Clamp
  value = Math.max(min, Math.min(max, value));

  const result = new Map<string, Partial<FixtureState>>();

  // Apply to all fixtures in the group
  // Context fixtureStates contains all fixtures, we need to filter by group?
  // Actually context.groupId tells us which group this effect applies to.
  // We should iterate over fixtures in that group.
  // But context.fixtureStates is a Map of ALL states.
  // Unlike the renderer, we don't have direct access to PatchManager here to look up group members easily
  // unless we pass them or iterate all and check group (if state had group, but it doesn't).

  // Wait, EffectContext has:
  // fixtureStates: Map<string, FixtureState>;
  // groupId: string;

  // We assume the caller (EffectEngine) handles group filtering or we need to know which fixtures are in the group.
  // Looking at Brain architecture, usually EffectEngine applies effect to a group.
  // If the handler returns a Map, it specifies which fixtures to update.
  // If it returns a single Partial<FixtureState>, maybe it applies to all?

  // Let's assume for now we apply to all fixtures passed in context (if context is scoped)
  // OR we simply return a state that the engine applies to the group.

  // Based on the type definition:
  // => Partial<FixtureState> | Map<string, Partial<FixtureState>>

  // If we return Partial<FixtureState>, the engine likely applies it to all fixtures in the target group.

  return {
    dim: value,
  };
};
