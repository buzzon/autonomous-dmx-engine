/**
 * ConfigLoader - утилиты для загрузки и сохранения конфигурационных файлов
 */

import { SceneDefinition, EffectDescriptor, BrainState } from '../../../brain/types';

export interface ConfigFile {
  path: string;
  content: any;
  lastModified: number;
}

export class ConfigLoader {
  private static instance: ConfigLoader;
  private cache: Map<string, ConfigFile> = new Map();
  
  private constructor() {}
  
  static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader();
    }
    return ConfigLoader.instance;
  }
  
  /**
   * Загружает сцены из config/scenes.json
   */
  async loadScenes(): Promise<SceneDefinition[]> {
    try {
      const config = await this.loadConfigFile('config/scenes.json');
      return config.scenes || [];
    } catch (error) {
      console.error('Failed to load scenes:', error);
      return [];
    }
  }
  
  /**
   * Сохраняет сцены в config/scenes.json
   */
  async saveScenes(scenes: SceneDefinition[]): Promise<boolean> {
    try {
      const config = { scenes };
      await this.saveConfigFile('config/scenes.json', config);
      return true;
    } catch (error) {
      console.error('Failed to save scenes:', error);
      return false;
    }
  }
  
  /**
   * Загружает эффекты из config/effects.json
   */
  async loadEffects(): Promise<any> {
    try {
      return await this.loadConfigFile('config/effects.json');
    } catch (error) {
      console.error('Failed to load effects:', error);
      return { handlers: {}, categories: {}, groups: {}, defaults: {} };
    }
  }
  
  /**
   * Загружает фикстуры из config/fixtures.json
   */
  async loadFixtures(): Promise<any> {
    try {
      return await this.loadConfigFile('config/fixtures.json');
    } catch (error) {
      console.error('Failed to load fixtures:', error);
      return { profiles: [] };
    }
  }
  
  /**
   * Загружает пач из config/patch.json
   */
  async loadPatch(): Promise<any> {
    try {
      return await this.loadConfigFile('config/patch.json');
    } catch (error) {
      console.error('Failed to load patch:', error);
      return { fixtures: [], universes: 1 };
    }
  }
  
  /**
   * Загружает правила сцен из config/scenes-rules.json
   */
  async loadSceneRules(): Promise<any> {
    try {
      return await this.loadConfigFile('config/scenes-rules.json');
    } catch (error) {
      console.error('Failed to load scene rules:', error);
      return { rules: [] };
    }
  }
  
  /**
   * Загружает базовую сцену из config/base/scene-base.json
   */
  async loadBaseScene(): Promise<SceneDefinition | null> {
    try {
      const config = await this.loadConfigFile('config/base/scene-base.json');
      return config.scene || null;
    } catch (error) {
      console.error('Failed to load base scene:', error);
      return null;
    }
  }
  
  /**
   * Загружает конфигурационный файл с кэшированием
   */
  private async loadConfigFile(path: string): Promise<any> {
    const cached = this.cache.get(path);
    const now = Date.now();
    
    // Проверяем, нужно ли обновить кэш (старше 5 секунд)
    if (cached && now - cached.lastModified < 5000) {
      return cached.content;
    }
    
    try {
      // В реальном приложении здесь был бы fetch или fs.readFile
      // Для демонстрации используем заглушку
      const response = await fetch(`/${path}`);
      if (!response.ok) {
        throw new Error(`Failed to load ${path}: ${response.status}`);
      }
      
      const content = await response.json();
      const configFile: ConfigFile = {
        path,
        content,
        lastModified: now
      };
      
      this.cache.set(path, configFile);
      return content;
    } catch (error) {
      // Fallback to local mock if fetch fails (for offline development)
      return this.loadMockConfig(path);
    }
  }
  
  /**
   * Сохраняет конфигурационный файл
   */
  private async saveConfigFile(path: string, content: any): Promise<void> {
    try {
      // В реальном приложении здесь был бы fetch с POST или fs.writeFile
      const response = await fetch(`/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(content, null, 2)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to save ${path}: ${response.status}`);
      }
      
      // Обновляем кэш
      const configFile: ConfigFile = {
        path,
        content,
        lastModified: Date.now()
      };
      this.cache.set(path, configFile);
    } catch (error) {
      console.error('Failed to save config file:', error);
      throw error;
    }
  }
  
  /**
   * Загружает мок-конфигурацию для разработки
   */
  private loadMockConfig(path: string): any {
    console.log(`Loading mock config for ${path}`);
    
    switch (path) {
      case 'config/scenes.json':
        return {
          scenes: [
            {
              id: 'IdleWarmStatic',
              name: 'Idle Warm Static',
              allowedStates: ['Idle'],
              paletteId: 'warm',
              baseIntensity: 0.3,
              effectDescriptors: [
                { type: 'dim/none', groupId: 'BEAMS', params: {} },
                { type: 'pos/none', groupId: 'BEAMS', params: {} },
                { type: 'dim/none', groupId: 'WASH', params: {} }
              ]
            },
            {
              id: 'ChillSoftMovement',
              name: 'Chill Soft Movement',
              allowedStates: ['Chill'],
              paletteId: 'cool',
              baseIntensity: 0.6,
              effectDescriptors: [
                { type: 'dim/none', groupId: 'BEAMS', params: {} },
                { type: 'pos/circle', groupId: 'BEAMS', params: { speed: 0.5, radius: 0.3 } },
                { type: 'dim/pulse', groupId: 'WASH', params: { speed: 1.0, depth: 0.5 } }
              ]
            }
          ]
        };
        
      case 'config/effects.json':
        return {
          handlers: {
            'dim/pulse': {
              description: 'Pulsing dim effect',
              defaultParams: { speed: 1.0, depth: 0.5, phase: 0, waveform: 'sine' },
              supportedGroups: ['BEAMS', 'WASH', 'SPOTS'],
              category: 'dim'
            },
            'pos/circle': {
              description: 'Circular position movement',
              defaultParams: { speed: 0.5, radius: 0.3, centerX: 0, centerY: 0, direction: 'clockwise' },
              supportedGroups: ['BEAMS', 'SPOTS'],
              category: 'position'
            }
          },
          categories: {
            dim: { description: 'Dimming/intensity effects', defaultPriority: 10 },
            position: { description: 'Position/movement effects', defaultPriority: 20 }
          },
          groups: {
            BEAMS: { description: 'Beam fixtures with position control', supportedCategories: ['dim', 'position', 'color', 'strobe'] },
            WASH: { description: 'Wash fixtures with color mixing', supportedCategories: ['dim', 'color', 'strobe'] }
          }
        };
        
      case 'config/fixtures.json':
        return {
          profiles: [
            {
              id: 'beam8ch',
              name: 'Generic Beam 8ch',
              manufacturer: 'Generic',
              channels: [
                { name: 'dim', type: 'dim', channelIndex: 1 },
                { name: 'strobe', type: 'strobe', channelIndex: 2 },
                { name: 'colorIndex', type: 'color', channelIndex: 3 },
                { name: 'goboIndex', type: 'other', channelIndex: 4 },
                { name: 'pan', type: 'position', channelIndex: 5 },
                { name: 'tilt', type: 'position', channelIndex: 6 },
                { name: 'panFine', type: 'position', channelIndex: 7 },
                { name: 'tiltFine', type: 'position', channelIndex: 8 }
              ]
            }
          ]
        };
        
      case 'config/patch.json':
        return {
          universes: 1,
          fixtures: [
            { id: 1, name: 'Beam 1', profileId: 'beam8ch', universe: 1, address: 1, groupId: 'BEAMS' },
            { id: 2, name: 'Beam 2', profileId: 'beam8ch', universe: 1, address: 9, groupId: 'BEAMS' }
          ]
        };
        
      case 'config/scenes-rules.json':
        return {
          rules: [
            {
              sceneId: 'IdleWarmStatic',
              conditions: { brainState: 'Idle', energyMax: 0.3 },
              weight: 1.0,
              cooldown: 10000
            }
          ]
        };
        
      case 'config/base/scene-base.json':
        return {
          scene: {
            id: 'base-scene',
            name: 'Base Scene Template',
            allowedStates: ['Idle', 'Chill', 'Party'],
            paletteId: 'neutral',
            baseIntensity: 0.5,
            effectDescriptors: []
          }
        };
        
      default:
        return {};
    }
  }
  
  /**
   * Очищает кэш конфигураций
   */
  clearCache(): void {
    this.cache.clear();
  }
  
  /**
   * Проверяет валидность сцены
   */
  validateScene(scene: SceneDefinition): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!scene.id || scene.id.trim() === '') {
      errors.push('Scene ID is required');
    }
    
    if (!scene.name || scene.name.trim() === '') {
      errors.push('Scene name is required');
    }
    
    if (!Array.isArray(scene.allowedStates) || scene.allowedStates.length === 0) {
      errors.push('At least one allowed state is required');
    }
    
    if (scene.baseIntensity < 0 || scene.baseIntensity > 1) {
      errors.push('Base intensity must be between 0 and 1');
    }
    
    // Проверяем эффекты
    if (scene.effectDescriptors) {
      for (let i = 0; i < scene.effectDescriptors.length; i++) {
        const effect = scene.effectDescriptors[i];
        if (!effect.type) {
          errors.push(`Effect ${i + 1}: type is required`);
        }
        if (!effect.groupId) {
          errors.push(`Effect ${i + 1}: groupId is required`);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Проверяет валидность эффекта
   */
  validateEffect(effect: EffectDescriptor): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!effect.type || effect.type.trim() === '') {
      errors.push('Effect type is required');
    }
    
    if (!effect.groupId || effect.groupId.trim() === '') {
      errors.push('Fixture group is required');
    }
    
    // Проверяем параметры
    if (effect.params) {
      for (const key in effect.params) {
        const value = effect.params[key];
        if (typeof value === 'number' && (isNaN(value) || !isFinite(value))) {
          errors.push(`Parameter "${key}" has invalid numeric value`);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Создает новую сцену на основе шаблона
   */
  createSceneFromTemplate(templateId: string = 'base'): SceneDefinition {
    const now = Date.now();
    
    switch (templateId) {
      case 'base':
        return {
          id: `scene-${now}`,
          name: 'New Scene',
          allowedStates: ['Idle'] as BrainState[],
          paletteId: 'warm',
          baseIntensity: 0.5,
          effectDescriptors: []
        };
        
      case 'pulse':
        return {
          id: `pulse-scene-${now}`,
          name: 'Pulse Scene',
          allowedStates: ['Chill', 'Party'] as BrainState[],
          paletteId: 'party',
          baseIntensity: 0.7,
          effectDescriptors: [
            { type: 'dim/pulse', groupId: 'BEAMS', params: { speed: 1.0, depth: 0.8 } },
            { type: 'dim/pulse', groupId: 'WASH', params: { speed: 0.5, depth: 0.6 } }
          ]
        };
        
      case 'movement':
        return {
          id: `movement-scene-${now}`,
          name: 'Movement Scene',
          allowedStates: ['Chill', 'Party'] as BrainState[],
          paletteId: 'cool',
          baseIntensity: 0.6,
          effectDescriptors: [
            { type: 'pos/circle', groupId: 'BEAMS', params: { speed: 0.3, radius: 0.4 } },
            { type: 'pos/swing', groupId: 'BEAMS', params: { speed: 0.5, amplitude: 0.3 } }
          ]
        };
        
      default:
        return this.createSceneFromTemplate('base');
    }
  }
  
  /**
   * Экспортирует конфигурацию в JSON файл
   */
  exportToJson(data: any, filename: string): void {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
  }
  
  /**
   * Импортирует конфигурацию из JSON файла
   */
  importFromJson(file: File): Promise<any> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          const content = JSON.parse(event.target?.result as string);
          resolve(content);
        } catch (error) {
          reject(new Error('Invalid JSON file'));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      
      reader.readAsText(file);
    });
  }
}

// Singleton instance export
export const configLoader = ConfigLoader.getInstance();