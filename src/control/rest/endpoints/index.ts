/**
 * REST API Endpoints
 */

import { Express, Request, Response } from 'express';
import { defaultLogger } from '../../../utils/logger';
import { ControlAPI } from '../../api';
import { VenueConfigManager } from '../../../config/venue';
import { BrainFacade } from '../../../brain/facade';
import { LightingFacade } from '../../../lighting/facade';
import { AudioAnalyzer } from '../../../audio/analyzer';
import { AuthRequest, requirePermission } from '../auth';

const logger = defaultLogger.child({ module: 'RESTEndpoints' });

/**
 * Setup all REST API endpoints
 */
export function setupEndpoints(app: Express): void {
  // Status endpoints
  app.get('/api/status', getStatus);
  app.get('/api/health', getHealth);
  
  // Metrics endpoints
  app.get('/api/metrics', getMetrics);
  app.get('/api/metrics/audio', getAudioMetrics);
  app.get('/api/metrics/system', getSystemMetrics);
  
  // Configuration endpoints
  app.get('/api/config', getConfig);
  app.post('/api/config/reload', reloadConfig);
  app.get('/api/config/venues', getVenues);
  app.post('/api/config/venues/:venueId/switch', switchVenue);
  
  // Control endpoints
  app.post('/api/control/mode', setMode);
  app.post('/api/control/intensity', setIntensity);
  app.post('/api/control/blackout', setBlackout);
  app.post('/api/control/scene', setScene);
  app.post('/api/control/effect', toggleEffect);
  app.post('/api/control/preset/save', savePreset);
  app.post('/api/control/preset/load', loadPreset);
  
  // Fixture endpoints
  app.get('/api/fixtures', getFixtures);
  app.get('/api/fixtures/:fixtureId', getFixture);
  app.post('/api/fixtures/:fixtureId/control', controlFixture);
  
  // Scene endpoints
  app.get('/api/scenes', getScenes);
  app.get('/api/scenes/current', getCurrentScene);
  app.post('/api/scenes/select', selectScene);
  
  // Log endpoints
  app.get('/api/logs', getLogs);
  app.get('/api/logs/:level', getLogsByLevel);
  
  logger.info('REST endpoints registered');
}

// Service references (to be injected)
let controlAPI: ControlAPI | null = null;
let venueManager: VenueConfigManager | null = null;
let brainFacade: BrainFacade | null = null;
let lightingFacade: LightingFacade | null = null;
let audioAnalyzer: AudioAnalyzer | null = null;

/**
 * Set service references (dependency injection)
 */
export function setServices(
  control: ControlAPI,
  venue: VenueConfigManager,
  brain: BrainFacade,
  lighting: LightingFacade,
  audio: AudioAnalyzer
): void {
  controlAPI = control;
  venueManager = venue;
  brainFacade = brain;
  lightingFacade = lighting;
  audioAnalyzer = audio;
  logger.info('Services injected into REST endpoints');
}

// ========== Status Endpoints ==========

async function getStatus(req: Request, res: Response): Promise<void> {
  try {
    const status = {
      timestamp: Date.now(),
      service: 'autonomous-dmx-engine',
      version: process.env.npm_package_version || '0.1.0',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      system: {
        platform: process.platform,
        node: process.version,
      },
      components: {
        controlAPI: controlAPI?.getState()?.isRunning ?? false,
        brain: brainFacade?.getCurrentBrainState() ?? 'unknown',
        lighting: lightingFacade ? 'available' : 'unavailable',
        audio: audioAnalyzer ? 'available' : 'unavailable',
      },
    };
    
    res.json({
      success: true,
      data: status,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Error getting status', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: Date.now(),
    });
  }
}

