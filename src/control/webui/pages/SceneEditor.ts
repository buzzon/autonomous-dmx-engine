/**
 * SceneEditor - drag-and-drop редактор сцен
 */

import { ImGui } from "@zhobo63/imgui-ts";
import { Panel, CardPanel } from '../components/Panel';
import { Button, PrimaryButton } from '../components/Button';
import { store, selectors } from '../store/store';
import { useResponsiveLayout } from '../layouts/DashboardLayout';
import { SceneDefinition, EffectDescriptor, BrainState } from '../../../brain/types';

export interface SceneEditorProps {
  onNavigate: (page: string) => void;
  onSave?: (scene: SceneDefinition) => void;
  onLoad?: (sceneId: string) => void;
}

export function SceneEditor(props: SceneEditorProps): void {
  const { onNavigate, onSave, onLoad } = props;
  const state = store.getState();
  const { isMobile, columnWidth } = useResponsiveLayout();

  // Получаем текущие сцены из store (в будущем из конфигурации)
  const scenes = loadScenesFromConfig();
  const currentScene = scenes[0] || createEmptyScene();

  // Render header
  renderHeader(state, onNavigate, currentScene, onSave);
  
  ImGui.Spacing();
  
  // Main editor layout
  renderEditorLayout(state, isMobile, columnWidth, currentScene, onSave);
  
  ImGui.Spacing();
  
  // Scene properties panel
  renderPropertiesPanel(currentScene, onSave);
}

function renderHeader(
  state: any,
  onNavigate: (page: string) => void,
  currentScene: SceneDefinition,
  onSave?: (scene: SceneDefinition) => void
): void {
  CardPanel({
    title: 'Scene Editor',
    width: -1,
    height: 100,
    children: () => {
      ImGui.Columns(4, 'scene-header', false);
      
      // Column 1: Scene info
      ImGui.Text("Current Scene:");
      ImGui.TextColored(new ImGui.ImVec4(0, 1, 1, 1), currentScene.name);
      ImGui.Text(`ID: ${currentScene.id}`);
      
      ImGui.NextColumn();
      
      // Column 2: Scene stats
      ImGui.Text("Statistics:");
      ImGui.Text(`Effects: ${currentScene.effectDescriptors?.length || 0}`);
      ImGui.Text(`Intensity: ${(currentScene.baseIntensity * 100).toFixed(0)}%`);
      
      ImGui.NextColumn();
      
      // Column 3: Actions
      ImGui.Text("Actions:");
      if (PrimaryButton({ label: "Save Scene", onClick: () => onSave?.(currentScene) })) {}
      ImGui.SameLine();
      if (Button({ label: "Load Scene", onClick: () => openSceneBrowser() })) {}
      
      ImGui.NextColumn();
      
      // Column 4: Navigation
      ImGui.Text("Navigation:");
      if (Button({ label: "← Back", onClick: () => onNavigate('home') })) {}
      ImGui.SameLine();
      if (Button({ label: "Effects →", onClick: () => onNavigate('effects') })) {}
      
      ImGui.Columns(1);
    }
  });
}

function renderEditorLayout(
  state: any,
  isMobile: boolean,
  columnWidth: number,
  currentScene: SceneDefinition,
  onSave?: (scene: SceneDefinition) => void
): void {
  const columns = isMobile ? 1 : 3;
  
  ImGui.Columns(columns, 'editor-layout', false);
  
  // Left panel: Effect palette
  CardPanel({
    title: 'Effect Palette',
    width: columnWidth,
    height: 400,
    children: () => {
      renderEffectPalette(currentScene, onSave);
    }
  });
  
  if (!isMobile) {
    ImGui.NextColumn();
  }
  
  // Center panel: Timeline
  CardPanel({
    title: 'Timeline',
    width: columnWidth * (isMobile ? 1 : 2),
    height: 400,
    children: () => {
      renderTimeline(currentScene, onSave);
    }
  });
  
  if (!isMobile) {
    ImGui.NextColumn();
  }
  
  // Right panel: Layer manager
  CardPanel({
    title: 'Layers',
    width: columnWidth,
    height: 400,
    children: () => {
      renderLayerManager(currentScene, onSave);
    }
  });
  
  ImGui.Columns(1);
}

