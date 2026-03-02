/**
 * Socket.IO utilities for DMX Engine UI
 */

import { io, Socket } from 'socket.io-client';
import { SocketState } from '../types/ui';
import { store } from '../store/store';

export class SocketManager {
  private socket: Socket | null = null;
  private state: SocketState = { isConnected: false };
  private listeners: Map<string, Function[]> = new Map();

  constructor(private url: string = window.location.origin) {}

  connect(): void {
    if (this.socket?.connected) {
      return;
    }

    this.socket = io(this.url, {
      path: '/ws',
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    this.setupEventHandlers();
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.state.isConnected = false;
    }
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      this.state.isConnected = true;
      this.state.lastPing = Date.now();
      this.emit('connect', this.state);
      
      // Authenticate with server
      this.socket?.emit('authenticate', {
        type: 'authenticate',
        token: 'demo-token-phase-3',
        timestamp: Date.now(),
      });
    });

    this.socket.on('disconnect', () => {
      this.state.isConnected = false;
      this.emit('disconnect', this.state);
    });

    this.socket.on('stateUpdate', (data: any) => {
      this.emit('stateUpdate', data);
      
      // Update store with system state
      if (data.systemState) {
        store.updateSystemState(data.systemState);
      }
    });

    this.socket.on('loopUpdate', (data: any) => {
      this.emit('loopUpdate', data);
      
      // Update store with real-time data
      if (data.metrics) {
        // Audio metrics
        if (data.metrics.audio) {
          store.updateAudioMetrics(data.metrics.audio);
          
          // Update real-time audio data
          if (data.metrics.audio.waveform) {
            store.updateAudioData({ waveform: data.metrics.audio.waveform });
          }
          if (data.metrics.audio.spectrum) {
            store.updateAudioData({ spectrum: data.metrics.audio.spectrum });
          }
        }
        
        // DMX data
        if (data.metrics.dmx) {
          store.updateDMXData({ channels: data.metrics.dmx.channels || [] });
        }
        
        // System metrics
        if (data.metrics.system) {
          store.updateSystemMetrics(data.metrics.system);
        }
      }
    });

    this.socket.on('initialState', (data: any) => {
      this.emit('initialState', data);
      
      if (data.systemState) {
        store.updateSystemState(data.systemState);
      }
    });

    // Real-time audio data stream
    this.socket.on('audioData', (data: any) => {
      this.emit('audioData', data);
      
      if (data.waveform) {
        store.updateAudioData({ waveform: data.waveform });
      }
      if (data.spectrum) {
        store.updateAudioData({ spectrum: data.spectrum });
      }
      if (data.peaks) {
        store.updateAudioData({ peaks: data.peaks });
      }
    });

    // Real-time DMX data stream
    this.socket.on('dmxData', (data: any) => {
      this.emit('dmxData', data);
      
      if (data.channels) {
        store.updateDMXData({ channels: data.channels });
      }
      if (data.fixtures) {
        store.updateDMXData({ fixtures: data.fixtures });
      }
    });

    // System metrics stream
    this.socket.on('systemMetrics', (data: any) => {
      this.emit('systemMetrics', data);
      
      store.updateSystemMetrics(data);
    });

    this.socket.on('error', (error: any) => {
      this.state.error = error.message || 'Unknown socket error';
      this.emit('error', error);
    });

    this.socket.on('pong', (latency: number) => {
      this.state.latency = latency;
    });
  }

  sendCommand(type: string, payload: any): void {
    if (!this.socket || !this.state.isConnected) {
      console.warn('Socket not connected, command not sent:', type);
      return;
    }

    const command = {
      type: 'command',
      data: {
        type,
        payload,
        timestamp: Date.now(),
        commandId: `cmd-${Date.now()}`,
      },
    };

    this.socket.emit('command', command);
    this.emit('commandSent', { type, payload });
  }

  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off(event: string, callback: Function): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  private emit(event: string, data: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  getState(): SocketState {
    return { ...this.state };
  }

  isConnected(): boolean {
    return this.state.isConnected;
  }
}

// Singleton instance for global use
export const socketManager = new SocketManager();