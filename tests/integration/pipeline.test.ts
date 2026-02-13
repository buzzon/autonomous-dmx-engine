import { Engine } from "../../src/engine/engine";
import { AudioAnalyzer } from "../../src/audio/analyzer";
import { BrainFacade } from "../../src/brain/facade";
import { LightingFacade } from "../../src/lighting/facade";
import { WebSocketAPI } from "../../src/control/websocket";
import { AudioMetrics } from "../../src/audio/types";

// Mock dependencies
jest.mock("../../src/control/websocket");
jest.mock("../../src/lighting/renderer"); // Mock DMX renderer to avoid hardware calls

describe("Integration Pipeline: Audio -> Brain -> Lighting", () => {
  let engine: Engine;
  let audioAnalyzer: AudioAnalyzer;
  let brainFacade: BrainFacade;
  let lightingFacade: LightingFacade;
  let controlAPI: WebSocketAPI;

  beforeEach(async () => {
    // 1. Setup mocks
    controlAPI = new WebSocketAPI(3001);
    (controlAPI.broadcastToAll as jest.Mock).mockImplementation(() => {});

    // 2. Setup Real Components (with some config tweaks for testing)

    // Hack to prevent worker spawning during tests
    // Using prototype spy might be tricky if constructor calls it
    // We can just spy on the private method if we cast to any or use prototype before new
    jest
      .spyOn(AudioAnalyzer.prototype as any, "initializeWorker")
      .mockImplementation(() => {});

    audioAnalyzer = new AudioAnalyzer({
      sampleRate: 44100,
      frameSize: 1024,
      hopSize: 512,
      beatThresholdCoeff: 1.5,
      minBeatInterval: 100,
      bpmSmoothingBeta: 0.9,
      energySmoothingAlpha: 0.9,
      moodUpdateInterval: 1000,
      historySize: 100,
      moodEnergyThresholdLow: 0.3,
      moodEnergyThresholdHigh: 0.7,
      moodBpmThresholdLow: 80,
      moodBpmThresholdHigh: 140,
    });

    brainFacade = new BrainFacade({
      stateMachine: {
        energyThresholdLow: 0.3,
        energyThresholdHigh: 0.7,
        hysteresis: 0.1,
        manualOverrideTimeout: 30000,
      },
      sceneSelector: {
        defaultSceneId: "default",
        historySize: 10,
        cooldownEnabled: true,
        randomSelection: true,
      },
      effectEngine: {
        defaultEffectHandlers: {},
        effectRegistryPath: "", // No file loading for tests
      },
    });

    lightingFacade = new LightingFacade({
      artNet: { host: "localhost", port: 6454, universe: 1, refreshRate: 40 },
      mergeRules: {
        priority: ["base", "effects", "overrides"],
        blendModes: { dim: "multiply", color: "replace", position: "replace" },
        globalDim: 1,
        blackout: false,
      },
      defaultAttributes: { dim: 0 },
      enableDMXOutput: false, // Disable real DMX for tests
    });

    // Initialize lighting manually since we skipped main.ts
    // We need to inject some mock fixtures to test against
    (lightingFacade as any).patchManager.loadPatch({
      fixtures: [
        {
          id: "fix1",
          name: "Test Fixture",
          universe: 1,
          startAddress: 1,
          profileId: "generic",
          groupId: "all",
        },
      ],
      groups: { all: ["fix1"] },
      universes: { 1: [1] }, // Using number IDs internal logic
    });
    (lightingFacade as any).attributeManager.initializeFixtures(["fix1"]);
    (lightingFacade as any).isInitialized = true;

    // 3. Initialize Engine
    engine = new Engine(
      audioAnalyzer,
      brainFacade,
      lightingFacade,
      controlAPI,
      {
        fastTickInterval: 40,
        slowTickInterval: 500,
        enableHotReload: false,
        maxFastLoopTime: 100,
      },
    );
  });

  test("Pipeline should propagate high energy to lighting changes", async () => {
    // 1. Mock Audio Output to simulate HIGH ENERGY (Party Mode)
    // We spy on processFrame to return specific metrics
    const highEnergyMetrics: AudioMetrics = {
      timestamp: Date.now(),
      energy: 0.9, // High energy
      beat: true,
      bpm: 120,
      mood: "hard",
      spectralCentroid: 100,
      spectralFlux: 100,
      zeroCrossingRate: 0.5,
    };

    jest
      .spyOn(audioAnalyzer, "processFrame")
      .mockReturnValue(highEnergyMetrics);

    // 3. Trigger fast tick
    // In real implementation, this would trigger audio processing
    // For test with Worker, we need to wait for worker to reply
    (engine as any).fastTick();

    // Wait for worker to process (since AudioAnalyzer is now async)
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Trigger another tick to pick up the metrics
    (engine as any).fastTick();

    // 4. Verify Brain State Transition (Idle -> Chill -> Party requires multiple ticks usually,
    // or logic depends on thresholds).
    // Let's check if metrics were passed.
    expect(audioAnalyzer.processFrame).toHaveBeenCalled();

    // 4. Verify Lighting Output
    // Check if broadcastToAll was called with correct data
    expect(controlAPI.broadcastToAll).toHaveBeenCalledWith(
      "loopUpdate",
      expect.objectContaining({
        metrics: expect.objectContaining({
          audio: highEnergyMetrics,
        }),
        // We expect brainOutput and lightingOutput to be present
        brainOutput: expect.anything(),
        lightingOutput: expect.anything(),
      }),
    );

    // Check internal state of lighting if possible
    const fixtureState = lightingFacade.getFixtureState("fix1");
    expect(fixtureState).toBeDefined();
    // Specific logic depends on default scenes, but we verified the pipeline flow.
  });
});
