/**
 * AudioVisualization - страница визуализации аудиоанализа
 */

import { ImGui } from "@zhobo63/imgui-ts";
import { Panel, CardPanel } from '../components/Panel';
import { Button } from '../components/Button';
import { store, selectors } from '../store/store';
import { useResponsiveLayout } from '../layouts/DashboardLayout';

export interface AudioVisualizationProps {
  onNavigate: (page: string) => void;
}

export function AudioVisualization(props: AudioVisualizationProps): void {
  const { onNavigate } = props;
  const state = store.getState();
  const { isMobile, columnWidth } = useResponsiveLayout();

  // Render header with navigation
  renderHeader(onNavigate);
  
  ImGui.Spacing();
  
  // Main visualization area
  renderVisualizationArea(state, isMobile, columnWidth);
  
  ImGui.Spacing();
  
  // Audio metrics and controls
  renderAudioControls(state, isMobile, columnWidth);
}

function renderHeader(onNavigate: (page: string) => void): void {
  CardPanel({
    title: 'Audio Visualization Dashboard',
    width: -1,
    height: 60,
    children: () => {
      ImGui.Columns(3, 'audio-header', false);
      
      // Navigation
      ImGui.Text("Navigation:");
      if (Button({ label: "← Dashboard", onClick: () => onNavigate('home') })) {}
      
      ImGui.NextColumn();
      
      // Title
      ImGui.TextColored(new ImGui.ImVec4(0.4, 0.8, 1.0, 1.0), "Real-time Audio Analysis");
      ImGui.Text("Live audio processing and visualization");
      
      ImGui.NextColumn();
      
      // Controls
      ImGui.Text("View Mode:");
      if (Button({ label: "Spectrum", width: 100, onClick: () => {} })) {}
      ImGui.SameLine();
      if (Button({ label: "Waveform", width: 100, onClick: () => {} })) {}
      
      ImGui.Columns(1);
    }
  });
}

function renderVisualizationArea(state: any, isMobile: boolean, columnWidth: number): void {
  const audio = state.audio;
  
  // Main visualization container
  CardPanel({
    title: 'Visualization',
    width: -1,
    height: 300,
    children: () => {
      // Spectrum visualization (mock)
      ImGui.Text("Frequency Spectrum:");
      
      // Draw a simple spectrum visualization
      const spectrumWidth = ImGui.GetContentRegionAvail().x;
      const spectrumHeight = 150;
      const drawList = ImGui.GetWindowDrawList();
      const cursorPos = ImGui.GetCursorScreenPos();
      
      // Draw background
      drawList.AddRectFilled(
        cursorPos,
        new ImGui.ImVec2(cursorPos.x + spectrumWidth, cursorPos.y + spectrumHeight),
        ImGui.ColorConvertFloat4ToU32(new ImGui.ImVec4(0.1, 0.1, 0.1, 1.0))
      );
      
      // Draw spectrum bars (mock data)
      const barCount = 32;
      const barWidth = spectrumWidth / barCount;
      const maxEnergy = audio.energy || 0.5;
      
      for (let i = 0; i < barCount; i++) {
        const barHeight = Math.sin(i * 0.3 + Date.now() * 0.005) * 0.5 + 0.5;
        const height = barHeight * spectrumHeight * maxEnergy;
        const x = cursorPos.x + i * barWidth;
        const y = cursorPos.y + spectrumHeight - height;
        
        // Color based on frequency band
        const hue = i / barCount;
        const color = new ImGui.ImVec4(
          Math.sin(hue * Math.PI * 2) * 0.5 + 0.5,
          Math.cos(hue * Math.PI * 2) * 0.5 + 0.5,
          Math.sin(hue * Math.PI) * 0.5 + 0.5,
          1.0
        );
        
        drawList.AddRectFilled(
          new ImGui.ImVec2(x + 1, y),
          new ImGui.ImVec2(x + barWidth - 1, cursorPos.y + spectrumHeight),
          ImGui.ColorConvertFloat4ToU32(color)
        );
      }
      
      ImGui.Dummy(new ImGui.ImVec2(spectrumWidth, spectrumHeight));
      
      // Waveform visualization
      ImGui.Separator();
      ImGui.Text("Waveform:");
      
      const waveformHeight = 80;
      const waveformCursorPos = ImGui.GetCursorScreenPos();
      
      // Draw waveform background
      drawList.AddRectFilled(
        waveformCursorPos,
        new ImGui.ImVec2(waveformCursorPos.x + spectrumWidth, waveformCursorPos.y + waveformHeight),
        ImGui.ColorConvertFloat4ToU32(new ImGui.ImVec4(0.05, 0.05, 0.05, 1.0))
      );
      
      // Draw waveform line (mock)
      const points: ImGui.ImVec2[] = [];
      const pointCount = 100;
      
      for (let i = 0; i < pointCount; i++) {
        const x = waveformCursorPos.x + (i / pointCount) * spectrumWidth;
        const y = waveformCursorPos.y + waveformHeight / 2 + 
                  Math.sin(i * 0.2 + Date.now() * 0.01) * (waveformHeight / 2 - 5) * maxEnergy;
        points.push(new ImGui.ImVec2(x, y));
      }
      
      if (points.length > 1) {
        for (let i = 0; i < points.length - 1; i++) {
          drawList.AddLine(
            points[i],
            points[i + 1],
            ImGui.ColorConvertFloat4ToU32(new ImGui.ImVec4(0, 1, 0, 1)),
            2
          );
        }
      }
      
      ImGui.Dummy(new ImGui.ImVec2(spectrumWidth, waveformHeight));
    }
  });
}

