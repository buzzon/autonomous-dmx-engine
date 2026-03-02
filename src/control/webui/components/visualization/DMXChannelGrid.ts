/**
 * DMXChannelGrid - сетка DMX каналов с интерактивными элементами
 */

import { ImGui } from "@zhobo63/imgui-ts";
import { store } from '../../store/store';

export interface DMXChannelGridProps {
  /** Начальный канал (1-based) */
  startChannel?: number;
  /** Конечный канал (1-based) */
  endChannel?: number;
  /** Количество каналов в строке */
  channelsPerRow?: number;
  /** Ширина сетки */
  width?: number;
  /** Высота ячейки канала */
  cellHeight?: number;
  /** Показывать значения */
  showValues?: boolean;
  /** Показывать номера каналов */
  showChannelNumbers?: boolean;
  /** Режим редактирования */
  editable?: boolean;
  /** Цветовая схема */
  colorScheme?: 'intensity' | 'hue' | 'grayscale';
  /** Заголовок */
  title?: string;
}

export function DMXChannelGrid(props: DMXChannelGridProps): void {
  const {
    startChannel = 1,
    endChannel = 64,
    channelsPerRow = 16,
    width = -1,
    cellHeight = 40,
    showValues = true,
    showChannelNumbers = true,
    editable = true,
    colorScheme = 'intensity',
    title = 'DMX Channels'
  } = props;

  // Получаем данные из store
  const state = store.getState();
  const channels = state.realtime.dmxData.channels;
  
  // Рассчитываем отображаемые каналы
  const displayStart = Math.max(1, startChannel);
  const displayEnd = Math.min(512, endChannel);
  const channelCount = displayEnd - displayStart + 1;
  
  // Используем доступную ширину если не указана
  const availWidth = width > 0 ? width : ImGui.GetContentRegionAvail().x;
  const cellWidth = availWidth / channelsPerRow - 2;
  
  // Рендерим заголовок если есть
  if (title) {
    ImGui.Text(title);
    ImGui.SameLine();
    ImGui.TextDisabled(`(${displayStart}-${displayEnd})`);
  }
  
  // Контейнер для сетки
  const cursorPos = ImGui.GetCursorScreenPos();
  const drawList = ImGui.GetWindowDrawList();
  
  // Рисуем сетку каналов
  let channelIndex = 0;
  for (let row = 0; row < Math.ceil(channelCount / channelsPerRow); row++) {
    for (let col = 0; col < channelsPerRow; col++) {
      if (channelIndex >= channelCount) break;
      
      const channelNum = displayStart + channelIndex;
      const channelValue = channels[channelNum - 1] || 0;
      
      // Позиция ячейки
      const x = cursorPos.x + col * (cellWidth + 2);
      const y = cursorPos.y + row * (cellHeight + 2);
      
      // Рисуем ячейку канала
      renderChannelCell(
        drawList,
        x, y,
        cellWidth, cellHeight,
        channelNum,
        channelValue,
        colorScheme,
        showChannelNumbers,
        showValues,
        editable
      );
      
      channelIndex++;
    }
  }
  
  // Перемещаем курсор после сетки
  const totalRows = Math.ceil(channelCount / channelsPerRow);
  ImGui.Dummy(new ImGui.ImVec2(availWidth, totalRows * (cellHeight + 2)));
  
  // Элементы управления сеткой
  renderGridControls(displayStart, displayEnd, channelsPerRow);
}

