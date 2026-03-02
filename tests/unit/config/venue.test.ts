import { VenueConfigManager, VenueConfig } from '../../../src/config/venue';
import { ConfigLoader } from '../../../src/utils/config';

// Mock ConfigLoader
jest.mock('../../../src/utils/config', () => ({
  ConfigLoader: jest.fn().mockImplementation(() => ({
    loadJson: jest.fn(),
    saveJson: jest.fn(),
    fileExists: jest.fn(),
    deleteFile: jest.fn(),
    listFiles: jest.fn(),
  })),
}));

describe('VenueConfigManager', () => {
  let manager: VenueConfigManager;
  let mockConfigLoader: jest.Mocked<ConfigLoader>;

  beforeEach(() => {
    jest.clearAllMocks();
    manager = new VenueConfigManager('./test-venues');
    mockConfigLoader = (manager as any).configLoader as jest.Mocked<ConfigLoader>;
  });

  describe('constructor', () => {
    it('should initialize with default directory', () => {
      const defaultManager = new VenueConfigManager();
      expect(defaultManager).toBeInstanceOf(VenueConfigManager);
    });

    it('should initialize with custom directory', () => {
      expect(manager).toBeInstanceOf(VenueConfigManager);
    });
  });

  describe('loadAllVenues', () => {
    it('should load example venues when no files exist', async () => {
      mockConfigLoader.fileExists.mockResolvedValue(false);
      
      await manager.loadAllVenues();
      
      // Should have loaded example venues
      const venues = manager.getAllVenues();
      expect(venues.length).toBeGreaterThan(0);
    });

    it('should handle errors gracefully', async () => {
      mockConfigLoader.fileExists.mockRejectedValue(new Error('File system error'));
      
      await expect(manager.loadAllVenues()).rejects.toThrow('File system error');
    });
  });

  describe('getAllVenues', () => {
    it('should return empty array when no venues loaded', () => {
      const venues = manager.getAllVenues();
      expect(venues).toEqual([]);
    });

    it('should return all loaded venues', async () => {
      mockConfigLoader.fileExists.mockResolvedValue(false);
      await manager.loadAllVenues();
      
      const venues = manager.getAllVenues();
      expect(venues.length).toBeGreaterThan(0);
      expect(venues[0]).toHaveProperty('id');
      expect(venues[0]).toHaveProperty('name');
    });
  });

  describe('getVenue', () => {
    it('should return null for non-existent venue', () => {
      const venue = manager.getVenue('non-existent');
      expect(venue).toBeNull();
    });

    it('should return venue by id', async () => {
      mockConfigLoader.fileExists.mockResolvedValue(false);
      await manager.loadAllVenues();
      
      const venue = manager.getVenue('small-club');
      expect(venue).toBeDefined();
      expect(venue?.id).toBe('small-club');
      expect(venue?.name).toBe('Small Club');
    });
  });

  describe('setCurrentVenue', () => {
    it('should set current venue if venue exists', async () => {
      mockConfigLoader.fileExists.mockResolvedValue(false);
      await manager.loadAllVenues();
      
      const result = manager.setCurrentVenue('small-club');
      expect(result).toBe(true);
      expect(manager.getCurrentVenue()?.id).toBe('small-club');
    });

    it('should return false for non-existent venue', () => {
      const result = manager.setCurrentVenue('non-existent');
      expect(result).toBe(false);
      expect(manager.getCurrentVenue()).toBeNull();
    });
  });

  describe('getCurrentVenue', () => {
    it('should return null when no current venue', () => {
      expect(manager.getCurrentVenue()).toBeNull();
    });

    it('should return current venue after setting', async () => {
      mockConfigLoader.fileExists.mockResolvedValue(false);
      await manager.loadAllVenues();
      
      manager.setCurrentVenue('small-club');
      const current = manager.getCurrentVenue();
      expect(current?.id).toBe('small-club');
    });
  });

  describe('addVenue', () => {
    const newVenue: VenueConfig = {
      id: 'test-venue',
      name: 'Test Venue',
      audio: {
        defaultSource: 'microphone',
        sampleRate: 44100,
        bufferSize: 1024,
      },
      dmx: {
        artNet: {
          protocol: 'artnet',
          host: '192.168.1.100',
          port: 6454,
          universe: 0,
          refreshRate: 30,
          maxRetries: 3,
        },
        universes: [0],
        refreshRate: 30,
      },
      lighting: {
        patchFile: 'config/patch-test.json',
        profilesFile: 'config/fixtures.json',
        defaultAttributes: {
          dim: 0.5,
          colorIndex: 0,
          panNorm: 0,
          tiltNorm: 0,
          strobe: 0,
          goboIndex: 0,
        },
      },
      brain: {
        scenesFile: 'config/scenes-test.json',
        rulesFile: 'config/scenes-rules.json',
        effectsFile: 'config/effects.json',
        defaultScene: 'chill',
      },
      performance: {
        fastLoopHz: 30,
        slowLoopHz: 10,
        audioAnalysisWindow: 1024,
        beatDetectionSensitivity: 0.7,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: ['test'],
      venueType: 'club',
    };

    it('should add a new venue', () => {
      const result = manager.addVenue(newVenue);
      expect(result).toBe(true);
      
      const venue = manager.getVenue('test-venue');
      expect(venue).toEqual(newVenue);
    });

    it('should return false for duplicate venue id', () => {
      manager.addVenue(newVenue);
      const result = manager.addVenue(newVenue); // Duplicate
      expect(result).toBe(false);
    });
  });

  describe('updateVenue', () => {
    it('should update existing venue', async () => {
      mockConfigLoader.fileExists.mockResolvedValue(false);
      await manager.loadAllVenues();
      
      const venue = manager.getVenue('small-club');
      expect(venue).toBeDefined();
      
      const updatedVenue = { ...venue!, name: 'Updated Small Club' };
      const result = manager.updateVenue('small-club', updatedVenue);
      expect(result).toBe(true);
      
      const afterUpdate = manager.getVenue('small-club');
      expect(afterUpdate?.name).toBe('Updated Small Club');
    });

    it('should return false for non-existent venue', () => {
      const result = manager.updateVenue('non-existent', {} as VenueConfig);
      expect(result).toBe(false);
    });
  });

  describe('deleteVenue', () => {
    it('should delete existing venue', async () => {
      mockConfigLoader.fileExists.mockResolvedValue(false);
      await manager.loadAllVenues();
      
      const result = manager.deleteVenue('small-club');
      expect(result).toBe(true);
      
      const venue = manager.getVenue('small-club');
      expect(venue).toBeNull();
    });

    it('should return false for non-existent venue', () => {
      const result = manager.deleteVenue('non-existent');
      expect(result).toBe(false);
    });

    it('should clear current venue if it is deleted', async () => {
      mockConfigLoader.fileExists.mockResolvedValue(false);
      await manager.loadAllVenues();
      
      manager.setCurrentVenue('small-club');
      manager.deleteVenue('small-club');
      
      expect(manager.getCurrentVenue()).toBeNull();
    });
  });

  describe('validateVenue', () => {
    it('should validate correct venue configuration', () => {
      const validVenue: VenueConfig = {
        id: 'test',
        name: 'Test',
        audio: {
          defaultSource: 'microphone',
          sampleRate: 44100,
          bufferSize: 1024,
        },
        dmx: {
          artNet: {
            protocol: 'artnet',
            host: '192.168.1.100',
            port: 6454,
            universe: 0,
            refreshRate: 30,
            maxRetries: 3,
          },
          universes: [0],
          refreshRate: 30,
        },
        lighting: {
          patchFile: 'config/patch.json',
          profilesFile: 'config/fixtures.json',
          defaultAttributes: {
            dim: 0.5,
            colorIndex: 0,
            panNorm: 0,
            tiltNorm: 0,
            strobe: 0,
            goboIndex: 0,
          },
        },
        brain: {
          scenesFile: 'config/scenes.json',
          rulesFile: 'config/rules.json',
          effectsFile: 'config/effects.json',
          defaultScene: 'chill',
        },
        performance: {
          fastLoopHz: 30,
          slowLoopHz: 10,
          audioAnalysisWindow: 1024,
          beatDetectionSensitivity: 0.7,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: [],
        venueType: 'club',
      };

      const result = manager.validateVenue(validVenue);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid venue configuration', () => {
      const invalidVenue: VenueConfig = {
        id: '',
        name: '',
        audio: {
          defaultSource: 'microphone',
          sampleRate: 0, // Invalid
          bufferSize: 0, // Invalid
        },
        dmx: {
          artNet: {
            protocol: 'artnet',
            host: '', // Invalid
            port: 6454,
            universe: 0,
            refreshRate: 0, // Invalid
            maxRetries: 3,
          },
          universes: [0],
          refreshRate: 0, // Invalid
        },
        lighting: {
          patchFile: '', // Invalid
          profilesFile: 'config/fixtures.json',
          defaultAttributes: {
            dim: 0.5,
            colorIndex: 0,
            panNorm: 0,
            tiltNorm: 0,
            strobe: 0,
            goboIndex: 0,
          },
        },
        brain: {
          scenesFile: '', // Invalid
          rulesFile: 'config/rules.json',
          effectsFile: 'config/effects.json',
          defaultScene: 'chill',
        },
        performance: {
          fastLoopHz: 0, // Invalid
          slowLoopHz: 0, // Invalid
          audioAnalysisWindow: 0, // Invalid
          beatDetectionSensitivity: 0.7,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: [],
        venueType: 'club',
      };

      const result = manager.validateVenue(invalidVenue);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('getStatistics', () => {
    it('should return statistics', async () => {
      mockConfigLoader.fileExists.mockResolvedValue(false);
      await manager.loadAllVenues();
      
      const stats = manager.getStatistics();
      expect(stats.totalVenues).toBeGreaterThan(0);
      expect(stats.currentVenue).toBe('small-club');
      expect(stats.venueTypes).toBeDefined();
    });

    it('should count venue types correctly', async () => {
      mockConfigLoader.fileExists.mockResolvedValue(false);
      await manager.loadAllVenues();
      
      manager.setCurrentVenue('small-club');
      const stats = manager.getStatistics();
      
      expect(stats.currentVenue).toBe('small-club');
      expect(stats.venueTypes['club']).toBeDefined();
    });
  });

  describe('resetToDefault', () => {
    it('should reset to first venue', async () => {
      mockConfigLoader.fileExists.mockResolvedValue(false);
      await manager.loadAllVenues();
      
      manager.resetToDefault();
      const current = manager.getCurrentVenue();
      expect(current).toBeDefined();
      expect(current?.id).toBe('small-club');
    });

    it('should do nothing when no venues', () => {
      manager.resetToDefault();
      expect(manager.getCurrentVenue()).toBeNull();
    });
  });
});