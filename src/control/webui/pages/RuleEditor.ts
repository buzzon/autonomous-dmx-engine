/**
 * RuleEditor - редактор правил выбора сцен
 */

import { ImGui } from "@zhobo63/imgui-ts";
import { Panel, CardPanel } from '../components/Panel';
import { Button, PrimaryButton, DangerButton } from '../components/Button';
import { store, selectors } from '../store/store';
import { useResponsiveLayout } from '../layouts/DashboardLayout';
import { configLoader } from '../utils/configLoader';
import { SceneRule, BrainState } from '../../../brain/types';
import { Mood } from '../../../audio/types';

export interface RuleEditorProps {
  onNavigate: (page: string) => void;
  onSave?: (rules: SceneRule[]) => void;
}

export function RuleEditor(props: RuleEditorProps): void {
  const { onNavigate, onSave } = props;
  const state = store.getState();
  const { isMobile, columnWidth } = useResponsiveLayout();

  // Загружаем правила и сцены
  const rules = loadRules();
  const scenes = loadScenes();
  const currentRule = rules[0] || createEmptyRule();

  // Render header
  renderHeader(state, onNavigate, rules, onSave);
  
  ImGui.Spacing();
  
  // Main editor layout
  renderEditorLayout(state, isMobile, columnWidth, currentRule, scenes, onSave);
  
  ImGui.Spacing();
  
  // Rule list panel
  renderRuleList(rules, currentRule, onSave);
}

function renderHeader(
  state: any, 
  onNavigate: (page: string) => void,
  rules: SceneRule[],
  onSave?: (rules: SceneRule[]) => void
): void {
  CardPanel({
    title: 'Scene Rule Editor',
    width: -1,
    height: 100,
    children: () => {
      ImGui.Columns(4, 'rule-header', false);
      
      // Column 1: Rule info
      ImGui.Text("Rule Statistics:");
      ImGui.Text(`Total Rules: ${rules.length}`);
      const activeRules = rules.filter(r => !r.disabled).length;
      ImGui.Text(`Active: ${activeRules}`);
      
      ImGui.NextColumn();
      
      // Column 2: System state
      ImGui.Text("Current System:");
      const audioEnergy = state.audio.energy || 0;
      const brainState = state.system.mode || 'Idle';
      ImGui.Text(`Energy: ${audioEnergy.toFixed(3)}`);
      ImGui.Text(`State: ${brainState}`);
      
      ImGui.NextColumn();
      
      // Column 3: Actions
      ImGui.Text("Actions:");
      if (PrimaryButton({ label: "Save Rules", onClick: () => saveRules(rules, onSave) })) {}
      ImGui.SameLine();
      if (Button({ label: "Test Rules", onClick: () => testRules(rules) })) {}
      
      ImGui.NextColumn();
      
      // Column 4: Navigation
      ImGui.Text("Navigation:");
      if (Button({ label: "← Scenes", onClick: () => onNavigate('scenes') })) {}
      ImGui.SameLine();
      if (Button({ label: "Home →", onClick: () => onNavigate('home') })) {}
      
      ImGui.Columns(1);
    }
  });
}

function renderEditorLayout(
  state: any,
  isMobile: boolean,
  columnWidth: number,
  currentRule: SceneRule,
  scenes: any[],
  onSave?: (rules: SceneRule[]) => void
): void {
  const columns = isMobile ? 1 : 2;
  
  ImGui.Columns(columns, 'editor-layout', false);
  
  // Left panel: Condition builder
  CardPanel({
    title: 'Condition Builder',
    width: columnWidth,
    height: 400,
    children: () => {
      renderConditionBuilder(currentRule, onSave);
    }
  });
  
  if (!isMobile) {
    ImGui.NextColumn();
  }
  
  // Right panel: Rule preview and actions
  CardPanel({
    title: 'Rule Preview & Actions',
    width: columnWidth,
    height: 400,
    children: () => {
      renderRulePreview(currentRule, scenes, state, onSave);
    }
  });
  
  ImGui.Columns(1);
}

