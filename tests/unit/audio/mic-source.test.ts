import { MicAudioSource } from "../../../src/audio/sources/mic-source";
import { AudioAnalyzer } from "../../../src/audio/analyzer";
import { EventEmitter } from "events";

// Mock node-microphone
jest.mock("node-microphone", () => {
  return jest.fn().mockImplementation(() => {
    return {
      startRecording: jest.fn().mockReturnValue(new EventEmitter()),
      stopRecording: jest.fn(),
    };
  });
});

// Mock AudioAnalyzer
const mockProcessFrame = jest.fn();
const mockAnalyzer = {
  processFrame: mockProcessFrame,
} as unknown as AudioAnalyzer;

describe("MicAudioSource", () => {
  let micSource: MicAudioSource;

  beforeEach(() => {
    jest.clearAllMocks();
    micSource = new MicAudioSource(mockAnalyzer);
  });

  it("should initialize successfully", () => {
    expect(micSource).toBeDefined();
  });

  it("should capture audio and send to analyzer", () => {
    micSource.start();

    // Simulate data stream
    const mockStream = (micSource as any).stream;

    // Create buffer with 1024 samples * 2 bytes (int16)
    const buffer = Buffer.alloc(1024 * 2);
    mockStream.emit("data", buffer);

    expect(mockProcessFrame).toHaveBeenCalled();
  });

  it("should stop recording", () => {
    micSource.start();
    micSource.stop();
    expect((micSource as any).isRecording).toBe(false);
  });
});
