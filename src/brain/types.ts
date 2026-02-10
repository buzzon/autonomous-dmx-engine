/**
 * Brain module types and interfaces
 * Types for State Machine, Scene Selector, and Effect Engine with data-driven approach
 */

import { AudioMetrics, Mood } from '../audio/types';
import { RuntimeMetrics } from '../engine/types';
import { FixtureState } from '../lighting/types';

/**
 * Brain states
 */
export type BrainState = 'Idle' | 'Chill' | 'Party' | 'Manual';

/**
 * State Machine configuration
 */
export interface StateMachineConfig {
  energyThresholdLow: number;   // Transition Idle → Chill
  energyThresholdHigh: number;  // Transition Chill → Party
  hysteresis: number;           // Hysteresis for stability
  manualOverrideTimeout: number; // Time before returning from Manual to Auto (ms)
}

/**
 * Scene State with data-driven effect descriptors
 */
export interface SceneState {
  sceneId: string;
  paletteId: string;
  baseIntensity: number;  // 0..1
  effectDescriptors: EffectDescriptor[];  // Data-driven array of effect descriptors
}

/**
 * Scene Definition (from configuration)
 */
export interface SceneDefinition {
  id: string;
  name: string;
  allowedStates: BrainState[];  // In which brain states this scene is available
  paletteId: string;
  baseIntensity: number;
  effectDescriptors: EffectDescriptor[];  // Data-driven effect descriptors
}

/**
 * Effect Descriptor - data-driven effect definition
 */
export interface EffectDescriptor {
  type: string;                    // 'dim/pulse', 'pos/circle', 'color/cycle', etc.
  params: Record<string, any>;     // Effect parameters
  groupId: string;                 // Which fixture group to apply to
  priority?: number;               // Effect priority (higher = applied later)
}

/**
 * Effect Context for effect handlers
 */
export interface EffectContext {
  metrics: RuntimeMetrics;
  timestamp: number;
  sceneState: SceneState;
  fixtureStates: Map<string, FixtureState>;
  groupId: string;
}

/**
 * Effect Handler function type
 */
export type EffectHandler = (
  params: Record<string, any>,
  context: EffectContext
) => Partial<FixtureState> | Map<string, Partial<FixtureState>>;

/**
 * Dim Effect State
 */
export interface DimEffectState {
  type: 'none' | 'chase' | 'pulse';
  speed: number;
  depth: number;
  phaseOffset: number;
}

/**
 * Position Effect State
 */
export interface PosEffectState {
  type: 'none' | 'circle' | 'swing';
  speed: number;
  size: number;
  centerPan: number;
  centerTilt: number;
}

/**
 * Color Effect State
 */
export interface ColorEffectState {
  type: 'none' | 'cycle' | 'gradient';
  speed: number;
  colors: number[];  // Color indices
}

/**
 * Group Effect State
 */
export interface GroupEffectState {
  groupId: string;
  dimEffect: DimEffectState;
  posEffect: PosEffectState;
  colorEffect: ColorEffectState;
}

/**
 * Scene Rule for data-driven scene selection
 */
export interface SceneRule {
  sceneId: string;
  
  // Activation conditions
  conditions: {
    brainState?: BrainState | BrainState[];
    mood?: Mood | Mood[];
    energyMin?: number;
    energyMax?: number;
    bpmMin?: number;
    bpmMax?: number;
    timeOfDay?: {
      start: string;  // "20:00"
      end: string;    // "06:00"
    };
    dayOfWeek?: number[];  // 0-6 (Sunday-Saturday)
    recentScenes?: string[];  // Scenes that should/shouldn't be recent
  };
  
  // Weight for random selection
  weight: number;
  
  // Minimum time between activations (ms)
  cooldown?: number;
  
  // Maximum scene duration (ms)
  maxDuration?: number;
  
  // Minimum scene duration (ms)
  minDuration?: number;
  
  // Transition time to this scene (ms)
  transitionTime?: number;
}

/**
 * Scene History entry
 */
export interface SceneHistory {
  sceneId: string;
  startTime: number;
  endTime?: number;
  brainState: BrainState;
  metrics: RuntimeMetrics;
}

/**
 * Brain Facade configuration
 */
export interface BrainFacadeConfig {
  stateMachine: StateMachineConfig;
  sceneSelector: SceneSelectorConfig;
  effectEngine: EffectEngineConfig;
}

/**
 * Scene Selector configuration
 */
export interface SceneSelectorConfig {
  defaultSceneId: string;
  historySize: number;
  cooldownEnabled: boolean;
  randomSelection: boolean;
}

/**
 * Effect Engine configuration
 */
export interface EffectEngineConfig {
  defaultEffectHandlers: Record<string, EffectHandler>;
  effectRegistryPath?: string;
}

/**
 * Brain Facade state
 */
export interface BrainFacadeState {
  currentBrainState: BrainState;
  currentScene: SceneState;
  history: {
    brainStates: Array<{ state: BrainState; timestamp: number }>;
    scenes: SceneHistory[];
    timestamps: number[];
  };
  lastStateChange: number;
  lastSceneChange: number;
}

/**
 * Effect Registry entry
 */
export interface EffectRegistryEntry {
  type: string;
  handler: EffectHandler;
  description: string;
  defaultParams: Record<string, any>;
  supportedGroups?: string[];
}

/**
 * Scene transition
 */
export interface SceneTransition {
  fromSceneId: string;
  toSceneId: string;
  startTime: number;
  duration: number;
  progress: number;  // 0..1
}