function renderEffectPalette(currentScene: SceneDefinition, onSave?: (scene: SceneDefinition) => void): void {
  const effectCategories = [
    { name: 'Dim', effects: ['dim/none', 'dim/pulse', 'dim/chase'] },
    { name: 'Position', effects: ['pos/none', 'pos/circle', 'pos/swing'] },
    { name: 'Color', effects: ['color/none', 'color/cycle', 'color/gradient'] },
    { name: 'Strobe', effects: ['strobe/none', 'strobe/pulse'] }
  ];
  
  for (const category of effectCategories) {
    if (ImGui.CollapsingHeader(category.name)) {
      for (const effectType of category.effects) {
        ImGui.Selectable(effectType, false);
        // Drag source for drag-and-drop
        if (ImGui.BeginDragDropSource()) {
          ImGui.SetDragDropPayload('EFFECT_TYPE', effectType);
          ImGui.Text(`Drag ${effectType}`);
          ImGui.EndDragDropSource();
        }
      }
    }
  }
  
  ImGui.Separator();
  ImGui.Text("Fixture Groups:");
  const groups = ['BEAMS', 'WASH', 'SPOTS'];
  for (const group of groups) {
    ImGui.Selectable(`Group: ${group}`, false);
  }
}

function renderTimeline(currentScene: SceneDefinition, onSave?: (scene: SceneDefinition) => void): void {
  // Timeline header
  ImGui.Text("Timeline (drag effects here)");
  ImGui.Separator();
  
  // Drop target for timeline
  if (ImGui.BeginDragDropTarget()) {
    const payload = ImGui.AcceptDragDropPayload('EFFECT_TYPE');
    if (payload) {
      // Add effect to scene
      const effectType = payload as string;
      addEffectToScene(currentScene, effectType, 'BEAMS', {});
      onSave?.(currentScene);
    }
    ImGui.EndDragDropTarget();
  }
  
  // Render existing effects on timeline
  const effects = currentScene.effectDescriptors || [];
  for (let i = 0; i < effects.length; i++) {
    const effect = effects[i];
    ImGui.PushID(`effect-${i}`);
    
    CardPanel({
      title: effect.type,
      width: -1,
      height: 60,
      children: () => {
        ImGui.Text(`Group: ${effect.groupId}`);
        ImGui.Text(`Params: ${JSON.stringify(effect.params)}`);
        
        if (Button({ label: "Edit", width: 50 })) {
          openEffectEditor(effect);
        }
        ImGui.SameLine();
        if (Button({ label: "Delete", width: 50 })) {
          removeEffectFromScene(currentScene, i);
          onSave?.(currentScene);
        }
      }
    });
    
    ImGui.PopID();
  }
  
  // Add new effect button
  if (Button({ label: "+ Add Effect", width: -1 })) {
    openEffectSelector(currentScene, onSave);
  }
}

function renderLayerManager(currentScene: SceneDefinition, onSave?: (scene: SceneDefinition) => void): void {
  const groups = ['BEAMS', 'WASH', 'SPOTS'];
  
  for (const group of groups) {
    if (ImGui.CollapsingHeader(`Group: ${group}`)) {
      const groupEffects = (currentScene.effectDescriptors || []).filter(e => e.groupId === group);
      
      if (groupEffects.length === 0) {
        ImGui.Text("No effects for this group");
      } else {
        for (const effect of groupEffects) {
          ImGui.Selectable(effect.type, false);
        }
      }
      
      // Add effect to this group
      if (Button({ label: `+ Add to ${group}`, width: -1 })) {
        openEffectSelectorForGroup(currentScene, group, onSave);
      }
    }
  }
}

