/**
 * FixtureManager - управление фикстурами и пачкой
 */

import { ImGui } from "@zhobo63/imgui-ts";
import { Panel, CardPanel } from '../components/Panel';
import { Button, PrimaryButton } from '../components/Button';
import { store, selectors } from '../store/store';
import { useResponsiveLayout } from '../layouts/DashboardLayout';

export interface FixtureManagerProps {
  onNavigate: (page: string) => void;
  onSave?: (patch: any) => void;
  onLoad?: (patchId: string) => void;
}

export interface FixtureProfile {
  id: string;
  name: string;
  manufacturer: string;
  channels: Array<{
    name: string;
    type: string;
    channelIndex: number;
  }>;
  colorMap?: Record<string, number>;
}

export interface FixtureInstance {
  id: number;
  name: string;
  profileId: string;
  universe: number;
  address: number;
  groupId: string;
  channels: number[];
}

export function FixtureManager(props: FixtureManagerProps): void {
  const { onNavigate, onSave, onLoad } = props;
  const state = store.getState();
  const { isMobile, columnWidth } = useResponsiveLayout();

  // Load fixture data
  const profiles = loadFixtureProfiles();
  const fixtures = loadFixtureInstances();
  const patch = loadPatchConfig();

  // Render header
  renderHeader(state, onNavigate, fixtures, patch, onSave);
  
  ImGui.Spacing();
  
  // Main manager layout
  renderManagerLayout(state, isMobile, columnWidth, profiles, fixtures, patch, onSave);
  
  ImGui.Spacing();
  
  // Patch properties panel
  renderPatchPanel(patch, fixtures, onSave);
}

function renderHeader(
  state: any, 
  onNavigate: (page: string) => void,
  fixtures: FixtureInstance[],
  patch: any,
  onSave?: (patch: any) => void
): void {
  CardPanel({
    title: 'Fixture Manager',
    width: -1,
    height: 100,
    children: () => {
      ImGui.Columns(4, 'fixture-header', false);
      
      // Column 1: Patch info
      ImGui.Text("Patch Summary:");
      ImGui.Text(`Fixtures: ${fixtures.length}`);
      ImGui.Text(`Universes: ${patch.universes || 1}`);
      
      ImGui.NextColumn();
      
      // Column 2: Channel usage
      const usedChannels = calculateUsedChannels(fixtures);
      const totalChannels = 512 * (patch.universes || 1);
      ImGui.Text("Channel Usage:");
      ImGui.Text(`${usedChannels}/${totalChannels} channels`);
      ImGui.ProgressBar(usedChannels / totalChannels, new ImGui.ImVec2(-1, 10), "");
      
      ImGui.NextColumn();
      
      // Column 3: Actions
      ImGui.Text("Actions:");
      if (PrimaryButton({ label: "Save Patch", onClick: () => onSave?.(patch) })) {}
      ImGui.SameLine();
      if (Button({ label: "Auto Patch", onClick: () => autoPatchFixtures() })) {}
      
      ImGui.NextColumn();
      
      // Column 4: Navigation
      ImGui.Text("Navigation:");
      if (Button({ label: "← Effects", onClick: () => onNavigate('effects') })) {}
      ImGui.SameLine();
      if (Button({ label: "Home →", onClick: () => onNavigate('home') })) {}
      
      ImGui.Columns(1);
    }
  });
}

function renderManagerLayout(
  state: any,
  isMobile: boolean,
  columnWidth: number,
  profiles: FixtureProfile[],
  fixtures: FixtureInstance[],
  patch: any,
  onSave?: (patch: any) => void
): void {
  const columns = isMobile ? 1 : 3;
  
  ImGui.Columns(columns, 'manager-layout', false);
  
  // Left panel: Fixture profiles
  CardPanel({
    title: 'Fixture Profiles',
    width: columnWidth,
    height: 400,
    children: () => {
      renderProfilesPanel(profiles, fixtures, onSave);
    }
  });
  
  if (!isMobile) {
    ImGui.NextColumn();
  }
  
  // Center panel: Fixture grid
  CardPanel({
    title: 'Fixture Grid',
    width: columnWidth * (isMobile ? 1 : 1.5),
    height: 400,
    children: () => {
      renderFixtureGrid(fixtures, profiles, onSave);
    }
  });
  
  if (!isMobile) {
    ImGui.NextColumn();
  }
  
  // Right panel: Channel map
  CardPanel({
    title: 'Channel Map',
    width: columnWidth,
    height: 400,
    children: () => {
      renderChannelMap(fixtures, patch);
    }
  });
  
  ImGui.Columns(1);
}

