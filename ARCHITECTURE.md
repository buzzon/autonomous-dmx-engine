# ARCHITECTURE.md — Модули и интерфейсы

## 1. Обзор архитектуры

Система состоит из четырёх основных слоёв:

```
Input Layer → Show Brain → Lighting Engine → Output (Art-Net)
     ↑                                           
  Control/UI                                     
```

Каждый модуль общается через чётко определённые интерфейсы (TypeScript).

---

## 2. Структура проекта

```
autonomous-dmx-engine/
├── config/                # Конфигурационные JSON
│   ├── fixtures.json      # Профили приборов
│   ├── patch.json         # Патч (адреса, группы)
│   ├── layout.json        # Позиции приборов
│   ├── scenes.json        # Определения сцен
│   └── styles.json        # Палитры и стили
├── src/
│   ├── audio/             # Audio Analyzer
│   │   ├── analyzer.ts    # Основной класс AudioAnalyzer
│   │   ├── types.ts       # AudioMetrics, AudioAnalyzerState
│   │   └── utils.ts       # Вспомогательные функции (RMS, beat detect и т.п.)
│   ├── brain/             # Show Brain
│   │   ├── stateMachine.ts    # State Machine (Idle/Chill/Party)
│   │   ├── sceneSelector.ts   # Scene / Style Selector
│   │   ├── effectEngine.ts    # Effect Engine
│   │   └── types.ts           # SceneState, EffectState и т.п.
│   ├── lighting/          # Lighting Engine
│   │   ├── patch.ts       # Загрузка и модель патча
│   │   ├── fixtures.ts    # Fixture Model (профили)
│   │   ├── attributes.ts  # Attribute Layer
│   │   ├── merge.ts       # Merge логика
│   │   ├── renderer.ts    # DMX Renderer + Art-Net output
│   │   └── types.ts       # FixtureState, UniverseFrame и т.п.
│   ├── control/           # Control & UI
│   │   ├── api.ts         # REST/WebSocket API
│   │   ├── webUI/         # Статика для web-панели
│   │   └── types.ts       # UserCommand и т.п.
│   ├── utils/             # Общие утилиты
│   │   ├── logger.ts
│   │   ├── config.ts      # Загрузка конфигов
│   │   └── math.ts        # Математические хелперы
│   └── main.ts            # Точка входа, интеграция всех модулей
├── tests/                 # Тесты
│   ├── audio/
│   ├── brain/
│   └── lighting/
├── docs/                  # Дополнительная документация
├── DESIGN.md              # Дизайн-документ
├── ARCHITECTURE.md        # Этот файл
├── README.md              # Краткое описание проекта
├── package.json
└── tsconfig.json
```

---

## 3. Модули и интерфейсы

### 3.1. Input Layer

#### 3.1.1. Audio Analyzer (`src/audio/`)

**Класс:** `AudioAnalyzer`

**Интерфейсы:**

```typescript
// src/audio/types.ts

export type Mood = 'calm' | 'medium' | 'hard';

export interface AudioMetrics {
  timestamp: number;   // ms
  energy: number;      // 0..1, нормализованная энергия
  beat: boolean;       // есть ли удар в этом фрейме
  bpm: number | null;  // оценка BPM
  mood: Mood;          // грубое настроение
}

export interface AudioAnalyzerState {
  sampleRate: number;
  frameSize: number;
  hopSize: number;

  energyHistory: number[];
  energyAvg: number;
  energyPeak: number;

  lastBeats: number[];  // timestamps
  bpm: number | null;
  lastBeatTime: number;

  mood: Mood;
  moodHistory: Mood[];

  lastUpdateTimestamp: number;
  lastMoodUpdate: number;
}

export interface AudioAnalyzerConfig {
  sampleRate: number;
  frameSize: number;
  hopSize: number;
  beatThresholdCoeff: number;  // c для beat detection
  minBeatInterval: number;     // ms
  bpmSmoothingBeta: number;
  // ...
}
```

**Методы:**

```typescript
class AudioAnalyzer {
  constructor(config: AudioAnalyzerConfig);

  // Обработать фрейм аудио
  processFrame(samples: Float32Array, timestamp: number): AudioMetrics;

  // Получить текущее состояние
  getState(): AudioAnalyzerState;

  // Сброс состояния
  reset(): void;
}
```

**Зависимости:**