function renderChannelCell(
  drawList: any,
  x: number, y: number,
  width: number, height: number,
  channelNum: number,
  value: number,
  colorScheme: string,
  showChannelNumber: boolean,
  showValue: boolean,
  editable: boolean
): void {
  // Цвет фона в зависимости от значения
  const backgroundColor = getChannelColor(value, colorScheme);
  const borderColor = new ImGui.ImVec4(0.3, 0.3, 0.3, 0.5);
  
  // Рисуем фон
  drawList.AddRectFilled(
    new ImGui.ImVec2(x, y),
    new ImGui.ImVec2(x + width, y + height),
    ImGui.ColorConvertFloat4ToU32(backgroundColor)
  );
  
  // Рисуем границу
  drawList.AddRect(
    new ImGui.ImVec2(x, y),
    new ImGui.ImVec2(x + width, y + height),
    ImGui.ColorConvertFloat4ToU32(borderColor)
  );
  
  // Номер канала
  if (showChannelNumber) {
    const channelText = `${channelNum}`;
    const textWidth = channelText.length * 7;
    const textX = x + (width - textWidth) / 2;
    const textY = y + 5;
    
    drawList.AddText(
      new ImGui.ImVec2(textX, textY),
      ImGui.ColorConvertFloat4ToU32(new ImGui.ImVec4(1, 1, 1, 0.8)),
      channelText
    );
  }
  
  // Значение
  if (showValue) {
    const valueText = `${Math.round(value * 100)}%`;
    const valueWidth = valueText.length * 6;
    const valueX = x + (width - valueWidth) / 2;
    const valueY = y + height - 15;
    
    drawList.AddText(
      new ImGui.ImVec2(valueX, valueY),
      ImGui.ColorConvertFloat4ToU32(new ImGui.ImVec4(1, 1, 1, 1)),
      valueText
    );
  }
  
  // Индикатор уровня
  const levelHeight = value * (height - 20);
  const levelY = y + height - levelHeight - 10;
  
  if (value > 0) {
    const levelColor = getLevelColor(value, colorScheme);
    drawList.AddRectFilled(
      new ImGui.ImVec2(x + 2, levelY),
      new ImGui.ImVec2(x + width - 2, y + height - 10),
      ImGui.ColorConvertFloat4ToU32(levelColor)
    );
  }
  
  // Обработка взаимодействия
  if (editable) {
    // Проверяем hover
    const mousePos = ImGui.GetMousePos();
    const isHovered = 
      mousePos.x >= x && mousePos.x <= x + width &&
      mousePos.y >= y && mousePos.y <= y + height;
    
    if (isHovered) {
      // Подсветка при наведении
      drawList.AddRect(
        new ImGui.ImVec2(x, y),
        new ImGui.ImVec2(x + width, y + height),
        ImGui.ColorConvertFloat4ToU32(new ImGui.ImVec4(1, 1, 1, 0.5)),
        0, 0, 2
      );
      
      // Tooltip
      if (ImGui.IsItemHovered()) {
        ImGui.BeginTooltip();
        ImGui.Text(`Channel ${channelNum}`);
        ImGui.Text(`Value: ${(value * 255).toFixed(0)} (${(value * 100).toFixed(1)}%)`);
        ImGui.Text("Click and drag to adjust");
        ImGui.EndTooltip();
      }
      
      // Обработка клика и drag для изменения значения
      if (ImGui.IsMouseDown(0)) {
        const relativeY = mousePos.y - y;
        const newValue = 1 - (relativeY / height);
        const clampedValue = Math.max(0, Math.min(1, newValue));
        
        // Обновляем значение в store
        store.updateDMXChannel(channelNum, clampedValue);
        
        // Отправляем команду на сервер
        // socketManager.sendCommand('setDMXChannel', { channel: channelNum, value: clampedValue });
      }
    }
  }
}

function getChannelColor(value: number, scheme: string): ImGui.ImVec4 {
  switch (scheme) {
    case 'hue':
      // Цветовая схема на основе hue
      const hue = value * 0.7; // 0-0.7 диапазон hue
      return hueToRgb(hue, 0.3, 0.2);
      
    case 'grayscale':
      // Градации серого
      const intensity = 0.1 + value * 0.2;
      return new ImGui.ImVec4(intensity, intensity, intensity, 1.0);
      
    case 'intensity':
    default:
      // Интенсивность (зеленый -> желтый -> красный)
      if (value < 0.3) {
        return new ImGui.ImVec4(0.1, 0.2, 0.1, 1.0); // Темно-зеленый
      } else if (value < 0.7) {
        return new ImGui.ImVec4(0.2, 0.2, 0.1, 1.0); // Темно-желтый
      } else {
        return new ImGui.ImVec4(0.2, 0.1, 0.1, 1.0); // Темно-красный
      }
  }
}

function getLevelColor(value: number, scheme: string): ImGui.ImVec4 {
  switch (scheme) {
    case 'hue':
      const hue = value * 0.7;
      return hueToRgb(hue, 0.8, 0.8);
      
    case 'grayscale':
      const intensity = 0.5 + value * 0.5;
      return new ImGui.ImVec4(intensity, intensity, intensity, 1.0);
      
    case 'intensity':
    default:
      if (value < 0.3) {
        return new ImGui.ImVec4(0.0, 0.8, 0.0, 1.0); // Зеленый
      } else if (value < 0.7) {
        return new ImGui.ImVec4(0.8, 0.8, 0.0, 1.0); // Желтый
      } else {
        return new ImGui.ImVec4(0.8, 0.0, 0.0, 1.0); // Красный
      }
  }
}