function renderProfilesPanel(profiles: FixtureProfile[], fixtures: FixtureInstance[], onSave?: (patch: any) => void): void {
  ImGui.Text("Available Profiles:");
  ImGui.Separator();
  
  for (const profile of profiles) {
    if (ImGui.CollapsingHeader(`${profile.name} (${profile.id})`)) {
      ImGui.Text(`Manufacturer: ${profile.manufacturer}`);
      ImGui.Text(`Channels: ${profile.channels.length}`);
      
      // Show channel breakdown
      if (ImGui.TreeNode("Channels")) {
        for (const channel of profile.channels) {
          ImGui.Text(`  ${channel.channelIndex}. ${channel.name} (${channel.type})`);
        }
        ImGui.TreePop();
      }
      
      // Add fixture button
      const count = fixtures.filter(f => f.profileId === profile.id).length;
      ImGui.Text(`Instances: ${count}`);
      
      if (Button({ label: `+ Add ${profile.name}`, onClick: () => addFixture(profile.id, fixtures, onSave) })) {}
    }
  }
  
  ImGui.Separator();
  
  // Import profile button
  if (Button({ label: "Import Profile", width: -1 })) {
    importFixtureProfile();
  }
}

function renderFixtureGrid(fixtures: FixtureInstance[], profiles: FixtureProfile[], onSave?: (patch: any) => void): void {
  // Grid header
  ImGui.Columns(6, "fixture-grid", true);
  ImGui.Text("ID"); ImGui.NextColumn();
  ImGui.Text("Name"); ImGui.NextColumn();
  ImGui.Text("Profile"); ImGui.NextColumn();
  ImGui.Text("Address"); ImGui.NextColumn();
  ImGui.Text("Group"); ImGui.NextColumn();
  ImGui.Text("Actions"); ImGui.NextColumn();
  ImGui.Separator();
  
  for (const fixture of fixtures) {
    const profile = profiles.find(p => p.id === fixture.profileId);
    
    ImGui.Text(fixture.id.toString()); ImGui.NextColumn();
    
    // Name editor
    const nameBuf = ImGui.StringBuffer(fixture.name, 50);
    if (ImGui.InputText(`##name-${fixture.id}`, nameBuf)) {
      fixture.name = nameBuf.toString();
    }
    ImGui.NextColumn();
    
    // Profile display
    ImGui.Text(profile?.name || fixture.profileId); ImGui.NextColumn();
    
    // Address editor
    ImGui.Text(`${fixture.universe}.${fixture.address}`); ImGui.NextColumn();
    
    // Group selector
    const groups = ['BEAMS', 'WASH', 'SPOTS', 'OTHER'];
    let groupIndex = groups.indexOf(fixture.groupId);
    if (groupIndex < 0) groupIndex = 0;
    
    if (ImGui.Combo(`##group-${fixture.id}`, groupIndex, groups)) {
      fixture.groupId = groups[groupIndex];
    }
    ImGui.NextColumn();
    
    // Actions
    if (Button({ label: "Edit", onClick: () => editFixture(fixture) })) {}
    ImGui.SameLine();
    if (Button({ label: "X", onClick: () => removeFixture(fixture.id, fixtures, onSave) })) {}
    
    ImGui.NextColumn();
  }
  
  ImGui.Columns(1);
  
  // Add fixture button
  ImGui.Separator();
  if (PrimaryButton({ label: "+ Add New Fixture", width: -1, onClick: () => addNewFixture(fixtures, profiles, onSave) })) {}
}

