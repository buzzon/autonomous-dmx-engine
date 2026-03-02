/**
 * DMXMonitor - мониторинг DMX каналов и фикстур
 */

import { ImGui } from "@zhobo63/imgui-ts";
import { Panel, CardPanel } from '../components/Panel';
import { Button } from '../components/Button';
import { store, selectors } from '../store/store';
import { useResponsiveLayout } from '../layouts/DashboardLayout';

export interface DMXMonitorProps {
  onNavigate: (page: string) => void;
}

export function DMXMonitor(props: DMXMonitorProps): void {
  const { onNavigate } = props;
  const state = store.getState();
  const { isMobile, columnWidth } = useResponsiveLayout();

  // Render header
  renderHeader(onNavigate);
  
  ImGui.Spacing();
  
  // DMX channel grid
  renderChannelGrid(state, isMobile);
  
  ImGui.Spacing();
  
  // Fixture visualization and controls
  renderFixtureControls(state, isMobile, columnWidth);
}

function renderHeader(onNavigate: (page: string) => void): void {
  CardPanel({
    title: 'DMX Monitor & Control',
    width: -1,
    height: 70,
    children: () => {
      ImGui.Columns(3, 'dmx-header', false);
      
      // Navigation
      ImGui.Text("Navigation:");
      if (Button({ label: "← Dashboard", onClick: () => onNavigate('home') })) {}
      
      ImGui.NextColumn();
      
      // Title and status
      const isBlackout = store.getState().system.blackout;
      ImGui.TextColored(new ImGui.ImVec4(0.8, 0.8, 0.2, 1.0), "DMX Output Monitor");
      if (isBlackout) {
        ImGui.TextColored(new ImGui.ImVec4(1, 0, 0, 1), "BLACKOUT ACTIVE");
      } else {
        ImGui.TextColored(new ImGui.ImVec4(0, 1, 0, 1), "OUTPUT ACTIVE");
      }
      
      ImGui.NextColumn();
      
      // Controls
      ImGui.Text("View:");
      if (Button({ label: "Channels", width: 80, onClick: () => {} })) {}
      ImGui.SameLine();
      if (Button({ label: "Fixtures", width: 80, onClick: () => {} })) {}
      
      ImGui.Columns(1);
    }
  });
}

