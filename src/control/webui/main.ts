/**
 * Main entry point for Phase 3 Dashboard
 * Расширенный dashboard для аудио визуализации и DMX мониторинга
 * Интегрирует все компоненты Phase 3 через App компонент
 */

import { ImGui, ImGui_Impl } from "@zhobo63/imgui-ts";
import { store, selectors } from './store/store';
import { extendedStore } from './store/store-extended';
import { socketManager } from './utils/socket';
import { performanceMonitor } from './utils/performance';
import { App } from './App';

// Global state
let lastUpdateTime = 0;
const UPDATE_INTERVAL = 16; // ~60 FPS

// Initialize application
async function main() {
  await ImGui.default();
  ImGui.CHECKVERSION();
  console.log("ImGui Version:", ImGui.VERSION);
  console.log("Phase 3 Dashboard Initialized - Full Integration");

  ImGui.CreateContext();
  ImGui.StyleColorsDark();

  // Adjust for mobile/high-DPI
  if (ImGui.isMobile.any()) {
    ImGui_Impl.setCanvasScale(1);
    ImGui_Impl.setFontScale(1.5);
  }

  const canvas = document.getElementById("canvas") as HTMLCanvasElement;
  ImGui_Impl.Init(canvas);

  // Initialize WebSocket connection
  socketManager.connect();
  
  // Subscribe to store updates for debugging
  store.subscribe((state) => {
    // Debug logging (optional)
    if (state.ui.showDebug) {
      console.debug('Store updated:', state);
    }
  });

  // Setup socket event listeners
  socketManager.on('connect', () => {
    console.log('WebSocket connected');
    store.updateSocketState({ isConnected: true });
  });

  socketManager.on('disconnect', () => {
    console.log('WebSocket disconnected');
    store.updateSocketState({ isConnected: false });
  });

  socketManager.on('error', (error: any) => {
    console.error('WebSocket error:', error);
    store.updateSocketState({ error: error.message });
  });

  // Start main loop
  window.requestAnimationFrame(loop);
}

const clearColor = new ImGui.ImVec4(0.08, 0.08, 0.1, 1.0);

function loop(time: number) {
  if (ImGui_Impl.is_contextlost) return;

  // Start performance monitoring for this frame
  performanceMonitor.startFrame();

  ImGui_Impl.NewFrame(time);
  ImGui.NewFrame();

  // Update real-time data periodically
  if (time - lastUpdateTime > UPDATE_INTERVAL) {
    updateRealTimeData(time);
    lastUpdateTime = time;
  }

  // Start render timing
  performanceMonitor.startRender();

  // Draw UI using App component
  drawUI();

  ImGui.EndFrame();
  ImGui.Render();

  ImGui_Impl.ClearBuffer(clearColor);
  ImGui_Impl.RenderDrawData(ImGui.GetDrawData());

  // End frame and update performance metrics
  performanceMonitor.endFrame();

  window.requestAnimationFrame(loop);
}

function updateRealTimeData(time: number) {
  // Generate mock real-time data for demonstration
  // In production, this would come from WebSocket
  
  const state = store.getState();
  
  // Update audio metrics with mock data
  if (state.socket.isConnected) {
    const mockEnergy = Math.sin(time * 0.001) * 0.5 + 0.5;
    const mockIsBeat = Math.random() > 0.7;
    const mockBPM = 120 + Math.sin(time * 0.0005) * 20;
    
    store.updateAudioMetrics({
      energy: mockEnergy,
      isBeat: mockIsBeat,
      bpm: mockBPM,
      mood: mockEnergy > 0.7 ? 'Energetic' : mockEnergy > 0.4 ? 'Chill' : 'Calm'
    });
    
    // Update real-time audio data
    const waveform: number[] = [];
    const spectrum: number[] = [];
    
    for (let i = 0; i < 100; i++) {
      waveform.push(Math.sin(i * 0.1 + time * 0.01) * mockEnergy);
    }
    
    for (let i = 0; i < 32; i++) {
      spectrum.push(Math.sin(i * 0.3 + time * 0.005) * 0.5 + 0.5);
    }
    
    store.updateAudioData({
      waveform,
      spectrum,
      peaks: mockIsBeat ? [mockEnergy] : []
    });
    
    // Update DMX data with mock values
    const channels = [...state.realtime.dmxData.channels];
    for (let i = 0; i < channels.length; i++) {
      // Slowly animate some channels
      if (i % 16 === Math.floor(time * 0.002) % 16) {
        channels[i] = Math.sin(time * 0.001 + i * 0.1) * 0.5 + 0.5;
      }
    }
    
    store.updateDMXData({ channels });
    
    // Update system metrics
    store.updateSystemMetrics({
      cpu: 30 + Math.sin(time * 0.0003) * 20,
      memory: 50 + Math.cos(time * 0.0002) * 10,
      fps: 1000 / UPDATE_INTERVAL
    });
  }
}