function renderChannelMap(fixtures: FixtureInstance[], patch: any): void {
  const universe = patch.currentUniverse || 1;
  const channelsPerRow = 16;
  const rows = 32; // 512 channels / 16
  
  ImGui.Text(`Universe ${universe} Channel Map:`);
  ImGui.Separator();
  
  // Channel grid
  for (let row = 0; row < rows; row++) {
    const startChannel = row * channelsPerRow + 1;
    
    for (let col = 0; col < channelsPerRow; col++) {
      const channel = startChannel + col;
      if (channel > 512) break;
      
      // Find fixture using this channel
      const fixture = fixtures.find(f => 
        f.universe === universe && 
        f.address <= channel && 
        channel < f.address + (f.channels?.length || 0)
      );
      
      const isUsed = !!fixture;
      const color = isUsed ? new ImGui.ImVec4(0, 0.5, 1, 1) : new ImGui.ImVec4(0.3, 0.3, 0.3, 1);
      
      ImGui.PushStyleColor(ImGui.Col.Button, color);
      ImGui.PushStyleColor(ImGui.Col.ButtonHovered, isUsed ? new ImGui.ImVec4(0, 0.7, 1, 1) : new ImGui.ImVec4(0.4, 0.4, 0.4, 1));
      
      const label = isUsed ? `${channel}\n${fixture?.name}` : channel.toString();
      if (ImGui.Button(label, new ImGui.ImVec2(40, 40))) {
        selectChannel(channel, universe, fixture);
      }
      
      ImGui.PopStyleColor(2);
      
      if (col < channelsPerRow - 1) {
        ImGui.SameLine();
      }
    }
  }
  
  ImGui.Separator();
  
  // Universe selector
  ImGui.Text("Universe:");
  ImGui.SameLine();
  let universeNum = universe;
  if (ImGui.InputInt("##universe", universeNum, 1, 1)) {
    patch.currentUniverse = Math.max(1, universeNum);
  }
}

function renderPatchPanel(patch: any, fixtures: FixtureInstance[], onSave?: (patch: any) => void): void {
  CardPanel({
    title: 'Patch Properties',
    width: -1,
    height: 200,
    children: () => {
      ImGui.Columns(2, 'patch-properties', false);
      
      // Left column: Patch settings
      ImGui.Text("Patch Settings:");
      
      // Number of universes
      ImGui.Text("Universes:");
      ImGui.SameLine();
      let universes = patch.universes || 1;
      if (ImGui.InputInt("##universes", universes, 1, 1)) {
        patch.universes = Math.max(1, Math.min(universes, 4));
        onSave?.(patch);
      }
      
      // Start address
      ImGui.Text("Start Address:");
      ImGui.SameLine();
      let startAddress = patch.startAddress || 1;
      if (ImGui.InputInt("##startAddress", startAddress, 1, 8)) {
        patch.startAddress = Math.max(1, Math.min(startAddress, 512));
        onSave?.(patch);
      }
      
      // Auto-address spacing
      ImGui.Text("Auto-spacing:");
      ImGui.SameLine();
      let spacing = patch.autoSpacing || 0;
      if (ImGui.InputInt("##spacing", spacing, 1, 1)) {
        patch.autoSpacing = Math.max(0, spacing);
        onSave?.(patch);
      }
      
      ImGui.NextColumn();
      
      // Right column: Statistics
      ImGui.Text("Statistics:");
      
      const stats = calculatePatchStatistics(fixtures, patch);
      
      ImGui.Text(`Total Fixtures: ${stats.totalFixtures}`);
      ImGui.Text(`Used Channels: ${stats.usedChannels}`);
      ImGui.Text(`Free Channels: ${stats.freeChannels}`);
      ImGui.Text(`Channel Usage: ${stats.usagePercent.toFixed(1)}%`);
      
      // Group breakdown
      ImGui.Text("By Group:");
      for (const [group, count] of Object.entries(stats.byGroup)) {
        ImGui.Text(`  ${group}: ${count}`);
      }
      
      ImGui.Columns(1);
      
      // Auto-patch button
      ImGui.Separator();
      if (PrimaryButton({ label: "Auto-Patch All Fixtures", width: -1, onClick: () => autoPatchAll(fixtures, patch, onSave) })) {}
    }
  });
}

