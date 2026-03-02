/**
 * WaveformView - осциллограмма аудиосигнала
 */

import { ImGui } from "@zhobo63/imgui-ts";

export interface WaveformViewProps {
  /** Array of waveform samples (-1 to 1) */
  samples?: number[];
  /** Number of samples to generate if not provided */
  sampleCount?: number;
  /** Width of the visualization */
  width?: number;
  /** Height of the visualization */
  height?: number;
  /** Color of the waveform */
  color?: [number, number, number, number];
  /** Whether to show grid */
  showGrid?: boolean;
  /** Whether to show zero line */
  showZeroLine?: boolean;
  /** Whether to show peak markers */
  showPeaks?: boolean;
  /** Title for the visualization */
  title?: string;
  /** Time window in seconds */
  timeWindow?: number;
  /** Sample rate in Hz */
  sampleRate?: number;
}

export function WaveformView(props: WaveformViewProps): void {
  const {
    samples,
    sampleCount = 200,
    width = -1,
    height = 120,
    color = [0.0, 1.0, 0.0, 1.0],
    showGrid = true,
    showZeroLine = true,
    showPeaks = true,
    title = 'Waveform',
    timeWindow = 0.1,
    sampleRate = 44100
  } = props;

  // Use available width if not specified
  const availWidth = width > 0 ? width : ImGui.GetContentRegionAvail().x;
  
  // Generate samples if not provided
  const waveformSamples = samples || generateMockWaveform(sampleCount, Date.now());
  
  // Render title if provided
  if (title) {
    ImGui.Text(title);
    
    // Show time window info
    if (timeWindow > 0) {
      ImGui.SameLine();
      ImGui.TextDisabled(`(${timeWindow * 1000}ms window)`);
    }
  }
  
  // Create visualization area
  const cursorPos = ImGui.GetCursorScreenPos();
  const drawList = ImGui.GetWindowDrawList();
  
  // Draw background
  drawList.AddRectFilled(
    cursorPos,
    new ImGui.ImVec2(cursorPos.x + availWidth, cursorPos.y + height),
    ImGui.ColorConvertFloat4ToU32(new ImGui.ImVec4(0.02, 0.02, 0.02, 1.0))
  );
  
  // Draw grid if requested
  if (showGrid) {
    drawWaveformGrid(cursorPos, availWidth, height, drawList);
  }
  
  // Draw zero line if requested
  if (showZeroLine) {
    const zeroY = cursorPos.y + height / 2;
    drawList.AddLine(
      new ImGui.ImVec2(cursorPos.x, zeroY),
      new ImGui.ImVec2(cursorPos.x + availWidth, zeroY),
      ImGui.ColorConvertFloat4ToU32(new ImGui.ImVec4(0.3, 0.3, 0.3, 0.5))
    );
  }
  
  // Draw waveform
  drawWaveform(
    cursorPos,
    availWidth,
    height,
    waveformSamples,
    color,
    drawList
  );
  
  // Draw peak markers if requested
  if (showPeaks && waveformSamples.length > 0) {
    drawPeakMarkers(cursorPos, availWidth, height, waveformSamples, drawList);
  }
  
  // Draw border
  drawList.AddRect(
    cursorPos,
    new ImGui.ImVec2(cursorPos.x + availWidth, cursorPos.y + height),
    ImGui.ColorConvertFloat4ToU32(new ImGui.ImVec4(0.3, 0.3, 0.3, 0.5))
  );
  
  // Advance cursor
  ImGui.Dummy(new ImGui.ImVec2(availWidth, height));
  
  // Draw statistics
  drawWaveformStats(waveformSamples, cursorPos, availWidth, height);
}

