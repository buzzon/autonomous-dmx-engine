/**
 * Main entry point for Phase 3 Dashboard
 * Расширенный dashboard для аудио визуализации и DMX мониторинга
 */

import { ImGui, ImGui_Impl } from "@zhobo63/imgui-ts";
import { store, selectors } from './store/store';
import { socketManager } from './utils/socket';
import { performanceMonitor } from './utils/performance';
import { DashboardLayout } from './layouts/DashboardLayout';
import { DashboardHome } from './pages/DashboardHome';
import { AudioVisualization } from './pages/AudioVisualization';
import { DMXMonitor } from './pages/DMXMonitor';

// Global state
let lastUpdateTime = 0;
const UPDATE_INTERVAL = 16; // ~60 FPS

// Initialize application
async function main() {
  await ImGui.default();
  ImGui.CHECKVERSION();
  console.log("ImGui Version:", ImGui.VERSION);
  console.log("Phase 3 Dashboard Initialized");

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

  // Draw UI
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
  const state = store.getState();
  const currentPage = selectors.getCurrentPage(state);
  
  // Apply theme
  if (state.ui.theme === 'dark') {
    ImGui.StyleColorsDark();
  } else {
    ImGui.StyleColorsLight();
  }
  
  // Render based on layout mode
  switch (state.ui.layout) {
    case 'dashboard':
      renderDashboardLayout(state, currentPage);
      break;
    case 'expanded':
      renderExpandedLayout(state, currentPage);
      break;
    case 'compact':
    default:
      renderCompactLayout(state, currentPage);
      break;
  }
  
  // Debug panel if enabled
  if (state.ui.showDebug) {
    renderDebugPanel(state);
  }
}

function renderDashboardLayout(state: any, currentPage: string) {
  // Use the new DashboardLayout component
  DashboardLayout({
    systemState: state.system,
    audioMetrics: state.audio,
    onCommand: sendCommand,
    onNavigate: handleNavigation,
    currentPage
  });
}

function renderExpandedLayout(state: any, currentPage: string) {
  // Expanded layout with more space
  ImGui.SetNextWindowPos(new ImGui.ImVec2(0, 0), ImGui.Cond.Always);
  ImGui.SetNextWindowSize(new ImGui.ImVec2(ImGui.GetIO().DisplaySize.x, ImGui.GetIO().DisplaySize.y), ImGui.Cond.Always);
  
  ImGui.Begin("Expanded Dashboard", null, 
    ImGui.WindowFlags.NoTitleBar | 
    ImGui.WindowFlags.NoResize | 
    ImGui.WindowFlags.NoMove |
    ImGui.WindowFlags.NoBringToFrontOnFocus
  );
  
  // Render page content
  renderPageContent(currentPage, state);
  
  ImGui.End();
}

function renderCompactLayout(state: any, currentPage: string) {
  // Compact layout for smaller screens
  ImGui.SetNextWindowPos(new ImGui.ImVec2(10, 10), ImGui.Cond.FirstUseEver);
  ImGui.SetNextWindowSize(new ImGui.ImVec2(800, 600), ImGui.Cond.FirstUseEver);
  
  ImGui.Begin("DMX Engine Control");
  
  // Simple header
  const isConnected = selectors.isConnected(state);
  if (isConnected) {
    ImGui.TextColored(new ImGui.ImVec4(0, 1, 0, 1), "Connected");
  } else {
    ImGui.TextColored(new ImGui.ImVec4(1, 0, 0, 1), "Disconnected");
  }
  
  ImGui.SameLine();
  ImGui.Text(` | Page: ${currentPage} | Layout: ${state.ui.layout}`);
  
  // Page navigation buttons
  const pages = ['home', 'audio', 'dmx', 'scenes', 'settings'];
  for (const page of pages) {
    if (ImGui.Button(page)) {
      handleNavigation(page);
    }
    ImGui.SameLine();
  }
  
  ImGui.NewLine();
  
  // Render page content
  renderPageContent(currentPage, state);
  
  ImGui.End();
}

function renderPageContent(page: string, state: any) {
  switch (page) {
    case 'home':
      DashboardHome({ onNavigate: handleNavigation });
      break;
    case 'audio':
      AudioVisualization({ onNavigate: handleNavigation });
      break;
    case 'dmx':
      DMXMonitor({ onNavigate: handleNavigation });
      break;
    case 'scenes':
      // SceneManager would be implemented here
      ImGui.Text("Scene Manager - To be implemented");
      break;
    case 'settings':
      // Settings would be implemented here
      renderSettingsPage(state);
      break;
    default:
      ImGui.Text(`Unknown page: ${page}`);
      break;
  }
}

function renderSettingsPage(state: any) {
  if (ImGui.CollapsingHeader("UI Settings", ImGui.TreeNodeFlags.DefaultOpen)) {
    // Theme selection
    ImGui.Text("Theme:");
    ImGui.SameLine();
    if (ImGui.Button(state.ui.theme === 'dark' ? "Dark" : "Light")) {
      store.toggleTheme();
    }
    
    // Layout selection
    ImGui.Text("Layout:");
    ImGui.SameLine();
    const layouts = ['compact', 'expanded', 'dashboard'];
    for (const layout of layouts) {
      if (ImGui.Button(layout)) {
        store.setLayout(layout as any);
      }
      ImGui.SameLine();
    }
    
    // Debug panel toggle
    ImGui.Text("Debug Panel:");
    ImGui.SameLine();
    if (ImGui.Button(state.ui.showDebug ? "Hide" : "Show")) {
      store.toggleDebug();
    }
  }
  
  if (ImGui.CollapsingHeader("System Settings")) {
    // System mode
    ImGui.Text("System Mode:");
    const mode = selectors.getMode(state);
    
    if (ImGui.Button("Auto")) sendCommand('setMode', 'auto');
    ImGui.SameLine();
    if (ImGui.Button("Manual")) sendCommand('setMode', 'manual');
    ImGui.SameLine();
    if (ImGui.Button("Off")) sendCommand('setMode', 'off');
    
    ImGui.Text(`Current mode: ${mode}`);
    
    // Intensity control
    const intensity = selectors.getIntensity(state);
    const intensityArr = [intensity];
    if (ImGui.SliderFloat("Global Intensity", intensityArr as any, 0, 1, "%.2f")) {
      store.setIntensity(intensityArr[0]);
      sendCommand('setIntensity', intensityArr[0]);
    }
    
    // Blackout control
    const isBlackout = selectors.isBlackout(state);
    if (isBlackout) {
      if (ImGui.Button("Restore Output")) {
        sendCommand('setBlackout', false);
      }
    } else {
      if (ImGui.Button("BLACKOUT")) {
        sendCommand('setBlackout', true);
      }
    }
  }
  
  if (ImGui.CollapsingHeader("Connection Settings")) {
    const socketState = state.socket;
    
    ImGui.Text(`Status: ${socketState.isConnected ? 'Connected' : 'Disconnected'}`);
    if (socketState.latency) {
      ImGui.Text(`Latency: ${socketState.latency}ms`);
    }
    
    if (ImGui.Button("Reconnect")) {
      socketManager.connect();
    }
    
    ImGui.SameLine();
    
    if (ImGui.Button("Disconnect")) {
      socketManager.disconnect();
    }
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
  socketManager,
  ImGui,
  sendCommand,
  handleNavigation
};

console.log("Phase 3 Dashboard loaded successfully");
