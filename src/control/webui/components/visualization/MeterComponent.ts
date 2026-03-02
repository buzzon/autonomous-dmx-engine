/**
 * MeterComponent - VU-метры, RMS, peak метры
 */

import { ImGui } from "@zhobo63/imgui-ts";

export interface MeterComponentProps {
  /** Current value (0-1 normalized) */
  value: number;
  /** Peak value (0-1 normalized) */
  peakValue?: number;
  /** RMS value (0-1 normalized) */
  rmsValue?: number;
  /** Label for the meter */
  label?: string;
  /** Width of the meter */
  width?: number;
  /** Height of the meter */
  height?: number;
  /** Type of meter display */
  type?: 'vertical' | 'horizontal' | 'circular' | 'led';
  /** Color scheme */
  colorScheme?: 'vu' | 'rms' | 'peak' | 'custom';
  /** Custom colors for different levels */
  colors?: {
    low: [number, number, number, number];
    mid: [number, number, number, number];
    high: [number, number, number, number];
    clip: [number, number, number, number];
  };
  /** Whether to show scale */
  showScale?: boolean;
  /** Whether to show numerical value */
  showValue?: boolean;
  /** Whether to show peak hold */
  showPeakHold?: boolean;
  /** Peak hold duration in milliseconds */
  peakHoldTime?: number;
}

export class MeterComponent {
  private peakHoldValue: number = 0;
  private peakHoldTime: number = 0;
  private lastUpdateTime: number = 0;
  
  constructor() {
    this.lastUpdateTime = Date.now();
  }
  
  render(props: MeterComponentProps): void {
    const {
      value,
      peakValue,
      rmsValue,
      label = 'Meter',
      width = 200,
      height = 300,
      type = 'vertical',
      colorScheme = 'vu',
      colors,
      showScale = true,
      showValue = true,
      showPeakHold = true,
      peakHoldTime = 2000
    } = props;
    
    // Update peak hold
    this.updatePeakHold(value, peakHoldTime);
    
    // Render based on type
    switch (type) {
      case 'vertical':
        this.renderVerticalMeter(value, peakValue, rmsValue, label, width, height, colorScheme, colors, showScale, showValue, showPeakHold);
        break;
      case 'horizontal':
        this.renderHorizontalMeter(value, peakValue, rmsValue, label, width, height, colorScheme, colors, showScale, showValue, showPeakHold);
        break;
      case 'circular':
        this.renderCircularMeter(value, peakValue, rmsValue, label, width, height, colorScheme, colors, showScale, showValue, showPeakHold);
        break;
      case 'led':
        this.renderLedMeter(value, peakValue, rmsValue, label, width, height, colorScheme, colors, showScale, showValue, showPeakHold);
        break;
    }
  }
  
  private updatePeakHold(value: number, holdTime: number): void {
    const now = Date.now();
    const elapsed = now - this.lastUpdateTime;
    
    // Update peak hold
    if (value > this.peakHoldValue) {
      this.peakHoldValue = value;
      this.peakHoldTime = now;
    } else if (now - this.peakHoldTime > holdTime) {
      // Decay peak hold
      this.peakHoldValue *= 0.99;
    }
    
    this.lastUpdateTime = now;
  }
  
