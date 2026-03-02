/**
 * SpectrumVisualizer - спектрограмма/FFT визуализация
 */

import { ImGui } from "@zhobo63/imgui-ts";

export interface SpectrumVisualizerProps {
  /** Array of frequency band values (0-1 normalized) */
  frequencyBands: number[];
  /** Width of the visualization */
  width?: number;
  /** Height of the visualization */
  height?: number;
  /** Color gradient for visualization */
  gradient?: 'rainbow' | 'heat' | 'cool' | 'mono';
  /** Whether to show labels */
  showLabels?: boolean;
  /** Whether to show scale */
  showScale?: boolean;
  /** Title for the visualization */
  title?: string;
}

export function SpectrumVisualizer(props: SpectrumVisualizerProps): void {
  const {
    frequencyBands = [],
    width = -1,
    height = 150,
    gradient = 'rainbow',
    showLabels = true,
    showScale = true,
    title = 'Frequency Spectrum'
  } = props;

  // Use available width if not specified
  const availWidth = width > 0 ? width : ImGui.GetContentRegionAvail().x;
  
  // Render title if provided
  if (title) {
    ImGui.Text(title);
  }
  
  // Create visualization area
  const cursorPos = ImGui.GetCursorScreenPos();
  const drawList = ImGui.GetWindowDrawList();
  
  // Draw background
  drawList.AddRectFilled(
    cursorPos,
    new ImGui.ImVec2(cursorPos.x + availWidth, cursorPos.y + height),
    ImGui.ColorConvertFloat4ToU32(new ImGui.ImVec4(0.05, 0.05, 0.05, 1.0))
  );
  
  // Draw border
  drawList.AddRect(
    cursorPos,
    new ImGui.ImVec2(cursorPos.x + availWidth, cursorPos.y + height),
    ImGui.ColorConvertFloat4ToU32(new ImGui.ImVec4(0.3, 0.3, 0.3, 0.5))
  );
  
  // Draw spectrum bars
  const bandCount = frequencyBands.length || 32;
  const barWidth = availWidth / bandCount;
  const maxValue = frequencyBands.length > 0 
    ? Math.max(...frequencyBands, 0.1) 
    : 1.0;
  
  for (let i = 0; i < bandCount; i++) {
    const value = frequencyBands[i] || Math.sin(i * 0.3 + Date.now() * 0.005) * 0.5 + 0.5;
    const normalizedValue = value / maxValue;
    const barHeight = normalizedValue * (height - 20);
    
    const x = cursorPos.x + i * barWidth;
    const y = cursorPos.y + height - barHeight;
    
    // Get color based on gradient and position
    const color = getBarColor(i / bandCount, normalizedValue, gradient);
    
    // Draw bar with rounded top
    drawList.AddRectFilled(
      new ImGui.ImVec2(x + 1, y),
      new ImGui.ImVec2(x + barWidth - 1, cursorPos.y + height),
      ImGui.ColorConvertFloat4ToU32(color)
    );
    
    // Draw highlight on top of bar
    if (normalizedValue > 0.1) {
      const highlightColor = new ImGui.ImVec4(
        Math.min(color.x + 0.2, 1.0),
        Math.min(color.y + 0.2, 1.0),
        Math.min(color.z + 0.2, 1.0),
        0.8
      );
      
      drawList.AddRectFilled(
        new ImGui.ImVec2(x + 1, y),
        new ImGui.ImVec2(x + barWidth - 1, y + 2),
        ImGui.ColorConvertFloat4ToU32(highlightColor)
      );
    }
  }
  
  // Draw scale if requested
  if (showScale) {
    drawScale(cursorPos, availWidth, height, drawList);
  }
  
  // Draw labels if requested
  if (showLabels) {
    drawLabels(cursorPos, availWidth, height, bandCount, drawList);
  }
  
  // Advance cursor
  ImGui.Dummy(new ImGui.ImVec2(availWidth, height));
  
  // Draw legend if needed
  if (showLabels) {
    drawLegend(cursorPos, availWidth, height, gradient);
  }
}

function getBarColor(position: number, value: number, gradient: string): ImGui.ImVec4 {
  switch (gradient) {
    case 'rainbow':
      // Rainbow gradient from red to violet
      const hue = position * 0.8; // 0-0.8 for full rainbow
      return hueToRgb(hue, value * 0.8 + 0.2);
      
    case 'heat':
      // Heat gradient (black -> red -> yellow -> white)
      return new ImGui.ImVec4(
        Math.min(value * 1.5, 1.0),
        Math.min(value * 0.8, 1.0),
        Math.min(value * 0.3, 1.0),
        1.0
      );
      
    case 'cool':
      // Cool gradient (black -> blue -> cyan)
      return new ImGui.ImVec4(
        Math.min(value * 0.3, 1.0),
        Math.min(value * 0.6, 1.0),
        Math.min(value * 1.2, 1.0),
        1.0
      );
      
    case 'mono':
    default:
      // Monochrome gradient
      const intensity = value * 0.7 + 0.3;
      return new ImGui.ImVec4(intensity, intensity, intensity, 1.0);
  }
}

function hueToRgb(hue: number, saturation: number = 0.8): ImGui.ImVec4 {
  // Convert HSL to RGB
  const h = hue * 6;
  const s = saturation;
  const v = 1.0;
  
  const i = Math.floor(h);
  const f = h - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  
  let r, g, b;
  
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
    default: r = v; g = t; b = p; break;
  }
  
  return new ImGui.ImVec4(r, g, b, 1.0);
}

