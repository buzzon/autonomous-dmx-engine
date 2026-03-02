/**
 * Configuration loader utility
 * Handles loading and validation of JSON configuration files
 */

import { defaultLogger } from './logger';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface AppConfig {
  fixtures: any;
  patch: any;
  scenes: any;
  styles: any;
  scenesRules?: any;
  effects?: any;
  plugins?: any;
}

export interface ConfigValidationError {
  file: string;
  error: string;
}

export class ConfigLoader {
  private logger = defaultLogger.child({ module: 'ConfigLoader' });
  private configCache: Map<string, any> = new Map();

  /**
   * Load a JSON configuration file
   */
  async load<T>(filePath: string): Promise<T> {
    try {
      // Check cache first
      if (this.configCache.has(filePath)) {
        this.logger.debug(`Loading config from cache: ${filePath}`);
        const cached = this.configCache.get(filePath);
        // Remove _timestamp before returning
        const { _timestamp, ...config } = cached;
        return config as T;
      }

      this.logger.info(`Loading config file: ${filePath}`);
      
      // Get file stats for timestamp
      const stats = await fs.stat(filePath);
      
      // Read and parse file
      const content = await fs.readFile(filePath, 'utf-8');
      const config = JSON.parse(content) as T;
      
      // Add timestamp for cache invalidation
      const cachedConfig = { ...config, _timestamp: stats.mtimeMs };
      
      // Cache the result
      this.configCache.set(filePath, cachedConfig);
      
      this.logger.debug(`Config loaded successfully: ${filePath}`);
      return config;
    } catch (error) {
      this.logger.error(`Failed to load config file: ${filePath}`, { error });
      throw error;
    }
  }

  /**
   * Load a JSON configuration file with inheritance support
   * Supports "extends" field pointing to another config file
   */
  async loadWithInheritance<T extends Record<string, any>>(filePath: string): Promise<T> {
    try {
      // Check cache first
      if (this.configCache.has(filePath)) {
        this.logger.debug(`Loading config with inheritance from cache: ${filePath}`);
        return this.configCache.get(filePath);
      }

      this.logger.info(`Loading config file with inheritance: ${filePath}`);
      
      // Read and parse file
      const content = await fs.readFile(filePath, 'utf-8');
      const config = JSON.parse(content) as T & { extends?: string };
      
      // Handle inheritance if "extends" field is present
      if (config.extends) {
        const basePath = path.resolve(path.dirname(filePath), config.extends);
        this.logger.debug(`Extending config from: ${basePath}`);
        
        // Load base config recursively
        const baseConfig = await this.loadWithInheritance(basePath);
        
        // Merge configs: base config first, then override with current config
        // Remove "extends" field from the final config
        const { extends: _, ...currentConfig } = config;
        const mergedConfig = this.deepMerge(baseConfig, currentConfig) as T;
        
        // Cache the result
        this.configCache.set(filePath, mergedConfig);
        
        this.logger.debug(`Config loaded with inheritance: ${filePath}`);
        return mergedConfig;
      }
      
      // Cache the result
      this.configCache.set(filePath, config);
      
      this.logger.debug(`Config loaded successfully: ${filePath}`);
      return config;
    } catch (error) {
      this.logger.error(`Failed to load config file with inheritance: ${filePath}`, { error });
      throw error;
    }
  }