- Web Audio API / node audio библиотеки для получения аудио-потока.
- Утилиты из `src/utils/math.ts` (mean, std, median).

---

#### 3.1.2. System Inputs (`src/control/`)

**Интерфейсы:**

```typescript
// src/control/types.ts

export type SystemMode = 'auto' | 'chill' | 'party' | 'manual';

export interface UserCommand {
  type: 'setMode' | 'setIntensity' | 'setBlackout' | 'setStyle';
  payload: any;
  timestamp: number;
}

export interface SystemState {
  mode: SystemMode;
  globalIntensity: number;  // 0..1
  blackout: boolean;
  activeStyleId?: string;
}
```

---

### 3.2. Show Brain (`src/brain/`)

#### 3.2.1. State Machine (`src/brain/stateMachine.ts`)

**Класс:** `StateMachine`

**Интерфейсы:**

```typescript
// src/brain/types.ts

export type BrainState = 'Idle' | 'Chill' | 'Party' | 'Manual';

export interface StateMachineConfig {
  energyThresholdLow: number;   // переход Idle → Chill
  energyThresholdHigh: number;  // переход Chill → Party
  hysteresis: number;           // гистерезис для стабильности
}
```

**Логика переходов:**

1. Если `systemState.mode === 'manual'`: возвращается `BrainState.Manual`
2. Если `systemState.mode === 'chill'`: возвращается `BrainState.Chill` (принудительный режим)
3. Если `systemState.mode === 'party'`: возвращается `BrainState.Party` (принудительный режим)
4. Если `systemState.mode === 'auto'`: автоматический выбор на основе `AudioMetrics.energy`:
   - `energy < energyThresholdLow`: `Idle`
   - `energyThresholdLow ≤ energy < energyThresholdHigh`: `Chill`
   - `energy ≥ energyThresholdHigh`: `Party`

**Методы:**

```typescript
class StateMachine {
  constructor(config: StateMachineConfig);

  // Обновить состояние по метрикам и системному режиму
  update(metrics: AudioMetrics, systemState: SystemState): BrainState;

  getCurrentState(): BrainState;
}
```

---

#### 3.2.2. Scene Selector (`src/brain/sceneSelector.ts`)

**Класс:** `SceneSelector`

**Интерфейсы:**

```typescript
// src/brain/types.ts

export interface SceneState {
  sceneId: string;
  paletteId: string;
  baseIntensity: number;  // 0..1
  effectDescriptors: {
    [groupId: string]: {
      dimEffectType?: 'none' | 'chase' | 'pulse';
      posEffectType?: 'none' | 'circle' | 'swing';
      colorEffectType?: 'none' | 'cycle';
      // дополнительные параметры
    }
  };
}

export interface SceneDefinition {
  id: string;
  name: string;
  allowedStates: BrainState[];  // в каких состояниях доступна
  paletteId: string;
  baseIntensity: number;
  effectDescriptors: {
    [groupId: string]: {
      dimEffectType?: 'none' | 'chase' | 'pulse';
      posEffectType?: 'none' | 'circle' | 'swing';
      colorEffectType?: 'none' | 'cycle';
    }
  };
}
```

**Методы:**

```typescript
class SceneSelector {
  constructor(scenes: SceneDefinition[]);

  // Выбрать сцену на основе состояния, метрик и истории
  selectScene(
    state: BrainState,
    metrics: AudioMetrics,
    history: string[]  // последние sceneId
  ): SceneState;
}
```

---

#### 3.2.3. Effect Engine (`src/brain/effectEngine.ts`)

**Класс:** `EffectEngine`

**Интерфейсы:**

```typescript
// src/brain/types.ts

export interface DimEffectState {
  type: 'none' | 'chase' | 'pulse';
  speed: number;
  depth: number;
  phaseOffset: number;
}

export interface PosEffectState {
  type: 'none' | 'circle' | 'swing';
  speed: number;
  size: number;
  centerPan: number;
  centerTilt: number;
}

export interface GroupEffectState {
  groupId: string;
  dimEffect: DimEffectState;
  posEffect: PosEffectState;
  // colorEffect, etc.
}
```

**Методы:**

```typescript
class EffectEngine {
  // Генерирует параметры эффектов для каждой группы
  generateEffects(
    sceneState: SceneState,
    metrics: AudioMetrics,
    timestamp: number
  ): GroupEffectState[];
}
```

---

### 3.3. Lighting Engine (`src/lighting/`)

