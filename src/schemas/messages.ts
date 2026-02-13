import { z } from "zod";

export const UserCommandSchema = z.object({
  type: z.enum([
    "setMode",
    "setIntensity",
    "setBlackout",
    "setScene",
    "reloadConfigs",
  ]),
  payload: z.record(z.any()).optional(),
  timestamp: z.number(),
  commandId: z.string().optional(),
});

export const SystemStateSchema = z.object({
  mode: z.enum(["auto", "manual", "chill", "party"]),
  globalIntensity: z.number().min(0).max(1),
  blackout: z.boolean(),
  activeSceneId: z.string().nullable().optional(),
  activeVenue: z.string().nullable().optional(),
});
