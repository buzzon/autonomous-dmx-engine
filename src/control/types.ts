// src/control/types.ts

export type SystemMode = 'auto' | 'chill' | 'party' | 'manual';

export interface UserCommand {
  type: 'setMode' | 'setIntensity' | 'setBlackout' | 'setStyle';
  payload: any;
  timestamp: number;
}

export interface SystemState {
  mode: SystemMode;
  globalIntensity: number;
  blackout: boolean;
  activeStyleId?: string;
}