#### 3.3.1. Patch & Fixture Model (`src/lighting/patch.ts`, `fixtures.ts`)

**Интерфейсы:**

```typescript
// src/lighting/types.ts

export interface ChannelDefinition {
  name: string;        // 'dim', 'pan', 'tilt', 'colorIndex', etc.
  type: 'dim' | 'position' | 'color' | 'strobe' | 'other';
  channelIndex: number;  // 1-based (DMX channel)
  fineChannelIndex?: number;
  range?: [number, number];  // DMX диапазон для этого значения
}

export interface FixtureProfile {
  id: string;
  name: string;
  manufacturer: string;
  channels: ChannelDefinition[];
  colorMap?: { [index: number]: number };  // colorIndex -> DMX value
  // goboMap, etc.
}

export interface FixtureInstance {
  id: string;
  name: string;
  universe: number;
  startAddress: number;  // 1-based
  profileId: string;
  groupId: string;
  x?: number;
  y?: number;
  z?: number;
}
```

**Методы:**

```typescript
class PatchManager {
  loadProfiles(path: string): void;
  loadPatch(path: string): void;
  loadLayout(path: string): void;

  getFixtures(): FixtureInstance[];
  getFixturesByGroup(groupId: string): FixtureInstance[];
  getProfile(profileId: string): FixtureProfile;
}
```

---

#### 3.3.2. Attribute Layer (`src/lighting/attributes.ts`)

**Интерфейсы:**

```typescript
// src/lighting/types.ts

export interface FixtureState {
  fixtureId: string;
  dim: number;         // 0..1
  colorIndex: number;
  panNorm: number;     // -1..1
  tiltNorm: number;
  strobe: number;      // 0..1
  // ...
}
```

**Методы:**

```typescript
class AttributeManager {
  // Установить атрибуты для fixture
  setAttributes(fixtureId: string, attrs: Partial<FixtureState>): void;

  // Получить текущие атрибуты
  getAttributes(fixtureId: string): FixtureState;

  // Применить эффекты к группе
  applyGroupEffect(groupId: string, effect: GroupEffectState): void;
}
```

---

#### 3.3.3. Merge (`src/lighting/merge.ts`)

**Класс:** `MergeEngine`

**Методы:**

```typescript
class MergeEngine {
  // Объединить base, effects, overrides
  merge(
    baseStates: Map<string, FixtureState>,
    effectStates: Map<string, Partial<FixtureState>>,
    overrides: { globalDim: number; blackout: boolean }
  ): Map<string, FixtureState>;
}
```

---

#### 3.3.4. DMX Renderer (`src/lighting/renderer.ts`)

**Интерфейсы:**

```typescript
// src/lighting/types.ts

export interface UniverseFrame {
  universe: number;
  data: Uint8Array;  // 512 bytes
}
```

**Класс:** `DMXRenderer`

**Методы:**

```typescript
class DMXRenderer {
  constructor(patchManager: PatchManager, artnetConfig: any);

  // Рендерит атрибуты в DMX и отправляет Art-Net
  render(fixtureStates: Map<string, FixtureState>): void;

  // Получить frame для отладки
  getUniverseFrames(): UniverseFrame[];
}
```

**Зависимости:**

- npm-пакет `artnet` или `artnet-node` для отправки UDP.

---

### 3.4. Control & UI (`src/control/`)

#### 3.4.1. API (`src/control/api.ts`)

**Класс:** `ControlAPI`

**Методы:**

```typescript
class ControlAPI {
  constructor(port: number);

  start(): void;

  // Handlers для REST/WebSocket
  onCommand(handler: (cmd: UserCommand) => void): void;

  // Отправка состояния клиентам
  broadcastState(state: any): void;
}
```

**Endpoints (REST):**

- `GET /state` — текущее состояние системы.
- `POST /mode` — изменить режим (`{ mode: 'chill' }`).
- `POST /intensity` — установить global intensity (`{ value: 0.8 }`).
- `POST /blackout` — вкл/выкл blackout (`{ on: true }`).

**WebSocket:**

- Двусторонняя связь для реального времени (обновление метрик, команды).

---

### 3.5. Main (`src/main.ts`)

Точка входа, связывает все модули:

