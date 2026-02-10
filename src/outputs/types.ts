/**
 * Outputs module types and interfaces
 * Types for output sinks (DMX, visualization, logging, OSC, etc.)
 */

import { UniverseFrame } from '../lighting/types';

/**
 * Output sink types
 */
export type OutputSinkType = 'dmx' | 'visualization' | 'logging' | 'osc' | 'file' | 'websocket' | 'http';

/**
 * Output sink interface
 */
export interface OutputSink {
  readonly name: string;
  readonly type: OutputSinkType;
  
  // Initialization
  initialize(config: any): Promise<void>;
  
  // Send data
  send(data: any): Promise<void>;
  
  // Health check
  isHealthy(): Promise<boolean>;
  
  // Shutdown
  shutdown(): Promise<void>;
}

/**
 * Output sink configuration
 */
export interface OutputSinkConfig {
  type: OutputSinkType;
  enabled: boolean;
  priority: number;  // Higher priority sinks are tried first
  config: any;
}

/**
 * DMX output configuration
 */
export interface DMXOutputConfig {
  protocol: 'artnet' | 'sACN' | 'dmx4all' | 'opendmx';
  host: string;
  port: number;
  universe: number;
  refreshRate: number;  // Hz
  maxRetries: number;
  failover?: {
    enabled: boolean;
    secondaryHost: string;
    secondaryPort: number;
  };
}

/**
 * Visualization output configuration
 */
export interface VisualizationOutputConfig {
  type: 'webgl' | 'canvas' | 'terminal' | 'external';
  width: number;
  height: number;
  fps: number;
  colorMode: 'rgb' | 'hsl' | 'grayscale';
  showFixtures: boolean;
  showBeams: boolean;
  showMetrics: boolean;
}

/**
 * Logging output configuration
 */
export interface LoggingOutputConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  format: 'json' | 'text' | 'csv';
  destination: 'console' | 'file' | 'syslog';
  filePath?: string;
  maxSize?: number;  // bytes
  maxFiles?: number;
}

/**
 * OSC output configuration
 */
export interface OSCOutputConfig {
  host: string;
  port: number;
  addressPattern: string;
  bundleMessages: boolean;
  rateLimit?: number;  // messages per second
}

/**
 * WebSocket output configuration
 */
export interface WebSocketOutputConfig {
  port: number;
  path: string;
  compression: boolean;
  maxConnections: number;
  pingInterval: number;
}

/**
 * HTTP output configuration
 */
export interface HTTPOutputConfig {
  url: string;
  method: 'POST' | 'PUT' | 'PATCH';
  headers: Record<string, string>;
  timeout: number;
  retries: number;
  batchSize?: number;
  batchInterval?: number;
}

/**
 * Output data format
 */
export interface OutputData {
  type: OutputSinkType;
  timestamp: number;
  data: any;
  metadata?: Record<string, any>;
}

/**
 * DMX output data
 */
export interface DMXOutputData {
  universeFrames: UniverseFrame[];
  timestamp: number;
  priority: number;
}

/**
 * Visualization output data
 */
export interface VisualizationOutputData {
  fixtureStates: Map<string, any>;
  metrics: any;
  timestamp: number;
  view: '2d' | '3d' | 'top' | 'front';
}

/**
 * Output sink manager configuration
 */
export interface OutputSinkManagerConfig {
  defaultPriority: number;
  healthCheckInterval: number;
  failoverEnabled: boolean;
  enabledSinks: string[];
  batchProcessing: {
    enabled: boolean;
    maxBatchSize: number;
    maxBatchTime: number;
  };
}

/**
 * Output sink health status
 */
export interface OutputSinkHealth {
  name: string;
  healthy: boolean;
  lastSuccess: number;
  error?: string;
  latency: number;
  throughput: number;  // messages per second
}

/**
 * Output statistics
 */
export interface OutputStatistics {
  totalSent: number;
  failed: number;
  averageLatency: number;
  lastSent: number;
  throughput: number;
  sinkStats: Record<string, {
    sent: number;
    failed: number;
    latency: number;
  }>;
}

/**
 * Output transformation
 */
export interface OutputTransformation {
  name: string;
  apply(data: any): any;
}

/**
 * Output filter
 */
export interface OutputFilter {
  name: string;
  predicate(data: any): boolean;
}

/**
 * Output routing rule
 */
export interface OutputRoutingRule {
  source: string;
  sink: string;
  condition?: (data: any) => boolean;
  transformation?: string;
  priority: number;
}

/**
 * Batch output
 */
export interface BatchOutput {
  id: string;
  items: OutputData[];
  timestamp: number;
  size: number;
}

/**
 * Output queue status
 */
export interface OutputQueueStatus {
  queueSize: number;
  processing: number;
  maxQueueSize: number;
  dropped: number;
  averageWaitTime: number;
}