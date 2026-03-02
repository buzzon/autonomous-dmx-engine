/**
 * UI-specific types for DMX Engine Web Interface
 */

import { SystemState as CoreSystemState } from '../../types';

// Re-export core types for convenience
export type { CoreSystemState };

// UI-specific state extensions
export interface UISystemState extends CoreSystemState {
  // UI-specific extensions
  uiTheme: 'dark' | 'light';
  uiLayout: 'compact' | 'expanded';
  showDebugPanel: boolean;
  showAudioMetrics: boolean;
}

// Audio metrics from server
export interface AudioMetrics {
  energy: number;
  isBeat: boolean;
  bpm?: number;
  frequencyBands?: number[];
  mood?: string;
}

// Socket connection state
export interface SocketState {
  isConnected: boolean;
  lastPing?: number;
  latency?: number;
  error?: string;
}

// Component props base
export interface ComponentProps {
  className?: string;
  style?: Record<string, any>;
}

// Layout configuration
export interface LayoutConfig {
  type: 'grid' | 'flex';
  columns?: number;
  gap?: number;
  padding?: number;
}

// Theme configuration
export interface ThemeConfig {
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  dangerColor: string;
  successColor: string;
}