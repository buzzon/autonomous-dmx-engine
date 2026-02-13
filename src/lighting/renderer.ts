/**
 * DMX Renderer for real lighting equipment
 * Converts fixture states to DMX channel values with support for:
 * - Full channel mapping based on fixture profiles
 * - Gamma correction
 * - Smooth transitions
 * - Rate limiting
 * - Support for all fixture attributes
 */

import { defaultLogger } from '../utils/logger';
import {
  DMXRenderingOptions,
  FixtureInstance,
  FixtureState,
  FixtureProfile,
  UniverseFrame,
  ChannelDefinition,
  RenderStatistics
} from './types';

/**
 * Transition state for smooth value changes
 */
interface TransitionState {
  targetValue: number;
  currentValue: number;
  startTime: number;
  endTime: number;
  startValue: number;
}

/**
 * Fixture channel mapping
 */
interface FixtureChannelMapping {
  dim?: ChannelDefinition;
  pan?: ChannelDefinition;
  tilt?: ChannelDefinition;
  color?: ChannelDefinition;
  strobe?: ChannelDefinition;
  gobo?: ChannelDefinition;
  focus?: ChannelDefinition;
  zoom?: ChannelDefinition;
  iris?: ChannelDefinition;
  frost?: ChannelDefinition;
  prism?: ChannelDefinition;
  shutter?: ChannelDefinition;
}

/**
 * Extended DMX Renderer for real equipment
 */
export class DMXRenderer {
  private logger = defaultLogger.child({ module: 'DMXRenderer' });
  private options: DMXRenderingOptions;
  private statistics: RenderStatistics = {
    framesRendered: 0,
    averageRenderTime: 0,
    dmxPacketsSent: 0,
    lastRenderTime: 0,
    fixtureCount: 0,
    universeCount: 0
  };
  
  // Transition tracking
  private transitions: Map<string, Map<string, TransitionState>> = new Map();
  
  // Previous values for rate limiting
  private previousValues: Map<string, Map<string, number>> = new Map();
  
  // Fixture profile cache
  private profileCache: Map<string, FixtureChannelMapping> = new Map();

  constructor(options: Partial<DMXRenderingOptions> = {}) {
    this.options = {
      applyGammaCorrection: options.applyGammaCorrection ?? true,
      gamma: options.gamma ?? 2.2,
      smoothTransitions: options.smoothTransitions ?? true,
      transitionTime: options.transitionTime ?? 100,
      limitRateOfChange: options.limitRateOfChange ?? true,
      maxChangePerFrame: options.maxChangePerFrame ?? 0.1,
    };
    
    this.logger.info('DMXRenderer initialized for real equipment', { options: this.options });
  }

  /**
   * Render fixture states to DMX universe frames
   */
  renderToDMX(
    fixtureStates: Map<string, FixtureState>,
    patchManager: any, // Using any for now since PatchManager is internal to facade
    profiles: Map<string, FixtureProfile>
  ): UniverseFrame[] {
    const startTime = performance.now();
    const universeFrames: UniverseFrame[] = [];
    
    // Group fixtures by universe
    const universeMap = new Map<number, Array<{fixture: FixtureInstance, state: FixtureState}>>();
    
    // Process each fixture
    for (const [fixtureId, state] of fixtureStates) {
      const fixture = patchManager.getFixture(fixtureId);
      if (!fixture) {
        this.logger.warn('Fixture not found in patch', { fixtureId });
        continue;
      }
      
      const universe = fixture.universe;
      if (!universeMap.has(universe)) {
        universeMap.set(universe, []);
      }
      universeMap.get(universe)!.push({ fixture, state });
    }
    
    // Render each universe
    for (const [universe, fixtures] of universeMap) {
      const frameData = new Uint8Array(512); // 512 DMX channels
      
      for (const { fixture, state } of fixtures) {
        this.renderFixtureToDMX(fixture, state, frameData, profiles);
      }
      
      universeFrames.push({
        universe,
        data: frameData,
        timestamp: Date.now()
      });
    }
    
    // Update statistics
    const renderTime = performance.now() - startTime;
    this.updateStatistics(renderTime, universeFrames.length, fixtureStates.size);
    
    this.logger.debug('DMX rendering complete', {
      universeCount: universeFrames.length,
      fixtureCount: fixtureStates.size,
      renderTime: renderTime.toFixed(2)
    });
    
    return universeFrames;
  }