function drawScale(cursorPos: ImGui.ImVec2, width: number, height: number, drawList: any): void {
  // Draw vertical scale lines
  const scaleSteps = 5;
  for (let i = 0; i <= scaleSteps; i++) {
    const y = cursorPos.y + height - (i / scaleSteps) * (height - 20);
    const label = `${(i / scaleSteps * 100).toFixed(0)}%`;
    
    // Draw line
    drawList.AddLine(
      new ImGui.ImVec2(cursorPos.x, y),
      new ImGui.ImVec2(cursorPos.x + width, y),
      ImGui.ColorConvertFloat4ToU32(new ImGui.ImVec4(0.3, 0.3, 0.3, 0.3))
    );
    
    // Draw label on left side
    drawList.AddText(
      new ImGui.ImVec2(cursorPos.x - 25, y - 7),
      ImGui.ColorConvertFloat4ToU32(new ImGui.ImVec4(0.7, 0.7, 0.7, 1.0)),
      label
    );
  }
  
  // Draw horizontal frequency labels
  const freqLabels = ['20Hz', '100Hz', '500Hz', '2kHz', '10kHz', '20kHz'];
  for (let i = 0; i < freqLabels.length; i++) {
    const x = cursorPos.x + (i / (freqLabels.length - 1)) * width;
    const label = freqLabels[i];
    
    drawList.AddText(
      new ImGui.ImVec2(x - 15, cursorPos.y + height + 5),
      ImGui.ColorConvertFloat4ToU32(new ImGui.ImVec4(0.7, 0.7, 0.7, 1.0)),
      label
    );
    
    // Draw tick mark
    drawList.AddLine(
      new ImGui.ImVec2(x, cursorPos.y + height - 5),
      new ImGui.ImVec2(x, cursorPos.y + height),
      ImGui.ColorConvertFloat4ToU32(new ImGui.ImVec4(0.7, 0.7, 0.7, 0.5))
    );
  }
}

function drawLabels(cursorPos: ImGui.ImVec2, width: number, height: number, bandCount: number, drawList: any): void {
  // Draw band labels for every 8th band
  const labelStep = Math.max(1, Math.floor(bandCount / 8));
  
  for (let i = 0; i < bandCount; i += labelStep) {
    const x = cursorPos.x + (i / bandCount) * width + 5;
    
    // Only draw label if there's space
    if (i + labelStep < bandCount) {
      drawList.AddText(
        new ImGui.ImVec2(x, cursorPos.y + height + 20),
        ImGui.ColorConvertFloat4ToU32(new ImGui.ImVec4(0.5, 0.5, 0.5, 1.0)),
        `B${i + 1}`
      );
    }
  }
}

function drawLegend(cursorPos: ImGui.ImVec2, width: number, height: number, gradient: string): void {
  const legendHeight = 15;
  const legendTop = cursorPos.y + height + 30;
  
  // Draw gradient legend
  ImGui.SetCursorScreenPos(new ImGui.ImVec2(cursorPos.x, legendTop));
  
  const drawList = ImGui.GetWindowDrawList();
  const legendWidth = Math.min(width, 200);
  
  // Draw gradient bar
  for (let i = 0; i < legendWidth; i++) {
    const pos = i / legendWidth;
    const color = getBarColor(pos, 1.0, gradient);
    
    drawList.AddLine(
      new ImGui.ImVec2(cursorPos.x + i, legendTop),
      new ImGui.ImVec2(cursorPos.x + i, legendTop + legendHeight),
      ImGui.ColorConvertFloat4ToU32(color)
    );
  }
  
  // Draw legend border
  drawList.AddRect(
    new ImGui.ImVec2(cursorPos.x, legendTop),
    new ImGui.ImVec2(cursorPos.x + legendWidth, legendTop + legendHeight),
    ImGui.ColorConvertFloat4ToU32(new ImGui.ImVec4(0.5, 0.5, 0.5, 0.5))
  );
  
  // Draw legend labels
  drawList.AddText(
    new ImGui.ImVec2(cursorPos.x, legendTop + legendHeight + 2),
    ImGui.ColorConvertFloat4ToU32(new ImGui.ImVec4(0.7, 0.7, 0.7, 1.0)),
    "Low"
  );
  
  drawList.AddText(
    new ImGui.ImVec2(cursorPos.x + legendWidth - 20, legendTop + legendHeight + 2),
    ImGui.ColorConvertFloat4ToU32(new ImGui.ImVec4(0.7, 0.7, 0.7, 1.0)),
    "High"
  );
  
  // Advance cursor past legend
  ImGui.Dummy(new ImGui.ImVec2(0, legendHeight + 20));
}

// Utility function to generate mock frequency data
export function generateMockFrequencyBands(count: number = 32, time: number = Date.now()): number[] {
  const bands: number[] = [];
  
  for (let i = 0; i < count; i++) {
    // Create interesting frequency patterns
    const base = Math.sin(i * 0.2 + time * 0.001) * 0.3 + 0.4;
    const harmonic = Math.sin(i * 0.7 + time * 0.002) * 0.2;
    const noise = Math.random() * 0.1;
    
    bands.push(Math.max(0, Math.min(1, base + harmonic + noise)));
  }
  
  return bands;
}