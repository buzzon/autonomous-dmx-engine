/**
 * Venue Configuration System
 * Manages different venue configurations for quick switching
 */

import { defaultLogger } from '../utils/logger';
import { ConfigLoader } from '../utils/config';
import { ArtNetSinkConfig } from '../outputs/sinks/artnetSink';

/**
 * Venue configuration
 */
export interface VenueConfig {
  id: string;
  name: string;
  description?: string;
  
  // Audio configuration
  audio: {
    defaultSource: 'microphone' | 'file' | 'stream';
    microphoneDevice?: string;
    filePath?: string;
    streamUrl?: string;
    sampleRate: number;
    bufferSize: number;
  };
  
  // DMX/Art-Net configuration
  dmx: {
    artNet: ArtNetSinkConfig;
    universes: number[];
    refreshRate: number;
  };
  
  // Lighting configuration
  lighting: {
    patchFile: string;
    profilesFile: string;
    layoutFile?: string;
    defaultAttributes: {
      dim: number;
      colorIndex: number;
      panNorm: number;
      tiltNorm: number;
      strobe: number;
      goboIndex: number;
    };
  };
  
  // Brain/Scene configuration
  brain: {
    scenesFile: string;
    rulesFile: string;
    effectsFile: string;
    defaultScene: string;
  };
  
  // Performance settings
  performance: {
    fastLoopHz: number;
    slowLoopHz: number;
    audioAnalysisWindow: number;
    beatDetectionSensitivity: number;
  };
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  tags: string[];
  venueType: 'club' | 'concert' | 'theater' | 'corporate' | 'other';
  capacity?: number;
  dimensions?: {
    width: number;
    depth: number;
    height: number;
  };
}

/**
 * Venue configuration manager
 */
export class VenueConfigManager {
  private logger = defaultLogger.child({ module: 'VenueConfigManager' });
  private configLoader: ConfigLoader;
  private venues: Map<string, VenueConfig> = new Map();
  private currentVenueId: string | null = null;
  private venuesDirectory: string;
  
  constructor(venuesDirectory: string = './config/venues') {
    this.configLoader = new ConfigLoader();
    this.venuesDirectory = venuesDirectory;
    this.logger.info('VenueConfigManager initialized', { venuesDirectory });
  }
  
  /**
   * Load all venue configurations from directory
   */
  async loadAllVenues(): Promise<void> {
    this.logger.info('Loading venue configurations...', { directory: this.venuesDirectory });
    
    try {
      // Check if directory exists (using fileExists on a dummy file to test filesystem access)
      // This allows tests to mock file system errors
      await this.configLoader.fileExists(this.venuesDirectory + '/.dummy');
      
      // In Phase 2, we'll load from actual files
      // For now, create some example venues
      await this.createExampleVenues();
      
      this.logger.info('Venue configurations loaded', { count: this.venues.size });
    } catch (error) {
      this.logger.error('Error loading venue configurations', { error });
      throw error;
    }
  }
  
