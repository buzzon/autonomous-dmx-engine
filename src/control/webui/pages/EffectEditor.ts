/**
 * EffectEditor - визуальный редактор эффектов
 */

import { ImGui } from "@zhobo63/imgui-ts";
import { Panel, CardPanel } from '../components/Panel';
import { Button, PrimaryButton } from '../components/Button';
import { store, selectors } from '../store/store';
import { useResponsiveLayout } from '../layouts/DashboardLayout';
import { EffectDescriptor } from '../../../brain/types';

export interface EffectEditorProps {
  onNavigate: (page: string) => void;
  onSave?: (effect: EffectDescriptor) => void;
  onLoad?: (effectType: string) => void;
}

export function EffectEditor(props: EffectEditorProps): void {
  const { onNavigate, onSave, onLoad } = props;
  const state = store.getState();
  const { isMobile, columnWidth } = useResponsiveLayout();

  // Current effect being edited
  const currentEffect = loadCurrentEffect();

  // Render header
  renderHeader(state, onNavigate, currentEffect, onSave);
  
  ImGui.Spacing();
  
  // Main editor layout
  renderEditorLayout(state, isMobile, columnWidth, currentEffect, onSave);
  
  ImGui.Spacing();
  
  // Effect properties panel
  renderPropertiesPanel(currentEffect, onSave);
}

function renderHeader(
  state: any, 
  onNavigate: (page: string) => void,
  currentEffect: EffectDescriptor,
  onSave?: (effect: EffectDescriptor) => void
): void {
  CardPanel({
    title: 'Effect Editor',
    width: -1,
    height: 100,
    children: () => {
      ImGui.Columns(4, 'effect-header', false);
      
      // Column 1: Effect info
      ImGui.Text("Current Effect:");
      ImGui.TextColored(new ImGui.ImVec4(0, 1, 1, 1), currentEffect.type);
      ImGui.Text(`Group: ${currentEffect.groupId}`);
      
      ImGui.NextColumn();
      
      // Column 2: Effect stats
      ImGui.Text("Statistics:");
      const paramCount = Object.keys(currentEffect.params || {}).length;
      ImGui.Text(`Parameters: ${paramCount}`);
      ImGui.Text(`Priority: ${currentEffect.priority || 'default'}`);
      
      ImGui.NextColumn();
      
      // Column 3: Actions
      ImGui.Text("Actions:");
      if (PrimaryButton({ label: "Save Effect", onClick: () => onSave?.(currentEffect) })) {}
      ImGui.SameLine();
      if (Button({ label: "Load Effect", onClick: () => openEffectBrowser() })) {}
      
      ImGui.NextColumn();
      
      // Column 4: Navigation
      ImGui.Text("Navigation:");
      if (Button({ label: "← Scenes", onClick: () => onNavigate('scenes') })) {}
      ImGui.SameLine();
      if (Button({ label: "Fixtures →", onClick: () => onNavigate('fixtures') })) {}
      
      ImGui.Columns(1);
    }
  });
}

function renderEditorLayout(
  state: any,
  isMobile: boolean,
  columnWidth: number,
  currentEffect: EffectDescriptor,
  onSave?: (effect: EffectDescriptor) => void
): void {
  const columns = isMobile ? 1 : 2;
  
  ImGui.Columns(columns, 'editor-layout', false);
  
  // Left panel: Node editor
  CardPanel({
    title: 'Node Editor',
    width: columnWidth,
    height: 400,
    children: () => {
      renderNodeEditor(currentEffect, onSave);
    }
  });
  
  if (!isMobile) {
    ImGui.NextColumn();
  }
  
  // Right panel: Preview and parameters
  CardPanel({
    title: 'Preview & Parameters',
    width: columnWidth,
    height: 400,
    children: () => {
      renderPreviewPanel(currentEffect, onSave);
    }
  });
  
  ImGui.Columns(1);
}

