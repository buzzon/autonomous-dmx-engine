/**
 * Slider component for numeric input
 */

import { ImGui } from "@zhobo63/imgui-ts";
import { ComponentProps } from '../types/ui';

export interface SliderProps extends ComponentProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  format?: string;
  width?: number;
  logarithmic?: boolean;
  disabled?: boolean;
}

export function Slider(props: SliderProps): boolean {
  const {
    label,
    value,
    min,
    max,
    onChange,
    format = "%.1f",
    width = 0,
    logarithmic = false,
    disabled = false,
  } = props;

  // Create a mutable reference for ImGui
  const currentValue = { value };
  
  // Set width if specified
  if (width > 0) {
    ImGui.SetNextItemWidth(width);
  }

  // Handle disabled state
  if (disabled) {
    ImGui.BeginDisabled();
  }

  let changed = false;
  
  if (logarithmic) {
    // Logarithmic slider (for values like intensity)
    changed = ImGui.SliderFloat(label, currentValue, min, max, format, ImGui.SliderFlags.Logarithmic);
  } else {
    // Linear slider
    changed = ImGui.SliderFloat(label, currentValue, min, max, format);
  }

  if (disabled) {
    ImGui.EndDisabled();
  }

  // Notify parent if value changed
  if (changed && !disabled) {
    onChange(currentValue.value);
  }

  return changed;
}

// Integer slider variant
export interface IntSliderProps extends Omit<SliderProps, 'value' | 'onChange' | 'format'> {
  value: number;
  onChange: (value: number) => void;
}

export function IntSlider(props: IntSliderProps): boolean {
  const {
    label,
    value,
    min,
    max,
    onChange,
    width = 0,
    disabled = false,
  } = props;

  // Create a mutable reference for ImGui
  const currentValue = { value: Math.round(value) };
  
  // Set width if specified
  if (width > 0) {
    ImGui.SetNextItemWidth(width);
  }

  // Handle disabled state
  if (disabled) {
    ImGui.BeginDisabled();
  }

  const changed = ImGui.SliderInt(label, currentValue, min, max, "%d");

  if (disabled) {
    ImGui.EndDisabled();
  }

  // Notify parent if value changed
  if (changed && !disabled) {
    onChange(currentValue.value);
  }

  return changed;
}

// Percentage slider (0-100%)
export function PercentSlider(props: Omit<SliderProps, 'min' | 'max' | 'format'>): boolean {
  return Slider({
    ...props,
    min: 0,
    max: 100,
    format: "%.0f%%",
  });
}

// Intensity slider (0-1 with logarithmic scale)
export function IntensitySlider(props: Omit<SliderProps, 'min' | 'max' | 'format' | 'logarithmic'>): boolean {
  return Slider({
    ...props,
    min: 0.01,
    max: 1.0,
    format: "%.2f",
    logarithmic: true,
  });
}