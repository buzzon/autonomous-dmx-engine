/**
 * Button component for ImGui-based UI
 * Simplified version that matches the actual ImGui API
 */

import { ImGui } from "@zhobo63/imgui-ts";
import { ComponentProps } from '../types/ui';

export interface ButtonProps extends ComponentProps {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  width?: number;
}

export function Button(props: ButtonProps): boolean {
  const {
    label,
    onClick,
    variant = 'primary',
    disabled = false,
    width = 0,
  } = props;

  // Set button color based on variant
  const buttonColor = getButtonColor(variant);
  
  // Save current style
  ImGui.PushStyleColor(ImGui.Col.Button, buttonColor.normal);
  ImGui.PushStyleColor(ImGui.Col.ButtonHovered, buttonColor.hover);
  ImGui.PushStyleColor(ImGui.Col.ButtonActive, buttonColor.active);
  ImGui.PushStyleColor(ImGui.Col.Text, buttonColor.text);

  // For disabled state, reduce opacity
  if (disabled) {
    ImGui.PushStyleVar(ImGui.StyleVar.Alpha, 0.5);
  }

  // Render button - ImGui.Button takes only label
  // Width can be set with SetNextItemWidth before the button
  if (width > 0) {
    ImGui.SetNextItemWidth(width);
  }

  const clicked = ImGui.Button(label);

  if (disabled) {
    ImGui.PopStyleVar();
  }

  // Restore style colors
  ImGui.PopStyleColor(4);

  // Handle click
  if (clicked && !disabled) {
    onClick();
  }

  return clicked;
}

function getButtonColor(variant: string) {
  switch (variant) {
    case 'primary':
      return {
        normal: new ImGui.ImVec4(0.2, 0.5, 0.8, 1.0),
        hover: new ImGui.ImVec4(0.3, 0.6, 0.9, 1.0),
        active: new ImGui.ImVec4(0.1, 0.4, 0.7, 1.0),
        text: new ImGui.ImVec4(1.0, 1.0, 1.0, 1.0),
      };
    case 'secondary':
      return {
        normal: new ImGui.ImVec4(0.4, 0.4, 0.4, 1.0),
        hover: new ImGui.ImVec4(0.5, 0.5, 0.5, 1.0),
        active: new ImGui.ImVec4(0.3, 0.3, 0.3, 1.0),
        text: new ImGui.ImVec4(1.0, 1.0, 1.0, 1.0),
      };
    case 'danger':
      return {
        normal: new ImGui.ImVec4(0.8, 0.2, 0.2, 1.0),
        hover: new ImGui.ImVec4(0.9, 0.3, 0.3, 1.0),
        active: new ImGui.ImVec4(0.7, 0.1, 0.1, 1.0),
        text: new ImGui.ImVec4(1.0, 1.0, 1.0, 1.0),
      };
    case 'success':
      return {
        normal: new ImGui.ImVec4(0.2, 0.7, 0.2, 1.0),
        hover: new ImGui.ImVec4(0.3, 0.8, 0.3, 1.0),
        active: new ImGui.ImVec4(0.1, 0.6, 0.1, 1.0),
        text: new ImGui.ImVec4(1.0, 1.0, 1.0, 1.0),
      };
    default:
      return {
        normal: new ImGui.ImVec4(0.2, 0.5, 0.8, 1.0),
        hover: new ImGui.ImVec4(0.3, 0.6, 0.9, 1.0),
        active: new ImGui.ImVec4(0.1, 0.4, 0.7, 1.0),
        text: new ImGui.ImVec4(1.0, 1.0, 1.0, 1.0),
      };
  }
}

// Convenience functions for common button types
export function PrimaryButton(props: Omit<ButtonProps, 'variant'>): boolean {
  return Button({ ...props, variant: 'primary' });
}

export function DangerButton(props: Omit<ButtonProps, 'variant'>): boolean {
  return Button({ ...props, variant: 'danger' });
}

export function SuccessButton(props: Omit<ButtonProps, 'variant'>): boolean {
  return Button({ ...props, variant: 'success' });
}

// Small and large button helpers
export function SmallButton(props: ButtonProps): boolean {
  return Button({ ...props, width: 80 });
}

export function LargeButton(props: ButtonProps): boolean {
  return Button({ ...props, width: 200 });
}