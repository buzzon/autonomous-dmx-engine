/**
 * Simple state management for DMX Engine UI
 * Observer pattern implementation
 */

import { UISystemState, AudioMetrics, SocketState } from '../types/ui';
import { SystemMode } from '../../../engine/types';

export interface AppState {
  system: UISystemState;
  audio: AudioMetrics;
  socket: SocketState;
  ui: {
    theme: 'dark' | 'light';
    layout: 'compact' | 'expanded' | 'dashboard';
    showDebug: boolean;
    currentPage: 'home' | 'audio' | 'dmx' | 'scenes' | 'settings';
    sidebarCollapsed: boolean;
  };
  
  // Real-time data
  realtime: {
    audioData: {
      waveform: number[];
      spectrum: number[];
      peaks: number[];
    };
    dmxData: {
      channels: number[];
      fixtures: Array<{
        id: number;
        name: string;
        values: number[];
      }>;
    };
    systemMetrics: {
      cpu: number;
      memory: number;
      fps: number;
    };
  };
}

type Listener = (state: AppState) => void;
type Unsubscribe = () => void;

class Store {
  private state: AppState;
  private listeners: Listener[] = [];

  constructor() {
    // Initial state
    this.state = {
      system: {
        mode: 'manual' as SystemMode,
        globalIntensity: 0.5,
        blackout: false,
        activeStyleId: undefined,
        activeSceneId: undefined,
        manualOverrides: new Map(),
        lastUserActivity: Date.now(),
        uiTheme: 'dark',
        uiLayout: 'compact',
        showDebugPanel: false,
        showAudioMetrics: true,
      },
      audio: {
        energy: 0,
        isBeat: false,
        bpm: undefined,
        frequencyBands: undefined,
        mood: undefined,
      },
      socket: {
        isConnected: false,
        lastPing: undefined,
        latency: undefined,
        error: undefined,
      },
      ui: {
        theme: 'dark',
        layout: 'compact',
        showDebug: false,
        currentPage: 'home',
        sidebarCollapsed: false,
      },
      realtime: {
        audioData: {
          waveform: [],
          spectrum: [],
          peaks: [],
        },
        dmxData: {
          channels: new Array(512).fill(0),
          fixtures: [],
        },
        systemMetrics: {
          cpu: 0,
          memory: 0,
          fps: 0,
        },
      },
    };
  }

  getState(): AppState {
    return { ...this.state };
  }

  setState(updater: Partial<AppState> | ((state: AppState) => Partial<AppState>)): void {
    const newPartialState = typeof updater === 'function' ? updater(this.state) : updater;
    
    this.state = {
      ...this.state,
      ...newPartialState,
    };

    this.notifyListeners();
  }

  updateSystemState(updates: Partial<UISystemState>): void {
    this.setState({
      system: {
        ...this.state.system,
        ...updates,
      },
    });
  }

  updateAudioMetrics(updates: Partial<AudioMetrics>): void {
    this.setState({
      audio: {
        ...this.state.audio,
        ...updates,
      },
    });
  }

  updateSocketState(updates: Partial<SocketState>): void {
    this.setState({
      socket: {
        ...this.state.socket,
        ...updates,
      },
    });
  }

