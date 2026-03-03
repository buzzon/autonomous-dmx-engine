/**
 * DragDrop - утилиты для реализации drag-and-drop в редакторе
 */

import { ImGui } from "@zhobo63/imgui-ts";

export interface DragDropPayload<T = any> {
  type: string;
  data: T;
  sourceId?: string;
  timestamp: number;
}

export interface DragDropItem {
  id: string;
  type: string;
  data: any;
  canDropOn?: (targetType: string) => boolean;
  onDrop?: (targetId: string, position?: any) => void;
}

export interface DropTarget {
  id: string;
  type: string;
  acceptTypes: string[];
  onDrop: (payload: DragDropPayload, position?: any) => void;
  highlightColor?: [number, number, number, number];
}

export class DragDropManager {
  private static instance: DragDropManager;
  private items: Map<string, DragDropItem> = new Map();
  private targets: Map<string, DropTarget> = new Map();
  private currentDrag: { itemId: string; payload: DragDropPayload } | null = null;
  private lastDropTime: number = 0;
  private debug: boolean = false;

  private constructor() {}

  static getInstance(): DragDropManager {
    if (!DragDropManager.instance) {
      DragDropManager.instance = new DragDropManager();
    }
    return DragDropManager.instance;
  }

  /**
   * Регистрирует перетаскиваемый элемент
   */
  registerItem(item: DragDropItem): void {
    this.items.set(item.id, item);
    
    if (this.debug) {
      console.log(`Drag item registered: ${item.id} (${item.type})`);
    }
  }

  /**
   * Удаляет регистрацию элемента
   */
  unregisterItem(itemId: string): void {
    this.items.delete(itemId);
  }

  /**
   * Регистрирует цель для сброса
   */
  registerTarget(target: DropTarget): void {
    this.targets.set(target.id, target);
    
    if (this.debug) {
      console.log(`Drop target registered: ${target.id} (accepts: ${target.acceptTypes.join(', ')})`);
    }
  }

  /**
   * Удаляет регистрацию цели
   */
  unregisterTarget(targetId: string): void {
    this.targets.delete(targetId);
  }

  /**
   * Начинает перетаскивание элемента
   */
  beginDrag(itemId: string, additionalData: any = {}): boolean {
    const item = this.items.get(itemId);
    if (!item) {
      console.warn(`Drag item not found: ${itemId}`);
      return false;
    }

    this.currentDrag = {
      itemId,
      payload: {
        type: item.type,
        data: { ...item.data, ...additionalData },
        sourceId: itemId,
        timestamp: Date.now()
      }
    };

    if (this.debug) {
      console.log(`Begin drag: ${itemId}`, this.currentDrag.payload);
    }

    return true;
  }

  /**
   * Завершает перетаскивание (вызывается при отпускании кнопки мыши)
   */
  endDrag(): void {
    if (!this.currentDrag) return;

    // Ищем цель под курсором
    const target = this.findTargetUnderCursor();
    
    if (target && this.currentDrag) {
      this.handleDrop(target);
    } else {
      if (this.debug) {
        console.log('Drag ended with no valid target');
      }
    }

    this.currentDrag = null;
  }

  /**
   * Отменяет текущее перетаскивание
   */
  cancelDrag(): void {
    if (this.debug && this.currentDrag) {
      console.log('Drag cancelled:', this.currentDrag.itemId);
    }
    
    this.currentDrag = null;
  }

  /**
   * Проверяет, происходит ли перетаскивание
   */
  isDragging(): boolean {
    return this.currentDrag !== null;
  }

  /**
   * Получает текущий перетаскиваемый элемент
   */
  getCurrentDrag(): DragDropPayload | null {
    return this.currentDrag?.payload || null;
  }

  /**
   * Рендерит визуальную обратную связь для перетаскивания
   */
  renderDragFeedback(): void {
    if (!this.currentDrag) return;

    const mousePos = ImGui.GetMousePos();
    const item = this.items.get(this.currentDrag.itemId);
    
    if (!item) return;

    // Рисуем полупрозрачный дубликат элемента под курсором
    ImGui.SetNextWindowPos(mousePos);
    ImGui.SetNextWindowBgAlpha(0.7);
    
    ImGui.Begin(
      'drag_feedback',
      new ImGui.ImGuiWindowFlags(
        ImGui.WindowFlags.NoTitleBar |
        ImGui.WindowFlags.NoResize |
        ImGui.WindowFlags.NoMove |
        ImGui.WindowFlags.NoSavedSettings |
        ImGui.WindowFlags.NoInputs |
        ImGui.WindowFlags.NoFocusOnAppearing
      )
    );
    
    // Простое отображение типа элемента
    ImGui.Text(`Dragging: ${item.type}`);
    
    ImGui.End();

    // Подсветка допустимых целей
    const target = this.findTargetUnderCursor();
    if (target) {
      this.highlightTarget(target);
    }
  }