function renderConditionBuilder(currentRule: SceneRule, onSave?: (rules: SceneRule[]) => void): void {
  const conditions = currentRule.conditions || {};
  
  ImGui.Text("When ALL of these conditions are true:");
  ImGui.Separator();
  
  // Brain State condition
  ImGui.Text("Brain State:");
  ImGui.SameLine();
  
  const brainStates: BrainState[] = ['Idle', 'Chill', 'Party', 'Manual'];
  const selectedStates = Array.isArray(conditions.brainState) 
    ? conditions.brainState 
    : conditions.brainState ? [conditions.brainState] : [];
  
  let stateMask = 0;
  for (const state of selectedStates) {
    const index = brainStates.indexOf(state as BrainState);
    if (index >= 0) {
      stateMask |= (1 << index);
    }
  }
  
  // Multi-select для brain states
  for (let i = 0; i < brainStates.length; i++) {
    const state = brainStates[i];
    const isSelected = (stateMask & (1 << i)) !== 0;
    let checked = isSelected;
    
    if (ImGui.Checkbox(state, checked)) {
      if (checked) {
        // Add state
        if (!selectedStates.includes(state)) {
          selectedStates.push(state);
        }
      } else {
        // Remove state
        const index = selectedStates.indexOf(state);
        if (index >= 0) {
          selectedStates.splice(index, 1);
        }
      }
      
      if (selectedStates.length === 1) {
        conditions.brainState = selectedStates[0];
      } else if (selectedStates.length > 1) {
        conditions.brainState = [...selectedStates];
      } else {
        delete conditions.brainState;
      }
      
      onSave?.([currentRule]);
    }
  }
  
  ImGui.Separator();
  
  // Energy conditions
  ImGui.Text("Audio Energy:");
  ImGui.Columns(2, "energy-conditions", false);
  
  ImGui.Text("Min:");
  ImGui.SameLine();
  let energyMin = conditions.energyMin || 0;
  if (ImGui.InputFloat("##energyMin", energyMin, 0.1, 0.5, "%.2f")) {
    conditions.energyMin = Math.max(0, Math.min(1, energyMin));
    onSave?.([currentRule]);
  }
  
  ImGui.NextColumn();
  
  ImGui.Text("Max:");
  ImGui.SameLine();
  let energyMax = conditions.energyMax || 1;
  if (ImGui.InputFloat("##energyMax", energyMax, 0.1, 0.5, "%.2f")) {
    conditions.energyMax = Math.max(0, Math.min(1, energyMax));
    onSave?.([currentRule]);
  }
  
  ImGui.Columns(1);
  
  // BPM conditions
  ImGui.Separator();
  ImGui.Text("BPM Range:");
  ImGui.Columns(2, "bpm-conditions", false);
  
  ImGui.Text("Min:");
  ImGui.SameLine();
  let bpmMin = conditions.bpmMin || 60;
  if (ImGui.InputInt("##bpmMin", bpmMin, 5, 10)) {
    conditions.bpmMin = Math.max(0, bpmMin);
    onSave?.([currentRule]);
  }
  
  ImGui.NextColumn();
  
  ImGui.Text("Max:");
  ImGui.SameLine();
  let bpmMax = conditions.bpmMax || 180;
  if (ImGui.InputInt("##bpmMax", bpmMax, 5, 10)) {
    conditions.bpmMax = Math.max(0, bpmMax);
    onSave?.([currentRule]);
  }
  
  ImGui.Columns(1);
  
  // Mood condition
  ImGui.Separator();
  ImGui.Text("Mood:");
  ImGui.SameLine();
  
  const moods: Mood[] = ['calm', 'energetic', 'intense', 'melodic'];
  let moodIndex = -1;
  if (conditions.mood) {
    if (Array.isArray(conditions.mood)) {
      // Для простоты берем первое значение
      moodIndex = moods.indexOf(conditions.mood[0] as Mood);
    } else {
      moodIndex = moods.indexOf(conditions.mood as Mood);
    }
  }
  
  if (ImGui.Combo("##mood", moodIndex, moods)) {
    conditions.mood = moods[moodIndex];
    onSave?.([currentRule]);
  }
  
  // Time of day condition
  ImGui.Separator();
  ImGui.Text("Time of Day:");
  
  const timeOfDay = conditions.timeOfDay || { start: "20:00", end: "06:00" };
  
  ImGui.Text("Start:");
  ImGui.SameLine();
  const startBuf = ImGui.StringBuffer(timeOfDay.start, 6);
  if (ImGui.InputText("##startTime", startBuf)) {
    timeOfDay.start = startBuf.toString();
    conditions.timeOfDay = timeOfDay;
    onSave?.([currentRule]);
  }
  
  ImGui.Text("End:");
  ImGui.SameLine();
  const endBuf = ImGui.StringBuffer(timeOfDay.end, 6);
  if (ImGui.InputText("##endTime", endBuf)) {
    timeOfDay.end = endBuf.toString();
    conditions.timeOfDay = timeOfDay;
    onSave?.([currentRule]);
  }
  
  // Add condition button
  ImGui.Separator();
  if (Button({ label: "+ Add Condition", onClick: () => addCondition(currentRule) })) {}
}

