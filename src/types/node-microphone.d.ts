declare module "node-microphone" {
  interface MicrophoneOptions {
    rate?: number;
    channels?: number;
    debug?: boolean;
    device?: string;
  }

  class Microphone {
    constructor(options?: MicrophoneOptions);
    startRecording(): any;
    stopRecording(): void;
  }

  export default Microphone;
}