// Helper functions
function loadFixtureProfiles(): FixtureProfile[] {
  // TODO: Load from config/fixtures.json
  return [
    {
      id: 'beam8ch',
      name: 'Generic Beam 8ch',
      manufacturer: 'Generic',
      channels: [
        { name: 'dim', type: 'dim', channelIndex: 1 },
        { name: 'strobe', type: 'strobe', channelIndex: 2 },
        { name: 'colorIndex', type: 'color', channelIndex: 3 },
        { name: 'goboIndex', type: 'other', channelIndex: 4 },
        { name: 'pan', type: 'position', channelIndex: 5 },
        { name: 'tilt', type: 'position', channelIndex: 6 },
        { name: 'panFine', type: 'position', channelIndex: 7 },
        { name: 'tiltFine', type: 'position', channelIndex: 8 }
      ]
    },
    {
      id: 'wash7ch',
      name: 'Generic RGBW Wash 7ch',
      manufacturer: 'Generic',
      channels: [
        { name: 'dim', type: 'dim', channelIndex: 1 },
        { name: 'red', type: 'color', channelIndex: 2 },
        { name: 'green', type: 'color', channelIndex: 3 },
        { name: 'blue', type: 'color', channelIndex: 4 },
        { name: 'white', type: 'color', channelIndex: 5 },
        { name: 'strobe', type: 'strobe', channelIndex: 6 },
        { name: 'colorMacro', type: 'other', channelIndex: 7 }
      ]
    }
  ];
}

function loadFixtureInstances(): FixtureInstance[] {
  // TODO: Load from config/patch.json
  return [
    {
      id: 1,
      name: 'Beam 1',
      profileId: 'beam8ch',
      universe: 1,
      address: 1,
      groupId: 'BEAMS',
      channels: new Array(8).fill(0)
    },
    {
      id: 2,
      name: 'Beam 2',
      profileId: 'beam8ch',
      universe: 1,
      address: 9,
      groupId: 'BEAMS',
      channels: new Array(8).fill(0)
    },
    {
      id: 3,
      name: 'Wash 1',
      profileId: 'wash7ch',
      universe: 1,
      address: 17,
      groupId: 'WASH',
      channels: new Array(7).fill(0)
    }
  ];
}

function loadPatchConfig(): any {
  // TODO: Load from config/patch.json
  return {
    universes: 1,
    startAddress: 1,
    autoSpacing: 0,
    currentUniverse: 1
  };
}

function calculateUsedChannels(fixtures: FixtureInstance[]): number {
  let used = 0;
  for (const fixture of fixtures) {
    const profile = loadFixtureProfiles().find(p => p.id === fixture.profileId);
    used += profile?.channels.length || 0;
  }
  return used;
}

function calculatePatchStatistics(fixtures: FixtureInstance[], patch: any) {
  const totalChannels = 512 * (patch.universes || 1);
  const usedChannels = calculateUsedChannels(fixtures);
  const freeChannels = totalChannels - usedChannels;
  const usagePercent = (usedChannels / totalChannels) * 100;
  
  const byGroup: Record<string, number> = {};
  for (const fixture of fixtures) {
    byGroup[fixture.groupId] = (byGroup[fixture.groupId] || 0) + 1;
  }
  
  return {
    totalFixtures: fixtures.length,
    usedChannels,
    freeChannels,
    usagePercent,
    byGroup
  };
}

function addFixture(profileId: string, fixtures: FixtureInstance[], onSave?: (patch: any) => void): void {
  const profiles = loadFixtureProfiles();
  const profile = profiles.find(p => p.id === profileId);
  if (!profile) return;
  
  const newId = fixtures.length > 0 ? Math.max(...fixtures.map(f => f.id)) + 1 : 1;
  
  // Find next available address
  let address = 1;
  const usedAddresses = new Set<number>();
  for (const fixture of fixtures) {
    if (fixture.universe === 1) {
      const profile = profiles.find(p => p.id === fixture.profileId);
      const length =