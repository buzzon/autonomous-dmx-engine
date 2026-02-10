// src/lighting/types.ts

export interface ChannelDefinition {
  name: string;
  type: 'dim' | 'position' | 'color' | 'strobe' | 'other';
  channelIndex: number;
  fineChannelIndex?: number;
  range?: [number, number];
}

export interface FixtureProfile {
  id: string;
  name: string;
  manufacturer: string;
  channels: ChannelDefinition[];
  colorMap?: { [index: number]: number };
}

export interface FixtureInstance {
  id: string;
  name: string;
  universe: number;
  startAddress: number;
  profileId: string;
  groupId: string;
  x?: number;
  y?: number;
  z?: number;
}

export interface FixtureState {
  fixtureId: string;
  dim: number;
  colorIndex: number;
  panNorm: number;
  tiltNorm: number;
  strobe: number;
}

export interface UniverseFrame {
  universe: number;
  data: Uint8Array;
}