  private renderVerticalMeter(
    value: number,
    peakValue: number | undefined,
    rmsValue: number | undefined,
    label: string,
    width: number,
    height: number,
    colorScheme: string,
    colors: any,
    showScale: boolean,
    showValue: boolean,
    showPeakHold: boolean
  ): void {
    // Render label
    ImGui.Text(label);
    
    // Create meter area
    const cursorPos = ImGui.GetCursorScreenPos();
    const drawList = ImGui.GetWindowDrawList();
    const meterWidth = Math.max(30, width);
    const meterHeight = height;
    
    // Draw background
    drawList.AddRectFilled(
      cursorPos,
      new ImGui.ImVec2(cursorPos.x + meterWidth, cursorPos.y + meterHeight),
      ImGui.ColorConvertFloat4ToU32(new ImGui.ImVec4(0.05, 0.05, 0.05, 1.0))
    );
    
    // Draw meter fill
    const fillHeight = value * meterHeight;
    const fillY = cursorPos.y + meterHeight - fillHeight;
    
    // Get fill color based on value and color scheme
    const fillColor = this.getMeterColor(value, colorScheme, colors);
    
    drawList.AddRectFilled(
      new ImGui.ImVec2(cursorPos.x, fillY),
      new ImGui.ImVec2(cursorPos.x + meterWidth, cursorPos.y + meterHeight),
      ImGui.ColorConvertFloat4ToU32(fillColor)
    );
    
    // Draw RMS if provided
    if (rmsValue !== undefined) {
      const rmsHeight = rmsValue * meterHeight;
      const rmsY = cursorPos.y + meterHeight - rmsHeight;
      
      drawList.AddLine(
        new ImGui.ImVec2(cursorPos.x, rmsY),
        new ImGui.ImVec2(cursorPos.x + meterWidth, rmsY),
        ImGui.ColorConvertFloat4ToU32(new ImGui.ImVec4(1, 1, 1, 0.8)),
        2
      );
    }
    
    // Draw peak indicator if provided or using peak hold
    const peak = peakValue !== undefined ? peakValue : this.peakHoldValue;
    if (peak > 0) {
      const peakHeight = peak * meterHeight;
      const peakY = cursorPos.y + meterHeight - peakHeight;
      
      drawList.AddLine(
        new ImGui.ImVec2(cursorPos.x, peakY),
        new ImGui.ImVec2(cursorPos.x + meterWidth, peakY),
        ImGui.ColorConvertFloat4ToU32(new ImGui.ImVec4(1, 0, 0, 1.0)),
        2
      );
    }
    
    // Draw scale if requested
    if (showScale) {
      this.drawVerticalScale(cursorPos, meterWidth, meterHeight, drawList);
    }
    
    // Draw border
    drawList.AddRect(
      cursorPos,
      new ImGui.ImVec2(cursorPos.x + meterWidth, cursorPos.y + meterHeight),
      ImGui.ColorConvertFloat4ToU32(new ImGui.ImVec4(0.3, 0.3, 0.3, 0.5))
    );
    
    // Advance cursor
    ImGui.Dummy(new ImGui.ImVec2(meterWidth, meterHeight));
    
    // Draw value if requested
    if (showValue) {
      ImGui.Text(`${(value * 100).toFixed(1)}%`);
      
      if (peakValue !== undefined) {
        ImGui.SameLine();
        ImGui.TextDisabled(`Peak: ${(peakValue * 100).toFixed(1)}%`);
      }
    }
  }
  
  private renderHorizontalMeter(
    value: number,
    peakValue: number | undefined,
    rmsValue: number | undefined,
    label: string,
    width: number,
    height: number,
    colorScheme: string,
    colors: any,
    showScale: boolean,
    showValue: boolean,
    showPeakHold: boolean
  ): void {
    // Render label
    ImGui.Text(label);
    
    // Create meter area
    const cursorPos = ImGui.GetCursorScreenPos();
    const drawList = ImGui.GetWindowDrawList();
    const meterWidth = width;
    const meterHeight = Math.max(20, height);
    
    // Draw background
    drawList.AddRectFilled(
      cursorPos,
      new ImGui.ImVec2(cursorPos.x + meterWidth, cursorPos.y + meterHeight),
      ImGui.ColorConvertFloat4ToU32(new ImGui.ImVec4(0.05, 0.05, 0.05, 1.0))
    );
    
    // Draw meter fill
    const fillWidth = value * meterWidth;
    
    // Get fill color based on value and color scheme
    const fillColor = this.getMeterColor(value, colorScheme, colors);
    
    drawList.AddRectFilled(
      cursorPos,
      new ImGui.ImVec2(cursorPos.x + fillWidth, cursorPos.y + meterHeight),
      ImGui.ColorConvertFloat4ToU32(fillColor)
    );
    
    // Draw RMS if provided
    if (rmsValue !== undefined) {
      const rmsWidth = rmsValue * meterWidth;
      
      drawList.AddLine(
        new ImGui.ImVec2(cursorPos.x + rmsWidth, cursorPos.y),
        new ImGui.ImVec2(cursorPos.x + rmsWidth, cursorPos.y + meterHeight),
        ImGui.ColorConvertFloat4ToU32(new ImGui.ImVec4(1, 1, 1, 0.8)),
        2
      );
    }
    
    // Draw peak indicator if provided or using peak hold
    const peak = peakValue !== undefined ? peakValue : this.peakHoldValue;
    if (peak > 0) {
      const peakWidth = peak * meterWidth;
      
      drawList.AddLine(
        new ImGui.ImVec2(cursorPos.x + peakWidth, cursorPos.y),
        new ImGui.ImVec2(cursorPos.x + peakWidth, cursorPos.y + meterHeight),
        ImGui.ColorConvertFloat4ToU32(new ImGui.ImVec4(1, 0, 0, 1.0)),
        2
      );
    }
    
    // Draw scale if requested
    if (showScale) {
      this.drawHorizontalScale(cursorPos, meterWidth, meterHeight, drawList);
    }
    
    // Draw border
    drawList.AddRect(
      cursorPos,
      new ImGui.ImVec2(cursorPos.x + meterWidth, cursorPos.y + meterHeight),
      ImGui.ColorConvertFloat4ToU32(new ImGui.ImVec4(0.3, 0.3, 0.3, 0.5))
    );
    
    // Advance cursor
    ImGui.Dummy(new ImGui.ImVec2(meterWidth, meterHeight));
    
    // Draw value if requested
    if (showValue) {
      ImGui.Text(`${(value * 100).toFixed(1)}%`);
    }
  }
  