function hueToRgb(hue: number, saturation: number, value: number): ImGui.ImVec4 {
  // Конвертация HSV to RGB
  const h = hue * 6;
  const s = saturation;
  const v = value;
  
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

function renderGridControls(startChannel: number, endChannel: number, channelsPerRow: number): void {
  ImGui.Spacing();
  
  // Элементы управления диапазоном
  ImGui.Text("Channel Range:");
  ImGui.SameLine();
  
  // Быстрые диапазоны
  const ranges = [
    { label: "1-64", start: 1, end: 64 },
    { label: "65-128", start: 65, end: 128 },
    { label: "129-192", start: 129, end: 192 },
    { label: "193-256", start: 193, end: 256 },
    { label: "257-320", start: 257, end: 320 },
    { label: "321-384", start: 321, end: 384 },
    { label: "385-448", start: 385, end: 448 },
    { label: "449-512", start: 449, end: 512 },
  ];
  
  for (const range of ranges) {
    if (ImGui.Button(range.label)) {
      // Здесь можно обновить состояние для изменения диапазона
      // В реальном приложении это изменило бы props компонента
    }
    ImGui.SameLine();
  }
  
  ImGui.NewLine();
  
  // Управление плотностью
  ImGui.Text("Density:");
  ImGui.SameLine();
  
  const densities = [8, 16, 24, 32];
  for (const density of densities) {
    if (ImGui.Button(`${density}/row`)) {
      // Изменить channelsPerRow
    }
    ImGui.SameLine();
  }
  
  ImGui.NewLine();
  
  // Статистика
  const state = store.getState();
  const channels = state.realtime.dmxData.channels;
  const activeChannels = channels.filter(v => v > 0.01).length;
  const avgValue = channels.reduce((a, b) => a + b, 0) / channels.length;
  
  ImGui.Text(`Active: ${activeChannels}/512 | Avg: ${(avgValue * 100).toFixed(1)}%`);
  
  // Кнопки действий
  if (ImGui.Button("Zero All")) {
    // Обнулить все каналы
    for (let i = 1; i <= 512; i++) {
      store.updateDMXChannel(i, 0);
    }
  }
  
  ImGui.SameLine();
  
  if (ImGui.Button("Full All")) {
    // Установить все каналы в максимум
    for (let i = 1; i <= 512; i++) {
      store.updateDMXChannel(i, 1);
    }
  }
  
  ImGui.SameLine();
  
  if (ImGui.Button("Test Pattern")) {
    // Тестовый паттерн
    for (let i = 1; i <= 512; i++) {
      const value = Math.sin(i * 0.1) * 0.5 + 0.5;
      store.updateDMXChannel(i, value);
    }
  }
}

// Компонент для быстрого редактирования отдельного канала
export function DMXChannelSlider(props: {
  channel: number;
  width?: number;
  height?: number;
  showLabel?: boolean;
}): void {
  const { channel, width = 200, height = 20, showLabel = true } = props;
  
  const state = store.getState();
  const value = state.realtime.dmxData.channels[channel - 1] || 0;
  
  if (showLabel) {
    ImGui.Text(`Ch ${channel}:`);
    ImGui.SameLine();
  }
  
  // Слайдер для редактирования значения
  // Используем массив для совместимости с ImGui API
  const sliderValue = [value];
  if (ImGui.SliderFloat(`##channel-${channel}`, sliderValue as any, 0, 1, "%.3f")) {
    store.updateDMXChannel(channel, sliderValue[0]);
  }
  
  // Визуализация значения
  const cursorPos = ImGui.GetCursorScreenPos();
  const drawList = ImGui.GetWindowDrawList();
  
  const barWidth = value * (width - 50);
  const barHeight = 5;
  
  drawList.AddRectFilled(
    cursorPos,
    new ImGui.ImVec2(cursorPos.x + barWidth, cursorPos.y + barHeight),
    ImGui.ColorConvertFloat4ToU32(new ImGui.ImVec4(0, 1, 0, 1))
  );
  
  drawList.AddRect(
    cursorPos,
    new ImGui.ImVec2(cursorPos.x + width - 50, cursorPos.y + barHeight),
    ImGui.ColorConvertFloat4ToU32(new ImGui.ImVec4(0.5, 0.5, 0.5, 0.5))
  );
  
  ImGui.Dummy(new ImGui.ImVec2(0, barHeight + 5));
}