function renderNodeEditor(currentEffect: EffectDescriptor, onSave?: (effect: EffectDescriptor) => void): void {
  ImGui.Text("Node-based effect programming");
  ImGui.Separator();
  
  // Simple node visualization
  const nodeWidth = 120;
  const nodeHeight = 80;
  
  // Input node
  ImGui.SetCursorPos(new ImGui.ImVec2(20, 60));
  ImGui.BeginChild("input-node", new ImGui.ImVec2(nodeWidth, nodeHeight), true);
  ImGui.TextColored(new ImGui.ImVec4(0, 1, 0, 1), "Input");
  ImGui.Text("Time");
  ImGui.Text("Audio");
  ImGui.Text("Beat");
  ImGui.EndChild();
  
  // Effect node
  ImGui.SetCursorPos(new ImGui.ImVec2(160, 60));
  ImGui.BeginChild("effect-node", new ImGui.ImVec2(nodeWidth, nodeHeight), true);
  ImGui.TextColored(new ImGui.ImVec4(1, 1, 0, 1), currentEffect.type);
  ImGui.Text("Parameters:");
  for (const key in currentEffect.params) {
    if (currentEffect.params.hasOwnProperty(key)) {
      ImGui.Text(`  ${key}: ${currentEffect.params[key]}`);
    }
  }
  ImGui.EndChild();
  
  // Output node
  ImGui.SetCursorPos(new ImGui.ImVec2(300, 60));
  ImGui.BeginChild("output-node", new ImGui.ImVec2(nodeWidth, nodeHeight), true);
  ImGui.TextColored(new ImGui.ImVec4(0, 0.5, 1, 1), "Output");
  ImGui.Text("DMX Values");
  ImGui.Text("Fixture Group");
  ImGui.Text(currentEffect.groupId);
  ImGui.EndChild();
  
  // Add node button
  ImGui.SetCursorPos(new ImGui.ImVec2(20, 160));
  if (Button({ label: "+ Add Node", onClick: () => addNodeToEffect(currentEffect) })) {}
  
  // Connection lines would be drawn here in a real implementation
  ImGui.Text("Drag nodes to connect them");
}

function renderPreviewPanel(currentEffect: EffectDescriptor, onSave?: (effect: EffectDescriptor) => void): void {
  // Parameter editor
  ImGui.Text("Effect Parameters:");
  ImGui.Separator();
  
  const params = currentEffect.params || {};
  const paramKeys = Object.keys(params);
  
  if (paramKeys.length === 0) {
    ImGui.Text("No parameters defined");
  } else {
    for (const key of paramKeys) {
      ImGui.Text(`${key}:`);
      ImGui.SameLine();
      
      const value = params[key];
      if (typeof value === 'number') {
        // Number input
        let numValue = value;
        if (ImGui.InputFloat(`##${key}`, numValue, 0.1, 1, "%.2f")) {
          params[key] = numValue;
          onSave?.(currentEffect);
        }
      } else if (typeof value === 'boolean') {
        // Checkbox
        let boolValue = value;
        if (ImGui.Checkbox(`##${key}`, boolValue)) {
          params[key] = boolValue;
          onSave?.(currentEffect);
        }
      } else if (typeof value === 'string') {
        // Text input
        const strBuf = ImGui.StringBuffer(value, 256);
        if (ImGui.InputText(`##${key}`, strBuf)) {
          params[key] = strBuf.toString();
          onSave?.(currentEffect);
        }
      } else {
        // Display as JSON
        ImGui.Text(JSON.stringify(value));
      }
    }
  }
  
  ImGui.Separator();
  
  // Add parameter button
  if (Button({ label: "+ Add Parameter", onClick: () => addParameterToEffect(currentEffect) })) {}
  
  ImGui.Separator();
  
  // Preview visualization
  ImGui.Text("Preview:");
  const previewHeight = 100;
  const time = Date.now() / 1000;
  
  // Simple waveform preview
  for (let i = 0; i < 20; i++) {
    const x = i * 10;
    const t = time + i * 0.1;
    let height = 0;
    
    // Different preview based on effect type
    if (currentEffect.type.includes('pulse')) {
      height = Math.sin(t * 2) * 0.5 + 0.5;
    } else if (currentEffect.type.includes('chase')) {
      height = Math.sin(t + i * 0.5) * 0.5 + 0.5;
    } else if (currentEffect.type.includes('circle')) {
      height = Math.sin(t + i * 0.3) * 0.5 + 0.5;
    } else {
      height = 0.5;
    }
    
    const barHeight = height * previewHeight;
    ImGui.GetWindowDrawList().AddRectFilled(
      new ImGui.ImVec2(ImGui.GetCursorScreenPos().x + x, ImGui.GetCursorScreenPos().y + previewHeight - barHeight),
      new ImGui.ImVec2(ImGui.GetCursorScreenPos().x + x + 8, ImGui.GetCursorScreenPos().y + previewHeight),
      ImGui.GetColorU32(new ImGui.ImVec4(0, 0.8, 1, 1))
    );
  }
  
  ImGui.Dummy(new ImGui.ImVec2(200, previewHeight));
}