function renderChannelGrid(state: any, isMobile: boolean): void {
  CardPanel({
    title: 'DMX Channel Values (1-512)',
    width: -1,
    height: 300,
    children: () => {
      // Channel grid controls
      ImGui.Text("Display Range:");
      ImGui.SameLine();
      if (Button({ label: "1-64", width: 60, onClick: () => {} })) {}
      ImGui.SameLine();
      if (Button({ label: "65-128", width: 60, onClick: () => {} })) {}
      ImGui.SameLine();
      if (Button({ label: "129-192", width: 60, onClick: () => {} })) {}
      ImGui.SameLine();
      if (Button({ label: "193-256", width: 60, onClick: () => {} })) {}
      
      ImGui.Separator();
      
      // Channel grid
      const channelsPerRow = isMobile ? 8 : 16;
      const startChannel = 1;
      const endChannel = Math.min(startChannel + 63, 512);
      
      // Create mock channel data
      const channelValues: number[] = [];
      for (let i = startChannel; i <= endChannel; i++) {
        // Mock values with some pattern
        const value = Math.sin(i * 0.1 + Date.now() * 0.001) * 0.5 + 0.5;
        channelValues.push(value);
      }
      
      // Draw channel grid
      const gridWidth = ImGui.GetContentRegionAvail().x;
      const channelWidth = gridWidth / channelsPerRow - 4;
      
      let channelIndex = 0;
      for (let row = 0; row < Math.ceil((endChannel - startChannel + 1) / channelsPerRow); row++) {
        for (let col = 0; col < channelsPerRow; col++) {
          if (channelIndex >= channelValues.length) break;
          
          const channelNum = startChannel + channelIndex;
          const value = channelValues[channelIndex];
          
          // Draw channel cell
          ImGui.PushID(`channel-${channelNum}`);
          
          // Channel number
          ImGui.Text(`${channelNum}`);
          
          // Value bar
          const barHeight = 30;
          const cursorPos = ImGui.GetCursorScreenPos();
          const drawList = ImGui.GetWindowDrawList();
          
          // Background
          drawList.AddRectFilled(
            cursorPos,
            new ImGui.ImVec2(cursorPos.x + channelWidth, cursorPos.y + barHeight),
            ImGui.ColorConvertFloat4ToU32(new ImGui.ImVec4(0.1, 0.1, 0.1, 1.0))
          );
          
          // Value fill
          const fillWidth = value * channelWidth;
          let fillColor = new ImGui.ImVec4(0.2, 0.6, 0.2, 1.0); // Green for normal
          
          if (value > 0.9) {
            fillColor = new ImGui.ImVec4(1, 0.5, 0, 1.0); // Orange for high
          } else if (value < 0.1) {
            fillColor = new ImGui.ImVec4(0.3, 0.3, 0.3, 1.0); // Dark for low
          }
          
          drawList.AddRectFilled(
            cursorPos,
            new ImGui.ImVec2(cursorPos.x + fillWidth, cursorPos.y + barHeight),
            ImGui.ColorConvertFloat4ToU32(fillColor)
          );
          
          // Border
          drawList.AddRect(
            cursorPos,
            new ImGui.ImVec2(cursorPos.x + channelWidth, cursorPos.y + barHeight),
            ImGui.ColorConvertFloat4ToU32(new ImGui.ImVec4(0.5, 0.5, 0.5, 0.5))
          );
          
          // Value text
          const textPos = new ImGui.ImVec2(
            cursorPos.x + channelWidth / 2 - 10,
            cursorPos.y + barHeight / 2 - 7
          );
          
          drawList.AddText(
            textPos,
            ImGui.ColorConvertFloat4ToU32(new ImGui.ImVec4(1, 1, 1, 1)),
            `${Math.round(value * 100)}`
          );
          
          ImGui.Dummy(new ImGui.ImVec2(channelWidth, barHeight));
          
          // Tooltip on hover
          if (ImGui.IsItemHovered()) {
            ImGui.BeginTooltip();
            ImGui.Text(`Channel ${channelNum}`);
            ImGui.Text(`Value: ${(value * 255).toFixed(0)} (${(value * 100).toFixed(1)}%)`);
            ImGui.Text("Click to edit");
            ImGui.EndTooltip();
            
            // Click to edit
            if (ImGui.IsMouseClicked(0)) {
              // Open channel editor
            }
          }
          
          ImGui.PopID();
          
          if (col < channelsPerRow - 1) {
            ImGui.SameLine();
          }
          
          channelIndex++;
        }
        
        // New line for next row
        if (row < Math.ceil((endChannel - startChannel + 1) / channelsPerRow) - 1) {
          ImGui.NewLine();
        }
      }
      
      // Grid summary
      ImGui.Separator();
      ImGui.Text(`Showing channels ${startChannel}-${endChannel} of 512`);
      ImGui.SameLine();
      ImGui.Text(`Active channels: ${channelValues.filter(v => v > 0.1).length}`);
    }
  });
}

