/**
 * Dashboard layout system for DMX Engine UI
 */

import { ImGui } from "@zhobo63/imgui-ts";
import { Panel, CardPanel } from '../components/Panel';
import { Button, PrimaryButton, DangerButton } from '../components/Button';
import { socketManager } from '../utils/socket';
import { UISystemState, AudioMetrics } from '../types/ui';

export interface DashboardLayoutProps {
  systemState: UISystemState;
  audioMetrics: AudioMetrics;
  onCommand: (type: string, payload: any) => void;
  onNavigate: (page: string) => void;
  currentPage: string;
}

export function DashboardLayout(props: DashboardLayoutProps): void {
  const { systemState, audioMetrics, onCommand, onNavigate, currentPage } = props;
  const { isMobile } = useResponsiveLayout();

  // Render sidebar if not mobile or sidebar not collapsed
  const showSidebar = !isMobile; // Simplified for now
  
  if (showSidebar) {
    renderSidebar(onNavigate, currentPage, isMobile);
    ImGui.SameLine();
  }

  // Main content area
  ImGui.BeginGroup();
  
  // Render header
  renderHeader(systemState, onCommand, isMobile);
  
  // Render page content based on current page
  renderPageContent(currentPage, systemState, audioMetrics, onCommand, onNavigate, isMobile);
  
  ImGui.EndGroup();
}

function renderSidebar(onNavigate: (page: string) => void, currentPage: string, isMobile: boolean): void {
  const sidebarWidth = isMobile ? 60 : 200;
  
  CardPanel({
    title: 'Navigation',
    width: sidebarWidth,
    height: -1, // Full height
    children: () => {
      const menuItems = [
        { id: 'home', label: 'Dashboard', icon: '🏠' },
        { id: 'audio', label: 'Audio Viz', icon: '🎵' },
        { id: 'dmx', label: 'DMX Monitor', icon: '💡' },
        { id: 'scenes', label: 'Scenes', icon: '🎭' },
        { id: 'settings', label: 'Settings', icon: '⚙️' },
      ];
      
      for (const item of menuItems) {
        const isActive = currentPage === item.id;
        
        if (isMobile) {
          // Mobile: icon only
          if (Button({
            label: item.icon,
            width: 40,
            variant: isActive ? 'primary' : 'secondary',
            onClick: () => onNavigate(item.id)
          })) {}
          
          if (item.id !== 'settings') {
            ImGui.Spacing();
          }
        } else {
          // Desktop: icon + label
          if (Button({
            label: `${item.icon} ${item.label}`,
            width: -1,
            variant: isActive ? 'primary' : 'secondary',
            onClick: () => onNavigate(item.id)
          })) {}
          
          if (item.id !== 'settings') {
            ImGui.Spacing();
          }
        }
      }
      
      // Separator
      ImGui.Separator();
      
      // System status in sidebar
      if (!isMobile) {
        ImGui.Text("System Status");
        const isConnected = socketManager.isConnected();
        
        if (isConnected) {
          ImGui.TextColored(new ImGui.ImVec4(0, 1, 0, 1), "✓ Online");
        } else {
          ImGui.TextColored(new ImGui.ImVec4(1, 0, 0, 1), "✗ Offline");
        }
      }
    }
  });
}

