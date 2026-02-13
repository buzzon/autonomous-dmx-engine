import { EnergyPulse } from "../../src/brain/effects/handlers/energyPulse";
import { BeatStrobe } from "../../src/brain/effects/handlers/beatStrobe";

console.log("Testing Effects manually...");

const mockContext: any = {
  metrics: {
    audio: {
      energy: 0.8,
      beat: false,
    },
  },
};

// Test EnergyPulse
try {
  const res1 = EnergyPulse({ multiplier: 1.0 }, mockContext);
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

// Test BeatStrobe
try {
  mockContext.metrics.audio.beat = true;
  const res3 = BeatStrobe({ intensity: 1.0 }, mockContext);
  console.log("BeatStrobe(beat=true) =>", res3);
  if (!res3["strobe"]) throw new Error("Failed BeatStrobe check 1");

  mockContext.metrics.audio.beat = false;
  const res4 = BeatStrobe({ intensity: 1.0 }, mockContext);
  console.log("BeatStrobe(beat=false) =>", res4);
  if (res4["strobe"] !== 0) throw new Error("Failed BeatStrobe check 2");

  console.log("BeatStrobe tests passed.");
} catch (e) {
  console.error("BeatStrobe failed:", e);
  process.exit(1);
}

console.log("ALL MANUAL CHECKS PASSED");