  private renderCircularMeter(
    value: number,
    peakValue: number | undefined,
    rmsValue: number | undefined,
    label: string,
    width: number,
    height: number,
    colorScheme: string,
    colors: any,
    showScale: boolean,
    showValue: boolean,
    showPeakHold: boolean
  ): void {
    // Not implemented in this version
    ImGui.Text(`Circular meter for "${label}": ${(value * 100).toFixed(1)}%`);
    ImGui.Dummy(new ImGui.ImVec2(width, height));
  }
  
  private renderLedMeter(
    value: number,
    peakValue: number | undefined,
    rmsValue: number | undefined,
    label: string,
    width: number,
    height: number,
    colorScheme: string,
    colors: any,
    showScale: boolean,
    showValue: boolean,
    showPeakHold: boolean
  ): void {
    // Render label
    ImGui.Text(label);
    
    // Create LED meter
    const ledCount = 20;
    const ledWidth = Math.max(5, width / ledCount - 2);
    const ledHeight = height;
    
    const cursorPos = ImGui.GetCursorScreenPos();
    const drawList = ImGui.GetWindowDrawList();
    
    // Draw LED segments
    for (let i = 0; i < ledCount; i++) {
      const ledValue = (i + 1) / ledCount;
      const isLit = value >= ledValue;
      
      const x = cursorPos.x + i * (ledWidth + 2);
      const y = cursorPos.y;
      
      // Determine LED color
      let ledColor: ImGui.ImVec4;
      
      if (!isLit) {
        ledColor = new ImGui.ImVec4(0.1, 0.1, 0.1, 1.0);
      } else {
        // Color based on position in meter
        const position = i / ledCount;
        ledColor = this.getMeterColor(position, colorScheme, colors);
        
        // Make lit LEDs brighter
        ledColor.x = Math.min(ledColor.x * 1.5, 1.0);
        ledColor.y = Math.min(ledColor.y * 1.5, 1.0);
        ledColor.z = Math.min(ledColor.z * 1.5, 1.0);
      }
      
      // Draw LED
      drawList.AddRectFilled(
        new ImGui.ImVec2(x, y),
        new ImGui.ImVec2(x + ledWidth, y + ledHeight),
        ImGui.ColorConvertFloat4ToU32(ledColor)
      );
      
      // Draw LED border
      drawList.AddRect(
        new ImGui.ImVec2(x, y),
        new ImGui.ImVec2(x + ledWidth, y + ledHeight),
        ImGui.ColorConvertFloat4ToU32(new ImGui.ImVec4(0.3, 0.3, 0.3, 0.5))
      );
    }
    
    // Advance cursor
    ImGui.Dummy(new ImGui.ImVec2(width, height));
    
    // Draw value if requested
    if (showValue) {
      ImGui.Text(`${(value * 100).toFixed(1)}%`);
    }
  }
  