async function getHealth(req: Request, res: Response): Promise<void> {
  try {
    const healthChecks = [
      { component: 'controlAPI', healthy: controlAPI?.getState()?.isRunning ?? false },
      { component: 'brain', healthy: !!brainFacade },
      { component: 'lighting', healthy: !!lightingFacade },
      { component: 'audio', healthy: !!audioAnalyzer },
    ];
    
    const allHealthy = healthChecks.every(check => check.healthy);
    
    res.json({
      success: true,
      data: {
        healthy: allHealthy,
        checks: healthChecks,
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Error getting health', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: Date.now(),
    });
  }
}

// ========== Metrics Endpoints ==========

async function getMetrics(req: Request, res: Response): Promise<void> {
  try {
    // In a real implementation, collect metrics from all components
    const metrics = {
      audio: audioAnalyzer?.getState() || null,
      brain: brainFacade?.getState() || null,
      lighting: lightingFacade ? 'available' : 'unavailable',
      system: {
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        timestamp: Date.now(),
      },
    };
    
    res.json({
      success: true,
      data: metrics,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Error getting metrics', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: Date.now(),
    });
  }
}

async function getAudioMetrics(req: Request, res: Response): Promise<void> {
  try {
    const metrics = audioAnalyzer?.getState();
    if (!metrics) {
      res.status(503).json({
        success: false,
        error: 'Audio analyzer not available',
        timestamp: Date.now(),
      });
      return;
    }
    
    res.json({
      success: true,
      data: metrics,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Error getting audio metrics', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: Date.now(),
    });
  }
}

async function getSystemMetrics(req: Request, res: Response): Promise<void> {
  try {
    const systemMetrics = {
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      uptime: process.uptime(),
      timestamp: Date.now(),
      activeConnections: controlAPI?.getState()?.connectedClients || 0,
    };
    
    res.json({
      success: true,
      data: systemMetrics,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Error getting system metrics', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: Date.now(),
    });
  }
}

// ========== Configuration Endpoints ==========

async function getConfig(req: Request, res: Response): Promise<void> {
  try {
    const config = {
      venue: venueManager?.getCurrentVenue() || null,
      availableVenues: venueManager?.getAllVenues() || [],
      brainConfig: brainFacade ? 'available' : 'unavailable',
      lightingConfig: lightingFacade ? 'available' : 'unavailable',
    };
    
    res.json({
      success: true,
      data: config,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Error getting config', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: Date.now(),
    });
  }
}

async function reloadConfig(req: Request, res: Response): Promise<void> {
  try {
    // Trigger config reload in all components
    await Promise.all([
      brainFacade?.reloadConfigs(),
      // lightingFacade?.reloadConfigs(),
      // venueManager?.reload(),
    ]);
    
    res.json({
      success: true,
      data: { message: 'Config reload initiated' },
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Error reloading config', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: Date.now(),
    });
  }
}

async function getVenues(req: Request, res: Response): Promise<void> {
  try {
    const venues = venueManager?.getAllVenues() || [];
    
    res.json({
      success: true,
      data: venues,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Error getting venues', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: Date.now(),
    });
  }
}

async function switchVenue(req: Request, res: Response): Promise<void> {
  try {
    const venueId = req.params.venueId as string;
    
    if (!venueManager) {
      res.status(503).json({
        success: false,
        error: 'Venue manager not available',
        timestamp: Date.now(),
      });
      return;
    }
    
    const success = await venueManager.switchVenue(venueId);
    
    if (success) {
      res.json({
        success: true,
        data: {
          venueId,
          switched: true,
          venue: venueManager.getCurrentVenue(),
        },
        timestamp: Date.now(),
      });
    } else {
      res.status(404).json({
        success: false,
        error: `Venue ${venueId} not found`,
        timestamp: Date.now(),
      });
    }
  } catch (error) {
    logger.error('Error switching venue', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: Date.now(),
    });
  }
}

// ========== Control Endpoints ==========

async function setMode(req: Request, res: Response): Promise<void> {
  try {
    const { mode } = req.body;
    
    if (!mode || !['auto', 'manual', 'scene', 'test'].includes(mode)) {
      res.status(400).json({
        success: false,
        error: 'Invalid mode. Must be one of: auto, manual, scene, test',
        timestamp: Date.now(),
      });
      return;
    }
    
    // In a real implementation, this would call controlAPI.handleCommand
    logger.info('Mode change requested', { mode });
    
    res.json({
      success: true,
      data: { mode },
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Error setting mode', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: Date.now(),
    });
  }
}

async function setIntensity(req: Request, res: Response): Promise<void> {
  try {
    const { intensity } = req.body;
    
    if (typeof intensity !== 'number' || intensity < 0 || intensity > 1) {
      res.status(400).json({
        success: false,
        error: 'Intensity must be a number between 0 and 1',
        timestamp: Date.now(),
      });
      return;
    }
    
    logger.info('Intensity change requested', { intensity });
    
    res.json({
      success: true,
      data: { intensity },
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Error setting intensity', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: Date.now(),
    });
  }
}

async function setBlackout(req: Request, res: Response): Promise<void> {
  try {
    const { enable } = req.body;
    const blackout = enable ?? true;
    
    logger.info('Blackout requested', { blackout });
    
    res.json({
      success: true,
      data: { blackout },
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Error setting blackout', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: Date.now(),
    });
  }
}

async function setScene(req: Request, res: Response): Promise<void> {
  try {
    const { sceneId } = req.body;
    
    if (!sceneId || typeof sceneId !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Scene ID is required',
        timestamp: Date.now(),
      });
      return;
    }
    
    logger.info('Scene change requested', { sceneId });
    
    res.json({
      success: true,
      data: { sceneId },
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Error setting scene', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: Date.now(),
    });
  }
}