  /**
   * Deep merge two objects
   */
  private deepMerge(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
    const result = { ...target };
    
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        const sourceValue = source[key];
        const targetValue = target[key];
        
        if (this.isObject(sourceValue) && this.isObject(targetValue)) {
          // Recursive merge for nested objects
          result[key] = this.deepMerge(targetValue, sourceValue);
        } else if (Array.isArray(sourceValue) && Array.isArray(targetValue)) {
          // For arrays, concatenate by default for config inheritance
          // This allows extending configs to add items to arrays
          this.logger.debug(`Deep merging arrays for key "${key}": ${targetValue.length} base items + ${sourceValue.length} extended items`);
          result[key] = [...targetValue, ...sourceValue];
        } else {
          // Primitive value or different types - override
          result[key] = sourceValue;
        }
      }
    }
    
    return result;
  }

  /**
   * Check if value is a plain object
   */
  private isObject(value: any): boolean {
    return value && typeof value === 'object' && !Array.isArray(value);
  }

  /**
   * Load all configuration files for the application
   */
  async loadAll(basePath: string = './config'): Promise<AppConfig> {
    this.logger.info(`Loading all configs from: ${basePath}`);
    
    const configs = await Promise.allSettled([
      this.loadWithInheritance(path.join(basePath, 'fixtures.json')),
      this.loadWithInheritance(path.join(basePath, 'patch.json')),
      this.loadWithInheritance(path.join(basePath, 'scenes.json')),
      this.loadWithInheritance(path.join(basePath, 'styles.json')),
      this.loadWithInheritance(path.join(basePath, 'scenes-rules.json')).catch(() => null),
      this.loadWithInheritance(path.join(basePath, 'effects.json')).catch(() => null),
      this.loadWithInheritance(path.join(basePath, 'plugins.json')).catch(() => null),
    ]);

    // Check for critical config failures
    const criticalConfigs = configs.slice(0, 4);
    const criticalErrors = criticalConfigs
      .map((result, index) => ({ result, index }))
      .filter(({ result }) => result.status === 'rejected');

    if (criticalErrors.length > 0) {
      const errorFiles = ['fixtures.json', 'patch.json', 'scenes.json', 'styles.json'];
      const errorMessages = criticalErrors.map(({ index }) => errorFiles[index]);
      throw new Error(`Failed to load critical config files: ${errorMessages.join(', ')}`);
    }

    // Build config object
    const appConfig: AppConfig = {
      fixtures: (configs[0] as PromiseFulfilledResult<any>).value,
      patch: (configs[1] as PromiseFulfilledResult<any>).value,
      scenes: (configs[2] as PromiseFulfilledResult<any>).value,
      styles: (configs[3] as PromiseFulfilledResult<any>).value,
    };

    // Add optional configs if they exist
    if (configs[4].status === 'fulfilled' && configs[4].value) {
      appConfig.scenesRules = configs[4].value;
    }

    if (configs[5].status === 'fulfilled' && configs[5].value) {
      appConfig.effects = configs[5].value;
    }

    if (configs[6].status === 'fulfilled' && configs[6].value) {
      appConfig.plugins = configs[6].value;
    }

    this.logger.info('All configs loaded successfully');
    return appConfig;
  }

  /**
   * Clear the config cache
   */
  clearCache(): void {
    this.configCache.clear();
    this.logger.debug('Config cache cleared');
  }

  /**
   * Check if config files have been modified since last load
   */
  async checkForUpdates(filePaths: string[]): Promise<string[]> {
    const updatedFiles: string[] = [];
    
    for (const filePath of filePaths) {
      try {
        const stats = await fs.stat(filePath);
        const cached = this.configCache.get(filePath);
        
        // If not cached or modified since cache
        if (!cached || stats.mtimeMs > (cached._timestamp || 0)) {
          updatedFiles.push(filePath);
        }
      } catch (error) {
        this.logger.warn(`Could not check file for updates: ${filePath}`, { error });
      }
    }
    
    return updatedFiles;
  }

  /**
   * Hot-reload configuration files
   */
  async hotReload(filePaths: string[]): Promise<void> {
    const updatedFiles = await this.checkForUpdates(filePaths);
    
    if (updatedFiles.length === 0) {
      this.logger.debug('No config files need reloading');
      return;
    }
    
    this.logger.info(`Hot-reloading config files: ${updatedFiles.join(', ')}`);
    
    for (const filePath of updatedFiles) {
      try {
        // Remove from cache to force reload
        this.configCache.delete(filePath);
        await this.load(filePath);
        this.logger.info(`Config reloaded: ${filePath}`);
      } catch (error) {
        this.logger.error(`Failed to hot-reload config: ${filePath}`, { error });
      }
    }
  }

  /**
   * Check if a file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Load JSON file (alias for load)
   */
  async loadJson<T>(filePath: string): Promise<T> {
    return this.load<T>(filePath);
  }

  /**
   * Save JSON file
   */
  async saveJson(filePath: string, data: any): Promise<void> {
    try {
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
      this.logger.info(`Config saved: ${filePath}`);
      // Update cache
      this.configCache.set(filePath, data);
    } catch (error) {
      this.logger.error(`Failed to save config: ${filePath}`, { error });
      throw error;
    }
  }

  /**
   * Delete a configuration file
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
      this.configCache.delete(filePath);
      this.logger.info(`Config file deleted: ${filePath}`);
    } catch (error) {
      this.logger.error(`Failed to delete config file: ${filePath}`, { error });
      throw error;
    }
  }

  /**
   * List files in a directory
   */
  async listFiles(dirPath: string, pattern?: RegExp): Promise<string[]> {
    try {
      const files = await fs.readdir(dirPath);
      const filtered = pattern ? files.filter(file => pattern.test(file)) : files;
      return filtered.map(file => path.join(dirPath, file));
    } catch (error) {
      this.logger.error(`Failed to list files in directory: ${dirPath}`, { error });
      throw error;
    }
  }

  /**
   * Validate configuration against a schema (basic implementation)
   */
  validateConfig<T extends Record<string, any>>(config: T, schema: Record<string, any>): ConfigValidationError[] {
    const errors: ConfigValidationError[] = [];
    
    // Basic validation - check required fields
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in config)) {
          errors.push({
            file: 'unknown',
            error: `Missing required field: ${field}`
          });
        }
      }
    }
    
    // Type validation
    if (schema.properties) {
      for (const [field, fieldSchema] of Object.entries(schema.properties)) {
        if (field in config) {
          const value = config[field];
          const expectedType = (fieldSchema as any).type;
          
          if (expectedType && typeof value !== expectedType) {
            errors.push({
              file: 'unknown',
              error: `Field ${field} should be type ${expectedType}, got ${typeof value}`
            });
          }
        }
      }
    }
    
    return errors;
  }
}

/**
 * Default config loader instance
 */
export const defaultConfigLoader = new ConfigLoader();