/**
 * Configuration types for visual config editor
 */

export interface ConfigNode {
  id: string;
  name: string;
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
  value?: any;
  children?: ConfigNode[];
  path: string;
  description?: string;
  required?: boolean;
  readOnly?: boolean;
  defaultValue?: any;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    enum?: string[];
    format?: 'date-time' | 'email' | 'uri' | 'regex';
  };
}

export interface ConfigSchema {
  $schema?: string;
  title?: string;
  description?: string;
  type: 'object';
  properties: Record<string, any>;
  required?: string[];
  definitions?: Record<string, any>;
}

export interface ConfigTemplate {
  id: string;
  name: string;
  description?: string;
  schema: ConfigSchema;
  defaultValues: Record<string, any>;
  category: 'system' | 'audio' | 'lighting' | 'effects' | 'scenes' | 'fixtures' | 'rules';
  tags?: string[];
  version: string;
  createdAt: number;
  updatedAt: number;
}

export interface ConfigVersion {
  id: string;
  configId: string;
  version: number;
  data: Record<string, any>;
  hash: string;
  createdAt: number;
  createdBy?: string;
  comment?: string;
  tags?: string[];
}

export interface ConfigDiff {
  path: string;
  operation: 'add' | 'remove' | 'modify';
  oldValue?: any;
  newValue?: any;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null';
}

export interface ConfigValidationResult {
  valid: boolean;
  errors: Array<{
    path: string;
    message: string;
    severity: 'error' | 'warning' | 'info';
    code?: string;
  }>;
  warnings: Array<{
    path: string;
    message: string;
    severity: 'warning';
  }>;
}

export interface ConfigImportExportOptions {
  format: 'json' | 'yaml' | 'toml';
  includeSchema?: boolean;
  includeMetadata?: boolean;
  includeVersions?: boolean;
  compress?: boolean;
}

export interface ConfigBackup {
  id: string;
  name: string;
  description?: string;
  timestamp: number;
  size: number;
  configCount: number;
  includes: {
    system: boolean;
    audio: boolean;
    lighting: boolean;
    effects: boolean;
    scenes: boolean;
    fixtures: boolean;
    rules: boolean;
  };
  storageLocation?: string;
  restorePoint?: boolean;
}

export interface ConfigEditorState {
  currentConfig: ConfigNode | null;
  schema: ConfigSchema | null;
  templates: ConfigTemplate[];
  selectedTemplate: string | null;
  validationResult: ConfigValidationResult | null;
  isDirty: boolean;
  isLoading: boolean;
  error: string | null;
  viewMode: 'tree' | 'form' | 'code' | 'diff';
  expandedPaths: string[];
  selectedPath: string | null;
  searchQuery: string;
  filter: {
    category?: string;
    type?: string;
    requiredOnly?: boolean;
    modifiedOnly?: boolean;
  };
  history: {
    past: ConfigNode[];
    future: ConfigNode[];
    currentIndex: number;
  };
}

export interface ConfigAPIClient {
  getConfig(path: string): Promise<ConfigNode>;
  saveConfig(path: string, data: ConfigNode): Promise<void>;
  validateConfig(data: ConfigNode): Promise<ConfigValidationResult>;
  getTemplates(): Promise<ConfigTemplate[]>;
  getTemplate(id: string): Promise<ConfigTemplate>;
  createTemplate(template: Omit<ConfigTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<ConfigTemplate>;
  getVersions(configId: string): Promise<ConfigVersion[]>;
  getVersion(configId: string, version: number): Promise<ConfigVersion>;
  compareVersions(configId: string, version1: number, version2: number): Promise<ConfigDiff[]>;
  importConfig(file: File, options: ConfigImportExportOptions): Promise<ConfigNode>;
  exportConfig(configId: string, options: ConfigImportExportOptions): Promise<Blob>;
  createBackup(options: Partial<ConfigBackup>): Promise<ConfigBackup>;
  restoreBackup(backupId: string): Promise<void>;
  getBackups(): Promise<ConfigBackup[]>;
  deleteBackup(backupId: string): Promise<void>;
}