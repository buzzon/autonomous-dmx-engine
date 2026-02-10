// src/brain/types.ts

export type BrainState = 'Idle' | 'Chill' | 'Party' | 'Manual';

export interface StateMachineConfig {
  energyThresholdLow: number;
  energyThresholdHigh: number;
  hysteresis: number;
}

export interface SceneState {
  sceneId: string;
  paletteId: string;
  baseIntensity: number;
  effectDescriptors: {
    [groupId: string]: {
      dimEffectType?: 'none' | 'chase' | 'pulse';
      posEffectType?: 'none' | 'circle' | 'swing';
      colorEffectType?: 'none' | 'cycle';
    }
  };
}

export interface SceneDefinition {
  id: string;
  name: string;
  allowedStates: BrainState[];
  paletteId: string;
  baseIntensity: number;
  effectDescriptors: any;
}

export interface DimEffectState {
  type: 'none' | 'chase' | 'pulse';
  speed: number;
  depth: number;
  phaseOffset: number;
}

export interface PosEffectState {
  type: 'none' | 'circle' | 'swing';
  speed: number;
  size: number;
  centerPan: number;
  centerTilt: number;
}

export interface GroupEffectState {
  groupId: string;
  dimEffect: DimEffectState;
  posEffect: PosEffectState;
}