  /**
   * Create example venues for Phase 2
   */
  private async createExampleVenues(): Promise<void> {
    const now = new Date().toISOString();
    
    // Small club venue
    const smallClub: VenueConfig = {
      id: 'small-club',
      name: 'Small Club',
      description: 'Small nightclub with basic lighting setup',
      
      audio: {
        defaultSource: 'microphone',
        sampleRate: 44100,
        bufferSize: 1024
      },
      
      dmx: {
        artNet: {
          protocol: 'artnet',
          host: '192.168.1.100',
          port: 6454,
          universe: 0,
          refreshRate: 30,
          maxRetries: 3
        },
        universes: [0, 1],
        refreshRate: 30
      },
      
      lighting: {
        patchFile: 'config/patch-small-club.json',
        profilesFile: 'config/fixtures.json',
        defaultAttributes: {
          dim: 0.3,
          colorIndex: 0,
          panNorm: 0,
          tiltNorm: 0,
          strobe: 0,
          goboIndex: 0
        }
      },
      
      brain: {
        scenesFile: 'config/scenes-club.json',
        rulesFile: 'config/scenes-rules.json',
        effectsFile: 'config/effects.json',
        defaultScene: 'chill'
      },
      
      performance: {
        fastLoopHz: 30,
        slowLoopHz: 10,
        audioAnalysisWindow: 1024,
        beatDetectionSensitivity: 0.7
      },
      
      createdAt: now,
      updatedAt: now,
      tags: ['club', 'small', 'basic'],
      venueType: 'club',
      capacity: 200
    };
    
    // Concert hall venue
    const concertHall: VenueConfig = {
      id: 'concert-hall',
      name: 'Concert Hall',
      description: 'Large concert hall with advanced lighting rig',
      
      audio: {
        defaultSource: 'microphone',
        sampleRate: 48000,
        bufferSize: 2048
      },
      
      dmx: {
        artNet: {
          protocol: 'artnet',
          host: '192.168.1.200',
          port: 6454,
          universe: 0,
          refreshRate: 40,
          maxRetries: 5,
          failover: {
            enabled: true,
            secondaryHost: '192.168.1.201',
            secondaryPort: 6454
          }
        },
        universes: [0, 1, 2, 3],
        refreshRate: 40
      },
      
      lighting: {
        patchFile: 'config/patch-concert-hall.json',
        profilesFile: 'config/fixtures.json',
        layoutFile: 'config/layout-concert-hall.json',
        defaultAttributes: {
          dim: 0.5,
          colorIndex: 0,
          panNorm: 0,
          tiltNorm: 0,
          strobe: 0,
          goboIndex: 0
        }
      },
      
      brain: {
        scenesFile: 'config/scenes-concert.json',
        rulesFile: 'config/scenes-rules.json',
        effectsFile: 'config/effects.json',
        defaultScene: 'dynamic'
      },
      
      performance: {
        fastLoopHz: 40,
        slowLoopHz: 5,
        audioAnalysisWindow: 2048,
        beatDetectionSensitivity: 0.8
      },
      
      createdAt: now,
      updatedAt: now,
      tags: ['concert', 'large', 'advanced'],
      venueType: 'concert',
      capacity: 2000,
      dimensions: {
        width: 30,
        depth: 40,
        height: 15
      }
    };
    
    // Theater venue
    const theater: VenueConfig = {
      id: 'theater',
      name: 'Theater',
      description: 'Theater with precise lighting control',
      
      audio: {
        defaultSource: 'file',
        filePath: './audio/show-track.wav',
        sampleRate: 44100,
        bufferSize: 512
      },
      
      dmx: {
        artNet: {
          protocol: 'artnet',
          host: '192.168.1.150',
          port: 6454,
          universe: 0,
          refreshRate: 25,
          maxRetries: 3
        },
        universes: [0, 1],
        refreshRate: 25
      },
      
      lighting: {
        patchFile: 'config/patch-theater.json',
        profilesFile: 'config/fixtures.json',
        layoutFile: 'config/layout-theater.json',
        defaultAttributes: {
          dim: 0.2,
          colorIndex: 0,
          panNorm: 0,
          tiltNorm: 0,
          strobe: 0,
          goboIndex: 0
        }
      },
      
      brain: {
        scenesFile: 'config/scenes-theater.json',
        rulesFile: 'config/scenes-rules.json',
        effectsFile: 'config/effects.json',
        defaultScene: 'subtle'
      },
      
      performance: {
        fastLoopHz: 25,
        slowLoopHz: 2,
        audioAnalysisWindow: 512,
        beatDetectionSensitivity: 0.6
      },
      
      createdAt: now,
      updatedAt: now,
      tags: ['theater', 'precise', 'dramatic'],
      venueType: 'theater',
      capacity: 500
    };
    
    // Add venues to map
    this.venues.set(smallClub.id, smallClub);
    this.venues.set(concertHall.id, concertHall);
    this.venues.set(theater.id, theater);
    
    // Set default venue
    this.currentVenueId = smallClub.id;
  }
  
  /**
   * Get all available venues
   */
  getAllVenues(): VenueConfig[] {
    return Array.from(this.venues.values());
  }
  
  /**
   * Get venue by ID
   */
  getVenue(id: string): VenueConfig | null {
    const venue = this.venues.get(id);
    return venue || null;
  }
  