  /**
   * Создает источник перетаскивания для ImGui
   */
  createImGuiSource(itemId: string, label: string = "Drag"): void {
    if (ImGui.BeginDragDropSource()) {
      const item = this.items.get(itemId);
      if (item && this.beginDrag(itemId)) {
        // Устанавливаем payload для ImGui
        ImGui.SetDragDropPayload('CUSTOM_DND', JSON.stringify(this.currentDrag!.payload));
        ImGui.Text(`${label} ${item.type}`);
      }
      ImGui.EndDragDropSource();
    }
  }

  /**
   * Создает цель сброса для ImGui
   */
  createImGuiTarget(targetId: string, renderContent: () => void): void {
    const target = this.targets.get(targetId);
    if (!target) return;

    renderContent();

    if (ImGui.BeginDragDropTarget()) {
      const payload = ImGui.AcceptDragDropPayload('CUSTOM_DND');
      if (payload) {
        try {
          const dragPayload: DragDropPayload = JSON.parse(payload as string);
          
          // Проверяем, принимает ли цель этот тип
          if (target.acceptTypes.includes(dragPayload.type)) {
            // Подсвечиваем цель
            ImGui.GetWindowDrawList().AddRect(
              ImGui.GetItemRectMin(),
              ImGui.GetItemRectMax(),
              ImGui.GetColorU32(new ImGui.ImVec4(0, 1, 0, 0.3)),
              0,
              0,
              3
            );

            // Обрабатываем сброс при отпускании
            if (ImGui.IsMouseReleased(0)) {
              target.onDrop(dragPayload);
              this.lastDropTime = Date.now();
            }
          }
        } catch (error) {
          console.error('Failed to parse drag-drop payload:', error);
        }
      }
      ImGui.EndDragDropTarget();
    }
  }

  /**
   * Находит цель под текущим положением курсора
   */
  private findTargetUnderCursor(): DropTarget | null {
    if (!this.currentDrag) return null;

    const mousePos = ImGui.GetMousePos();
    const payload = this.currentDrag.payload;

    // В реальном приложении здесь была бы проверка пересечения с областями целей
    // Для простоты возвращаем первую подходящую цель
    for (const target of this.targets.values()) {
      if (target.acceptTypes.includes(payload.type)) {
        return target;
      }
    }

    return null;
  }

  /**
   * Обрабатывает сброс на цель
   */
  private handleDrop(target: DropTarget): void {
    if (!this.currentDrag) return;

    const item = this.items.get(this.currentDrag.itemId);
    if (!item) return;

    // Проверяем, может ли элемент быть сброшен на эту цель
    if (item.canDropOn && !item.canDropOn(target.type)) {
      if (this.debug) {
        console.log(`Item ${item.id} cannot be dropped on target ${target.id}`);
      }
      return;
    }

    // Вызываем обработчики
    target.onDrop(this.currentDrag.payload);
    
    if (item.onDrop) {
      item.onDrop(target.id);
    }

    this.lastDropTime = Date.now();

    if (this.debug) {
      console.log(`Drop successful: ${item.id} -> ${target.id}`);
    }
  }

  /**
   * Подсвечивает цель
   */
  private highlightTarget(target: DropTarget): void {
    const color = target.highlightColor || [0, 1, 0, 0.3];
    
    // В реальном приложении здесь было бы рисование подсветки
    // Для ImGui можно использовать AddRect для визуальной обратной связи
    if (ImGui.IsWindowHovered()) {
      const drawList = ImGui.GetWindowDrawList();
      const min = ImGui.GetWindowPos();
      const max = new ImGui.ImVec2(min.x + ImGui.GetWindowWidth(), min.y + ImGui.GetWindowHeight());
      
      drawList.AddRect(
        min,
        max,
        ImGui.GetColorU32(new ImGui.ImVec4(color[0], color[1], color[2], color[3])),
        0,
        0,
        2
      );
    }
  }

  /**
   * Включает/выключает отладку
   */
  setDebug(enabled: boolean): void {
    this.debug = enabled;
  }

  /**
   * Очищает все регистрации
   */
  clear(): void {
    this.items.clear();
    this.targets.clear();
    this.currentDrag = null;
  }
}

// Глобальный экземпляр
export const dragDropManager = DragDropManager.getInstance();

// Предопределенные типы для drag-and-drop в редакторе
export const DragDropTypes = {
  EFFECT: 'effect',
  EFFECT_TYPE: 'effect_type',
  FIXTURE: 'fixture',
  FIXTURE_PROFILE: 'fixture_profile',
  SCENE: 'scene',
  LAYER: 'layer',
  TIMELINE_CLIP: 'timeline_clip',
  PARAMETER: 'parameter'
} as const;