function renderAudioControls(state: any, isMobile: boolean, columnWidth: number): void {
  const audio = state.audio;
  const columns = isMobile ? 1 : 3;
  
  ImGui.Columns(columns, 'audio-controls', false);
  
  // Metrics panel
  CardPanel({
    title: 'Audio Metrics',
    width: columnWidth,
    height: 200,
    children: () => {
      // Energy meter
      ImGui.Text(`Energy: ${(audio.energy || 0).toFixed(4)}`);
      ImGui.ProgressBar(audio.energy || 0, new ImGui.ImVec2(-1, 20), "");
      
      // RMS and Peak
      const rms = (audio.energy || 0) * 0.7;
      const peak = (audio.energy || 0) * 1.2;
      ImGui.Text(`RMS: ${rms.toFixed(4)}`);
      ImGui.Text(`Peak: ${peak.toFixed(4)}`);
      
      // VU meters (mock)
      ImGui.Separator();
      ImGui.Text("VU Meters:");
      
      // Left channel
      ImGui.Text("L:");
      ImGui.SameLine();
      ImGui.ProgressBar(rms, new ImGui.ImVec2(100, 15), "");
      
      // Right channel
      ImGui.Text("R:");
      ImGui.SameLine();
      ImGui.ProgressBar(rms * 0.9, new ImGui.ImVec2(100, 15), "");
    }
  });
  
  if (!isMobile) {
    ImGui.NextColumn();
  }
  
  // Beat detection panel
  CardPanel({
    title: 'Beat & BPM',
    width: columnWidth,
    height: 200,
    children: () => {
      // Beat indicator
      ImGui.Text("Beat Detection:");
      if (audio.isBeat) {
        ImGui.TextColored(new ImGui.ImVec4(0, 1, 0, 1), "● BEAT!");
        
        // Visual beat indicator
        const beatSize = 50;
        const cursorPos = ImGui.GetCursorScreenPos();
        const drawList = ImGui.GetWindowDrawList();
        
        drawList.AddCircleFilled(
          new ImGui.ImVec2(cursorPos.x + beatSize/2, cursorPos.y + beatSize/2),
          beatSize/2,
          ImGui.ColorConvertFloat4ToU32(new ImGui.ImVec4(1, 0, 0, 0.8))
        );
        
        ImGui.Dummy(new ImGui.ImVec2(beatSize, beatSize));
      } else {
        ImGui.Text("○ No beat detected");
        
        // Inactive circle
        const beatSize = 50;
        const cursorPos = ImGui.GetCursorScreenPos();
        const drawList = ImGui.GetWindowDrawList();
        
        drawList.AddCircle(
          new ImGui.ImVec2(cursorPos.x + beatSize/2, cursorPos.y + beatSize/2),
          beatSize/2,
          ImGui.ColorConvertFloat4ToU32(new ImGui.ImVec4(0.5, 0.5, 0.5, 0.5))
        );
        
        ImGui.Dummy(new ImGui.ImVec2(beatSize, beatSize));
      }
      
      ImGui.Separator();
      
      // BPM estimation
      if (audio.bpm) {
        ImGui.Text(`BPM: ${audio.bpm.toFixed(0)}`);
        ImGui.Text(`Confidence: ${(audio.bpmConfidence || 0.8).toFixed(2)}`);
        
        // BPM history graph would go here
      } else {
        ImGui.Text("BPM: Analyzing...");
      }
      
      // Tap tempo button
      if (Button({ label: "Tap Tempo", width: -1, onClick: () => {
        // Implement tap tempo functionality
      } })) {}
    }
  });
  
  if (!isMobile) {
    ImGui.NextColumn();
  }
  
  // Mood and analysis panel
  CardPanel({
    title: 'Mood & Analysis',
    width: columnWidth,
    height: 200,
    children: () => {
      // Mood classification
      ImGui.Text("Mood Analysis:");
      if (audio.mood) {
        const mood = audio.mood.toLowerCase();
        let color = new ImGui.ImVec4(1, 1, 1, 1);
        let icon = "○";
        
        if (mood.includes('energetic') || mood.includes('party')) {
          color = new ImGui.ImVec4(1, 0.5, 0, 1);
          icon = "⚡";
        } else if (mood.includes('chill') || mood.includes('calm')) {
          color = new ImGui.ImVec4(0.4, 0.8, 1, 1);
          icon = "☁️";
        } else if (mood.includes('intense') || mood.includes('dramatic')) {
          color = new ImGui.ImVec4(1, 0, 0, 1);
          icon = "🔥";
        }
        
        ImGui.TextColored(color, `${icon} ${audio.mood}`);
      } else {
        ImGui.Text("Mood: Unknown");
      }
      
      // Frequency bands
      ImGui.Separator();
      ImGui.Text("Frequency Bands:");
      
      if (audio.frequencyBands) {
        // Display frequency bands if available
        const bands = audio.frequencyBands as number[];
        for (let i = 0; i < Math.min(bands.length, 5); i++) {
          ImGui.Text(`Band ${i + 1}: ${bands[i].toFixed(3)}`);
        }
      } else {
        // Mock frequency bands
        const mockBands = ['Bass', 'Low Mid', 'Mid', 'High Mid', 'Treble'];
        for (let i = 0; i < mockBands.length; i++) {
          const value = Math.sin(Date.now() * 0.001 + i) * 0.5 + 0.5;
          ImGui.Text(`${mockBands[i]}:`);
          ImGui.SameLine();
          ImGui.ProgressBar(value, new ImGui.ImVec2(100, 10), "");
        }
      }
      
      // Analysis controls
      ImGui.Separator();
      if (Button({ label: "Reset Analysis", width: -1, onClick: () => {
        // Reset analysis state
      } })) {}
    }
  });
  
  ImGui.Columns(1);
}

// Real-time update function
export function updateAudioVisualization(): void {
  // Force UI updates for real-time visualization
  // This would be called from the main loop
}