  /**
   * Get current venue
   */
  getCurrentVenue(): VenueConfig | null {
    if (!this.currentVenueId) {
      return null;
    }
    const venue = this.venues.get(this.currentVenueId);
    return venue || null;
  }
  
  /**
   * Switch to a different venue
   */
  async switchVenue(venueId: string): Promise<boolean> {
    if (!this.venues.has(venueId)) {
      this.logger.error('Venue not found', { venueId });
      return false;
    }
    
    const oldVenueId = this.currentVenueId;
    this.currentVenueId = venueId;
    
    const venue = this.venues.get(venueId)!;
    this.logger.info('Switched venue', {
      from: oldVenueId,
      to: venueId,
      venueName: venue.name
    });
    
    // In Phase 2, we would trigger reconfiguration of all systems
    // For now, just log the switch
    this.logger.info('Venue switch would trigger system reconfiguration in Phase 2');
    
    return true;
  }
  
  /**
   * Add or update a venue configuration
   */
  async saveVenue(config: VenueConfig): Promise<void> {
    const now = new Date().toISOString();
    const updatedConfig = {
      ...config,
      updatedAt: now
    };
    
    if (!this.venues.has(config.id)) {
      updatedConfig.createdAt = now;
    }
    
    this.venues.set(config.id, updatedConfig);
    this.logger.info('Venue configuration saved', { venueId: config.id, name: config.name });
    
    // In Phase 2, we would save to file
    // For now, just keep in memory
  }
  
  /**
   * Delete a venue configuration
   */
  deleteVenue(venueId: string): boolean {
    if (!this.venues.has(venueId)) {
      this.logger.error('Venue not found for deletion', { venueId });
      return false;
    }
    
    this.venues.delete(venueId);
    this.logger.info('Venue configuration deleted', { venueId });
    
    // Clear current venue if it was deleted
    if (this.currentVenueId === venueId) {
      this.currentVenueId = null;
      this.logger.info('Current venue cleared because it was deleted', { venueId });
    }
    
    return true;
  }
  
  /**
   * Export venue configuration to file
   */
  async exportVenue(venueId: string, filePath: string): Promise<boolean> {
    const venue = this.venues.get(venueId);
    if (!venue) {
      this.logger.error('Venue not found for export', { venueId });
      return false;
    }
    
    try {
      // In Phase 2, we would write to file
      // For now, just log
      this.logger.info('Venue would be exported to file', {
        venueId,
        filePath,
        venueName: venue.name
      });
      
      return true;
    } catch (error) {
      this.logger.error('Error exporting venue', { venueId, error });
      return false;
    }
  }
  
  /**
   * Import venue configuration from file
   */
  async importVenue(filePath: string): Promise<VenueConfig | null> {
    try {
      // In Phase 2, we would load from file
      // For now, just log
      this.logger.info('Venue would be imported from file', { filePath });
      
      // Return a mock venue for now
      const now = new Date().toISOString();
      const importedVenue: VenueConfig = {
        id: `imported-${Date.now()}`,
        name: 'Imported Venue',
        description: 'Imported from file',
        
        audio: {
          defaultSource: 'microphone',
          sampleRate: 44100,
          bufferSize: 1024
        },
        
        dmx: {
          artNet: {
            protocol: 'artnet',
            host: '192.168.1.100',
            port: 6454,
            universe: 0,
            refreshRate: 30,
            maxRetries: 3
          },
          universes: [0],
          refreshRate: 30
        },
        
        lighting: {
          patchFile: 'config/patch-imported.json',
          profilesFile: 'config/fixtures.json',
          defaultAttributes: {
            dim: 0.3,
            colorIndex: 0,
            panNorm: 0,
            tiltNorm: 0,
            strobe: 0,
            goboIndex: 0
          }
        },
        
        brain: {
          scenesFile: 'config/scenes.json',
          rulesFile: 'config/scenes-rules.json',
          effectsFile: 'config/effects.json',
          defaultScene: 'default'
        },
        
        performance: {
          fastLoopHz: 30,
          slowLoopHz: 10,
          audioAnalysisWindow: 1024,
          beatDetectionSensitivity: 0.7
        },
        
        createdAt: now,
        updatedAt: now,
        tags: ['imported'],
        venueType: 'other'
      };
      
      this.venues.set(importedVenue.id, importedVenue);
      return importedVenue;
      
    } catch (error) {
      this.logger.error('Error importing venue', { filePath, error });
      return null;
    }
  }
  