function renderPropertiesPanel(currentScene: SceneDefinition, onSave?: (scene: SceneDefinition) => void): void {
  CardPanel({
    title: 'Scene Properties',
    width: -1,
    height: 200,
    children: () => {
      ImGui.Columns(2, 'properties', false);
      
      // Left column: Basic properties
      ImGui.Text("Basic Properties:");
      
      // Scene name
      ImGui.Text("Name:");
      ImGui.SameLine();
      const nameBuf = ImGui.CreateStringBuffer(currentScene.name, 256);
      if (ImGui.InputText("##name", nameBuf)) {
        currentScene.name = nameBuf.toString();
      }
      
      // Base intensity
      ImGui.Text("Base Intensity:");
      ImGui.SameLine();
      let intensity = currentScene.baseIntensity;
      if (ImGui.SliderFloat("##intensity", intensity, 0, 1, "%.2f")) {
        currentScene.baseIntensity = intensity;
        onSave?.(currentScene);
      }
      
      // Allowed states
      ImGui.Text("Allowed States:");
      const states = ['Idle', 'Chill', 'Party', 'Transition'];
      for (const state of states) {
        const isAllowed = (currentScene.allowedStates || []).includes(state);
        let checked = isAllowed;
        if (ImGui.Checkbox(state, checked)) {
          toggleAllowedState(currentScene, state);
          onSave?.(currentScene);
        }
      }
      
      ImGui.NextColumn();
      
      // Right column: Advanced properties
      ImGui.Text("Advanced Properties:");
      
      // Palette ID
      ImGui.Text("Palette:");
      ImGui.SameLine();
      const palettes = ['warm', 'cool', 'party', 'rainbow', 'custom'];
      let paletteIndex = palettes.indexOf(currentScene.paletteId || 'warm');
      if (ImGui.Combo("##palette", paletteIndex, palettes)) {
        currentScene.paletteId = palettes[paletteIndex];
        onSave?.(currentScene);
      }
      
      // Priority
      ImGui.Text("Priority:");
      ImGui.SameLine();
      let priority = currentScene.priority || 50;
      if (ImGui.SliderInt("##priority", priority, 1, 100)) {
        currentScene.priority = priority;
        onSave?.(currentScene);
      }
      
      // Duration (if applicable)
      ImGui.Text("Duration (s):");
      ImGui.SameLine();
      let duration = currentScene.duration || 0;
      if (ImGui.InputFloat("##duration", duration, 0.1, 1, "%.1f")) {
        currentScene.duration = duration;
        onSave?.(currentScene);
      }
      
      ImGui.Columns(1);
      
      // Save button
      ImGui.Separator();
      if (PrimaryButton({ label: "Apply Changes", width: -1, onClick: () => onSave?.(currentScene) })) {}
    }
  });
}

// Helper functions
function loadScenesFromConfig(): SceneDefinition[] {
  // TODO: Load from config/scenes.json
  return [
    {
      id: 'test-scene',
      name: 'Test Scene',
      allowedStates: ['Idle', 'Chill'] as BrainState[],
      paletteId: 'warm',
      baseIntensity: 0.5,
      effectDescriptors: [
        {
          type: 'dim/pulse',
          groupId: 'BEAMS',
          params: { speed: 1.0, depth: 0.5 }
        }
      ]
    }
  ];
}

function createEmptyScene(): SceneDefinition {
  return {
    id: `scene-${Date.now()}`,
    name: 'New Scene',
    allowedStates: ['Idle'] as BrainState[],
    paletteId: 'warm',
    baseIntensity: 0.5,
    effectDescriptors: []
  };
}

function addEffectToScene(scene: SceneDefinition, type: string, groupId: string, params: any): void {
  if (!scene.effectDescriptors) {
    scene.effectDescriptors = [];
  }
  
  scene.effectDescriptors.push({
    type,
    groupId,
    params
  });
}

function removeEffectFromScene(scene: SceneDefinition, index: number): void {
  if (scene.effectDescriptors && index >= 0 && index < scene.effectDescriptors.length) {
    scene.effectDescriptors.splice(index, 1);
  }
}

function toggleAllowedState(scene: SceneDefinition, state: BrainState): void {
  if (!scene.allowedStates) {
    scene.allowedStates = [];
  }
  
  const index = scene.allowedStates.indexOf(state);
  if (index >= 0) {
    scene.allowedStates.splice(index, 1);
  } else {
    scene.allowedStates.push(state);
  }
}

function openSceneBrowser(): void {
  // TODO: Implement scene browser modal
  console.log('Open scene browser');
}

function openEffectEditor(effect: EffectDescriptor): void {
  // TODO: Implement effect editor modal
  console.log('Open effect editor', effect);
}

function openEffectSelector(scene: SceneDefinition, onSave?: (scene: SceneDefinition) => void): void {
  // TODO: Implement effect selector modal
  console.log('Open effect selector');
}

function openEffectSelectorForGroup(scene: SceneDefinition, group: string, onSave?: (scene: SceneDefinition) => void): void {
  // TODO: Implement effect selector for specific group
  console.log('Open effect selector for group', group);
}

// Export for use in navigation
export default SceneEditor;