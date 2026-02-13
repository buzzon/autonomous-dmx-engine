"use strict";

// src/brain/effects/handlers/energyPulse.ts
var EnergyPulse = (params, context) => {
  const energy = context.metrics.audio.energy || 0;
  const multiplier = params.multiplier || 1;
  const min = params.min || 0;
  const max = params.max || 1;
  const invert = params.invert || false;
  let value = energy * multiplier;
  if (invert) {
    value = 1 - value;
  }
  value = Math.max(min, Math.min(max, value));
  const result = /* @__PURE__ */ new Map();
  return {
    dim: value
  };
};

// src/brain/effects/handlers/beatStrobe.ts
var BeatStrobe = (params, context) => {
  const isBeat = context.metrics.audio.beat;
  const intensity = params.intensity || 1;
  const duration = params.duration || 100;
  if (isBeat) {
    return {
      strobe: intensity,
      dim: 1
      // Ensure visible
    };
  }
  return {
    strobe: 0
  };
};

// tests/manual/effects_check.ts
console.log("Testing Effects manually...");
var mockContext = {
  metrics: {
    audio: {
      energy: 0.8,
      beat: false
    }
  }
};
try {
  const res1 = EnergyPulse({ multiplier: 1 }, mockContext);
  console.log("EnergyPulse(1.0, 0.8) =>", res1);
  if (res1["dim"] !== 0.8) throw new Error("Falied EnergyPulse check 1");
  const res2 = EnergyPulse({ multiplier: 0.5 }, mockContext);
  console.log("EnergyPulse(0.5, 0.8) =>", res2);
  if (res2["dim"] !== 0.4) throw new Error("Falied EnergyPulse check 2");
  console.log("EnergyPulse tests passed.");
} catch (e) {
  console.error("EnergyPulse failed:", e);
  process.exit(1);
}
try {
  mockContext.metrics.audio.beat = true;
  const res3 = BeatStrobe({ intensity: 1 }, mockContext);
  console.log("BeatStrobe(beat=true) =>", res3);
  if (!res3["strobe"]) throw new Error("Failed BeatStrobe check 1");
  mockContext.metrics.audio.beat = false;
  const res4 = BeatStrobe({ intensity: 1 }, mockContext);
  console.log("BeatStrobe(beat=false) =>", res4);
  if (res4["strobe"] !== 0) throw new Error("Failed BeatStrobe check 2");
  console.log("BeatStrobe tests passed.");
} catch (e) {
  console.error("BeatStrobe failed:", e);
  process.exit(1);
}
console.log("ALL MANUAL CHECKS PASSED");