```typescript
// Псевдокод
import { AudioAnalyzer } from './audio/analyzer';
import { StateMachine, SceneSelector, EffectEngine } from './brain/';
import { PatchManager, AttributeManager, MergeEngine, DMXRenderer } from './lighting/';
import { ControlAPI } from './control/api';

// Инициализация
const audioAnalyzer = new AudioAnalyzer(audioConfig);
const stateMachine = new StateMachine(stateConfig);
const sceneSelector = new SceneSelector(scenes);
const effectEngine = new EffectEngine();

const patchManager = new PatchManager();
patchManager.loadProfiles('./config/fixtures.json');
patchManager.loadPatch('./config/patch.json');
patchManager.loadLayout('./config/layout.json');

const attributeManager = new AttributeManager(patchManager);
const mergeEngine = new MergeEngine();
const dmxRenderer = new DMXRenderer(patchManager, artnetConfig);

const controlAPI = new ControlAPI(8080);

// Главный цикл (упрощённо)
let systemState: SystemState = { mode: 'auto', globalIntensity: 1.0, blackout: false };

controlAPI.onCommand((cmd) => {
  // Обработка команд от UI
  if (cmd.type === 'setMode') systemState.mode = cmd.payload.mode;
  // ...
});

setInterval(() => {
  // 1) Получить аудио-фрейм и метрики
  const metrics = audioAnalyzer.processFrame(audioFrame, Date.now());

  // 2) Обновить State Machine
  const brainState = stateMachine.update(metrics, systemState);

  // 3) Выбрать сцену
  const sceneState = sceneSelector.selectScene(brainState, metrics, sceneHistory);

  // 4) Сгенерировать эффекты
  const groupEffects = effectEngine.generateEffects(sceneState, metrics, Date.now());

  // 5) Применить к атрибутам
  for (const effect of groupEffects) {
    attributeManager.applyGroupEffect(effect.groupId, effect);
  }

  // 6) Merge
  const baseStates = attributeManager.getAll();
  const effectStates = attributeManager.getEffects();
  const finalStates = mergeEngine.merge(baseStates, effectStates, {
    globalDim: systemState.globalIntensity,
    blackout: systemState.blackout
  });

  // 7) Render DMX
  dmxRenderer.render(finalStates);

  // 8) Broadcast state to UI
  controlAPI.broadcastState({
    metrics,
    brainState,
    sceneState,
    systemState
  });

}, 40);  // 25 FPS
```

---

## 4. Потоки данных

### 4.1. Audio → Brain → Lighting

```
Audio Input
    ↓
AudioAnalyzer.processFrame()
    ↓
AudioMetrics { energy, beat, bpm, mood }
    ↓
StateMachine.update()
    ↓
BrainState (Idle/Chill/Party)
    ↓
SceneSelector.selectScene()
    ↓
SceneState
    ↓
EffectEngine.generateEffects()
    ↓
GroupEffectState[]
    ↓
AttributeManager.applyGroupEffect()
    ↓
FixtureState (виртуальные атрибуты)
    ↓
MergeEngine.merge()
    ↓
Merged FixtureState
    ↓
DMXRenderer.render()
    ↓
Art-Net UDP → DMX приборы
```

### 4.2. User → System

```
Web UI / OSC
    ↓
UserCommand
    ↓
ControlAPI
    ↓
SystemState update
    ↓
влияет на StateMachine / Merge
```

---

## 5. Конфигурационные файлы

### 5.1. `config/fixtures.json`

```json
{
  "profiles": [
    {
      "id": "beam8ch",
      "name": "Generic Beam 8ch",
      "manufacturer": "Generic",
      "channels": [
        { "name": "dim", "type": "dim", "channelIndex": 1 },
        { "name": "strobe", "type": "strobe", "channelIndex": 2 },
        { "name": "colorIndex", "type": "color", "channelIndex": 3 },
        { "name": "goboIndex", "type": "other", "channelIndex": 4 },
        { "name": "pan", "type": "position", "channelIndex": 5 },
        { "name": "tilt", "type": "position", "channelIndex": 6 },
        { "name": "panFine", "type": "position", "channelIndex": 7 },
        { "name": "tiltFine", "type": "position", "channelIndex": 8 }
      ],
      "colorMap": {
        "0": 0,
        "1": 32,
        "2": 64,
        "3": 96
      }
    },
    {
      "id": "wash7ch",
      "name": "Generic RGBW Wash 7ch",
      "manufacturer": "Generic",
      "channels": [
        { "name": "dim", "type": "dim", "channelIndex": 1 },
        { "name": "red", "type": "color", "channelIndex": 2 },
        { "name": "green", "type": "color", "channelIndex": 3 },
        { "name": "blue", "type": "color", "channelIndex": 4 },
        { "name": "white", "type": "color", "channelIndex": 5 },
        { "name": "strobe", "type": "strobe", "channelIndex": 6 },
        { "name": "colorMacro", "type": "other", "channelIndex": 7 }
      ]
    }
  ]
}
```

