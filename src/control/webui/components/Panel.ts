/**
 * Panel component for grouping UI elements
 */

import { ImGui } from "@zhobo63/imgui-ts";
import { ComponentProps } from '../types/ui';

export interface PanelProps extends ComponentProps {
  title?: string;
  children?: () => void;
  open?: boolean;
  flags?: number;
  width?: number;
  height?: number;
  padding?: number;
  showBorder?: boolean;
}

export function Panel(props: PanelProps): boolean {
  const {
    title = '',
    children,
    open = true,
    flags = 0,
    width = 0,
    height = 0,
    padding = 8,
    showBorder = true,
  } = props;

  // Set window size if specified
  if (width > 0 || height > 0) {
    const size = new ImGui.ImVec2(
      width > 0 ? width : 0,
      height > 0 ? height : 0
    );
    ImGui.SetNextWindowSize(size, ImGui.Cond.FirstUseEver);
  }

  // Set padding
  if (padding !== 8) {
    ImGui.PushStyleVar(ImGui.StyleVar.WindowPadding, new ImGui.ImVec2(padding, padding));
  }

  // Border styling
  if (!showBorder) {
    ImGui.PushStyleVar(ImGui.StyleVar.WindowBorderSize, 0);
  }

  // Begin the window/panel
  const isOpen = ImGui.Begin(title, open, flags);

  // Restore style vars
  if (!showBorder) {
    ImGui.PopStyleVar();
  }
  if (padding !== 8) {
    ImGui.PopStyleVar();
  }

  // Render children if panel is open
  if (isOpen && children) {
    children();
  }

  // End the panel
  ImGui.End();

  return isOpen;
}

// Convenience panel types
export function CardPanel(props: Omit<PanelProps, 'flags' | 'showBorder'>): boolean {
  return Panel({
    ...props,
    flags: ImGui.WindowFlags.NoTitleBar | 
           ImGui.WindowFlags.NoResize | 
           ImGui.WindowFlags.NoMove |
           ImGui.WindowFlags.NoScrollbar,
    showBorder: true,
    padding: 12,
  });
}

export function CollapsiblePanel(props: Omit<PanelProps, 'flags'>): boolean {
  return Panel({
    ...props,
    flags: ImGui.WindowFlags.NoResize | 
           ImGui.WindowFlags.NoMove |
           ImGui.WindowFlags.NoScrollbar,
  });
}

export function ModalPanel(props: Omit<PanelProps, 'flags'>): boolean {
  return Panel({
    ...props,
    flags: ImGui.WindowFlags.NoResize | 
           ImGui.WindowFlags.NoMove |
           ImGui.WindowFlags.NoCollapse |
           ImGui.WindowFlags.Modal,
  });
}