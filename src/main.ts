/**
 * Main Entry Point
 * Wires up the full application stack:
 * - Express Static Server (UI)
 * - WebSocket API (Real-time control)
 * - Audio Analyzer (Real input)
 * - Brain & Lighting Facades
 * - Core Engine
 */

import express from "express";
import http from "http";
import path from "path";
import { defaultLogger } from "./utils/logger";
import { defaultConfigLoader } from "./utils/config";
import { AudioAnalyzer } from "./audio/analyzer";
import { MicAudioSource } from "./audio/sources/mic-source";
import { BrainFacade } from "./brain/facade";
import { LightingFacade } from "./lighting/facade";
import { WebSocketAPI } from "./control/websocket";
import { Engine } from "./engine/engine";

const logger = defaultLogger.child({ module: "Main" });

async function main() {
  try {
    logger.info("Starting Autonomous DMX Engine (Phase 2)...");

    // 1. Load Configurations
    logger.info("Loading configurations...");
    const configLoader = defaultConfigLoader;
    const configs = await configLoader.loadAll();

    // 2. Initialize Web Server & Control API
    const app = express();
    const server = http.createServer(app);
    const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;

    // Serve Static UI
    // Assuming UI build is in dist/control/webui or src/control/webui
    const uiPath = path.join(__dirname, "control/webui");
    app.use(express.static(uiPath));
    logger.info(`Serving UI from ${uiPath}`);

    const controlAPI = new WebSocketAPI(port);
    await controlAPI.start(server);

    // 3. Initialize Core Components

    // Audio Analyzer
    const audioAnalyzer = new AudioAnalyzer({
      sampleRate: 44100,
      frameSize: 1024,
      hopSize: 512,
      beatThresholdCoeff: 1.5,
      minBeatInterval: 100, // ms
      bpmSmoothingBeta: 0.9,
      energySmoothingAlpha: 0.9,
      moodUpdateInterval: 1000,
      historySize: 100,
      moodEnergyThresholdLow: 0.3,
      moodEnergyThresholdHigh: 0.7,
      moodBpmThresholdLow: 80,
      moodBpmThresholdHigh: 140,
    });

    // Initialize Microphone Source
    const micSource = new MicAudioSource(audioAnalyzer);
    micSource.start();
    logger.info("Microphone source started");

    // Brain Facade
    const brainFacade = new BrainFacade({
      stateMachine: {
        energyThresholdLow: 0.3,
        energyThresholdHigh: 0.7,
        hysteresis: 0.1,
        manualOverrideTimeout: 30000,
      },
      sceneSelector: {
        defaultSceneId: "default", // Ensure this ID exists or use one from configs
        historySize: 10,
        cooldownEnabled: true,
        randomSelection: true,
      },
      effectEngine: {
        defaultEffectHandlers: {},
        effectRegistryPath: "./config/effects.json",
      },
    });

    // Manually load scenes from config if available, otherwise Brain use defaults
    if (configs.scenes?.scenes) {
      // Note: BrainFacade currently doesn't expose loadScenes directly in the simplified version
      // We might need to extend BrainFacade or rely on its internal config loading if implemented
      // For now, we rely on the constructor config.
      // TODO: Enhance BrainFacade key methods to accept external data
      (brainFacade as any).sceneSelector.loadScenes(configs.scenes.scenes);
    }
    if (configs.scenesRules?.rules) {
      (brainFacade as any).sceneSelector.loadRules(configs.scenesRules.rules);
    }

    // Lighting Facade
    const lightingFacade = new LightingFacade({
      artNet: {
        host: "127.0.0.1", // Default, should be configurable
        port: 6454,
        universe: 1,
        refreshRate: 40,
      },
      mergeRules: {
        priority: ["base", "effects", "overrides"],
        blendModes: { dim: "multiply", color: "replace", position: "replace" },
        globalDim: 1,
        blackout: false,
      },
      defaultAttributes: {},
      enableDMXOutput: true, // Enable real DMX output
    });
    await lightingFacade.initialize();

    // 4. Initialize Engine
    const engine = new Engine(
      audioAnalyzer,
      brainFacade,
      lightingFacade,
      controlAPI,
      {
        fastTickInterval: 40,
        slowTickInterval: 500,
        enableHotReload: true,
        maxFastLoopTime: 20,
      },
    );

    // 5. Start Everything
    server.listen(port, () => {
      logger.info(`Web UI & Control API listening on port ${port}`);
    });

    engine.start();

    // Graceful Shutdown
    const shutdown = async () => {
      logger.info("Shutting down...");
      await engine.stop();
      server.close();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    logger.error("Failed to start application", { error });
    process.exit(1);
  }
}

// Run main
if (require.main === module) {
  main();
}