function renderHeader(systemState: UISystemState, onCommand: (type: string, payload: any) => void, isMobile: boolean): void {
  CardPanel({
    title: 'System Header',
    width: -1,
    height: isMobile ? 80 : 60,
    children: () => {
      if (isMobile) {
        // Mobile header: compact
        ImGui.Columns(2, 'mobile-header', false);
        
        // Left: Title
        ImGui.TextColored(new ImGui.ImVec4(0.4, 0.8, 1.0, 1.0), "DMX Engine");
        
        ImGui.NextColumn();
        
        // Right: Connection status
        const isConnected = socketManager.isConnected();
        if (isConnected) {
          ImGui.TextColored(new ImGui.ImVec4(0, 1, 0, 1), "✓");
        } else {
          ImGui.TextColored(new ImGui.ImVec4(1, 0, 0, 1), "✗");
        }
        
        ImGui.Columns(1);
      } else {
        // Desktop header: full
        ImGui.Columns(4, 'desktop-header', false);
        
        // Column 1: Title
        ImGui.TextColored(new ImGui.ImVec4(0.4, 0.8, 1.0, 1.0), "Autonomous DMX Engine - Phase 3");
        
        ImGui.NextColumn();
        
        // Column 2: Mode
        ImGui.Text("Mode:");
        ImGui.SameLine();
        if (systemState.mode === 'auto') {
          ImGui.TextColored(new ImGui.ImVec4(0, 1, 0, 1), "Auto");
        } else if (systemState.mode === 'manual') {
          ImGui.TextColored(new ImGui.ImVec4(1, 1, 0, 1), "Manual");
        } else {
          ImGui.TextColored(new ImGui.ImVec4(1, 0, 0, 1), "Off");
        }
        
        ImGui.NextColumn();
        
        // Column 3: Connection
        const isConnected = socketManager.isConnected();
        ImGui.Text("Connection:");
        ImGui.SameLine();
        if (isConnected) {
          ImGui.TextColored(new ImGui.ImVec4(0, 1, 0, 1), "Online");
        } else {
          ImGui.TextColored(new ImGui.ImVec4(1, 0, 0, 1), "Offline");
          ImGui.SameLine();
          if (Button({ label: "Connect", onClick: () => socketManager.connect() })) {}
        }
        
        ImGui.NextColumn();
        
        // Column 4: Quick actions
        if (systemState.blackout) {
          if (PrimaryButton({ label: "Restore", onClick: () => onCommand('setBlackout', false) })) {}
        } else {
          if (DangerButton({ label: "Blackout", onClick: () => onCommand('setBlackout', true) })) {}
        }
        
        ImGui.Columns(1);
      }
    }
  });
}

function renderPageContent(
  currentPage: string,
  systemState: UISystemState,
  audioMetrics: AudioMetrics,
  onCommand: (type: string, payload: any) => void,
  onNavigate: (page: string) => void,
  isMobile: boolean
): void {
  // This would render different content based on current page
  // For now, render a placeholder
  CardPanel({
    title: `Page: ${currentPage}`,
    width: -1,
    height: 400,
    children: () => {
      ImGui.Text(`Current page: ${currentPage}`);
      ImGui.Text("Page-specific content would be rendered here");
      
      // Example: render different content based on page
      switch (currentPage) {
        case 'home':
          ImGui.Text("Dashboard home page content");
          break;
        case 'audio':
          ImGui.Text("Audio visualization page content");
          break;
        case 'dmx':
          ImGui.Text("DMX monitor page content");
          break;
        case 'scenes':
          ImGui.Text("Scene manager page content");
          break;
        case 'settings':
          ImGui.Text("Settings page content");
          break;
      }
    }
  });
}

function renderStatusPanel(systemState: UISystemState, onCommand: (type: string, payload: any) => void): void {
  const isConnected = socketManager.isConnected();
  
  CardPanel({
    title: 'System Status',
    width: 300,
    height: 200,
    children: () => {
      // Connection status
      if (isConnected) {
        ImGui.TextColored(new ImGui.ImVec4(0, 1, 0, 1), "✓ Connected");
      } else {
        ImGui.TextColored(new ImGui.ImVec4(1, 0, 0, 1), "✗ Disconnected");
        if (Button({ label: "Reconnect", onClick: () => socketManager.connect() })) {
          // Reconnect handled by socketManager
        }
      }

      ImGui.Separator();

      // System mode
      ImGui.Text("Mode:");
      ImGui.SameLine();
      if (systemState.mode === 'auto') {
        ImGui.TextColored(new ImGui.ImVec4(0, 1, 0, 1), "Auto");
      } else if (systemState.mode === 'manual') {
        ImGui.TextColored(new ImGui.ImVec4(1, 1, 0, 1), "Manual");
      } else {
        ImGui.TextColored(new ImGui.ImVec4(1, 0, 0, 1), "Off");
      }

      // Intensity
      ImGui.Text(`Intensity: ${(systemState.globalIntensity * 100).toFixed(0)}%`);

      // Blackout status
      if (systemState.blackout) {
        ImGui.TextColored(new ImGui.ImVec4(1, 0, 0, 1), "BLACKOUT ACTIVE");
      }

      ImGui.Separator();

      // Quick controls
      ImGui.Text("Quick Controls:");
      if (PrimaryButton({ label: "Auto Mode", onClick: () => onCommand('setMode', 'auto') })) {}
      ImGui.SameLine();
      if (Button({ label: "Manual", onClick: () => onCommand('setMode', 'manual') })) {}
      ImGui.SameLine();
      if (DangerButton({ label: "Off", onClick: () => onCommand('setMode', 'off') })) {}
    }
  });
}