  /**
   * Render a single fixture to DMX
   */
  private renderFixtureToDMX(
    fixture: FixtureInstance,
    state: FixtureState,
    frameData: Uint8Array,
    profiles: Map<string, FixtureProfile>
  ): void {
    const profile = profiles.get(fixture.profileId);
    if (!profile) {
      this.logger.warn('Fixture profile not found', { profileId: fixture.profileId, fixtureId: fixture.id });
      return;
    }
    
    // Get or create channel mapping
    const channelMapping = this.getChannelMapping(profile);
    
    // Process each attribute
    this.processAttribute('dim', state.dim, fixture, channelMapping.dim, frameData);
    this.processAttribute('pan', this.normalizePan(state.panNorm), fixture, channelMapping.pan, frameData);
    this.processAttribute('tilt', this.normalizeTilt(state.tiltNorm), fixture, channelMapping.tilt, frameData);
    this.processAttribute('color', state.colorIndex, fixture, channelMapping.color, frameData);
    this.processAttribute('strobe', state.strobe, fixture, channelMapping.strobe, frameData);
    this.processAttribute('gobo', state.goboIndex, fixture, channelMapping.gobo, frameData);
    
    // Optional attributes
    if (state.focus !== undefined && channelMapping.focus) {
      this.processAttribute('focus', state.focus, fixture, channelMapping.focus, frameData);
    }
    if (state.zoom !== undefined && channelMapping.zoom) {
      this.processAttribute('zoom', state.zoom, fixture, channelMapping.zoom, frameData);
    }
    if (state.iris !== undefined && channelMapping.iris) {
      this.processAttribute('iris', state.iris, fixture, channelMapping.iris, frameData);
    }
    if (state.frost !== undefined && channelMapping.frost) {
      this.processAttribute('frost', state.frost, fixture, channelMapping.frost, frameData);
    }
    if (state.prism !== undefined && channelMapping.prism) {
      this.processAttribute('prism', state.prism, fixture, channelMapping.prism, frameData);
    }
    if (state.shutter !== undefined && channelMapping.shutter) {
      this.processAttribute('shutter', state.shutter, fixture, channelMapping.shutter, frameData);
    }
  }

  /**
   * Process a single attribute to DMX
   */
  private processAttribute(
    attributeName: string,
    normalizedValue: number,
    fixture: FixtureInstance,
    channelDef: ChannelDefinition | undefined,
    frameData: Uint8Array
  ): void {
    if (!channelDef) {
      return; // Fixture doesn't support this attribute
    }
    
    // Apply smooth transitions if enabled
    let processedValue = normalizedValue;
    if (this.options.smoothTransitions) {
      processedValue = this.applySmoothTransition(fixture.id, attributeName, normalizedValue);
    }
    
    // Apply rate limiting if enabled
    if (this.options.limitRateOfChange) {
      processedValue = this.applyRateLimiting(fixture.id, attributeName, processedValue);
    }
    
    // Convert normalized value to DMX value
    let dmxValue = this.normalizedToDMX(processedValue, channelDef.range);
    
    // Apply gamma correction if enabled
    if (this.options.applyGammaCorrection) {
      dmxValue = this.applyGammaCorrection(dmxValue);
    }
    
    // Calculate DMX channel (0-based index)
    const dmxChannel = fixture.startAddress - 1 + (channelDef.channelIndex - 1);
    
    // Set DMX value
    if (dmxChannel >= 0 && dmxChannel < 512) {
      frameData[dmxChannel] = dmxValue;
    } else {
      this.logger.warn('DMX channel out of range', {
        fixtureId: fixture.id,
        attribute: attributeName,
        channel: dmxChannel,
        startAddress: fixture.startAddress,
        channelIndex: channelDef.channelIndex
      });
    }
  }

  /**
   * Apply smooth transition to value
   */
  private applySmoothTransition(fixtureId: string, attributeName: string, targetValue: number): number {
    const transitionKey = `${fixtureId}:${attributeName}`;
    const now = Date.now();
    
    if (!this.transitions.has(fixtureId)) {
      this.transitions.set(fixtureId, new Map());
    }
    
    const fixtureTransitions = this.transitions.get(fixtureId)!;
    
    if (!fixtureTransitions.has(attributeName)) {
      // Start new transition
      fixtureTransitions.set(attributeName, {
        targetValue,
        currentValue: targetValue,
        startTime: now,
        endTime: now + this.options.transitionTime,
        startValue: targetValue
      });
      return targetValue;
    }
    
    const transition = fixtureTransitions.get(attributeName)!;
    
    // Check if target value changed
    if (Math.abs(transition.targetValue - targetValue) > 0.001) {
      // Update transition with new target
      transition.targetValue = targetValue;
      transition.startValue = transition.currentValue;
      transition.startTime = now;
      transition.endTime = now + this.options.transitionTime;
    }
    
    // Calculate current value based on transition progress
    if (now >= transition.endTime) {
      // Transition complete
      transition.currentValue = transition.targetValue;
      return transition.currentValue;
    }
    
    // Linear interpolation
    const progress = (now - transition.startTime) / (transition.endTime - transition.startTime);
    transition.currentValue = transition.startValue + (transition.targetValue - transition.startValue) * progress;
    
    return transition.currentValue;
  }