function drawWaveformGrid(cursorPos: ImGui.ImVec2, width: number, height: number, drawList: any): void {
  // Vertical grid lines (time)
  const verticalDivisions = 10;
  for (let i = 0; i <= verticalDivisions; i++) {
    const x = cursorPos.x + (i / verticalDivisions) * width;
    
    drawList.AddLine(
      new ImGui.ImVec2(x, cursorPos.y),
      new ImGui.ImVec2(x, cursorPos.y + height),
      ImGui.ColorConvertFloat4ToU32(new ImGui.ImVec4(0.1, 0.1, 0.1, 0.5))
    );
  }
  
  // Horizontal grid lines (amplitude)
  const horizontalDivisions = 4;
  for (let i = 0; i <= horizontalDivisions; i++) {
    const y = cursorPos.y + (i / horizontalDivisions) * height;
    
    drawList.AddLine(
      new ImGui.ImVec2(cursorPos.x, y),
      new ImGui.ImVec2(cursorPos.x + width, y),
      ImGui.ColorConvertFloat4ToU32(new ImGui.ImVec4(0.1, 0.1, 0.1, 0.5))
    );
    
    // Amplitude labels
    const amplitude = 1.0 - (i / horizontalDivisions * 2); // -1 to 1
    const label = amplitude.toFixed(1);
    
    drawList.AddText(
      new ImGui.ImVec2(cursorPos.x - 25, y - 7),
      ImGui.ColorConvertFloat4ToU32(new ImGui.ImVec4(0.5, 0.5, 0.5, 1.0)),
      label
    );
  }
}

function drawWaveform(
  cursorPos: ImGui.ImVec2,
  width: number,
  height: number,
  samples: number[],
  color: [number, number, number, number],
  drawList: any
): void {
  if (samples.length < 2) return;
  
  const sampleSpacing = width / (samples.length - 1);
  const halfHeight = height / 2;
  const centerY = cursorPos.y + halfHeight;
  
  // Convert color array to ImVec4
  const waveformColor = new ImGui.ImVec4(color[0], color[1], color[2], color[3]);
  const fillColor = new ImGui.ImVec4(
    color[0] * 0.3,
    color[1] * 0.3,
    color[2] * 0.3,
    color[3] * 0.2
  );
  
  // Create path for waveform fill
  const fillPoints: ImGui.ImVec2[] = [];
  
  // Start at left edge, bottom
  fillPoints.push(new ImGui.ImVec2(cursorPos.x, cursorPos.y + height));
  
  // Add waveform points
  for (let i = 0; i < samples.length; i++) {
    const x = cursorPos.x + i * sampleSpacing;
    const y = centerY - samples[i] * halfHeight * 0.9; // 90% of half height
    
    fillPoints.push(new ImGui.ImVec2(x, y));
  }
  
  // End at right edge, bottom
  fillPoints.push(new ImGui.ImVec2(cursorPos.x + width, cursorPos.y + height));
  
  // Draw filled waveform area
  if (fillPoints.length >= 3) {
    drawList.AddConvexPolyFilled(
      fillPoints,
      fillPoints.length,
      ImGui.ColorConvertFloat4ToU32(fillColor)
    );
  }
  
  // Draw waveform line
  for (let i = 0; i < samples.length - 1; i++) {
    const x1 = cursorPos.x + i * sampleSpacing;
    const y1 = centerY - samples[i] * halfHeight * 0.9;
    
    const x2 = cursorPos.x + (i + 1) * sampleSpacing;
    const y2 = centerY - samples[i + 1] * halfHeight * 0.9;
    
    // Vary line thickness based on amplitude
    const thickness = 1 + Math.abs(samples[i]) * 2;
    
    drawList.AddLine(
      new ImGui.ImVec2(x1, y1),
      new ImGui.ImVec2(x2, y2),
      ImGui.ColorConvertFloat4ToU32(waveformColor),
      thickness
    );
  }
  
  // Draw sample points for high-resolution displays
  if (samples.length < 100) {
    for (let i = 0; i < samples.length; i++) {
      const x = cursorPos.x + i * sampleSpacing;
      const y = centerY - samples[i] * halfHeight * 0.9;
      
      drawList.AddCircleFilled(
        new ImGui.ImVec2(x, y),
        2,
        ImGui.ColorConvertFloat4ToU32(waveformColor)
      );
    }
  }
}

