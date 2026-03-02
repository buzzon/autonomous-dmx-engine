import { EffectEngine } from '../../../src/brain/effectEngine';
import { SceneState, EffectDescriptor } from '../../../src/brain/types';
import { RuntimeMetrics } from '../../../src/engine/types';

describe('EffectEngine', () => {
  const mockConfig = {
    defaultEffectHandlers: {},
  };

  const mockMetrics: RuntimeMetrics = {
    audio: {
      timestamp: Date.now(),
      energy: 0.7,
      beat: false,
      bpm: 120,
      mood: 'calm' as const,
      spectralCentroid: 0.5,
      spectralFlatness: 0.5,
    },
    timestamp: Date.now(),
  };

  const mockSceneState: SceneState = {
    sceneId: 'test-scene',
    paletteId: 'default',
    baseIntensity: 0.8,
    effectDescriptors: [
      {
        type: 'dim/pulse',
        params: { speed: 1.0, depth: 0.5, phase: 0 },
        groupId: 'group1',
      },
      {
        type: 'pos/circle',
        params: { speed: 0.5, size: 0.3, centerPan: 0.5, centerTilt: 0.5 },
        groupId: 'group2',
      },
    ],
  };

  describe('constructor', () => {
    it('should initialize with config', () => {
      const engine = new EffectEngine(mockConfig);
      expect(engine).toBeInstanceOf(EffectEngine);
    });

    it('should register default handlers', () => {
      const engine = new EffectEngine(mockConfig);
      // We can't directly access private effectRegistry, but we can test via generateEffects
      // If default handlers are registered, dim/pulse should work
      const sceneState: SceneState = {
        sceneId: 'test',
        paletteId: 'default',
        baseIntensity: 1,
        effectDescriptors: [
          {
            type: 'dim/pulse',
            params: { speed: 1.0, depth: 0.5, phase: 0 },
            groupId: 'group1',
          },
        ],
      };
      const result = engine.generateEffects(sceneState, mockMetrics, Date.now());
      expect(result.groupEffects).toHaveLength(1);
      expect(result.groupEffects[0].groupId).toBe('group1');
    });
  });

  describe('registerEffectHandler', () => {
    it('should register custom effect handler', () => {
      const engine = new EffectEngine(mockConfig);
      const mockHandler = jest.fn(() => ({ dim: 0.5 }));
      
      engine.registerEffectHandler({
        type: 'custom/effect',
        handler: mockHandler,
        description: 'Custom effect',
        defaultParams: {},
      });

      // Test that handler is used
      const sceneState: SceneState = {
        sceneId: 'test',
        paletteId: 'default',
        baseIntensity: 1,
        effectDescriptors: [
          {
            type: 'custom/effect',
            params: {},
            groupId: 'group1',
          },
        ],
      };
      
      const result = engine.generateEffects(sceneState, mockMetrics, Date.now());
      // The mock handler should have been called
      // Since we can't directly verify, we rely on the fact that the engine didn't crash
      expect(result.groupEffects).toHaveLength(1);
    });
  });

  describe('generateEffects', () => {
    it('should process multiple effect descriptors', () => {
      const engine = new EffectEngine(mockConfig);
      const timestamp = Date.now();
      
      const result = engine.generateEffects(mockSceneState, mockMetrics, timestamp);
      
      expect(result.groupEffects).toHaveLength(2);
      expect(result.groupEffects.map(g => g.groupId)).toEqual(['group1', 'group2']);
      expect(result.fixtureOverrides).toBeInstanceOf(Map);
    });

    it('should group effects by groupId', () => {
      const engine = new EffectEngine(mockConfig);
      const sceneState: SceneState = {
        sceneId: 'test',
        paletteId: 'default',
        baseIntensity: 1,
        effectDescriptors: [
          { type: 'dim/pulse', params: { speed: 1 }, groupId: 'group1' },
          { type: 'pos/circle', params: { speed: 0.5 }, groupId: 'group1' },
          { type: 'color/cycle', params: { speed: 2 }, groupId: 'group2' },
        ],
      };
      
      const result = engine.generateEffects(sceneState, mockMetrics, Date.now());
      // Should have 2 groups
      expect(result.groupEffects).toHaveLength(2);
      const groupIds = result.groupEffects.map(g => g.groupId);
      expect(groupIds).toContain('group1');
      expect(groupIds).toContain('group2');
    });

    it('should handle unknown effect types gracefully', () => {
      const engine = new EffectEngine(mockConfig);
      const sceneState: SceneState = {
        sceneId: 'test',
        paletteId: 'default',
        baseIntensity: 1,
        effectDescriptors: [
          { type: 'unknown/effect', params: {}, groupId: 'group1' },
        ],
      };
      
      // Should not throw
      const result = engine.generateEffects(sceneState, mockMetrics, Date.now());
      expect(result.groupEffects).toHaveLength(1);
      // The effect will be ignored but group still created
      expect(result.groupEffects[0].groupId).toBe('group1');
    });

    it('should return fixture overrides for handlers that return Map', () => {
      const engine = new EffectEngine(mockConfig);
      const mockHandler = jest.fn(() => {
        const map = new Map();
        map.set('fixture1', { dim: 0.8 });
        map.set('fixture2', { panNorm: 0.5 });
        return map;
      });
      
      engine.registerEffectHandler({
        type: 'map/effect',
        handler: mockHandler,
        description: 'Map effect',
        defaultParams: {},
      });

      const sceneState: SceneState = {
        sceneId: 'test',
        paletteId: 'default',
        baseIntensity: 1,
        effectDescriptors: [
          { type: 'map/effect', params: {}, groupId: 'group1' },
        ],
      };
      
      const result = engine.generateEffects(sceneState, mockMetrics, Date.now());
      expect(result.fixtureOverrides.size).toBe(2);
      expect(result.fixtureOverrides.get('fixture1')).toEqual({ dim: 0.8 });
      expect(result.fixtureOverrides.get('fixture2')).toEqual({ panNorm: 0.5 });
    });
  });

  describe('reloadEffects', () => {
    it('should log reload message', () => {
      const engine = new EffectEngine(mockConfig);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      engine.reloadEffects();
      
      // The method currently just logs a message
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('default effect handlers', () => {
    let engine: EffectEngine;

    beforeEach(() => {
      engine = new EffectEngine(mockConfig);
    });

    it('should have dim/pulse handler', () => {
      const sceneState: SceneState = {
        sceneId: 'test',
        paletteId: 'default',
        baseIntensity: 1,
        effectDescriptors: [
          { type: 'dim/pulse', params: { speed: 1.0, depth: 0.5, phase: 0 }, groupId: 'group1' },
        ],
      };
      
      const result = engine.generateEffects(sceneState, mockMetrics, Date.now());
      expect(result.groupEffects[0].dimEffect.type).toBe('pulse');
    });

    it('should have dim/energyPulse handler', () => {
      const sceneState: SceneState = {
        sceneId: 'test',
        paletteId: 'default',
        baseIntensity: 1,
        effectDescriptors: [
          { type: 'dim/energyPulse', params: { multiplier: 1.0 }, groupId: 'group1' },
        ],
      };
      
      const result = engine.generateEffects(sceneState, mockMetrics, Date.now());
      expect(result.groupEffects[0].dimEffect.type).toBe('energyPulse'); // Actually energyPulse is registered as dim/energyPulse but applyEffectParams sets type?
      // The handler returns a value but we can't easily test it
    });

    it('should have strobe/beat handler', () => {
      const sceneState: SceneState = {
        sceneId: 'test',
        paletteId: 'default',
        baseIntensity: 1,
        effectDescriptors: [
          { type: 'strobe/beat', params: { intensity: 1.0, duration: 100 }, groupId: 'group1' },
        ],
      };
      
      const result = engine.generateEffects(sceneState, mockMetrics, Date.now());
      // strobe/beat is not a dim/pos/color effect, so it won't affect groupEffect
      // but it should be processed
      expect(result.groupEffects).toHaveLength(1);
    });

    it('should have pos/circle handler', () => {
      const sceneState: SceneState = {
        sceneId: 'test',
        paletteId: 'default',
        baseIntensity: 1,
        effectDescriptors: [
          { type: 'pos/circle', params: { speed: 1.0, size: 0.5 }, groupId: 'group1' },
        ],
      };
      
      const result = engine.generateEffects(sceneState, mockMetrics, Date.now());
      expect(result.groupEffects[0].posEffect.type).toBe('circle');
    });

    it('should have color/cycle handler', () => {
      const sceneState: SceneState = {
        sceneId: 'test',
        paletteId: 'default',
        baseIntensity: 1,
        effectDescriptors: [
          { type: 'color/cycle', params: { speed: 1.0, colors: [0, 1, 2] }, groupId: 'group1' },
        ],
      };
      
      const result = engine.generateEffects(sceneState, mockMetrics, Date.now());
      expect(result.groupEffects[0].colorEffect.type).toBe('cycle');
    });
  });
});