// Хелперы для конкретных use cases

/**
 * Создает перетаскиваемый элемент эффекта
 */
export function createEffectDragItem(
  effectId: string,
  effectType: string,
  groupId: string,
  params: any = {}
): DragDropItem {
  return {
    id: `effect_${effectId}`,
    type: DragDropTypes.EFFECT,
    data: { effectId, effectType, groupId, params },
    canDropOn: (targetType: string) => {
      return targetType === 'timeline' || targetType === 'layer' || targetType === 'group';
    },
    onDrop: (targetId: string) => {
      console.log(`Effect ${effectId} dropped on ${targetId}`);
    }
  };
}

/**
 * Создает перетаскиваемый тип эффекта (из палитры)
 */
export function createEffectTypeDragItem(
  effectType: string,
  description: string = ''
): DragDropItem {
  return {
    id: `effect_type_${effectType}`,
    type: DragDropTypes.EFFECT_TYPE,
    data: { effectType, description },
    canDropOn: (targetType: string) => {
      return targetType === 'timeline' || targetType === 'scene' || targetType === 'group';
    }
  };
}

/**
 * Создает цель сброса для таймлайна
 */
export function createTimelineDropTarget(
  timelineId: string,
  onDrop: (payload: DragDropPayload, timePosition: number) => void
): DropTarget {
  return {
    id: `timeline_${timelineId}`,
    type: 'timeline',
    acceptTypes: [DragDropTypes.EFFECT, DragDropTypes.EFFECT_TYPE, DragDropTypes.TIMELINE_CLIP],
    onDrop: (payload, position) => {
      const timePos = position?.time || 0;
      onDrop(payload, timePos);
    },
    highlightColor: [0.2, 0.8, 0.2, 0.3]
  };
}

/**
 * Создает цель сброса для группы фикстур
 */
export function createFixtureGroupDropTarget(
  groupId: string,
  onDrop: (payload: DragDropPayload) => void
): DropTarget {
  return {
    id: `group_${groupId}`,
    type: 'group',
    acceptTypes: [DragDropTypes.EFFECT, DragDropTypes.EFFECT_TYPE],
    onDrop,
    highlightColor: [0.8, 0.2, 0.8, 0.3]
  };
}

/**
 * Хук для использования drag-and-drop в компонентах
 */
export function useDragDrop() {
  return {
    beginDrag: dragDropManager.beginDrag.bind(dragDropManager),
    endDrag: dragDropManager.endDrag.bind(dragDropManager),
    cancelDrag: dragDropManager.cancelDrag.bind(dragDropManager),
    isDragging: dragDropManager.isDragging(),
    getCurrentDrag: dragDropManager.getCurrentDrag(),
    renderFeedback: dragDropManager.renderDragFeedback.bind(dragDropManager),
    
    // ImGui интеграция
    createSource: dragDropManager.createImGuiSource.bind(dragDropManager),
    createTarget: dragDropManager.createImGuiTarget.bind(dragDropManager),
    
    // Регистрация
    registerItem: dragDropManager.registerItem.bind(dragDropManager),
    registerTarget: dragDropManager.registerTarget.bind(dragDropManager),
    unregisterItem: dragDropManager.unregisterItem.bind(dragDropManager),
    unregisterTarget: dragDropManager.unregisterTarget.bind(dragDropManager)
  };
}

// Пример использования в компоненте:
/*
// В компоненте эффекта:
const { createSource } = useDragDrop();

function renderEffect(effect) {
  // Регистрируем элемент как перетаскиваемый
  useEffect(() => {
    const item = createEffectDragItem(effect.id, effect.type, effect.groupId, effect.params);
    dragDropManager.registerItem(item);
    
    return () => {
      dragDropManager.unregisterItem(item.id);
    };
  }, [effect]);
  
  // Рендерим с возможностью перетаскивания
  return (
    <div onMouseDown={() => dragDropManager.beginDrag(`effect_${effect.id}`)}>
      {effect.type}
    </div>
  );
}

// В компоненте таймлайна:
const { createTarget } = useDragDrop();

function renderTimeline() {
  // Регистрируем цель
  useEffect(() => {
    const target = createTimelineDropTarget('main', (payload, timePos) => {
      console.log(`Effect dropped at time ${timePos}`, payload);
    });
    
    dragDropManager.registerTarget(target);
    
    return () => {
      dragDropManager.unregisterTarget(target.id);
    };
  }, []);
  
  // Рендерим с возможностью сброса
  return createTarget('timeline_main', () => {
    // Содержимое таймлайна
    return <div>Timeline content</div>;
  });
}
*/