  /**
   * Apply rate limiting to value changes
   */
  private applyRateLimiting(fixtureId: string, attributeName: string, currentValue: number): number {
    if (!this.previousValues.has(fixtureId)) {
      this.previousValues.set(fixtureId, new Map());
    }
    
    const fixtureValues = this.previousValues.get(fixtureId)!;
    const previousValue = fixtureValues.get(attributeName) ?? currentValue;
    
    // Calculate maximum allowed change
    const maxChange = this.options.maxChangePerFrame;
    const delta = currentValue - previousValue;
    
    let limitedValue = currentValue;
    if (Math.abs(delta) > maxChange) {
      limitedValue = previousValue + Math.sign(delta) * maxChange;
    }
    
    // Store for next frame
    fixtureValues.set(attributeName, limitedValue);
    
    return limitedValue;
  }

  /**
   * Convert normalized value (0..1) to DMX value (0..255)
   */
  private normalizedToDMX(normalizedValue: number, range?: [number, number]): number {
    // Clamp to 0..1
    const clamped = Math.max(0, Math.min(1, normalizedValue));
    
    if (range) {
      // Map to custom range
      const [min, max] = range;
      return Math.round(min + clamped * (max - min));
    }
    
    // Default mapping to 0..255
    return Math.round(clamped * 255);
  }

  /**
   * Apply gamma correction to DMX value
   */
  private applyGammaCorrection(dmxValue: number): number {
    if (!this.options.applyGammaCorrection || this.options.gamma === 1.0) {
      return dmxValue;
    }
    
    const normalized = dmxValue / 255;
    const corrected = Math.pow(normalized, 1 / this.options.gamma);
    return Math.round(corrected * 255);
  }

  /**
   * Normalize pan value (-1..1) to 0..1
   */
  private normalizePan(panNorm: number): number {
    return (panNorm + 1) / 2;
  }

  /**
   * Normalize tilt value (-1..1) to 0..1
   */
  private normalizeTilt(tiltNorm: number): number {
    return (tiltNorm + 1) / 2;
  }

  /**
   * Get channel mapping for a fixture profile
   */
  private getChannelMapping(profile: FixtureProfile): FixtureChannelMapping {
    if (this.profileCache.has(profile.id)) {
      return this.profileCache.get(profile.id)!;
    }
    
    const mapping: FixtureChannelMapping = {};
    
    for (const channel of profile.channels) {
      switch (channel.type) {
        case 'dim':
          mapping.dim = channel;
          break;
        case 'position':
          // Determine if this is pan or tilt based on name
          if (channel.name.toLowerCase().includes('pan')) {
            mapping.pan = channel;
          } else if (channel.name.toLowerCase().includes('tilt')) {
            mapping.tilt = channel;
          }
          break;
        case 'color':
          mapping.color = channel;
          break;
        case 'strobe':
          mapping.strobe = channel;
          break;
        case 'other':
          // Map based on name
          if (channel.name.toLowerCase().includes('gobo')) {
            mapping.gobo = channel;
          } else if (channel.name.toLowerCase().includes('focus')) {
            mapping.focus = channel;
          } else if (channel.name.toLowerCase().includes('zoom')) {
            mapping.zoom = channel;
          } else if (channel.name.toLowerCase().includes('iris')) {
            mapping.iris = channel;
          } else if (channel.name.toLowerCase().includes('frost')) {
            mapping.frost = channel;
          } else if (channel.name.toLowerCase().includes('prism')) {
            mapping.prism = channel;
          } else if (channel.name.toLowerCase().includes('shutter')) {
            mapping.shutter = channel;
          }
          break;
      }
    }
    
    this.profileCache.set(profile.id, mapping);
    return mapping;
  }

  /**
   * Update render statistics
   */
  private updateStatistics(renderTime: number, universeCount: number, fixtureCount: number): void {
    this.statistics.framesRendered++;
    this.statistics.lastRenderTime = renderTime;
    this.statistics.fixtureCount = fixtureCount;
    this.statistics.universeCount = universeCount;
    
    // Update average render time
    this.statistics.averageRenderTime = 
      (this.statistics.averageRenderTime * (this.statistics.framesRendered - 1) + renderTime) / 
      this.statistics.framesRendered;
    
    this.statistics.dmxPacketsSent += universeCount;
  }

  /**
   * Get render statistics
   */
  getStatistics(): RenderStatistics {
    return { ...this.statistics };
  }

  /**
   * Reset render statistics
   */
  resetStatistics(): void {
    this.statistics = {
      framesRendered: 0,
      averageRenderTime: 0,
      dmxPacketsSent: 0,
      lastRenderTime: 0,
      fixtureCount: 0,
      universeCount: 0
    };
    
    // Clear transition and previous value caches
    this.transitions.clear();
    this.previousValues.clear();
    
    this.logger.info('DMX render statistics and caches reset');
  }

  /**
   * Update renderer options
   */
  updateOptions(options: Partial<DMXRenderingOptions>): void {
    this.options = { ...this.options, ...options };
    this.logger.info('DMX renderer options updated', { newOptions: this.options });
  }

  /**
   * Clear all transitions (useful for scene changes)
   */
  clearTransitions(): void {
    this.transitions.clear();
    this.previousValues.clear();
    this.logger.info('All transitions cleared');
  }

  /**
   * Get current renderer options
   */
  getOptions(): DMXRenderingOptions {
    return { ...this.options };
  }
}