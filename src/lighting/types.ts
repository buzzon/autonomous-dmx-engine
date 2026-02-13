/**
 * Lighting module types and interfaces
 * Types for Patch, Fixtures, Attributes, Merge, and DMX Renderer
 */

/**
 * Channel definition for a fixture profile
 */
export interface ChannelDefinition {
  name: string; // 'dim', 'pan', 'tilt', 'colorIndex', etc.
  type: "dim" | "position" | "color" | "strobe" | "other";
  channelIndex: number; // 1-based (DMX channel)
  fineChannelIndex?: number;
  range?: [number, number]; // DMX range for this value
  defaultValue?: number;
}

/**
 * Fixture profile (template)
 */
export interface FixtureProfile {
  id: string;
  name: string;
  manufacturer: string;
  channels: ChannelDefinition[];
  colorMap?: { [index: number]: number }; // colorIndex -> DMX value
  goboMap?: { [index: number]: number }; // goboIndex -> DMX value
  capabilities: string[]; // ['dim', 'color', 'position', 'strobe', 'gobo']
}

/**
 * Fixture instance (patched fixture)
 */
export interface FixtureInstance {
  id: string;
  name: string;
  universe: number;
  startAddress: number; // 1-based
  profileId: string;
  groupId: string;
  x?: number; // Position in layout
  y?: number;
  z?: number;
  zone?: string; // 'front', 'back', 'left', 'right', etc.
  rotation?: number; // Degrees
}

/**
 * Fixture state (virtual attributes)
 */
export interface FixtureState {
  fixtureId: string;
  dim: number; // 0..1
  colorIndex: number;
  panNorm: number; // -1..1 (normalized)
  tiltNorm: number; // -1..1 (normalized)
  strobe: number; // 0..1
  goboIndex: number;
  focus?: number; // 0..1
  zoom?: number; // 0..1
  iris?: number; // 0..1
  frost?: number; // 0..1
  prism?: number; // 0..1
  shutter?: number; // 0..1
  timestamp: number; // When this state was last updated
}

/**
 * Universe frame (512 DMX channels)
 */
export interface UniverseFrame {
  universe: number;
  data: Uint8Array; // 512 bytes
  timestamp: number;
}

/**
 * DMX channel value with timestamp
 */
export interface DMXChannel {
  universe: number;
  channel: number; // 1-based
  value: number; // 0-255
  timestamp: number;
}

/**
 * Art-Net configuration
 */
export interface ArtNetConfig {
  host: string;
  port: number;
  universe: number;
  refreshRate: number; // Hz
}

/**
 * Patch configuration
 */
export interface PatchConfig {
  fixtures: FixtureInstance[];
  groups: Record<string, string[]>; // groupId -> fixtureIds
  universes: Record<number, number[]>; // universe -> fixtureIds
}

/**
 * Layout configuration
 */
export interface LayoutConfig {
  fixtures: Array<{
    id: string;
    x: number;
    y: number;
    z?: number;
    zone?: string;
    rotation?: number;
  }>;
  zones: Record<
    string,
    {
      x: number;
      y: number;
      width: number;
      height: number;
      depth?: number;
    }
  >;
}

/**
 * Merge rules for combining attribute layers
 */
export interface MergeRules {
  priority: Array<"base" | "effects" | "overrides">;
  blendModes: {
    dim: "multiply" | "add" | "max" | "replace";
    color: "replace" | "add" | "average";
    position: "replace" | "average" | "weighted";
  };
  globalDim: number; // 0..1
  blackout: boolean;
}

/**
 * Attribute layer type
 */
export type AttributeLayer = "base" | "effects" | "overrides" | "manual";

/**
 * Layer state
 */
export interface LayerState {
  layer: AttributeLayer;
  fixtureStates: Map<string, Partial<FixtureState>>;
  priority: number;
  blendMode: string;
}

/**
 * Lighting Facade configuration
 */
export interface LightingFacadeConfig {
  artNet: ArtNetConfig;
  mergeRules: MergeRules;
  defaultAttributes: Partial<FixtureState>;
  enableDMXOutput: boolean;
}

/**
 * DMX rendering options
 */
export interface DMXRenderingOptions {
  applyGammaCorrection: boolean;
  gamma: number;
  smoothTransitions: boolean;
  transitionTime: number; // ms
  limitRateOfChange: boolean;
  maxChangePerFrame: number;
  artNet?: ArtNetConfig; // Optional ArtNet configuration
}

/**
 * Fixture group definition
 */
export interface FixtureGroup {
  id: string;
  name: string;
  fixtureIds: string[];
  type: "beam" | "wash" | "spot" | "hybrid";
  capabilities: string[];
  center?: { x: number; y: number; z?: number };
  bounds?: { minX: number; maxX: number; minY: number; maxY: number };
}

/**
 * Color palette
 */
export interface ColorPalette {
  id: string;
  name: string;
  colors: number[]; // Color indices
  description: string;
}

/**
 * Style definition
 */
export interface StyleDefinition {
  id: string;
  name: string;
  paletteId: string;
  intensityRange: [number, number];
  movementStyle: "static" | "slow" | "medium" | "fast";
  colorStyle: "mono" | "complementary" | "analogous" | "rainbow";
}

/**
 * Render statistics
 */
export interface RenderStatistics {
  framesRendered: number;
  averageRenderTime: number;
  dmxPacketsSent: number;
  lastRenderTime: number;
  fixtureCount: number;
  universeCount: number;
}