function drawUI() {
  // Use App component for rendering
  App({
    onCommand: sendCommand,
    onNavigate: handleNavigation
  });
  
  // Debug panel if enabled
  const state = store.getState();
  if (state.ui.showDebug) {
    renderDebugPanel(state);
  }
}

function renderDebugPanel(state: any) {
  ImGui.SetNextWindowPos(new ImGui.ImVec2(ImGui.GetIO().DisplaySize.x - 400, 20), ImGui.Cond.FirstUseEver);
  ImGui.SetNextWindowSize(new ImGui.ImVec2(380, 500), ImGui.Cond.FirstUseEver);
  
  ImGui.Begin("Debug Panel", null, ImGui.WindowFlags.AlwaysAutoResize);
  
  ImGui.Text("Application State:");
  ImGui.Separator();
  
  // System state
  ImGui.TextColored(new ImGui.ImVec4(0.8, 0.8, 0.2, 1), "System:");
  ImGui.Text(`Mode: ${state.system.mode}`);
  ImGui.Text(`Intensity: ${state.system.globalIntensity.toFixed(3)}`);
  ImGui.Text(`Blackout: ${state.system.blackout}`);
  
  ImGui.Separator();
  
  // Audio state
  ImGui.TextColored(new ImGui.ImVec4(0.2, 0.8, 0.8, 1), "Audio:");
  ImGui.Text(`Energy: ${state.audio.energy.toFixed(4)}`);
  ImGui.Text(`Beat: ${state.audio.isBeat}`);
  ImGui.Text(`BPM: ${state.audio.bpm || 'N/A'}`);
  ImGui.Text(`Mood: ${state.audio.mood || 'N/A'}`);
  
  ImGui.Separator();
  
  // Socket state
  ImGui.TextColored(new ImGui.ImVec4(0.8, 0.2, 0.8, 1), "Socket:");
  ImGui.Text(`Connected: ${state.socket.isConnected}`);
  ImGui.Text(`Latency: ${state.socket.latency || 'N/A'}ms`);
  if (state.socket.error) {
    ImGui.TextColored(new ImGui.ImVec4(1, 0, 0, 1), `Error: ${state.socket.error}`);
  }
  
  ImGui.Separator();
  
  // UI state
  ImGui.TextColored(new ImGui.ImVec4(0.8, 0.5, 0.2, 1), "UI:");
  ImGui.Text(`Theme: ${state.ui.theme}`);
  ImGui.Text(`Layout: ${state.ui.layout}`);
  ImGui.Text(`Current Page: ${state.ui.currentPage}`);
  ImGui.Text(`Sidebar: ${state.ui.sidebarCollapsed ? 'Collapsed' : 'Expanded'}`);
  
  ImGui.Separator();
  
  // Real-time data stats
  ImGui.TextColored(new ImGui.ImVec4(0.2, 0.8, 0.2, 1), "Real-time Data:");
  ImGui.Text(`Waveform samples: ${state.realtime.audioData.waveform.length}`);
  ImGui.Text(`Spectrum bands: ${state.realtime.audioData.spectrum.length}`);
  ImGui.Text(`Active DMX channels: ${selectors.getActiveDMXChannels(state)}`);
  ImGui.Text(`Avg DMX value: ${selectors.getAverageDMXValue(state).toFixed(3)}`);
  
  ImGui.Separator();
  
  // Performance
  ImGui.TextColored(new ImGui.ImVec4(0.8, 0.2, 0.2, 1), "Performance:");
  ImGui.Text(`FPS: ${Math.round(1000 / UPDATE_INTERVAL)}`);
  ImGui.Text(`Update interval: ${UPDATE_INTERVAL}ms`);
  
  // Store actions
  if (ImGui.Button("Reset Store")) {
    // This would reset to initial state
    console.log("Store reset requested");
  }
  
  ImGui.SameLine();
  
  if (ImGui.Button("Mock Data")) {
    // Generate new mock data
    console.log("Mock data generated");
  }
  
  ImGui.End();
}

function sendCommand(type: string, payload: any) {
  socketManager.sendCommand(type, payload);
}

function handleNavigation(page: string) {
  store.setCurrentPage(page as any);
}

// Start application
document.addEventListener("DOMContentLoaded", main);

// Export for debugging
(window as any).DMXEngine = {
  store,
  extendedStore,
  socketManager,
  ImGui,
  sendCommand,
  handleNavigation,
  App
};

console.log("Phase 3 Dashboard loaded successfully - Full Integration Complete");
