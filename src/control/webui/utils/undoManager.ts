/**
 * UndoManager - система отмены/повтора действий для редактора
 */

export interface UndoAction {
  id: string;
  description: string;
  timestamp: number;
  undo: () => Promise<void> | void;
  redo: () => Promise<void> | void;
  mergeKey?: string; // Ключ для объединения последовательных действий
}

export interface UndoManagerOptions {
  maxHistorySize?: number;
  mergeTimeout?: number; // Время в мс для объединения действий
  debug?: boolean;
}

export class UndoManager {
  private undoStack: UndoAction[] = [];
  private redoStack: UndoAction[] = [];
  private maxHistorySize: number;
  private mergeTimeout: number;
  private debug: boolean;
  private lastActionTime: number = 0;
  private lastMergeKey: string | null = null;

  constructor(options: UndoManagerOptions = {}) {
    this.maxHistorySize = options.maxHistorySize || 50;
    this.mergeTimeout = options.mergeTimeout || 1000; // 1 секунда
    this.debug = options.debug || false;
  }

  /**
   * Регистрирует новое действие
   */
  registerAction(
    description: string,
    undo: () => Promise<void> | void,
    redo: () => Promise<void> | void,
    mergeKey?: string
  ): string {
    const now = Date.now();
    const action: UndoAction = {
      id: this.generateId(),
      description,
      timestamp: now,
      undo,
      redo,
      mergeKey
    };

    // Проверяем, можно ли объединить с предыдущим действием
    const shouldMerge = this.shouldMergeAction(action, now);

    if (shouldMerge && this.undoStack.length > 0) {
      // Заменяем последнее действие объединенным
      const lastAction = this.undoStack[this.undoStack.length - 1];
      if (this.debug) {
        console.log(`Merging action "${description}" with "${lastAction.description}"`);
      }
      
      // Создаем объединенное действие
      const mergedAction: UndoAction = {
        id: lastAction.id,
        description: `${lastAction.description} + ${description}`,
        timestamp: now,
        undo: async () => {
          await Promise.resolve(action.undo());
          await Promise.resolve(lastAction.undo());
        },
        redo: async () => {
          await Promise.resolve(lastAction.redo());
          await Promise.resolve(action.redo());
        },
        mergeKey
      };

      this.undoStack[this.undoStack.length - 1] = mergedAction;
    } else {
      // Добавляем новое действие
      this.undoStack.push(action);
      this.lastMergeKey = mergeKey || null;
      
      // Очищаем стек redo при новом действии
      this.redoStack = [];
      
      // Обрезаем стек, если превышен лимит
      if (this.undoStack.length > this.maxHistorySize) {
        this.undoStack.shift();
      }
    }

    this.lastActionTime = now;

    if (this.debug) {
      console.log(`Action registered: ${description}`, {
        undoStack: this.undoStack.length,
        redoStack: this.redoStack.length
      });
    }

    return action.id;
  }