function renderRulePreview(
  currentRule: SceneRule, 
  scenes: any[], 
  systemState: any,
  onSave?: (rules: SceneRule[]) => void
): void {
  // Scene selection
  ImGui.Text("Target Scene:");
  ImGui.SameLine();
  
  const sceneOptions = scenes.map(s => s.name);
  let sceneIndex = scenes.findIndex(s => s.id === currentRule.sceneId);
  if (sceneIndex < 0) sceneIndex = 0;
  
  if (ImGui.Combo("##scene", sceneIndex, sceneOptions)) {
    currentRule.sceneId = scenes[sceneIndex]?.id || '';
    onSave?.([currentRule]);
  }
  
  ImGui.Separator();
  
  // Rule parameters
  ImGui.Text("Rule Parameters:");
  
  // Weight
  ImGui.Text("Weight:");
  ImGui.SameLine();
  let weight = currentRule.weight || 1.0;
  if (ImGui.InputFloat("##weight", weight, 0.1, 0.5, "%.1f")) {
    currentRule.weight = Math.max(0.1, weight);
    onSave?.([currentRule]);
  }
  ImGui.Text("(higher = more likely to be selected)");
  
  // Cooldown
  ImGui.Text("Cooldown (ms):");
  ImGui.SameLine();
  let cooldown = currentRule.cooldown || 0;
  if (ImGui.InputInt("##cooldown", cooldown, 1000, 5000)) {
    currentRule.cooldown = Math.max(0, cooldown);
    onSave?.([currentRule]);
  }
  
  // Duration limits
  ImGui.Text("Duration Limits (ms):");
  ImGui.Columns(2, "duration-limits", false);
  
  ImGui.Text("Min:");
  ImGui.SameLine();
  let minDuration = currentRule.minDuration || 0;
  if (ImGui.InputInt("##minDuration", minDuration, 1000, 5000)) {
    currentRule.minDuration = Math.max(0, minDuration);
    onSave?.([currentRule]);
  }
  
  ImGui.NextColumn();
  
  ImGui.Text("Max:");
  ImGui.SameLine();
  let maxDuration = currentRule.maxDuration || 0;
  if (ImGui.InputInt("##maxDuration", maxDuration, 1000, 5000)) {
    currentRule.maxDuration = Math.max(0, maxDuration);
    onSave?.([currentRule]);
  }
  
  ImGui.Columns(1);
  
  // Transition time
  ImGui.Text("Transition Time (ms):");
  ImGui.SameLine();
  let transitionTime = currentRule.transitionTime || 1000;
  if (ImGui.InputInt("##transition", transitionTime, 100, 500)) {
    currentRule.transitionTime = Math.max(0, transitionTime);
    onSave?.([currentRule]);
  }
  
  ImGui.Separator();
  
  // Rule evaluation
  ImGui.Text("Rule Evaluation:");
  
  const isActive = evaluateRule(currentRule, systemState);
  const matchPercent = calculateMatchPercent(currentRule, systemState);
  
  if (isActive) {
    ImGui.TextColored(new ImGui.ImVec4(0, 1, 0, 1), "✓ Rule would activate");
  } else {
    ImGui.TextColored(new ImGui.ImVec4(1, 0.5, 0, 1), "○ Rule would not activate");
  }
  
  ImGui.Text(`Match: ${matchPercent.toFixed(1)}%`);
  ImGui.ProgressBar(matchPercent / 100, new ImGui.ImVec2(-1, 20), "");
  
  // Test button
  ImGui.Separator();
  if (PrimaryButton({ label: "Test This Rule", onClick: () => testSingleRule(currentRule, systemState) })) {}
}