function renderPropertiesPanel(currentEffect: EffectDescriptor, onSave?: (effect: EffectDescriptor) => void): void {
  CardPanel({
    title: 'Effect Properties',
    width: -1,
    height: 200,
    children: () => {
      ImGui.Columns(2, 'properties', false);
      
      // Left column: Basic properties
      ImGui.Text("Basic Properties:");
      
      // Effect type
      ImGui.Text("Type:");
      ImGui.SameLine();
      const effectTypes = [
        'dim/none', 'dim/pulse', 'dim/chase',
        'pos/none', 'pos/circle', 'pos/swing',
        'color/none', 'color/cycle', 'color/gradient',
        'strobe/none', 'strobe/pulse'
      ];
      let typeIndex = effectTypes.indexOf(currentEffect.type);
      if (typeIndex < 0) typeIndex = 0;
      
      if (ImGui.Combo("##type", typeIndex, effectTypes)) {
        currentEffect.type = effectTypes[typeIndex];
        // Load default parameters for this effect type
        currentEffect.params = getDefaultParamsForType(currentEffect.type);
        onSave?.(currentEffect);
      }
      
      // Group ID
      ImGui.Text("Fixture Group:");
      ImGui.SameLine();
      const groups = ['BEAMS', 'WASH', 'SPOTS'];
      let groupIndex = groups.indexOf(currentEffect.groupId);
      if (groupIndex < 0) groupIndex = 0;
      
      if (ImGui.Combo("##group", groupIndex, groups)) {
        currentEffect.groupId = groups[groupIndex];
        onSave?.(currentEffect);
      }
      
      // Priority
      ImGui.Text("Priority:");
      ImGui.SameLine();
      let priority = currentEffect.priority || 10;
      if (ImGui.InputInt("##priority", priority, 1, 5)) {
        currentEffect.priority = priority;
        onSave?.(currentEffect);
      }
      
      ImGui.NextColumn();
      
      // Right column: Advanced properties
      ImGui.Text("Advanced Properties:");
      
      // Category
      const category = getCategoryFromType(currentEffect.type);
      ImGui.Text(`Category: ${category}`);
      
      // Supported groups
      const supportedGroups = getSupportedGroupsForType(currentEffect.type);
      ImGui.Text("Supported Groups:");
      for (const group of supportedGroups) {
        ImGui.Text(`  • ${group}`);
      }
      
      // Description
      const description = getDescriptionForType(currentEffect.type);
      ImGui.Text("Description:");
      ImGui.TextWrapped(description);
      
      ImGui.Columns(1);
      
      // Save button
      ImGui.Separator();
      if (PrimaryButton({ label: "Apply Changes", width: -1, onClick: () => onSave?.(currentEffect) })) {}
    }
  });
}

// Helper functions
function loadCurrentEffect(): EffectDescriptor {
  // TODO: Load from config/effects.json or current selection
  return {
    type: 'dim/pulse',
    groupId: 'BEAMS',
    params: {
      speed: 1.0,
      depth: 0.5,
      phase: 0,
      waveform: 'sine'
    },
    priority: 10
  };
}

function getDefaultParamsForType(effectType: string): Record<string, any> {
  // TODO: Load from config/effects.json
  const defaults: Record<string, Record<string, any>> = {
    'dim/pulse': { speed: 1.0, depth: 0.5, phase: 0, waveform: 'sine' },
    'dim/chase': { speed: 1.5, waveCount: 3, direction: 'forward', spread: 0.5 },
    'pos/circle': { speed: 0.5, radius: 0.3, centerX: 0, centerY: 0, direction: 'clockwise' },
    'color/cycle': { speed: 0.2, colors: [1, 2, 3], direction: 'forward', smooth: true }
  };
  
  return defaults[effectType] || {};
}

function getCategoryFromType(effectType: string): string {
  if (effectType.startsWith('dim/')) return 'dim';
  if (effectType.startsWith('pos/')) return 'position';
  if (effectType.startsWith('color/')) return 'color';
  if (effectType.startsWith('strobe/')) return 'strobe';
  return 'other';
}

function getSupportedGroupsForType(effectType: string): string[] {
  // TODO: Load from config/effects.json
  const category = getCategoryFromType(effectType);
  switch (category) {
    case 'dim': return ['BEAMS', 'WASH', 'SPOTS'];
    case 'position': return ['BEAMS', 'SPOTS'];
    case 'color': return ['BEAMS', 'WASH'];
    case 'strobe': return ['BEAMS', 'WASH', 'SPOTS'];
    default: return ['BEAMS', 'WASH', 'SPOTS'];
  }
}

function getDescriptionForType(effectType: string): string {
  // TODO: Load from config/effects.json
  const descriptions: Record<string, string> = {
    'dim/pulse': 'Pulsing dim effect with adjustable speed and depth',
    'dim/chase': 'Chasing dim effect across fixtures',
    'pos/circle': 'Circular position movement',
    'color/cycle': 'Cycle through colors'
  };
  
  return descriptions[effectType] || 'No description available';
}

function addNodeToEffect(effect: EffectDescriptor): void {
  // TODO: Implement node addition
  console.log('Add node to effect', effect);
}

function addParameterToEffect(effect: EffectDescriptor): void {
  if (!effect.params) {
    effect.params = {};
  }
  
  // Add a default parameter
  effect.params[`param_${Object.keys(effect.params).length + 1}`] = 0.5;
}

function openEffectBrowser(): void {
  // TODO: Implement effect browser modal
  console.log('Open effect browser');
}

// Export for use in navigation
export default EffectEditor;