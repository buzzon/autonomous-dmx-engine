import { EnergyPulse } from "../../../src/brain/effects/handlers/energyPulse";
import { BeatStrobe } from "../../../src/brain/effects/handlers/beatStrobe";
import { EffectContext } from "../../../src/brain/types";

describe("Effect Handlers", () => {
  const mockContext: any = {
    metrics: {
      audio: {
        energy: 0.8,
        beat: false,
      },
    },
  };

  describe("EnergyPulse", () => {
    it("should map energy to dimmer", () => {
      const result = EnergyPulse({ multiplier: 1.0 }, mockContext);
      expect(result).toEqual({ dim: 0.8 });
    });

    it("should handle multiplier", () => {
      const result = EnergyPulse({ multiplier: 0.5 }, mockContext);
      expect(result).toEqual({ dim: 0.4 });
    });

    it("should clamp values", () => {
      mockContext.metrics.audio.energy = 1.0;
      const result = EnergyPulse({ multiplier: 2.0 }, mockContext);
      expect(result).toEqual({ dim: 1.0 });
    });
  });

  describe("BeatStrobe", () => {
    it("should trigger strobe on beat", () => {
      mockContext.metrics.audio.beat = true;
      const result = BeatStrobe({ intensity: 1.0 }, mockContext);
      expect(result).toEqual({ strobe: 1.0, dim: 1.0 });
    });

    it("should reset strobe when no beat", () => {
      mockContext.metrics.audio.beat = false;
      const result = BeatStrobe({ intensity: 1.0 }, mockContext);
      expect(result).toEqual({ strobe: 0 });
    });
  });
});