function renderRuleList(rules: SceneRule[], currentRule: SceneRule, onSave?: (rules: SceneRule[]) => void): void {
  CardPanel({
    title: 'Rule List',
    width: -1,
    height: 250,
    children: () => {
      ImGui.Columns(4, "rule-list", true);
      
      ImGui.Text("Active"); ImGui.NextColumn();
      ImGui.Text("Scene"); ImGui.NextColumn();
      ImGui.Text("Conditions"); ImGui.NextColumn();
      ImGui.Text("Actions"); ImGui.NextColumn();
      
      ImGui.Separator();
      
      for (const rule of rules) {
        const isCurrent = rule === currentRule;
        
        // Active checkbox
        let disabled = rule.disabled || false;
        if (ImGui.Checkbox(`##active-${rule.sceneId}`, disabled)) {
          rule.disabled = !disabled;
          onSave?.(rules);
        }
        ImGui.NextColumn();
        
        // Scene name
        if (isCurrent) {
          ImGui.TextColored(new ImGui.ImVec4(0, 1, 1, 1), rule.sceneId);
        } else {
          ImGui.Text(rule.sceneId);
        }
        ImGui.NextColumn();
        
        // Condition summary
        const conditionCount = countConditions(rule.conditions);
        ImGui.Text(`${conditionCount} conditions`);
        ImGui.NextColumn();
        
        // Actions
        if (Button({ label: "Edit", onClick: () => selectRule(rule) })) {}
        ImGui.SameLine();
        if (DangerButton({ label: "Delete", onClick: () => deleteRule(rule.sceneId, rules, onSave) })) {}
        
        ImGui.NextColumn();
      }
      
      ImGui.Columns(1);
      
      // Add rule button
      ImGui.Separator();
      if (PrimaryButton({ label: "+ Add New Rule", width: -1, onClick: () => addNewRule(rules, onSave) })) {}
    }
  });
}

// Helper functions
function loadRules(): SceneRule[] {
  // TODO: Load from config/scenes-rules.json via configLoader
  return [
    {
      sceneId: 'IdleWarmStatic',
      conditions: {
        brainState: 'Idle',
        energyMax: 0.3
      },
      weight: 1.0,
      cooldown: 10000
    },
    {
      sceneId: 'ChillSoftMovement',
      conditions: {
        brainState: 'Chill',
        energyMin: 0.3,
        energyMax: 0.7
      },
      weight: 1.0,
      cooldown: 8000
    },
    {
      sceneId: 'PartyBeams',
      conditions: {
        brainState: 'Party',
        energyMin: 0.7
      },
      weight: 1.5, // Higher weight for party scenes
      cooldown: 5000
    }
  ];
}

function loadScenes(): any[] {
  // TODO: Load from config/scenes.json via configLoader
  return [
    { id: 'IdleWarmStatic', name: 'Idle Warm Static' },
    { id: 'ChillSoftMovement', name: 'Chill Soft Movement' },
    { id: 'PartyBeams', name: 'Party Beams' }
  ];
}

function createEmptyRule(): SceneRule {
  return {
    sceneId: '',
    conditions: {},
    weight: 1.0,
    cooldown: 0
  };
}

function saveRules(rules: SceneRule[], onSave?: (rules: SceneRule[]) => void): void {
  // TODO: Save via configLoader
  console.log('Saving rules:', rules);
  onSave?.(rules);
}

function testRules(rules: SceneRule[]): void {
  console.log('Testing all rules:', rules);
  // В реальном приложении здесь была бы проверка всех правил
  alert(`Testing ${rules.length} rules. Check console for details.`);
}

function testSingleRule(rule: SceneRule, systemState: any): void {
  const isActive = evaluateRule(rule, systemState);
  const matchPercent = calculateMatchPercent(rule, systemState);
  
  alert(`Rule "${rule.sceneId}":\n` +