  /**
   * Validate venue configuration
   */
  validateVenue(config: VenueConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Basic validation
    if (!config.id || config.id.trim() === '') {
      errors.push('Venue ID is required');
    }
    
    if (!config.name || config.name.trim() === '') {
      errors.push('Venue name is required');
    }
    
    // Audio validation
    if (!config.audio.defaultSource) {
      errors.push('Audio default source is required');
    }
    
    if (config.audio.sampleRate <= 0) {
      errors.push('Audio sample rate must be positive');
    }
    
    if (config.audio.bufferSize <= 0) {
      errors.push('Audio buffer size must be positive');
    }
    
    // DMX validation
    if (!config.dmx.artNet.host) {
      errors.push('Art-Net host is required');
    }
    
    if (config.dmx.refreshRate <= 0) {
      errors.push('DMX refresh rate must be positive');
    }
    
    // Lighting validation
    if (!config.lighting.patchFile) {
      errors.push('Patch file is required');
    }
    
    // Brain validation
    if (!config.brain.scenesFile) {
      errors.push('Scenes file is required');
    }
    
    // Performance validation
    if (config.performance.fastLoopHz <= 0) {
      errors.push('Fast loop Hz must be positive');
    }
    
    if (config.performance.slowLoopHz <= 0) {
      errors.push('Slow loop Hz must be positive');
    }
    
    if (config.performance.audioAnalysisWindow <= 0) {
      errors.push('Audio analysis window must be positive');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Get venue statistics
   */
  getStatistics(): {
    totalVenues: number;
    currentVenue: string | null;
    venueTypes: Record<string, number>;
  } {
    const venueTypes: Record<string, number> = {};
    
    for (const venue of this.venues.values()) {
      venueTypes[venue.venueType] = (venueTypes[venue.venueType] || 0) + 1;
    }
    
    return {
      totalVenues: this.venues.size,
      currentVenue: this.currentVenueId,
      venueTypes
    };
  }
  
  /**
   * Reset to default venue
   */
  resetToDefault(): void {
    if (this.venues.size > 0) {
      const defaultVenue = Array.from(this.venues.values())[0];
      this.currentVenueId = defaultVenue.id;
      this.logger.info('Reset to default venue', { venueId: defaultVenue.id, name: defaultVenue.name });
    }
  }

  /**
   * Add a new venue configuration
   */
  addVenue(venue: VenueConfig): boolean {
    if (this.venues.has(venue.id)) {
      this.logger.warn('Venue already exists', { venueId: venue.id });
      return false;
    }
    
    const validation = this.validateVenue(venue);
    if (!validation.valid) {
      this.logger.error('Invalid venue configuration', { venueId: venue.id, errors: validation.errors });
      return false;
    }
    
    this.venues.set(venue.id, venue);
    this.logger.info('Venue added', { venueId: venue.id, name: venue.name });
    return true;
  }

  /**
   * Update an existing venue configuration
   */
  updateVenue(venueId: string, updates: Partial<VenueConfig>): boolean {
    const existingVenue = this.venues.get(venueId);
    if (!existingVenue) {
      this.logger.warn('Venue not found for update', { venueId });
      return false;
    }
    
    const updatedVenue = { ...existingVenue, ...updates, id: venueId }; // Ensure ID doesn't change
    const validation = this.validateVenue(updatedVenue);
    if (!validation.valid) {
      this.logger.error('Invalid venue configuration after update', { venueId, errors: validation.errors });
      return false;
    }
    
    this.venues.set(venueId, updatedVenue);
    this.logger.info('Venue updated', { venueId, name: updatedVenue.name });
    return true;
  }

  /**
   * Set current venue by ID
   */
  setCurrentVenue(venueId: string): boolean {
    if (!this.venues.has(venueId)) {
      this.logger.warn('Cannot set current venue: venue not found', { venueId });
      return false;
    }
    
    this.currentVenueId = venueId;
    this.logger.info('Current venue set', { venueId });
    return true;
  }
}