### 5.2. `config/patch.json`

```json
{
  "fixtures": [
    {
      "id": "beam1",
      "name": "Beam 1",
      "universe": 1,
      "startAddress": 1,
      "profileId": "beam8ch",
      "groupId": "BEAMS"
    },
    {
      "id": "beam2",
      "name": "Beam 2",
      "universe": 1,
      "startAddress": 9,
      "profileId": "beam8ch",
      "groupId": "BEAMS"
    },
    {
      "id": "wash1",
      "name": "Wash 1",
      "universe": 1,
      "startAddress": 17,
      "profileId": "wash7ch",
      "groupId": "WASH"
    },
    {
      "id": "wash2",
      "name": "Wash 2",
      "universe": 1,
      "startAddress": 24,
      "profileId": "wash7ch",
      "groupId": "WASH"
    }
  ]
}
```

### 5.3. `config/layout.json`

```json
{
  "fixtures": [
    { "id": "beam1", "x": -0.5, "y": 0.0, "z": 2.5, "zone": "front" },
    { "id": "beam2", "x": 0.5, "y": 0.0, "z": 2.5, "zone": "front" },
    { "id": "wash1", "x": -1.0, "y": -1.0, "z": 3.0, "zone": "back" },
    { "id": "wash2", "x": 1.0, "y": -1.0, "z": 3.0, "zone": "back" }
  ]
}
```

### 5.4. `config/scenes.json`

```json
{
  "scenes": [
    {
      "id": "IdleWarmStatic",
      "name": "Idle Warm Static",
      "allowedStates": ["Idle"],
      "paletteId": "warm",
      "baseIntensity": 0.3,
      "effectDescriptors": {
        "BEAMS": {
          "dimEffectType": "none",
          "posEffectType": "none"
        },
        "WASH": {
          "dimEffectType": "none"
        }
      }
    },
    {
      "id": "ChillSoftMovement",
      "name": "Chill Soft Movement",
      "allowedStates": ["Chill"],
      "paletteId": "cool",
      "baseIntensity": 0.6,
      "effectDescriptors": {
        "BEAMS": {
          "dimEffectType": "none",
          "posEffectType": "circle"
        },
        "WASH": {
          "dimEffectType": "pulse"
        }
      }
    },
    {
      "id": "PartyBeams",
      "name": "Party Beams",
      "allowedStates": ["Party"],
      "paletteId": "party",
      "baseIntensity": 0.9,
      "effectDescriptors": {
        "BEAMS": {
          "dimEffectType": "pulse",
          "posEffectType": "circle"
        },
        "WASH": {
          "dimEffectType": "chase"
        }
      }
    }
  ]
}
```

### 5.5. `config/styles.json`

```json
{
  "palettes": [
    {
      "id": "warm",
      "name": "Warm",
      "colors": [0, 1],
      "description": "Тёплые цвета для спокойных сцен"
    },
    {
      "id": "cool",
      "name": "Cool",
      "colors": [2, 3],
      "description": "Холодные цвета"
    },
    {
      "id": "party",
      "name": "Party Mix",
      "colors": [1, 2, 3],
      "description": "Яркие цвета для энергичных сцен"
    }
  ]
}
```

---

## 6. Тестирование

### 6.1. Unit-тесты

- `tests/audio/analyzer.test.ts` — тесты AudioAnalyzer (beat detection, BPM, энергия).
- `tests/brain/stateMachine.test.ts` — переходы состояний.
- `tests/lighting/renderer.test.ts` — корректность DMX-генерации по профилям.

### 6.2. Integration-тесты

- Полный цикл: mock audio → метрики → сцены → DMX output.

---

## 7. Развёртывание

- Один сервер (NUC/RPi/PC) под управлением Node.js.
- Art-Net по сети к DMX-нодам/приборам.
- Web-панель доступна по HTTP (например, `http://localhost:8080`).

---

**Версия:** 0.1  
**Дата:** 2026-02-09  
**Статус:** Живой документ, дополняется по ходу разработки.
