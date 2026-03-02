/**
 * Rainbow color effect
 * Cycles through color palette based on time and audio energy
 * Returns colorIndex for palette-based color system
 */

import { EffectHandler } from "../../types";

/**
 * Rainbow effect parameters
 */
export interface RainbowParams {
  /** Speed of color cycling (cycles per second) */
  speed?: number;
  /** Number of colors in rainbow spectrum (default: 12) */
  colorCount?: number;
  /** Sync to BPM (true/false) */
  syncToBpm?: boolean;
  /** Energy modulation amount (0-1) */
  energyModulation?: number;
  /** Offset between fixtures (0-1) */
  fixtureOffset?: number;
}

/**
 * Rainbow effect handler
 * Returns colorIndex for palette-based color system
 */
export const RainbowEffect: EffectHandler = (params: RainbowParams, context) => {
  const {
    speed = 0.5,
    colorCount = 12,
    syncToBpm = false,
    energyModulation = 0.2,
    fixtureOffset = 0.1,
  } = params;

  const { metrics, timestamp, groupId } = context;
  
  // Calculate base time
  let time = timestamp / 1000; // Convert to seconds
  
  // If syncing to BPM, adjust speed
  let effectiveSpeed = speed;
  if (syncToBpm && metrics.audio.bpm) {
    // Convert BPM to cycles per second (BPM/60)
    const bps = metrics.audio.bpm / 60;
    // Match speed to BPM multiples
    effectiveSpeed = bps * speed;
  }
  
  // Calculate base position in color cycle
  let position = (time * effectiveSpeed) % 1.0;
  
  // Apply energy modulation if available
  const energy = metrics.audio.energy || 0;
  if (energyModulation > 0) {
    // Energy affects position shift
    position = (position + energy * energyModulation) % 1.0;
  }
  
  // Calculate color index (0 to colorCount-1)
  const colorIndex = Math.floor(position * colorCount) % colorCount;
  
  // For simplicity, return same color for all fixtures in group
  // In a more advanced implementation, we could use fixtureOffset to create rainbow spread
  return {
    colorIndex,
  };
};

export default RainbowEffect;