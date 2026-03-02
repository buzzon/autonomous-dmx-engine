/**
 * DashboardHome - главная страница с обзором системы
 */

import { ImGui } from "@zhobo63/imgui-ts";
import { Panel, CardPanel } from '../components/Panel';
import { Button, PrimaryButton } from '../components/Button';
import { store, selectors } from '../store/store';
import { socketManager } from '../utils/socket';
import { useResponsiveLayout } from '../layouts/DashboardLayout';

export interface DashboardHomeProps {
  onNavigate: (page: string) => void;
}

export function DashboardHome(props: DashboardHomeProps): void {
  const { onNavigate } = props;
  const state = store.getState();
  const { isMobile, columnWidth } = useResponsiveLayout();

  // Render header
  renderHeader(state, onNavigate);
  
  ImGui.Spacing();
  
  // Main dashboard grid
  renderDashboardGrid(state, isMobile, columnWidth, onNavigate);
  
  ImGui.Spacing();
  
  // Footer with system info
  renderFooter(state);
}

function renderHeader(state: any, onNavigate: (page: string) => void): void {
  const isConnected = selectors.isConnected(state);
  
  CardPanel({
    title: 'System Overview',
    width: -1,
    height: 80,
    children: () => {
      // Connection status
      ImGui.Columns(3, 'header', false);
      
      // Column 1: Connection
      ImGui.Text("Connection:");
      ImGui.SameLine();
      if (isConnected) {
        ImGui.TextColored(new ImGui.ImVec4(0, 1, 0, 1), "✓ Online");
        ImGui.Text(`Latency: ${state.socket.latency || '--'}ms`);
      } else {
        ImGui.TextColored(new ImGui.ImVec4(1, 0, 0, 1), "✗ Offline");
        if (Button({ label: "Connect", onClick: () => socketManager.connect() })) {}
      }
      
      ImGui.NextColumn();
      
      // Column 2: System Mode
      ImGui.Text("System Mode:");
      ImGui.SameLine();
      const mode = selectors.getMode(state);
      if (mode === 'auto') {
        ImGui.TextColored(new ImGui.ImVec4(0, 1, 0, 1), "Auto");
      } else if (mode === 'manual') {
        ImGui.TextColored(new ImGui.ImVec4(1, 1, 0, 1), "Manual");
      } else {
        ImGui.TextColored(new ImGui.ImVec4(1, 0, 0, 1), "Off");
      }
      
      ImGui.Text(`Intensity: ${(selectors.getIntensity(state) * 100).toFixed(0)}%`);
      
      ImGui.NextColumn();
      
      // Column 3: Quick Actions
      ImGui.Text("Quick Actions:");
      if (PrimaryButton({ label: "Audio Viz", onClick: () => onNavigate('audio') })) {}
      ImGui.SameLine();
      if (Button({ label: "DMX Monitor", onClick: () => onNavigate('dmx') })) {}
      
      ImGui.Columns(1);
    }
  });
}

