/**
 * Metrics module types and interfaces
 * Types for metric sources and metric collection
 */

import { RuntimeMetrics } from '../engine/types';

/**
 * Metric source types
 */
export type MetricSourceType = 'audio' | 'vision' | 'sensor' | 'external' | 'system';

/**
 * Metric source interface
 */
export interface MetricSource {
  readonly name: string;
  readonly type: MetricSourceType;
  
  // Initialization
  initialize(config: any): Promise<void>;
  
  // Get current metrics
  getMetrics(): Promise<Record<string, any>>;
  
  // Health check
  isHealthy(): Promise<boolean>;
  
  // Shutdown
  shutdown(): Promise<void>;
}

/**
 * Metric source configuration
 */
export interface MetricSourceConfig {
  type: MetricSourceType;
  enabled: boolean;
  updateInterval: number;  // ms
  config: any;
}

/**
 * Metric definition
 */
export interface MetricDefinition {
  name: string;
  type: 'gauge' | 'counter' | 'histogram' | 'summary';
  description: string;
  unit?: string;
  labels?: string[];
}

/**
 * Metric value
 */
export interface MetricValue {
  name: string;
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
}

/**
 * Metric collection
 */
export interface MetricCollection {
  timestamp: number;
  metrics: MetricValue[];
  source: string;
}

/**
 * Metric source manager configuration
 */
export interface MetricSourceManagerConfig {
  defaultUpdateInterval: number;
  healthCheckInterval: number;
  maxRetries: number;
  enabledSources: string[];
}

/**
 * Metric aggregation
 */
export interface MetricAggregation {
  metricName: string;
  values: number[];
  timestamp: number;
  aggregation: 'mean' | 'sum' | 'min' | 'max' | 'count';
  result: number;
}

/**
 * Metric alert condition
 */
export interface MetricAlertCondition {
  metricName: string;
  operator: 'gt' | 'lt' | 'eq' | 'neq' | 'gte' | 'lte';
  threshold: number;
  duration: number;  // ms
}

/**
 * Metric alert
 */
export interface MetricAlert {
  id: string;
  condition: MetricAlertCondition;
  triggered: boolean;
  lastTriggered: number | null;
  count: number;
}

/**
 * Metric history entry
 */
export interface MetricHistoryEntry {
  timestamp: number;
  metrics: Record<string, number>;
}

/**
 * Metric source health status
 */
export interface MetricSourceHealth {
  name: string;
  healthy: boolean;
  lastUpdate: number;
  error?: string;
  latency: number;
}

/**
 * System metrics (CPU, memory, etc.)
 */
export interface SystemMetrics {
  cpu: {
    usage: number;  // 0..1
    user: number;
    system: number;
    idle: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usage: number;  // 0..1
  };
  process: {
    uptime: number;
    memoryUsage: number;
    cpuUsage: number;
  };
  timestamp: number;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  processingTimes: {
    audio: number;
    brain: number;
    lighting: number;
    dmx: number;
    total: number;
  };
  frameRates: {
    audio: number;
    dmx: number;
  };
  latencies: {
    audio: number;
    dmx: number;
  };
  timestamp: number;
}

/**
 * Metric exporter interface
 */
export interface MetricExporter {
  readonly name: string;
  
  initialize(config: any): Promise<void>;
  export(metrics: MetricCollection[]): Promise<void>;
  shutdown(): Promise<void>;
}

/**
 * Export destination
 */
export type ExportDestination = 'console' | 'file' | 'database' | 'http' | 'websocket';

/**
 * Export configuration
 */
export interface ExportConfig {
  destination: ExportDestination;
  format: 'json' | 'csv' | 'prometheus' | 'influx';
  interval: number;
  config: any;
}