  subscribe(listener: Listener): Unsubscribe {
    this.listeners.push(listener);
    
    // Immediately call with current state
    listener(this.getState());

    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(): void {
    const currentState = this.getState();
    this.listeners.forEach(listener => {
      try {
        listener(currentState);
      } catch (error) {
        console.error('Store listener error:', error);
      }
    });
  }

  // Action creators
  setMode(mode: SystemMode): void {
    this.updateSystemState({ mode });
  }

  setIntensity(intensity: number): void {
    this.updateSystemState({ globalIntensity: Math.max(0, Math.min(1, intensity)) });
  }

  setBlackout(blackout: boolean): void {
    this.updateSystemState({ blackout });
  }

  toggleDebug(): void {
    this.setState({
      ui: {
        ...this.state.ui,
        showDebug: !this.state.ui.showDebug,
      },
    });
  }

  toggleTheme(): void {
    const newTheme = this.state.ui.theme === 'dark' ? 'light' : 'dark';
    this.setState({
      ui: {
        ...this.state.ui,
        theme: newTheme,
      },
    });
  }

  setLayout(layout: 'compact' | 'expanded' | 'dashboard'): void {
    this.setState({
      ui: {
        ...this.state.ui,
        layout,
      },
    });
  }

  setCurrentPage(page: 'home' | 'audio' | 'dmx' | 'scenes' | 'settings'): void {
    this.setState({
      ui: {
        ...this.state.ui,
        currentPage: page,
      },
    });
  }

  toggleSidebar(): void {
    this.setState({
      ui: {
        ...this.state.ui,
        sidebarCollapsed: !this.state.ui.sidebarCollapsed,
      },
    });
  }

  updateAudioData(data: Partial<AppState['realtime']['audioData']>): void {
    this.setState({
      realtime: {
        ...this.state.realtime,
        audioData: {
          ...this.state.realtime.audioData,
          ...data,
        },
      },
    });
  }

  updateDMXData(data: Partial<AppState['realtime']['dmxData']>): void {
    this.setState({
      realtime: {
        ...this.state.realtime,
        dmxData: {
          ...this.state.realtime.dmxData,
          ...data,
        },
      },
    });
  }

  updateSystemMetrics(metrics: Partial<AppState['realtime']['systemMetrics']>): void {
    this.setState({
      realtime: {
        ...this.state.realtime,
        systemMetrics: {
          ...this.state.realtime.systemMetrics,
          ...metrics,
        },
      },
    });
  }

  updateDMXChannel(channel: number, value: number): void {
    const channels = [...this.state.realtime.dmxData.channels];
    if (channel >= 1 && channel <= 512) {
      channels[channel - 1] = Math.max(0, Math.min(1, value));
      
      this.setState({
        realtime: {
          ...this.state.realtime,
          dmxData: {
            ...this.state.realtime.dmxData,
            channels,
          },
        },
      });
    }
  }
}

// Singleton store instance
export const store = new Store();

// Hook-like function for React-like components (if needed)
export function useStore(): AppState {
  return store.getState();
}

// Selector functions
export const selectors = {
  isConnected: (state: AppState) => state.socket.isConnected,
  getMode: (state: AppState) => state.system.mode,
  getIntensity: (state: AppState) => state.system.globalIntensity,
  isBlackout: (state: AppState) => state.system.blackout,
  getAudioEnergy: (state: AppState) => state.audio.energy,
  isBeat: (state: AppState) => state.audio.isBeat,
  getTheme: (state: AppState) => state.ui.theme,
  getLayout: (state: AppState) => state.ui.layout,
  showDebug: (state: AppState) => state.ui.showDebug,
  getCurrentPage: (state: AppState) => state.ui.currentPage,
  isSidebarCollapsed: (state: AppState) => state.ui.sidebarCollapsed,
  
  // Real-time data selectors
  getAudioWaveform: (state: AppState) => state.realtime.audioData.waveform,
  getAudioSpectrum: (state: AppState) => state.realtime.audioData.spectrum,
  getAudioPeaks: (state: AppState) => state.realtime.audioData.peaks,
  getDMXChannels: (state: AppState) => state.realtime.dmxData.channels,
  getDMXFixtures: (state: AppState) => state.realtime.dmxData.fixtures,
  getSystemMetrics: (state: AppState) => state.realtime.systemMetrics,
  
  // Derived selectors
  getActiveDMXChannels: (state: AppState) =>
    state.realtime.dmxData.channels.filter(value => value > 0.01).length,
  getAverageDMXValue: (state: AppState) => {
    const channels = state.realtime.dmxData.channels;
    if (channels.length === 0) return 0;
    const sum = channels.reduce((a, b) => a + b, 0);
    return sum / channels.length;
  },
};