function renderControlPanel(systemState: UISystemState, onCommand: (type: string, payload: any) => void): void {
  CardPanel({
    title: 'Lighting Control',
    width: 300,
    height: 200,
    children: () => {
      // Intensity slider would go here
      ImGui.Text("Global Intensity Control");
      ImGui.Text("(Slider component to be implemented)");
      
      ImGui.Separator();

      // Blackout control
      if (systemState.blackout) {
        if (PrimaryButton({ 
          label: "Restore Output", 
          onClick: () => onCommand('setBlackout', false) 
        })) {}
      } else {
        if (DangerButton({ 
          label: "BLACKOUT", 
          onClick: () => onCommand('setBlackout', true) 
        })) {}
      }

      ImGui.Separator();

      // Additional controls
      ImGui.Text("Presets:");
      if (Button({ label: "Save Preset", onClick: () => onCommand('savePreset', {}) })) {}
      ImGui.SameLine();
      if (Button({ label: "Load Preset", onClick: () => onCommand('loadPreset', {}) })) {}
    }
  });
}

function renderAudioPanel(audioMetrics: AudioMetrics): void {
  CardPanel({
    title: 'Audio Analysis',
    width: 300,
    height: 200,
    children: () => {
      // Energy meter
      ImGui.Text(`Energy: ${(audioMetrics.energy || 0).toFixed(3)}`);
      
      // Simple visual energy bar
      const energy = audioMetrics.energy || 0;
      ImGui.ProgressBar(energy, new ImGui.ImVec2(-1, 20), "");

      // Beat detection
      ImGui.Separator();
      ImGui.Text("Beat Detection:");
      if (audioMetrics.isBeat) {
        ImGui.TextColored(new ImGui.ImVec4(0, 1, 0, 1), "● BEAT!");
      } else {
        ImGui.Text("○ No beat");
      }

      // BPM if available
      if (audioMetrics.bpm) {
        ImGui.Text(`BPM: ${audioMetrics.bpm.toFixed(0)}`);
      }

      // Mood if available
      if (audioMetrics.mood) {
        ImGui.Text(`Mood: ${audioMetrics.mood}`);
      }
    }
  });
}

function renderFixturePanel(): void {
  CardPanel({
    title: 'Fixture Control',
    width: 400,
    height: 250,
    children: () => {
      ImGui.Text("Fixture controls will be implemented here");
      ImGui.Text("Individual fixture intensity, color, and position");
      
      // Placeholder for fixture list
      ImGui.Separator();
      ImGui.Text("Fixture 1: ████████ 75%");
      ImGui.Text("Fixture 2: ████ 40%");
      ImGui.Text("Fixture 3: ██████████ 100%");
    }
  });
}

function renderScenePanel(): void {
  CardPanel({
    title: 'Scenes & Effects',
    width: 400,
    height: 250,
    children: () => {
      ImGui.Text("Scene management and effect controls");
      
      // Scene buttons
      if (Button({ label: "Scene 1: Chill", width: 100, onClick: () => {} })) {}
      ImGui.SameLine();
      if (Button({ label: "Scene 2: Party", width: 100, onClick: () => {} })) {}
      ImGui.SameLine();
      if (Button({ label: "Scene 3: Pulse", width: 100, onClick: () => {} })) {}
      
      ImGui.Separator();
      
      // Effect toggles
      ImGui.Text("Active Effects:");
      ImGui.Text("✓ Rainbow Wave");
      ImGui.Text("✓ Energy Pulse");
      ImGui.Text("○ Beat Strobe (disabled)");
    }
  });
}

// Grid layout helper
export function createGridLayout(columns: number, itemWidth: number): void {
  // Simple grid layout using SameLine and manual positioning
  // This is a basic implementation - could be enhanced with proper layout system
}

// Responsive layout helper
export function useResponsiveLayout(): { isMobile: boolean; columnWidth: number } {
  // Detect mobile/desktop based on window size or ImGui metrics
  const isMobile = Boolean(ImGui.isMobile.any());
  const columnWidth = isMobile ? 300 : 400;
  
  return { isMobile, columnWidth };
}