async function toggleEffect(req: Request, res: Response): Promise<void> {
  try {
    const { effectId, enabled } = req.body;
    
    if (!effectId || typeof effectId !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Effect ID is required',
        timestamp: Date.now(),
      });
      return;
    }
    
    logger.info('Effect toggle requested', { effectId, enabled });
    
    res.json({
      success: true,
      data: { effectId, enabled: enabled ?? 'toggle' },
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Error toggling effect', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: Date.now(),
    });
  }
}

async function savePreset(req: Request, res: Response): Promise<void> {
  try {
    const { presetId, name, description } = req.body;
    
    if (!presetId || typeof presetId !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Preset ID is required',
        timestamp: Date.now(),
      });
      return;
    }
    
    logger.info('Preset save requested', { presetId, name });
    
    res.json({
      success: true,
      data: {
        presetId,
        saved: true,
        message: 'Preset saved (simulated)',
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Error saving preset', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: Date.now(),
    });
  }
}

async function loadPreset(req: Request, res: Response): Promise<void> {
  try {
    const { presetId } = req.body;
    
    if (!presetId || typeof presetId !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Preset ID is required',
        timestamp: Date.now(),
      });
      return;
    }
    
    logger.info('Preset load requested', { presetId });
    
    res.json({
      success: true,
      data: {
        presetId,
        loaded: true,
        message: 'Preset loaded (simulated)',
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Error loading preset', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: Date.now(),
    });
  }
}

// ========== Fixture Endpoints ==========

async function getFixtures(req: Request, res: Response): Promise<void> {
  try {
    // In a real implementation, get fixtures from lighting facade
    const fixtures = lightingFacade ? [] : [];
    
    res.json({
      success: true,
      data: fixtures,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Error getting fixtures', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: Date.now(),
    });
  }
}

async function getFixture(req: Request, res: Response): Promise<void> {
  try {
    const { fixtureId } = req.params;
    
    // In a real implementation, get fixture details
    const fixture = { id: fixtureId, name: `Fixture ${fixtureId}`, state: {} };
    
    res.json({
      success: true,
      data: fixture,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Error getting fixture', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: Date.now(),
    });
  }
}

async function controlFixture(req: Request, res: Response): Promise<void> {
  try {
    const { fixtureId } = req.params;
    const { state } = req.body;
    
    if (!state || typeof state !== 'object') {
      res.status(400).json({
        success: false,
        error: 'Fixture state object is required',
        timestamp: Date.now(),
      });
      return;
    }
    
    logger.info('Fixture control requested', { fixtureId, state });
    
    res.json({
      success: true,
      data: { fixtureId, state },
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Error controlling fixture', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: Date.now(),
    });
  }
}

// ========== Scene Endpoints ==========

async function getScenes(req: Request, res: Response): Promise<void> {
  try {
    // In a real implementation, get scenes from brain facade
    const scenes = brainFacade ? [] : [];
    
    res.json({
      success: true,
      data: scenes,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Error getting scenes', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: Date.now(),
    });
  }
}

async function getCurrentScene(req: Request, res: Response): Promise<void> {
  try {
    const scene = brainFacade?.getCurrentScene() || null;
    
    res.json({
      success: true,
      data: scene,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Error getting current scene', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: Date.now(),
    });
  }
}

async function selectScene(req: Request, res: Response): Promise<void> {
  try {
    const { sceneId } = req.body;
    
    if (!sceneId || typeof sceneId !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Scene ID is required',
        timestamp: Date.now(),
      });
      return;
    }
    
    // In a real implementation, call brain facade to select scene
    logger.info('Scene selection requested', { sceneId });
    
    res.json({
      success: true,
      data: { sceneId },
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Error selecting scene', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: Date.now(),
    });
  }
}

// ========== Log Endpoints ==========

async function getLogs(req: Request, res: Response): Promise<void> {
  try {
    // In a real implementation, retrieve logs from logger
    const logs: any[] = [];
    
    res.json({
      success: true,
      data: logs,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Error getting logs', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: Date.now(),
    });
  }
}

async function getLogsByLevel(req: Request, res: Response): Promise<void> {
  try {
    const level = req.params.level as string;
    const validLevels = ['error', 'warn', 'info', 'debug'];
    
    if (!validLevels.includes(level)) {
      res.status(400).json({
        success: false,
        error: `Invalid log level. Must be one of: ${validLevels.join(', ')}`,
        timestamp: Date.now(),
      });
      return;
    }
    
    // In a real implementation, retrieve logs by level
    const logs: any[] = [];
    
    res.json({
      success: true,
      data: logs,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Error getting logs by level', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: Date.now(),
    });
  }
}