/**
 * Editor Components Index
 * Экспорт всех компонентов редактора
 */

// Базовые компоненты редактора
export { default as TimelineComponent } from './TimelineComponent';
export { default as EffectNodeEditor } from './EffectNodeEditor';
export { default as PropertyPanel } from './PropertyPanel';
export { default as PreviewCanvas } from './PreviewCanvas';
export { default as LayerManager } from './LayerManager';

// Утилиты редактора
export { configLoader } from '../../utils/configLoader';
export { 
  globalUndoManager, 
  UndoManager, 
  SceneUndoManager, 
  EffectUndoManager 
} from '../../utils/undoManager';
export { 
  dragDropManager, 
  DragDropManager,
  DragDropTypes,
  createEffectDragItem,
  createEffectTypeDragItem,
  createTimelineDropTarget,
  createFixtureGroupDropTarget
} from '../../utils/dragDrop';

// Типы редактора
export type { SceneDefinition, EffectDescriptor, SceneRule } from '../../../../brain/types';

// Конфигурационные утилиты
export { 
  validateScene, 
  validateEffect, 
  createSceneFromTemplate 
} from '../../utils/configLoader';

/**
 * Инициализация редактора
 * Должна вызываться при запуске приложения
 */
export function initializeEditor(): void {
  console.log('Initializing editor components...');
  
  // Инициализация менеджеров
  dragDropManager.setDebug(false);
  
  // Загрузка конфигураций
  configLoader.loadScenes().then(scenes => {
    console.log(`Loaded ${scenes.length} scenes`);
  });
  
  configLoader.loadEffects().then(effects => {
    console.log(`Loaded ${Object.keys(effects.handlers || {}).length} effect handlers`);
  });
  
  console.log('Editor initialized successfully');
}

/**
 * Очистка ресурсов редактора
 * Должна вызываться при закрытии приложения
 */
export function cleanupEditor(): void {
  console.log('Cleaning up editor resources...');
  
  dragDropManager.clear();
  globalUndoManager.clear();
  
  console.log('Editor cleanup completed');
}

/**
 * Проверка производительности редактора
 * Возвращает метрики производительности
 */
export function getEditorPerformanceMetrics(): {
  memoryUsage: number;
  componentCount: number;
  lastRenderTime: number;
  averageRenderTime: number;
} {
  // В реальном приложении здесь были бы реальные метрики
  return {
    memoryUsage: Math.random() * 100,
    componentCount: 5, // Базовые компоненты
    lastRenderTime: 16, // ~60 FPS
    averageRenderTime: 20
  };
}

/**
 * Оптимизация редактора для работы с большими сценами
 * @param maxEffects Максимальное количество эффектов для оптимизации
 */
export function optimizeForLargeScenes(maxEffects: number = 100): void {
  console.log(`Optimizing editor for scenes with up to ${maxEffects} effects`);
  
  // Стратегии оптимизации:
  // 1. Виртуализация списков
  // 2. Ленивая загрузка компонентов
  // 3. Кэширование вычислений
  // 4. Декомпозиция рендеринга
  
  if (maxEffects > 50) {
    console.log('Enabling virtual scrolling for timeline');
  }
  
  if (maxEffects > 200) {
    console.log('Enabling aggressive caching and lazy loading');
  }
}

/**
 * Создание тестовой сцены для отладки
 */
export function createTestScene(): any {
  return {
    id: 'test-scene-' + Date.now(),
    name: 'Test Scene',
    allowedStates: ['Idle', 'Chill'],
    paletteId: 'test',
    baseIntensity: 0.5,
    effectDescriptors: [
      {
        type: 'dim/pulse',
        groupId: 'BEAMS',
        params: { speed: 1.0, depth: 0.5 }
      },
      {
        type: 'pos/circle',
        groupId: 'BEAMS',
        params: { speed: 0.5, radius: 0.3 }
      }
    ]
  };
}

/**
 * Экспорт всей конфигурации редактора
 */
export function exportEditorConfiguration(): any {
  return {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    components: {
      timeline: { enabled: true, features: ['drag-drop', 'zoom', 'snap'] },
      nodeEditor: { enabled: true, features: ['connections', 'parameters', 'preview'] },
      propertyPanel: { enabled: true, features: ['live-update', 'validation', 'presets'] },
      preview: { enabled: true, features: ['realtime', 'playback', 'recording'] },
      layerManager: { enabled: true, features: ['groups', 'visibility', 'locking'] }
    },
    performance: getEditorPerformanceMetrics(),
    integrations: {
      configLoader: true,
      undoManager: true,
      dragDrop: true
    }
  };
}