  /**
   * Отменяет последнее действие
   */
  async undo(): Promise<boolean> {
    if (this.undoStack.length === 0) {
      if (this.debug) console.log('Nothing to undo');
      return false;
    }

    const action = this.undoStack.pop()!;
    
    try {
      await Promise.resolve(action.undo());
      this.redoStack.push(action);
      
      if (this.debug) {
        console.log(`Undo: ${action.description}`);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to undo action:', error);
      // Возвращаем действие в стек при ошибке
      this.undoStack.push(action);
      return false;
    }
  }

  /**
   * Повторяет последнее отмененное действие
   */
  async redo(): Promise<boolean> {
    if (this.redoStack.length === 0) {
      if (this.debug) console.log('Nothing to redo');
      return false;
    }

    const action = this.redoStack.pop()!;
    
    try {
      await Promise.resolve(action.redo());
      this.undoStack.push(action);
      
      if (this.debug) {
        console.log(`Redo: ${action.description}`);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to redo action:', error);
      // Возвращаем действие в стек при ошибке
      this.redoStack.push(action);
      return false;
    }
  }

  /**
   * Проверяет, можно ли отменить действие
   */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * Проверяет, можно ли повторить действие
   */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Возвращает описание следующего действия для отмены
   */
  getNextUndoDescription(): string | null {
    if (this.undoStack.length === 0) return null;
    return this.undoStack[this.undoStack.length - 1].description;
  }

  /**
   * Возвращает описание следующего действия для повтора
   */
  getNextRedoDescription(): string | null {
    if (this.redoStack.length === 0) return null;
    return this.redoStack[this.redoStack.length - 1].description;
  }

  /**
   * Очищает всю историю
   */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.lastActionTime = 0;
    this.lastMergeKey = null;
    
    if (this.debug) {
      console.log('Undo history cleared');
    }
  }

  /**
   * Возвращает статистику
   */
  getStats() {
    return {
      undoStackSize: this.undoStack.length,
      redoStackSize: this.redoStack.length,
      totalActions: this.undoStack.length + this.redoStack.length,
      lastActionTime: this.lastActionTime,
      canUndo: this.canUndo(),
      canRedo: this.canRedo()
    };
  }

  /**
   * Экспортирует историю (для отладки)
   */
  exportHistory(): any {
    return {
      undoStack: this.undoStack.map(a => ({
        id: a.id,
        description: a.description,
        timestamp: new Date(a.timestamp).toISOString()
      })),
      redoStack: this.redoStack.map(a => ({
        id: a.id,
        description: a.description,
        timestamp: new Date(a.timestamp).toISOString()
      }))
    };
  }

  /**
   * Генерирует уникальный ID для действия
   */
  private generateId(): string {
    return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Проверяет, можно ли объединить действие с предыдущим
   */
  private shouldMergeAction(action: UndoAction, now: number): boolean {
    if (!action.mergeKey || this.undoStack.length === 0) {
      return false;
    }

    const lastAction = this.undoStack[this.undoStack.length - 1];
    const timeDiff = now - this.lastActionTime;
    
    // Объединяем, если:
    // 1. Ключ объединения совпадает
    // 2. Время между действиями меньше таймаута
    // 3. Предыдущее действие тоже имеет mergeKey
    return (
      action.mergeKey === lastAction.mergeKey &&
      timeDiff < this.mergeTimeout &&
      !!lastAction.mergeKey
    );
  }
}

// Специализированные менеджеры для разных типов редакторов

export class SceneUndoManager extends UndoManager {
  constructor() {
    super({
      maxHistorySize: 100,
      mergeTimeout: 500,
      debug: false
    });
  }

  /**
   * Регистрирует изменение свойства сцены
   */
  registerPropertyChange<T>(
    scene: any,
    property: string,
    oldValue: T,
    newValue: T,
    description: string = `Change ${property}`
  ): string {
    return this.registerAction(
      description,
      () => { scene[property] = oldValue; },
      () => { scene[property] = newValue; },
      `property_${property}`
    );
  }

  /**
   * Регистрирует добавление эффекта
   */
  registerEffectAdd(
    scene: any,
    effect: any,
    index: number,
    description: string = `Add effect ${effect.type}`
  ): string {
    return this.registerAction(
      description,
      () => {
        scene.effectDescriptors.splice(index, 1);
      },
      () => {
        scene.effectDescriptors.splice(index, 0, effect);
      }
    );
  }

  /**
   * Регистрирует удаление эффекта
   */
  registerEffectRemove(
    scene: any,
    effect: any,
    index: number,
    description: string = `Remove effect ${effect.type}`
  ): string {
    return this.registerAction(
      description,
      () => {
        scene.effectDescriptors.splice(index, 0, effect);
      },
      () => {
        scene.effectDescriptors.splice(index, 1);
      }
    );
  }

  /**
   * Регистрирует перемещение эффекта
   */
  registerEffectMove(
    scene: any,
    fromIndex: number,
    toIndex: number,
    description: string = `Move effect`
  ): string {
    const effect = scene.effectDescriptors[fromIndex];
    
    return this.registerAction(
      description,
      () => {
        // Отмена перемещения: возвращаем на исходную позицию
        scene.effectDescriptors.splice(toIndex, 1);
        scene.effectDescriptors.splice(fromIndex, 0, effect);
      },
      () => {
        // Повтор перемещения: снова перемещаем
        scene.effectDescriptors.splice(fromIndex, 1);
        scene.effectDescriptors.splice(toIndex, 0, effect);
      }
    );
  }
}

export class EffectUndoManager extends UndoManager {
  constructor() {
    super({
      maxHistorySize: 50,
      mergeTimeout: 300,
      debug: false
    });
  }

  /**
   * Регистрирует изменение параметра эффекта
   */
  registerParamChange(
    effect: any,
    paramName: string,
    oldValue: any,
    newValue: any,
    description: string = `Change parameter ${paramName}`
  ): string {
    return this.registerAction(
      description,
      () => { effect.params[paramName] = oldValue; },
      () => { effect.params[paramName] = newValue; },
      `param_${paramName}`
    );
  }

  /**
   * Регистрирует изменение типа эффекта
   */
  registerTypeChange(
    effect: any,
    oldType: string,
    newType: string,
    oldParams: any,
    newParams: any,
    description: string = `Change effect type to ${newType}`
  ): string {
    return this.registerAction(
      description,
      () => {
        effect.type = oldType;
        effect.params = { ...oldParams };
      },
      () => {
        effect.type = newType;
        effect.params = { ...newParams };
      }
    );
  }
}

// Глобальный экземпляр для использования в приложении
export const globalUndoManager = new UndoManager();

// Хук для React-подобных компонентов (если используется)
export function useUndoManager() {
  return {
    undo: () => globalUndoManager.undo(),
    redo: () => globalUndoManager.redo(),
    canUndo: globalUndoManager.canUndo(),
    canRedo: globalUndoManager.canRedo(),
    registerAction: globalUndoManager.registerAction.bind(globalUndoManager)
  };
}