function renderDashboardGrid(state: any, isMobile: boolean, columnWidth: number, onNavigate: (page: string) => void): void {
  const columns = isMobile ? 1 : 2;
  
  // First row
  ImGui.Columns(columns, 'dashboard-grid', false);
  
  // Audio Metrics Card
  CardPanel({
    title: 'Audio Analysis',
    width: columnWidth,
    height: 200,
    children: () => {
      const audio = state.audio;
      
      // Energy visualization
      ImGui.Text(`Energy: ${(audio.energy || 0).toFixed(3)}`);
      ImGui.ProgressBar(audio.energy || 0, new ImGui.ImVec2(-1, 20), "");
      
      // Beat indicator
      ImGui.Separator();
      ImGui.Text("Beat Detection:");
      if (audio.isBeat) {
        ImGui.TextColored(new ImGui.ImVec4(0, 1, 0, 1), "● BEAT DETECTED");
      } else {
        ImGui.Text("○ No beat");
      }
      
      // BPM and mood
      if (audio.bpm) {
        ImGui.Text(`BPM: ${audio.bpm.toFixed(0)}`);
      }
      if (audio.mood) {
        ImGui.Text(`Mood: ${audio.mood}`);
      }
      
      ImGui.Separator();
      if (Button({ label: "Open Audio Dashboard", onClick: () => onNavigate('audio') })) {}
    }
  });
  
  if (!isMobile) {
    ImGui.NextColumn();
  }
  
  // DMX Status Card
  CardPanel({
    title: 'DMX Output',
    width: columnWidth,
    height: 200,
    children: () => {
      const isBlackout = selectors.isBlackout(state);
      
      if (isBlackout) {
        ImGui.TextColored(new ImGui.ImVec4(1, 0, 0, 1), "BLACKOUT ACTIVE");
        ImGui.Text("All DMX output is suppressed");
      } else {
        ImGui.TextColored(new ImGui.ImVec4(0, 1, 0, 1), "DMX ACTIVE");
        ImGui.Text(`Output intensity: ${(selectors.getIntensity(state) * 100).toFixed(0)}%`);
      }
      
      // Simple channel activity visualization
      ImGui.Separator();
      ImGui.Text("Channel Activity:");
      for (let i = 0; i < 5; i++) {
        const activity = Math.random() * 0.8 + 0.2; // Mock data
        ImGui.ProgressBar(activity, new ImGui.ImVec2(-1, 10), `Ch ${i + 1}`);
      }
      
      ImGui.Separator();
      if (Button({ label: "Open DMX Monitor", onClick: () => onNavigate('dmx') })) {}
    }
  });
  
  ImGui.Columns(1);
  ImGui.Spacing();
  
  // Second row
  ImGui.Columns(columns, 'dashboard-grid-2', false);
  
  // Scene Manager Card
  CardPanel({
    title: 'Scene Management',
    width: columnWidth,
    height: 180,
    children: () => {
      ImGui.Text("Active Scene:");
      if (state.system.activeSceneId) {
        ImGui.TextColored(new ImGui.ImVec4(0, 1, 0, 1), `Scene #${state.system.activeSceneId}`);
      } else {
        ImGui.Text("No active scene");
      }
      
      ImGui.Separator();
      ImGui.Text("Available Scenes:");
      
      // Scene buttons
      if (Button({ label: "Chill", width: 80, onClick: () => {
        socketManager.sendCommand('activateScene', { sceneId: 'chill' });
      } })) {}
      ImGui.SameLine();
      if (Button({ label: "Party", width: 80, onClick: () => {
        socketManager.sendCommand('activateScene', { sceneId: 'party' });
      } })) {}
      ImGui.SameLine();
      if (Button({ label: "Pulse", width: 80, onClick: () => {
        socketManager.sendCommand('activateScene', { sceneId: 'pulse' });
      } })) {}
      
      ImGui.Separator();
      if (Button({ label: "Manage Scenes", onClick: () => onNavigate('scenes') })) {}
    }
  });
  
  if (!isMobile) {
    ImGui.NextColumn();
  }
  
  // System Health Card
  CardPanel({
    title: 'System Health',
    width: columnWidth,
    height: 180,
    children: () => {
      // Mock system metrics
      const metrics = {
        cpu: 45,
        memory: 68,
        fps: 60,
        uptime: '2h 15m'
      };
      
      ImGui.Text("Performance Metrics:");
      ImGui.Text(`CPU: ${metrics.cpu}%`);
      ImGui.ProgressBar(metrics.cpu / 100, new ImGui.ImVec2(-1, 10), "");
      
      ImGui.Text(`Memory: ${metrics.memory}%`);
      ImGui.ProgressBar(metrics.memory / 100, new ImGui.ImVec2(-1, 10), "");
      
      ImGui.Text(`FPS: ${metrics.fps}`);
      ImGui.Text(`Uptime: ${metrics.uptime}`);
      
      ImGui.Separator();
      if (Button({ label: "System Settings", onClick: () => onNavigate('settings') })) {}
    }
  });
  
  ImGui.Columns(1);
}

function renderFooter(state: any): void {
  CardPanel({
    title: 'System Information',
    width: -1,
    height: 60,
    children: () => {
      ImGui.Columns(3, 'footer', false);
      
      // Column 1: Version
      ImGui.Text("Version: Phase 3 Dashboard");
      ImGui.Text("Build: 2026.03.02");
      
      ImGui.NextColumn();
      
      // Column 2: Last Update
      ImGui.Text("Last Update:");
      ImGui.Text(new Date().toLocaleTimeString());
      
      ImGui.NextColumn();
      
      // Column 3: Status
      const isConnected = selectors.isConnected(state);
      ImGui.Text("Status:");
      ImGui.SameLine();
      if (isConnected) {
        ImGui.TextColored(new ImGui.ImVec4(0, 1, 0, 1), "Operational");
      } else {
        ImGui.TextColored(new ImGui.ImVec4(1, 0.5, 0, 1), "Limited");
      }
      
      ImGui.Columns(1);
    }
  });
}

// Helper function for real-time updates
export function updateDashboardMetrics(): void {
  // This function can be called to force UI updates
  // In a real implementation, this would trigger re-renders
}