function renderFixtureControls(state: any, isMobile: boolean, columnWidth: number): void {
  const columns = isMobile ? 1 : 2;
  
  ImGui.Columns(columns, 'fixture-controls', false);
  
  // Fixture list
  CardPanel({
    title: 'Fixture Control',
    width: columnWidth,
    height: 250,
    children: () => {
      // Mock fixture data
      const fixtures = [
        { id: 1, name: "Wash 1", type: "Moving Head", address: 1, intensity: 0.8, color: [1, 0.5, 0] },
        { id: 2, name: "Wash 2", type: "Moving Head", address: 17, intensity: 0.6, color: [0, 1, 0.5] },
        { id: 3, name: "Spot 1", type: "Spot", address: 33, intensity: 0.9, color: [0.5, 0, 1] },
        { id: 4, name: "Bar 1", type: "LED Bar", address: 49, intensity: 0.4, color: [1, 1, 0] },
        { id: 5, name: "Strobe", type: "Strobe", address: 65, intensity: 0.3, color: [1, 1, 1] },
      ];
      
      // Fixture list with controls
      for (const fixture of fixtures) {
        ImGui.PushID(`fixture-${fixture.id}`);
        
        ImGui.Columns(2, `fixture-${fixture.id}-cols`, false);
        
        // Fixture info
        ImGui.TextColored(new ImGui.ImVec4(0.8, 0.8, 0.2, 1.0), fixture.name);
        ImGui.Text(`Type: ${fixture.type}`);
        ImGui.Text(`Address: ${fixture.address}`);
        
        ImGui.NextColumn();
        
        // Fixture controls
        // Intensity slider
        ImGui.Text("Intensity:");
        ImGui.SameLine();
        ImGui.ProgressBar(fixture.intensity, new ImGui.ImVec2(80, 15), "");
        
        // Color preview
        const cursorPos = ImGui.GetCursorScreenPos();
        const drawList = ImGui.GetWindowDrawList();
        const colorBoxSize = 20;
        
        drawList.AddRectFilled(
          cursorPos,
          new ImGui.ImVec2(cursorPos.x + colorBoxSize, cursorPos.y + colorBoxSize),
          ImGui.ColorConvertFloat4ToU32(new ImGui.ImVec4(
            fixture.color[0],
            fixture.color[1],
            fixture.color[2],
            1.0
          ))
        );
        
        ImGui.Dummy(new ImGui.ImVec2(colorBoxSize, colorBoxSize));
        ImGui.SameLine();
        
        // Control buttons
        if (Button({ label: "Edit", width: 50, onClick: () => {} })) {}
        ImGui.SameLine();
        if (Button({ label: "Test", width: 50, onClick: () => {} })) {}
        
        ImGui.Columns(1);
        ImGui.Separator();
        
        ImGui.PopID();
      }
      
      // Add fixture button
      if (Button({ label: "+ Add Fixture", width: -1, onClick: () => {} })) {}
    }
  });
  
  if (!isMobile) {
    ImGui.NextColumn();
  }
  
  // DMX output statistics
  CardPanel({
    title: 'DMX Statistics',
    width: columnWidth,
    height: 250,
    children: () => {
      // Output statistics
      const stats = {
        totalChannels: 512,
        activeChannels: 127,
        maxValue: 255,
        avgValue: 128,
        fps: 40,
        packetRate: 44
      };
      
      ImGui.Text("Output Statistics:");
      ImGui.Text(`Active Channels: ${stats.activeChannels}/${stats.totalChannels}`);
      ImGui.ProgressBar(stats.activeChannels / stats.totalChannels, new ImGui.ImVec2(-1, 15), "");
      
      ImGui.Text(`Average Value: ${stats.avgValue}`);
      ImGui.Text(`Max Value: ${stats.maxValue}`);
      
      ImGui.Separator();
      
      // Performance metrics
      ImGui.Text("Performance:");
      ImGui.Text(`FPS: ${stats.fps}`);
      ImGui.Text(`Packet Rate: ${stats.packetRate} Hz`);
      
      // Bandwidth usage
      const bandwidth = (stats.activeChannels * stats.packetRate * 2) / 1000; // KB/s
      ImGui.Text(`Bandwidth: ${bandwidth.toFixed(1)} KB/s`);
      
      ImGui.Separator();
      
      // Output controls
      ImGui.Text("Output Controls:");
      
      const isBlackout = store.getState().system.blackout;
      if (isBlackout) {
        if (Button({ label: "RESTORE OUTPUT", width: -1, onClick: () => {
          store.setBlackout(false);
        } })) {}
      } else {
        if (Button({ label: "BLACKOUT", width: -1, onClick: () => {
          store.setBlackout(true);
        } })) {}
      }
      
      ImGui.SameLine();
      if (Button({ label: "Test All", width: -1, onClick: () => {} })) {}
    }
  });
  
  ImGui.Columns(1);
}

// Helper to update DMX channel values
export function updateDMXChannel(channel: number, value: number): void {
  // This would update the store with new DMX values
  console.log(`DMX Channel ${channel} set to ${value}`);
}

// Real-time update function
export function updateDMXMonitor(): void {
  // Force UI updates for real-time DMX monitoring
}