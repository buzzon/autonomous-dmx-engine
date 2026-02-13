import Microphone from "node-microphone";
import { AudioAnalyzer } from "../analyzer";
import { defaultLogger } from "../../utils/logger";

export class MicAudioSource {
  private mic: any;
  private stream: any;
  private analyzer: AudioAnalyzer;
  private logger = defaultLogger.child({ module: "MicAudioSource" });
  private isRecording: boolean = false;

  constructor(analyzer: AudioAnalyzer, device?: string) {
    this.analyzer = analyzer;
    this.mic = new Microphone({
      rate: 44100,
      channels: 1,
      debug: false,
      device: device || "default",
    });
  }

  public start() {
    if (this.isRecording) return;

    this.logger.info("Starting microphone capture...");
    try {
      this.stream = this.mic.startRecording();
      this.isRecording = true;

      const frameSize = 1024; // Should match analyzer config if possible, or we buffer
      let buffer: number[] = [];

      this.stream.on("data", (data: Buffer) => {
        // Convert Buffer (int16 usually) to Float32
        for (let i = 0; i < data.length; i += 2) {
          const int16 = data.readInt16LE(i);
          const float32 = int16 / 32768.0;
          buffer.push(float32);

          if (buffer.length >= frameSize) {
            const frame = new Float32Array(buffer);
            // Push to analyzer
            this.analyzer.processFrame(frame, Date.now());
            buffer = [];
          }
        }
      });

      this.stream.on("error", (err: any) => {
        this.logger.error("Microphone stream error", err);
      });
    } catch (error) {
      this.logger.error("Failed to start microphone", { error });
    }
  }

  public stop() {
    if (!this.isRecording) return;
    this.mic.stopRecording();
    this.isRecording = false;
    this.logger.info("Microphone capture stopped");
  }
}
