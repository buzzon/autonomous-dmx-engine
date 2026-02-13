import { z } from "zod";

// --- Fixture & Patch Configs ---

export const FixtureProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  channels: z.record(z.string(), z.number()), // channel name -> offset
  // Add other profile properties as needed
});

export const FixtureInstanceSchema = z.object({
  id: z.string(),
  name: z.string(),
  profileId: z.string(),
  universe: z.number().int().min(1),
  startAddress: z.number().int().min(1).max(512),
  groupId: z.string(),
});

export const PatchConfigSchema = z.object({
  fixtures: z.array(FixtureInstanceSchema),
});

// --- Engine Subsystems ---

export const AudioConfigSchema = z.object({
  fftSize: z.number().int().optional(),
  sampleRate: z.number().int().optional(),
  // Add other audio config properties
});

export const BrainConfigSchema = z.object({
  energyThresholdLow: z.number().min(0).max(1).optional(),
  energyThresholdHigh: z.number().min(0).max(1).optional(),
});

export const LightingConfigSchema = z.object({
  artNet: z.object({
    host: z.string(),
    port: z.number().int(),
    universe: z.number().int(),
    refreshRate: z.number().int(),
  }),
});

// --- Main Engine Config ---

export const EngineConfigSchema = z.object({
  fastTickInterval: z.number().int().min(10),
  slowTickInterval: z.number().int().min(100),
  maxFastLoopTime: z.number().int(),
  enableHotReload: z.boolean().optional(),
});
