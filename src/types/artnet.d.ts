declare module "artnet" {
  export interface ArtNetOptions {
    host?: string;
    port?: number;
    refresh?: number;
    iface?: string;
    sendAll?: boolean;
  }

  export interface ArtNetClient {
    set(
      universe: number,
      data: number[],
      callback?: (err: Error | null, res: any) => void,
    ): void;
    set(
      universe: number,
      channel: number,
      data: number[],
      callback?: (err: Error | null, res: any) => void,
    ): void;
    close(): void;
  }

  /*
   * The module exports a function that returns an ArtNetClient.
   * To use it with `import * as ArtNet from 'artnet'`, we can try this:
   */
  function createClient(options?: ArtNetOptions): ArtNetClient;
  export = createClient;
}