function drawPeakMarkers(
  cursorPos: ImGui.ImVec2,
  width: number,
  height: number,
  samples: number[],
  drawList: any
): void {
  // Find positive and negative peaks
  let maxPositive = -Infinity;
  let maxNegative = Infinity;
  let positiveIndex = -1;
  let negativeIndex = -1;
  
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    
    if (sample > maxPositive) {
      maxPositive = sample;
      positiveIndex = i;
    }
    
    if (sample < maxNegative) {
      maxNegative = sample;
      negativeIndex = i;
    }
  }
  
  const halfHeight = height / 2;
  const centerY = cursorPos.y + halfHeight;
  const sampleSpacing = width / (samples.length - 1);
  
  // Draw positive peak marker
  if (positiveIndex >= 0 && maxPositive > 0.1) {
    const x = cursorPos.x + positiveIndex * sampleSpacing;
    const y = centerY - maxPositive * halfHeight * 0.9;
    
    // Peak indicator
    drawList.AddCircle(
      new ImGui.ImVec2(x, y),
      4,
      ImGui.ColorConvertFloat4ToU32(new ImGui.ImVec4(1, 0, 0, 1)),
      8,
      2
    );
    
    // Peak value label
    const label = `+${maxPositive.toFixed(3)}`;
    drawList.AddText(
      new ImGui.ImVec2(x + 8, y - 10),
      ImGui.ColorConvertFloat4ToU32(new ImGui.ImVec4(1, 0.5, 0.5, 1.0)),
      label
    );
  }
  
  // Draw negative peak marker
  if (negativeIndex >= 0 && maxNegative < -0.1) {
    const x = cursorPos.x + negativeIndex * sampleSpacing;
    const y = centerY - maxNegative * halfHeight * 0.9;
    
    // Peak indicator
    drawList.AddCircle(
      new ImGui.ImVec2(x, y),
      4,
      ImGui.ColorConvertFloat4ToU32(new ImGui.ImVec4(0, 0.5, 1, 1)),
      8,
      2
    );
    
    // Peak value label
    const label = `${maxNegative.toFixed(3)}`;
    drawList.AddText(
      new ImGui.ImVec2(x + 8, y + 2),
      ImGui.ColorConvertFloat4ToU32(new ImGui.ImVec4(0.5, 0.8, 1, 1.0)),
      label
    );
  }
}

function drawWaveformStats(
  samples: number[],
  cursorPos: ImGui.ImVec2,
  width: number,
  height: number
): void {
  if (samples.length === 0) return;
  
  // Calculate statistics
  let sum = 0;
  let sumSquares = 0;
  let max = -Infinity;
  let min = Infinity;
  
  for (const sample of samples) {
    sum += sample;
    sumSquares += sample * sample;
    max = Math.max(max, sample);
    min = Math.min(min, sample);
  }
  
  const mean = sum / samples.length;
  const rms = Math.sqrt(sumSquares / samples.length);
  const peakToPeak = max - min;
  
  // Display statistics
  ImGui.Columns(4, 'waveform-stats', false);
  
  ImGui.Text(`RMS: ${rms.toFixed(4)}`);
  ImGui.NextColumn();
  
  ImGui.Text(`Mean: ${mean.toFixed(4)}`);
  ImGui.NextColumn();
  
  ImGui.Text(`P-P: ${peakToPeak.toFixed(4)}`);
  ImGui.NextColumn();
  
  ImGui.Text(`Samples: ${samples.length}`);
  
  ImGui.Columns(1);
}

function generateMockWaveform(sampleCount: number, time: number): number[] {
  const samples: number[] = [];
  const timeStep = 0.01;
  
  for (let i = 0; i < sampleCount; i++) {
    const t = i * timeStep + time * 0.001;
    
    // Complex waveform with multiple frequencies
    const sample = 
      Math.sin(t * 10) * 0.3 +          // 10 Hz
      Math.sin(t * 50) * 0.2 +          // 50 Hz
      Math.sin(t * 200) * 0.1 +         // 200 Hz
      Math.sin(t * 1000) * 0.05 +       // 1 kHz
      (Math.random() - 0.5) * 0.1;      // Noise
    
    // Apply envelope
    const envelope = Math.sin((i / sampleCount) * Math.PI) * 0.8 + 0.2;
    
    samples.push(sample * envelope);
  }
  
  return samples;
}

// Real-time waveform buffer for streaming audio
export class WaveformBuffer {
  private buffer: number[] = [];
  private maxSize: number;
  
  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }
  
  addSamples(newSamples: number[]): void {
    this.buffer.push(...newSamples);
    
    // Trim buffer if too large
    if (this.buffer.length > this.maxSize) {
      this.buffer = this.buffer.slice(-this.maxSize);
    }
  }
  
  getSamples(count: number): number[] {
    if (count >= this.buffer.length) {
      return [...this.buffer];
    }
    
    // Get latest samples
    return this.buffer.slice(-count);
  }
  
  clear(): void {
    this.buffer = [];
  }
  
  getSize(): number {
    return this.buffer.length;
  }
  
  getLatest(): number {
    return this.buffer.length > 0 ? this.buffer[this.buffer.length - 1] : 0;
  }
}