  private drawVerticalScale(cursorPos: ImGui.ImVec2, width: number, height: number, drawList: any): void {
    const scaleSteps = 10;
    
    for (let i = 0; i <= scaleSteps; i++) {
      const y = cursorPos.y + height - (i / scaleSteps) * height;
      const value = (i / scaleSteps * 100).toFixed(0);
      
      // Draw scale line
      drawList.AddLine(
        new ImGui.ImVec2(cursorPos.x, y),
        new ImGui.ImVec2(cursorPos.x + width, y),
        ImGui.ColorConvertFloat4ToU32(new ImGui.ImVec4(0.2, 0.2, 0.2, 0.5))
      );
      
      // Draw value label on right side
      drawList.AddText(
        new ImGui.ImVec2(cursorPos.x + width + 5, y - 7),
        ImGui.ColorConvertFloat4ToU32(new ImGui.ImVec4(0.7, 0.7, 0.7, 1.0)),
        `${value}%`
      );
    }
    
    // Draw special markers for VU meter
    // -18dB, -12dB, -6dB, 0dB, +3dB
    const dbMarkers = [
      { db: -18, y: 0.1 },
      { db: -12, y: 0.25 },
      { db: -6, y: 0.5 },
      { db: 0, y: 0.75 },
      { db: 3, y: 0.9 }
    ];
    
    for (const marker of dbMarkers) {
      const y = cursorPos.y + height - marker.y * height;
      
      drawList.AddLine(
        new ImGui.ImVec2(cursorPos.x, y),
        new ImGui.ImVec2(cursorPos.x + width, y),
        ImGui.ColorConvertFloat4ToU32(new ImGui.ImVec4(0.5, 0.5, 0.5, 0.7)),
        1
      );
      
      drawList.AddText(
        new ImGui.ImVec2(cursorPos.x - 25, y - 7),
        ImGui.ColorConvertFloat4ToU32(new ImGui.ImVec4(0.7, 0.7, 0.7, 1.0)),
        `${marker.db}dB`
      );
    }
  }
  
  private drawHorizontalScale(cursorPos: ImGui.ImVec2, width: number, height: number, drawList: any): void {
    const scaleSteps = 10;
    
    for (let i = 0; i <= scaleSteps; i++) {
      const x = cursorPos.x + (i / scaleSteps) * width;
      const value = (i / scaleSteps * 100).toFixed(0);
      
      // Draw scale line
      drawList.AddLine(
        new ImGui.ImVec2(x, cursorPos.y),
        new ImGui.ImVec2(x, cursorPos.y + height),
        ImGui.ColorConvertFloat4ToU32(new ImGui.ImVec4(0.2, 0.2, 0.2, 0.5))
      );
      
      // Draw value label below
      drawList.AddText(
        new ImGui.ImVec2(x - 10, cursorPos.y + height + 2),
        ImGui.ColorConvertFloat4ToU32(new ImGui.ImVec4(0.7, 0.7, 0.7, 1.0)),
        `${value}%`
      );
    }
  }
  
  private getMeterColor(value: number, colorScheme: string, customColors: any): ImGui.ImVec4 {
    // Default VU meter colors
    const defaultColors = {
      vu: {
        low: [0.0, 0.8, 0.0, 1.0] as [number, number, number, number],  // Green
        mid: [0.8, 0.8, 0.0, 1.0] as [number, number, number, number],  // Yellow
        high: [0.8, 0.4, 0.0, 1.0] as [number, number, number, number], // Orange
        clip: [1.0, 0.0, 0.0, 1.0] as [number, number, number, number]  // Red
      },
      rms: {
        low: [0.0, 0.6, 0.8, 1.0] as [number, number, number, number],  // Cyan
        mid: [0.0, 0.4, 1.0, 1.0] as [number, number, number, number],  // Blue
        high: [0.4, 0.0, 0.8, 1.0] as [number, number, number, number], // Purple
        clip: [1.0, 0.0, 0.5, 1.0] as [number, number, number, number]  // Pink
      },
      peak: {
        low: [0.3, 0.3, 0.3, 1.0] as [number, number, number, number],  // Gray
        mid: [0.6, 0.6, 0.6, 1.0] as [number, number, number, number],  // Light Gray
        high: [0.9, 0.9, 0.9, 1.0] as [number, number, number, number], // White
        clip: [1.0, 1.0, 0.0, 1.0] as [number, number, number, number]  // Yellow
      }
    };

    // Use custom colors if provided
    const colors = customColors || defaultColors[colorScheme as keyof typeof defaultColors] || defaultColors.vu;
    
    // Determine which color to use based on value
    if (value > 0.95) {
      return new ImGui.ImVec4(colors.clip[0], colors.clip[1], colors.clip[2], colors.clip[3]);
    } else if (value > 0.75) {
      return new ImGui.ImVec4(colors.high[0], colors.high[1], colors.high[2], colors.high[3]);
    } else if (value > 0.5) {
      return new ImGui.ImVec4(colors.mid[0], colors.mid[1], colors.mid[2], colors.mid[3]);
    } else {
      return new ImGui.ImVec4(colors.low[0], colors.low[1], colors.low[2], colors.low[3]);
    }
  }
}