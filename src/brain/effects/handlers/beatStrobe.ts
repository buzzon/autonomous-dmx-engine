import { EffectHandler, EffectContext } from "../../types";
import { FixtureState } from "../../../lighting/types";

export const BeatStrobe: EffectHandler = (params, context) => {
  const isBeat = context.metrics.audio.beat;
  const intensity = params.intensity || 1.0; // Strobe speed/intensity
  const duration = params.duration || 100; // ms

  // Simple beat flash
  // Ideally we need state to handle duration decay, but handlers are stateless functions in this design (mostly).
  // If we want decay, we need to use closure or state passed in (which isn't in arguments).
  // So for now, pure beat trigger.

  if (isBeat) {
    return {
      strobe: intensity,
      dim: 1.0, // Ensure visible
    };
  }

  return {
    strobe: 0,
  };
};
