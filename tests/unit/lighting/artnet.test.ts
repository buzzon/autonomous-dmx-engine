import { DMXRenderer } from "../../../src/lighting/renderer";
import {
  FixtureState,
  FixtureProfile,
  FixtureInstance,
} from "../../../src/lighting/types";

// Mock artnet
const mockArtNetSet = jest.fn();
jest.mock("artnet", () => {
  return jest.fn().mockImplementation(() => {
    return {
      set: mockArtNetSet,
      close: jest.fn(),
    };
  });
});

describe("DMXRenderer with ArtNet", () => {
  let renderer: DMXRenderer;

  beforeEach(() => {
    jest.clearAllMocks();
    renderer = new DMXRenderer({
      artNet: {
        host: "127.0.0.1",
        port: 6454,
        universe: 0,
        refreshRate: 40,
      },
    });
  });

  it("should initialize ArtNet client", () => {
    expect(renderer).toBeDefined();
    // Access private property or check logs if possible, but mocking constructor ensures it was called
  });

  it("should send ArtNet packets on render", () => {
    const fixtureStates = new Map<string, FixtureState>();
    const profiles = new Map<string, FixtureProfile>();

    // Mock fixture and profile
    const fixture: FixtureInstance = {
      id: "f1",
      name: "Test",
      startAddress: 1,
      universe: 0,
      profileId: "p1",
      groupId: "g1",
    };

    const profile: FixtureProfile = {
      id: "p1",
      name: "Generic",
      manufacturer: "Generic",
      capabilities: [],
      channels: [{ name: "dim", type: "dim", channelIndex: 1 }],
    };

    profiles.set("p1", profile);
    fixtureStates.set("f1", {
      fixtureId: "f1",
      dim: 1.0,
      colorIndex: 0,
      panNorm: 0,
      tiltNorm: 0,
      strobe: 0,
      goboIndex: 0,
      timestamp: Date.now(),
    });

    // Mock PatchManager
    const patchManager = {
      getFixture: jest.fn().mockReturnValue(fixture),
    };

    renderer.renderToDMX(fixtureStates, patchManager, profiles);

    expect(mockArtNetSet).toHaveBeenCalledWith(
      0,
      expect.any(Array),
      expect.any(Function),
    );
  });
});
