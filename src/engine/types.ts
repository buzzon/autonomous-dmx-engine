/**
 * Engine module types and interfaces
 * Core types for the main facade and processing loops
 */

import { AudioMetrics } from "../audio/types";
import { BrainState, SceneState, GroupEffectState } from "../brain/types";
import { FixtureState, UniverseFrame } from "../lighting/types";

/**
 * Engine configuration
 */
export interface EngineConfig {
  fastTickInterval: number; // 40ms
  slowTickInterval: number; // 500-1000ms
  enableHotReload: boolean;
  maxFastLoopTime: number; // Maximum allowed processing time for fast loop (ms)
}

/**
 * Runtime metrics - extensible structure for all metric sources
 */
export interface RuntimeMetrics {
  audio: AudioMetrics;
  vision?: VisionMetrics; // For future expansion
  sensors?: SensorMetrics; // For future expansion
  timestamp: number;
}

/**
 * Brain output from BrainFacade
 */
export interface BrainOutput {
  brainState: BrainState;
  sceneState: SceneState;
  groupEffects: GroupEffectState[];
  fixtureOverrides?: Map<string, Partial<FixtureState>>;
}

/**
 * Lighting output from LightingFacade
 */
export interface LightingOutput {
  universeFrames: UniverseFrame[];
  fixtureStates: Map<string, FixtureState>;
}

/**
 * System state for UI/control
 */
export interface SystemState {
  mode: SystemMode;
  globalIntensity: number; // 0..1
  blackout: boolean;
  activeStyleId?: string;
}

/**
 * System mode
 */
export type SystemMode = "auto" | "chill" | "party" | "manual";

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  fastLoopTime: number;
  slowLoopTime: number;
  audioLatency: number;
  dmxLatency: number;
  memoryUsage: number;
  cpuUsage: number;
  audioDropouts: number;
  dmxDropouts: number;
  beatDetectionAccuracy: number;
}

/**
 * Health check status
 */
export interface HealthStatus {
  overall: "healthy" | "degraded" | "unhealthy";
  details: HealthCheckResult[];
  timestamp: number;
}

/**
 * Health check result for a component
 */
export interface HealthCheckResult {
  component: string;
  healthy: boolean;
  message: string;
}

/**
 * Bridge for communication between fast and slow cycles
 */
export interface FastToSlowBridge {
  recentAudioMetrics: AudioMetrics[];
  recentBrainStates: BrainState[];
  performanceMetrics: PerformanceMetrics;
}

/**
 * Bridge for commands from slow to fast cycle
 */
export interface SlowToFastBridge {
  configUpdates?: ConfigUpdate[];
  sceneOverrides?: SceneOverride[];
}

/**
 * Configuration update
 */
export interface ConfigUpdate {
  type: "scenes" | "rules" | "effects" | "plugins";
  path: string;
  timestamp: number;
}

/**
 * Scene override from UI/control
 */
export interface SceneOverride {
  sceneId: string;
  duration?: number; // ms, undefined means until manually changed
  timestamp: number;
}

/**
 * Vision metrics (for future expansion)
 */
export interface VisionMetrics {
  occupancy: number; // 0..1
  motionLevel: number; // 0..1
  zones: Record<string, number>;
  timestamp: number;
}

/**
 * Sensor metrics (for future expansion)
 */
export interface SensorMetrics {
  temperature?: number;
  humidity?: number;
  occupancy?: number;
  timestamp: number;
}

/**
 * Engine state
 */
export interface EngineState {
  isRunning: boolean;
  startTime: number;
  fastTickCount: number;
  slowTickCount: number;
  lastError?: string;
  performance: PerformanceMetrics;
  health: HealthStatus;
}
