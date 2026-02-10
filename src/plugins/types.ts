/**
 * Plugins module types and interfaces
 * Types for plugin system and extensibility
 */

import { MetricSource } from '../metrics/types';
import { OutputSink } from '../outputs/types';
import { EffectHandler } from '../brain/types';

/**
 * Plugin manifest
 */
export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  
  // Extension points provided by this plugin
  provides: {
    metricSources?: string[];
    outputSinks?: string[];
    effectHandlers?: string[];
    sceneRules?: string[];
    fixtureProfiles?: string[];
    colorPalettes?: string[];
    styles?: string[];
    uiComponents?: string[];
    apiEndpoints?: string[];
  };
  
  // Dependencies on other plugins
  dependencies?: string[];
  
  // Compatibility
  engineVersion: string;
  apiVersion: string;
  
  // Metadata
  homepage?: string;
  repository?: string;
  bugs?: string;
  keywords?: string[];
}

/**
 * Plugin interface
 */
export interface Plugin {
  manifest: PluginManifest;
  
  // Initialization
  initialize(context: PluginContext): Promise<void>;
  
  // Shutdown
  shutdown(): Promise<void>;
  
  // Lifecycle hooks
  onEnable?(): Promise<void>;
  onDisable?(): Promise<void>;
  onConfigChange?(config: any): Promise<void>;
}

/**
 * Plugin context
 */
export interface PluginContext {
  // Registries for extension
  metricSourceManager: any;  // MetricSourceManager
  outputSinkManager: any;    // OutputSinkManager
  effectRegistry: any;       // EffectRegistry
  sceneRuleRegistry: any;    // SceneRuleRegistry
  fixtureProfileRegistry: any; // FixtureProfileRegistry
  
  // Configuration
  config: any;
  
  // Logger
  logger: any;
  
  // Event emitter
  events: any;
  
  // API
  api: {
    registerMetricSource(name: string, source: MetricSource): void;
    registerOutputSink(name: string, sink: OutputSink): void;
    registerEffectHandler(type: string, handler: EffectHandler): void;
    registerSceneRule(rule: any): void;
    registerFixtureProfile(profile: any): void;
    registerColorPalette(palette: any): void;
    registerStyle(style: any): void;
    
    // Utility functions
    getConfig(): any;
    setConfig(config: any): void;
    log(level: string, message: string, data?: any): void;
    emit(event: string, data?: any): void;
  };
}

/**
 * Plugin configuration
 */
export interface PluginConfig {
  enabled: boolean;
  config: any;
  autoStart: boolean;
  hotReload: boolean;
}

/**
 * Plugin manager configuration
 */
export interface PluginManagerConfig {
  pluginsDirectory: string;
  autoLoad: boolean;
  hotReload: boolean;
  sandbox: boolean;
  maxLoadTime: number;
  healthCheckInterval: number;
}

/**
 * Plugin load result
 */
export interface PluginLoadResult {
  plugin: Plugin;
  manifest: PluginManifest;
  loaded: boolean;
  error?: string;
  loadTime: number;
}

/**
 * Plugin health status
 */
export interface PluginHealth {
  pluginId: string;
  healthy: boolean;
  lastCheck: number;
  error?: string;
  metrics: {
    loadTime: number;
    memoryUsage: number;
    uptime: number;
  };
}

/**
 * Plugin event types
 */
export type PluginEventType = 
  | 'pluginLoaded'
  | 'pluginUnloaded'
  | 'pluginEnabled'
  | 'pluginDisabled'
  | 'pluginError'
  | 'configChanged';

/**
 * Plugin event
 */
export interface PluginEvent {
  type: PluginEventType;
  pluginId: string;
  timestamp: number;
  data?: any;
}

/**
 * Plugin dependency graph
 */
export interface PluginDependency {
  pluginId: string;
  dependsOn: string[];
  requiredBy: string[];
}

/**
 * Plugin sandbox configuration
 */
export interface PluginSandboxConfig {
  enabled: boolean;
  memoryLimit: number;
  timeout: number;
  allowedApis: string[];
  blockedApis: string[];
}

/**
 * Built-in plugin types
 */
export type BuiltinPluginType = 
  | 'core-audio'
  | 'core-dmx'
  | 'core-webui'
  | 'core-metrics'
  | 'core-outputs';

/**
 * Built-in plugin configuration
 */
export interface BuiltinPluginConfig {
  type: BuiltinPluginType;
  enabled: boolean;
  config: any;
}

/**
 * Plugin discovery result
 */
export interface PluginDiscovery {
  found: PluginManifest[];
  errors: Array<{ path: string; error: string }>;
  total: number;
}

/**
 * Plugin lifecycle state
 */
export type PluginLifecycleState = 
  | 'unloaded'
  | 'loading'
  | 'loaded'
  | 'initializing'
  | 'initialized'
  | 'enabling'
  | 'enabled'
  | 'disabling'
  | 'disabled'
  | 'error'
  | 'shuttingDown';

/**
 * Plugin state
 */
export interface PluginState {
  pluginId: string;
  state: PluginLifecycleState;
  since: number;
  error?: string;
  metrics: {
    loadCount: number;
    errorCount: number;
    totalUptime: number;
    lastLoadTime: number;
  };
}