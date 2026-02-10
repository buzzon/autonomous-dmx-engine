# ARCHITECTURE.md — Модули и интерфейсы (Улучшенная версия)

## 1. Обзор архитектуры

Система построена по принципу фасадов для снижения связности и повышения гибкости:

```
┌─────────────────────────────────────────────────────────────┐
│                       Engine (фасад)                        │
├──────────────┬────────────────┬────────────────┬────────────┤
│ AudioAnalyzer│   BrainFacade  │ LightingFacade │ ControlAPI │
│              │  ┌──────────┐  │  ┌──────────┐  │            │
│              │  │State     │  │  │Patch     │  │            │
│              │  │Machine   │  │  │Manager   │  │            │
│              │  ├──────────┤  │  ├──────────┤  │            │
│              │  │Scene     │  │  │Attribute │  │            │
│              │  │Selector  │  │  │Manager   │  │            │
│              │  ├──────────┤  │  ├──────────┤  │            │
│              │  │Effect    │  │  │Merge     │  │            │
│              │  │Engine    │  │  │Engine    │  │            │
│              │  └──────────┘  │  └──────────┘  │            │
└──────────────┴────────────────┴────────────────┴────────────┘
```

### Ключевые улучшения:
1. **Engine** — центральный фасад, координирующий все подсистемы
2. **BrainFacade** — объединяет StateMachine, SceneSelector, EffectEngine
3. **LightingFacade** — объединяет Patch, Attributes, Merge, DMX Renderer
4. **Расширяемость** — чёткие точки для добавления новых источников метрик и выходов

### Два цикла обработки:
- **Быстрый цикл** (40ms): Audio → Brain → Lighting → DMX
- **Медленный цикл** (500-1000ms): Обновление mood, перевыбор сцен, hot-reload конфигов

---

## 2. Структура проекта

```
autonomous-dmx-engine/
├── src/
│   ├── engine/           # Главный фасад и циклы
│   │   ├── index.ts
│   │   ├── engine.ts
│   │   ├── fastLoop.ts
│   │   ├── slowLoop.ts
│   │   └── types.ts
│   ├── audio/            # Audio Analyzer
│   │   ├── analyzer.ts
│   │   ├── sources/      # Источники аудио
│   │   ├── types.ts
│   │   └── utils.ts
│   ├── brain/            # Show Brain
│   │   ├── facade.ts     # BrainFacade
│   │   ├── stateMachine.ts
│   │   ├── sceneSelector.ts
│   │   ├── effects/      # Система эффектов
│   │   │   ├── registry.ts
│   │   │   ├── handlers/ # Обработчики эффектов
│   │   │   └── types.ts
│   │   └── types.ts
│   ├── lighting/         # Lighting Engine
│   │   ├── facade.ts     # LightingFacade
│   │   ├── patch.ts
│   │   ├── fixtures.ts
│   │   ├── attributes.ts
│   │   ├── merge.ts
│   │   ├── renderer.ts
│   │   └── types.ts
│   ├── control/          # Control & UI
│   │   ├── api.ts
│   │   ├── webui/        # Web панель
│   │   └── types.ts
│   ├── metrics/          # Система метрик (расширение)
│   │   ├── sources/
│   │   ├── manager.ts
│   │   └── types.ts
│   ├── outputs/          # Выходные каналы (расширение)
│   │   ├── sinks/
│   │   ├── manager.ts
│   │   └── types.ts
│   ├── plugins/          # Plugin система (расширение)
│   │   ├── manager.ts
│   │   ├── types.ts
│   │   └── builtin/
│   ├── utils/            # Утилиты
│   │   ├── logger.ts
│   │   ├── config.ts
│   │   ├── math.ts
│   │   └── performance.ts
│   └── main.ts           # Точка входа
├── config/               # Конфигурационные файлы
│   ├── fixtures.json
│   ├── patch.json
│   ├── layout.json
│   ├── scenes.json
│   ├── scenes-rules.json # Правила выбора сцен (data-driven)
│   ├── effects.json      # Регистр эффектов (data-driven)
│   ├── styles.json
│   └── plugins.json      # Конфигурация плагинов (расширение)
├── plugins/              # Внешние плагины (расширение)
├── scripts/              # Вспомогательные скрипты
│   ├── mock-runtime.ts   # Офлайн-тестирование
│   ├── record-audio.ts
│   └── validate-configs.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
└── docs/
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

## 6. План реализации

### 6.1. Фазы разработки

#### Фаза 1: Базовый каркас (2-3 недели)

**Цель:** Создать работающий прототип с минимальной функциональностью.

**Задачи:**

1. **Структура проекта:**
   - [ ] Создать `src/engine/` с классами `Engine`, `FastLoop`, `SlowLoop`
   - [ ] Создать `src/brain/facade.ts` с `BrainFacade`
   - [ ] Создать `src/lighting/facade.ts` с `LightingFacade`

2. **Базовые утилиты:**
   - [ ] Реализовать `src/utils/logger.ts` с уровнями логирования
   - [ ] Реализовать `src/utils/config.ts` для загрузки конфигов
   - [ ] Реализовать `src/utils/math.ts` с математическими функциями

3. **Mock runtime для тестирования:**
   - [ ] Создать `scripts/mock-runtime.ts` для офлайн-тестирования
   - [ ] Подготовить тестовые данные (записанные AudioMetrics)

#### Фаза 2: Core модули (3-4 недели)

**Цель:** Реализовать основные функциональные модули.

**Задачи:**

1. **Audio Analyzer:**
   - [ ] Реализовать `processFrame()` с energy calculation
   - [ ] Реализовать beat detection
   - [ ] Реализовать BPM estimation
   - [ ] Реализовать mood estimation

2. **Show Brain:**
   - [ ] Реализовать `StateMachine` с логикой переходов
   - [ ] Реализовать `SceneSelector` с data-driven правилами
   - [ ] Реализовать `EffectEngine` с регистром обработчиков

3. **Lighting Engine:**
   - [ ] Реализовать `PatchManager` для загрузки конфигов
   - [ ] Реализовать `AttributeManager` для управления атрибутами
   - [ ] Реализовать `MergeEngine` для объединения слоёв
   - [ ] Реализовать `DMXRenderer` с Art-Net output

#### Фаза 3: Интеграция и тестирование (2-3 недели)

**Цель:** Создать полностью работающую систему.

**Задачи:**

1. **Главный цикл:**
   - [ ] Интегрировать все модули в `Engine`
   - [ ] Реализовать два цикла (fast/slow)
   - [ ] Добавить обработку ошибок и recovery

2. **Control & UI:**
   - [ ] Реализовать REST API (`src/control/api.ts`)
   - [ ] Создать базовую web-панель
   - [ ] Добавить WebSocket для real-time обновлений

3. **Тестирование:**
   - [ ] Создать unit-тесты для ключевых модулей
   - [ ] Создать интеграционные тесты
   - [ ] Протестировать с реальным DMX оборудованием

#### Фаза 4: Расширяемость и оптимизация (2-3 недели)

**Цель:** Сделать систему гибкой и производительной.

**Задачи:**

1. **Plugin система:**
   - [ ] Реализовать `PluginManager`
   - [ ] Создать интерфейсы для плагинов
   - [ ] Реализовать hot-reload плагинов

2. **Производительность:**
   - [ ] Добавить object pooling для быстрого цикла
   - [ ] Реализовать предварительные вычисления
   - [ ] Добавить мониторинг производительности

3. **Data-driven конфигурация:**
   - [ ] Расширить форматы конфигов (scenes-rules.json, effects.json)
   - [ ] Добавить валидацию конфигов
   - [ ] Реализовать hot-reload конфигов

### 6.2. Критические решения

#### 6.2.1. Приоритеты разработки

1. **Сначала mock runtime:** Разрабатывать и тестировать логику без реального аудио/DMX
2. **Data-driven подход:** Все настройки поведения через JSON конфиги
3. **Интерфейсы перед реализацией:** Чётко определить контракты между модулями

#### 6.2.2. Технический стек

- **Язык:** TypeScript (строгая типизация для надёжности)
- **Сборка:** tsc + npm scripts
- **Тестирование:** Jest + Supertest
- **Логирование:** Winston или собственный logger
- **Конфиги:** JSON с JSON Schema для валидации

### 6.3. Риски и mitigation

#### 6.3.1. Технические риски

| Риск | Вероятность | Влияние | Mitigation |
|------|-------------|---------|------------|
| Задержки в audio processing | Высокая | Высокое | Оптимизация алгоритмов, предварительные вычисления |
| Проблемы с реальным DMX оборудованием | Средняя | Высокое | Mock DMX output для разработки, изоляция hardware layer |
| Сложность data-driven правил | Средняя | Среднее | Постепенное усложнение, validation на этапе загрузки |
| Производительность при многих fixtures | Низкая | Высокое | Оптимизация рендеринга, object pooling |

#### 6.3.2. Организационные риски

| Риск | Mitigation |
|------|------------|
| Раздувание scope | Чёткое определение MVP, приоритизация фич |
| Недостаток тестирования с реальным оборудованием | Раннее привлечение hardware, создание эмуляторов |
| Сложность отладки в реальном времени | Детальное логирование, remote debugging |

### 6.4. Критерии успеха

#### MVP (Минимальный жизнеспособный продукт)

- [ ] Аудио анализируется в реальном времени
- [ ] State Machine переключает состояния на основе энергии
- [ ] Выбираются сцены по правилам
- [ ] Применяются базовые эффекты (dim/pulse, pos/circle)
- [ ] DMX данные отправляются на Art-Net
- [ ] Есть web-панель для мониторинга и управления

#### Полная реализация

- [ ] Работает plugin система
- [ ] Поддержка multiple metric sources
- [ ] Поддержка multiple output sinks
- [ ] Hot-reload конфигов и плагинов
- [ ] Производительность: fast loop < 20ms
- [ ] Надёжность: uptime > 99.9%
- [ ] Расширяемость: новые эффекты через конфиги

### 6.5. Следующие шаги

1. **Создать детальные спецификации интерфейсов**
2. **Начать реализацию с Phase 1 (базовый каркас)**
3. **Параллельно разрабатывать mock runtime для тестирования**
4. **Регулярно тестировать с реальным оборудованием**
5. **Итеративно добавлять фичи согласно плану**

**Рекомендация:** Переключиться в режим Code для начала реализации Phase 1.

## 5. Производительность и разделение циклов

### 5.1. Проблемы производительности

#### 5.1.1. Смешивание "реального времени" и тяжёлой логики

**Проблема:**
- Audio processing, beat detection, DMX rendering требуют низкой задержки (десятки мс)
- Тяжёлые операции (ML, vision analysis, disk I/O) могут блокировать основной цикл

**Решение:** Разделение на быстрый и медленный циклы.

#### 5.1.2. Состояние, разбросанное по модулям

**Проблема:**
- AudioAnalyzerState, SystemState, BrainState, FixtureState распределены по разным модулям
- Сложно управлять согласованностью состояния

**Решение:** Чёткое определение "источников правды" для каждого уровня.

### 5.2. Архитектура двух циклов

#### 5.2.1. Быстрый цикл (Fast Tick)

**Характеристики:**
- Интервал: 25-40 мс (25-40 FPS)
- Задачи:
  1. Обработка аудио-фрейма
  2. Beat detection и BPM estimation
  3. Обновление State Machine
  4. Применение эффектов к атрибутам
  5. Рендеринг DMX
  6. Отправка Art-Net

**Требования:**
- Детерминированное время выполнения
- Минимальные аллокации памяти
- Без блокирующих операций

```typescript
// src/engine/fastLoop.ts

class FastLoop {
  private readonly MAX_PROCESSING_TIME = 15; // ms
  
  async execute(audioFrame: Float32Array): Promise<void> {
    const startTime = performance.now();
    
    // 1. Audio processing (должно быть < 5ms)
    const audioMetrics = this.audioAnalyzer.processFrame(audioFrame);
    
    // 2. Brain processing (должно быть < 5ms)
    const brainOutput = this.brainFacade.fastUpdate(audioMetrics);
    
    // 3. Lighting processing (должно быть < 5ms)
    const lightingOutput = this.lightingFacade.fastUpdate(brainOutput);
    
    // 4. DMX output (должно быть < 2ms)
    await this.dmxRenderer.sendFrames(lightingOutput.universeFrames);
    
    const processingTime = performance.now() - startTime;
    
    // Мониторинг производительности
    if (processingTime > this.MAX_PROCESSING_TIME) {
      this.logger.warn(`Fast loop exceeded time budget: ${processingTime}ms`);
    }
  }
}
```

#### 5.2.2. Медленный цикл (Slow Tick)

**Характеристики:**
- Интервал: 500-1000 мс (0.5-1 Hz)
- Задачи:
  1. Пересчёт mood и долгосрочных статистик
  2. Перевыбор сцен (если нужно)
  3. Hot-reload конфигураций
  4. Сбор метрик производительности
  5. Очистка устаревших данных из истории
  6. Проверка здоровья системы

**Требования:**
- Может выполнять блокирующие операции
- Может аллоцировать память
- Допускаются задержки до нескольких секунд

```typescript
// src/engine/slowLoop.ts

class SlowLoop {
  async execute(): Promise<void> {
    // 1. Обновление долгосрочных состояний
    await this.brainFacade.slowUpdate();
    
    // 2. Hot-reload конфигов (если изменились)
    if (await this.configManager.checkForUpdates()) {
      await this.reloadConfigs();
    }
    
    // 3. Сбор и отправка метрик
    const metrics = await this.collectMetrics();
    await this.metricsExporter.export(metrics);
    
    // 4. Очистка памяти
    this.memoryManager.cleanup();
    
    // 5. Проверка здоровья
    await this.healthCheck();
  }
}
```

### 5.3. Управление состоянием

#### 5.3.1. Источники правды (Sources of Truth)

| Уровень | Источник правды | Доступ |
|---------|----------------|--------|
| Audio | `AudioAnalyzer` | Только через `getState()` |
| System | `ControlAPI` | Команды через `UserCommand` |
| Brain | `BrainFacade` | Только через `getCurrentState()` |
| Lighting | `AttributeManager` | Только через методы управления |

#### 5.3.2. Immutable данные между циклами

```typescript
// Использование immutable структур для передачи данных между циклами
interface FastToSlowBridge {
  // Данные из быстрого цикла для медленного
  recentAudioMetrics: AudioMetrics[];
  recentBrainStates: BrainState[];
  performanceMetrics: PerformanceMetrics;
  
  // Команды из медленного цикла для быстрого
  configUpdates?: ConfigUpdate[];
  sceneOverrides?: SceneOverride[];
}

class StateBridge {
  private fastToSlow: FastToSlowBridge = {
    recentAudioMetrics: [],
    recentBrainStates: [],
    performanceMetrics: { processingTimes: [] }
  };
  
  private slowToFast: SlowToFastBridge = {
    configUpdates: [],
    sceneOverrides: []
  };
  
  // Быстрый цикл записывает данные
  recordFastCycle(metrics: AudioMetrics, state: BrainState, time: number): void {
    this.fastToSlow.recentAudioMetrics.push(metrics);
    if (this.fastToSlow.recentAudioMetrics.length > 100) {
      this.fastToSlow.recentAudioMetrics.shift();
    }
    
    this.fastToSlow.performanceMetrics.processingTimes.push(time);
  }
  
  // Медленный цикл читает данные
  getFastCycleData(): FastToSlowBridge {
    return { ...this.fastToSlow }; // Возвращаем копию
  }
  
  // Медленный цикл отправляет команды
  sendToFastCycle(update: ConfigUpdate): void {
    this.slowToFast.configUpdates.push(update);
  }
  
  // Быстрый цикл читает команды
  getSlowCycleCommands(): SlowToFastBridge {
    const commands = { ...this.slowToFast };
    this.slowToFast.configUpdates = []; // Очищаем после чтения
    return commands;
  }
}
```

### 5.4. Оптимизации производительности

#### 5.4.1. Предварительные вычисления

```typescript
// Предварительный расчёт таблиц для быстрых операций
class LookupTables {
  private sinTable: Float32Array;
  private cosTable: Float32Array;
  
  constructor(resolution: number = 1024) {
    this.sinTable = new Float32Array(resolution);
    this.cosTable = new Float32Array(resolution);
    
    for (let i = 0; i < resolution; i++) {
      const angle = (i / resolution) * 2 * Math.PI;
      this.sinTable[i] = Math.sin(angle);
      this.cosTable[i] = Math.cos(angle);
    }
  }
  
  fastSin(phase: number): number {
    const index = Math.floor((phase % (2 * Math.PI)) / (2 * Math.PI) * this.sinTable.length);
    return this.sinTable[index];
  }
}
```

#### 5.4.2. Object pooling

```typescript
// Пулы объектов для избежания аллокаций в быстром цикле
class ObjectPool<T> {
  private pool: T[] = [];
  private createFn: () => T;
  
  constructor(createFn: () => T, initialSize: number = 10) {
    this.createFn = createFn;
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(createFn());
    }
  }
  
  acquire(): T {
    return this.pool.pop() || this.createFn();
  }
  
  release(obj: T): void {
    this.pool.push(obj);
  }
}

// Использование в быстром цикле
const audioMetricsPool = new ObjectPool(() => ({
  timestamp: 0,
  energy: 0,
  beat: false,
  bpm: null,
  mood: 'calm'
}));

const metrics = audioMetricsPool.acquire();
// ... использование ...
audioMetricsPool.release(metrics);
```

#### 5.4.3. Worker threads для тяжёлых вычислений

```typescript
// Вынесение тяжёлых операций в отдельные потоки
class VisionAnalyzerWorker {
  private worker: Worker;
  
  constructor() {
    this.worker = new Worker('./workers/vision-analyser.js');
  }
  
  async analyzeFrame(frame: ImageData): Promise<VisionMetrics> {
    return new Promise((resolve, reject) => {
      this.worker.postMessage({ type: 'analyze', frame });
      
      this.worker.onmessage = (event) => {
        if (event.data.type === 'result') {
          resolve(event.data.metrics);
        }
      };
      
      this.worker.onerror = reject;
    });
  }
}
```

### 5.5. Мониторинг и диагностика

#### 5.5.1. Метрики производительности

```typescript
interface PerformanceMetrics {
  // Время обработки
  fastLoopTime: number;
  slowLoopTime: number;
  
  // Задержки
  audioLatency: number;
  dmxLatency: number;
  
  // Использование ресурсов
  memoryUsage: number;
  cpuUsage: number;
  
  // Качество работы
  audioDropouts: number;
  dmxDropouts: number;
  beatDetectionAccuracy: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    fastLoopTime: 0,
    slowLoopTime: 0,
    audioLatency: 0,
    dmxLatency: 0,
    memoryUsage: 0,
    cpuUsage: 0,
    audioDropouts: 0,
    dmxDropouts: 0,
    beatDetectionAccuracy: 0
  };
  
  recordFastLoopTime(time: number): void {
    this.metrics.fastLoopTime = time;
    
    // Предупреждение при превышении бюджета
    if (time > 20) { // 20ms для 50 FPS
      this.logger.warn(`Fast loop time exceeded: ${time}ms`);
    }
  }
  
  getReport(): PerformanceMetrics {
    return { ...this.metrics };
  }
}
```

#### 5.5.2. Health checks

```typescript
class HealthChecker {
  async check(): Promise<HealthStatus> {
    const checks = [
      this.checkAudioInput(),
      this.checkDMXOutput(),
      this.checkMemory(),
      this.checkConfigs()
    ];
    
    const results = await Promise.all(checks);
    
    return {
      overall: results.every(r => r.healthy) ? 'healthy' : 'degraded',
      details: results,
      timestamp: Date.now()
    };
  }
  
  private async checkAudioInput(): Promise<HealthCheckResult> {
    try {
      const hasSignal = await this.audioAnalyzer.hasSignal();
      return {
        component: 'audio',
        healthy: hasSignal,
        message: hasSignal ? 'Signal detected' : 'No audio signal'
      };
    } catch (error) {
      return {
        component: 'audio',
        healthy: false,
        message: `Error: ${error.message}`
      };
    }
  }
}
```

## 4. Точки расширения и plugin-архитектура

### 4.1. Официальные точки расширения

#### 4.1.1. Источники метрик (Metric Sources)

**Интерфейс:** `MetricSource`

```typescript
// src/metrics/types.ts

export interface MetricSource {
  readonly name: string;
  readonly type: 'audio' | 'vision' | 'sensor' | 'external';
  
  // Инициализация
  initialize(config: any): Promise<void>;
  
  // Получение текущих метрик
  getMetrics(): Promise<Record<string, any>>;
  
  // Остановка
  shutdown(): Promise<void>;
}

// Пример реализации AudioSource
class AudioMetricSource implements MetricSource {
  readonly name = 'audio';
  readonly type = 'audio' as const;
  
  private analyzer: AudioAnalyzer;
  
  async initialize(config: AudioAnalyzerConfig): Promise<void> {
    this.analyzer = new AudioAnalyzer(config);
  }
  
  async getMetrics(): Promise<Record<string, any>> {
    const frame = await this.getAudioFrame();
    const metrics = this.analyzer.processFrame(frame, Date.now());
    return { audio: metrics };
  }
  
  async shutdown(): Promise<void> {
    // Освобождение ресурсов
  }
}

// Менеджер источников метрик
class MetricSourceManager {
  private sources: Map<string, MetricSource> = new Map();
  
  registerSource(source: MetricSource): void {
    this.sources.set(source.name, source);
  }
  
  async collectAllMetrics(): Promise<RuntimeMetrics> {
    const metrics: RuntimeMetrics = {
      audio: null as any, // будет заполнено
      timestamp: Date.now()
    };
    
    for (const [name, source] of this.sources) {
      const sourceMetrics = await source.getMetrics();
      Object.assign(metrics, sourceMetrics);
    }
    
    return metrics;
  }
}
```

#### 4.1.2. Выходные каналы (Output Sinks)

**Интерфейс:** `OutputSink`

```typescript
// src/outputs/types.ts

export interface OutputSink {
  readonly name: string;
  readonly type: 'dmx' | 'visualization' | 'logging' | 'osc';
  
  // Инициализация
  initialize(config: any): Promise<void>;
  
  // Отправка данных
  send(data: any): Promise<void>;
  
  // Остановка
  shutdown(): Promise<void>;
}

// Пример реализации DMX Output
class DMXOutputSink implements OutputSink {
  readonly name = 'dmx';
  readonly type = 'dmx' as const;
  
  private renderer: DMXRenderer;
  
  async initialize(config: ArtNetConfig): Promise<void> {
    this.renderer = new DMXRenderer(config);
  }
  
  async send(data: UniverseFrame[]): Promise<void> {
    for (const frame of data) {
      this.renderer.sendFrame(frame);
    }
  }
  
  async shutdown(): Promise<void> {
    // Отправка blackout и закрытие соединения
  }
}

// Менеджер выходных каналов
class OutputSinkManager {
  private sinks: Map<string, OutputSink> = new Map();
  
  registerSink(sink: OutputSink): void {
    this.sinks.set(sink.name, sink);
  }
  
  async sendToAll(data: Record<string, any>): Promise<void> {
    for (const [name, sink] of this.sinks) {
      if (data[name]) {
        await sink.send(data[name]);
      }
    }
  }
}
```

#### 4.1.3. Обработчики эффектов (Effect Handlers)

**Уже реализовано в разделе 3.1 через `EffectRegistry`.**

### 4.2. Plugin система

#### 4.2.1. Структура плагина

```typescript
// src/plugins/types.ts

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  
  // Точки расширения, которые предоставляет плагин
  provides: {
    metricSources?: string[];
    outputSinks?: string[];
    effectHandlers?: string[];
    sceneRules?: string[];
  };
  
  // Зависимости от других плагинов
  dependencies?: string[];
}

export interface Plugin {
  manifest: PluginManifest;
  
  // Инициализация плагина
  initialize(context: PluginContext): Promise<void>;
  
  // Остановка плагина
  shutdown(): Promise<void>;
}

export interface PluginContext {
  // Регистры для расширения
  metricSourceManager: MetricSourceManager;
  outputSinkManager: OutputSinkManager;
  effectRegistry: EffectRegistry;
  sceneRuleRegistry: SceneRuleRegistry;
  
  // Конфигурация
  config: any;
  
  // Логгер
  logger: Logger;
}
```

#### 4.2.2. Пример плагина Vision Analyzer

```typescript
// plugins/vision-analyzer/index.ts

class VisionAnalyzerPlugin implements Plugin {
  manifest: PluginManifest = {
    id: 'vision-analyzer',
    name: 'Vision Analyzer',
    version: '1.0.0',
    description: 'Анализ видео с камеры для определения occupancy и motion',
    provides: {
      metricSources: ['vision']
    }
  };
  
  private visionSource: VisionMetricSource;
  
  async initialize(context: PluginContext): Promise<void> {
    // Создание и регистрация источника метрик
    this.visionSource = new VisionMetricSource();
    await this.visionSource.initialize(context.config.vision);
    
    context.metricSourceManager.registerSource(this.visionSource);
    
    context.logger.info('Vision Analyzer plugin initialized');
  }
  
  async shutdown(): Promise<void> {
    await this.visionSource.shutdown();
  }
}

// VisionMetricSource реализация
class VisionMetricSource implements MetricSource {
  readonly name = 'vision';
  readonly type = 'vision' as const;
  
  async getMetrics(): Promise<Record<string, any>> {
    return {
      vision: {
        occupancy: 0.7,    // 0..1 заполненность
        motionLevel: 0.5,  // 0..1 уровень движения
        zones: {
          front: 0.8,
          back: 0.3
        }
      }
    };
  }
}
```

#### 4.2.3. Менеджер плагинов

```typescript
class PluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private loaded: Set<string> = new Set();
  
  async loadPlugin(pluginPath: string): Promise<void> {
    // Динамическая загрузка плагина
    const pluginModule = await import(pluginPath);
    const plugin: Plugin = new pluginModule.default();
    
    // Проверка зависимостей
    await this.checkDependencies(plugin.manifest);
    
    // Инициализация плагина
    const context = this.createPluginContext();
    await plugin.initialize(context);
    
    this.plugins.set(plugin.manifest.id, plugin);
    this.loaded.add(plugin.manifest.id);
  }
  
  async unloadPlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      await plugin.shutdown();
      this.plugins.delete(pluginId);
      this.loaded.delete(pluginId);
    }
  }
  
  async reloadPlugin(pluginId: string): Promise<void> {
    await this.unloadPlugin(pluginId);
    // Перезагрузка из того же пути
    await this.loadPlugin(this.getPluginPath(pluginId));
  }
}
```

### 4.3. Конфигурация плагинов

```json
// config/plugins.json
{
  "enabled": [
    "core-audio",
    "core-dmx",
    "vision-analyzer",
    "osc-output"
  ],
  
  "plugins": {
    "core-audio": {
      "type": "builtin",
      "config": {
        "sampleRate": 44100,
        "frameSize": 1024
      }
    },
    
    "vision-analyzer": {
      "type": "external",
      "path": "./plugins/vision-analyzer",
      "config": {
        "cameraIndex": 0,
        "analysisInterval": 1000
      }
    },
    
    "osc-output": {
      "type": "external",
      "path": "./plugins/osc-output",
      "config": {
        "host": "127.0.0.1",
        "port": 9000
      }
    }
  }
}
```

## 3. Data-driven архитектура

### 3.1. Гибкая система эффектов

**Проблема:** Жёстко зашитые типы эффектов ограничивают расширяемость.

**Решение:** Эффекты как данные + регистр обработчиков.

**Интерфейсы:**

```typescript
// src/brain/effects/types.ts

// Базовый дескриптор эффекта
export interface EffectDescriptor {
  type: string;                    // 'dim/chase', 'dim/pulse', 'pos/circle', 'color/cycle'
  params: Record<string, any>;     // Параметры эффекта
  groupId: string;                 // К какой группе применяется
}

// Контекст для обработки эффекта
export interface EffectContext {
  metrics: RuntimeMetrics;
  timestamp: number;
  sceneState: SceneState;
  fixtureStates: Map<string, FixtureState>;
}

// Обработчик эффекта
export type EffectHandler = (
  params: Record<string, any>,
  context: EffectContext
) => Partial<FixtureState> | Map<string, Partial<FixtureState>>;

// Регистр обработчиков эффектов
export class EffectRegistry {
  private handlers: Map<string, EffectHandler> = new Map();
  
  register(type: string, handler: EffectHandler): void {
    this.handlers.set(type, handler);
  }
  
  getHandler(type: string): EffectHandler | undefined {
    return this.handlers.get(type);
  }
  
  hasHandler(type: string): boolean {
    return this.handlers.has(type);
  }
}

// Пример обработчика
const dimPulseHandler: EffectHandler = (params, context) => {
  const { speed = 1.0, depth = 0.5, phase = 0 } = params;
  const time = context.timestamp / 1000; // секунды
  const pulse = (Math.sin(time * speed * 2 * Math.PI + phase) + 1) / 2;
  const dimValue = 0.5 + pulse * depth * 0.5;
  
  return { dim: dimValue };
};
```

**Обновлённый SceneState:**

```typescript
// src/brain/types.ts (обновлённый)

export interface SceneState {
  sceneId: string;
  paletteId: string;
  baseIntensity: number;
  effectDescriptors: EffectDescriptor[];  // Массив дескрипторов вместо жёсткой структуры
}

// Пример в scenes.json
{
  "id": "PartyBeams",
  "name": "Party Beams",
  "allowedStates": ["Party"],
  "paletteId": "party",
  "baseIntensity": 0.9,
  "effectDescriptors": [
    {
      "type": "dim/pulse",
      "groupId": "BEAMS",
      "params": {
        "speed": 2.0,
        "depth": 0.8,
        "phase": 0
      }
    },
    {
      "type": "pos/circle",
      "groupId": "BEAMS",
      "params": {
        "speed": 0.5,
        "radius": 0.3,
        "centerX": 0,
        "centerY": 0
      }
    },
    {
      "type": "color/cycle",
      "groupId": "WASH",
      "params": {
        "speed": 0.2,
        "colors": [1, 2, 3]
      }
    }
  ]
}
```

### 3.2. Правила выбора сцен как данные

**Проблема:** Логика выбора сцен зашита в коде.

**Решение:** Правила как конфигурационные данные.

**Интерфейсы:**

```typescript
// src/brain/scenes/types.ts

export interface SceneRule {
  sceneId: string;
  
  // Условия активации
  conditions: {
    brainState?: BrainState | BrainState[];
    mood?: Mood | Mood[];
    energyMin?: number;
    energyMax?: number;
    bpmMin?: number;
    bpmMax?: number;
    timeOfDay?: {
      start: string;  // "20:00"
      end: string;    // "06:00"
    };
    dayOfWeek?: number[];  // 0-6 (воскресенье-суббота)
  };
  
  // Вес для случайного выбора
  weight: number;
  
  // Минимальное время между активациями (ms)
  cooldown?: number;
  
  // Максимальная длительность сцены (ms)
  maxDuration?: number;
}

// Пример в scenes-rules.json
{
  "rules": [
    {
      "sceneId": "IdleWarmStatic",
      "conditions": {
        "brainState": ["Idle"],
        "energyMax": 0.3,
        "mood": ["calm"]
      },
      "weight": 1.0,
      "cooldown": 30000
    },
    {
      "sceneId": "ChillSoftMovement",
      "conditions": {
        "brainState": ["Chill"],
        "energyMin": 0.3,
        "energyMax": 0.7,
        "mood": ["calm", "medium"]
      },
      "weight": 1.0,
      "maxDuration": 60000
    },
    {
      "sceneId": "PartyBeams",
      "conditions": {
        "brainState": ["Party"],
        "energyMin": 0.7,
        "mood": ["medium", "hard"],
        "timeOfDay": {
          "start": "20:00",
          "end": "06:00"
        }
      },
      "weight": 1.5,  // Более высокая вероятность
      "cooldown": 15000
    }
  ]
}
```

**Обновлённый SceneSelector:**

```typescript
class SceneSelector {
  private rules: SceneRule[] = [];
  private history: SceneHistory[] = [];
  
  constructor(rules: SceneRule[], scenes: SceneDefinition[]) {
    this.rules = rules;
    this.scenes = scenes;
  }
  
  selectScene(
    brainState: BrainState,
    metrics: RuntimeMetrics,
    history: string[]
  ): SceneState {
    // 1. Фильтрация по условиям
    const eligibleScenes = this.rules.filter(rule =>
      this.checkConditions(rule, brainState, metrics)
    );
    
    // 2. Исключение недавно использованных (cooldown)
    const availableScenes = eligibleScenes.filter(rule =>
      !this.isOnCooldown(rule.sceneId)
    );
    
    // 3. Выбор по весам
    const selectedRule = this.selectByWeight(availableScenes);
    
    // 4. Получение определения сцены
    const sceneDef = this.scenes.find(s => s.id === selectedRule.sceneId);
    
    // 5. Обновление истории
    this.updateHistory(selectedRule.sceneId, metrics.timestamp);
    
    return {
      sceneId: sceneDef.id,
      paletteId: sceneDef.paletteId,
      baseIntensity: sceneDef.baseIntensity,
      effectDescriptors: sceneDef.effectDescriptors
    };
  }
  
  private checkConditions(
    rule: SceneRule,
    brainState: BrainState,
    metrics: RuntimeMetrics
  ): boolean {
    const cond = rule.conditions;
    
    // Проверка brainState
    if (cond.brainState) {
      const allowed = Array.isArray(cond.brainState)
        ? cond.brainState
        : [cond.brainState];
      if (!allowed.includes(brainState)) return false;
    }
    
    // Проверка mood
    if (cond.mood && metrics.audio.mood) {
      const allowedMoods = Array.isArray(cond.mood) ? cond.mood : [cond.mood];
      if (!allowedMoods.includes(metrics.audio.mood)) return false;
    }
    
    // Проверка energy
    if (cond.energyMin !== undefined && metrics.audio.energy < cond.energyMin) {
      return false;
    }
    if (cond.energyMax !== undefined && metrics.audio.energy > cond.energyMax) {
      return false;
    }
    
    // Проверка BPM
    if (cond.bpmMin !== undefined && metrics.audio.bpm !== null) {
      if (metrics.audio.bpm < cond.bpmMin) return false;
    }
    if (cond.bpmMax !== undefined && metrics.audio.bpm !== null) {
      if (metrics.audio.bpm > cond.bpmMax) return false;
    }
    
    // Проверка времени суток
    if (cond.timeOfDay) {
      if (!this.isWithinTimeRange(cond.timeOfDay)) return false;
    }
    
    // Проверка дня недели
    if (cond.dayOfWeek) {
      const today = new Date().getDay();
      if (!cond.dayOfWeek.includes(today)) return false;
    }
    
    return true;
  }
}
```

## 2. Фасадные модули

### 2.1. Engine (главный фасад)

**Класс:** `Engine`

**Назначение:** Координирует все подсистемы, управляет циклами обработки.

**Интерфейсы:**

```typescript
// src/engine/types.ts

export interface EngineConfig {
  fastTickInterval: number;    // 40ms
  slowTickInterval: number;    // 500-1000ms
  enableHotReload: boolean;
}

export interface RuntimeMetrics {
  audio: AudioMetrics;
  vision?: VisionMetrics;      // для будущего расширения
  sensors?: SensorMetrics;     // для будущего расширения
  timestamp: number;
}

export interface BrainOutput {
  brainState: BrainState;
  sceneState: SceneState;
  groupEffects: GroupEffectState[];
}

export interface LightingOutput {
  universeFrames: UniverseFrame[];
  fixtureStates: Map<string, FixtureState>;
}
```

**Методы:**

```typescript
class Engine {
  constructor(
    private audioAnalyzer: AudioAnalyzer,
    private brainFacade: BrainFacade,
    private lightingFacade: LightingFacade,
    private controlAPI: ControlAPI,
    private config: EngineConfig
  ) {}

  // Быстрый цикл (вызывается каждые 40ms)
  fastTick(audioFrame: Float32Array, now: number): void {
    // 1. Обработка аудио
    const audioMetrics = this.audioAnalyzer.processFrame(audioFrame, now);
    
    // 2. Сбор всех метрик
    const runtimeMetrics: RuntimeMetrics = {
      audio: audioMetrics,
      timestamp: now
    };
    
    // 3. Обработка Brain
    const brainOutput = this.brainFacade.update(runtimeMetrics);
    
    // 4. Обработка Lighting
    const lightingOutput = this.lightingFacade.update(brainOutput);
    
    // 5. Отправка DMX
    this.lightingFacade.render(lightingOutput);
    
    // 6. Отправка состояния в UI
    this.controlAPI.broadcastState({
      metrics: runtimeMetrics,
      brainOutput,
      lightingOutput
    });
  }

  // Медленный цикл (вызывается каждые 500-1000ms)
  slowTick(now: number): void {
    // 1. Hot-reload конфигов (если включено)
    if (this.config.enableHotReload) {
      this.brainFacade.reloadConfigs();
      this.lightingFacade.reloadConfigs();
    }
    
    // 2. Обновление долгосрочных состояний
    this.brainFacade.updateSlow(now);
    
    // 3. Сбор статистики и логирование
    this.collectStatistics(now);
  }

  start(): void {
    // Запуск двух таймеров
    setInterval(() => this.fastTick(getAudioFrame(), Date.now()),
                this.config.fastTickInterval);
    
    setInterval(() => this.slowTick(Date.now()),
                this.config.slowTickInterval);
  }
}
```

### 2.2. BrainFacade

**Класс:** `BrainFacade`

**Назначение:** Объединяет StateMachine, SceneSelector, EffectEngine.

**Интерфейсы:**

```typescript
// src/brain/facade.ts

export interface BrainFacadeConfig {
  stateMachine: StateMachineConfig;
  sceneSelector: SceneSelectorConfig;
  effectEngine: EffectEngineConfig;
}

export interface BrainFacadeState {
  currentBrainState: BrainState;
  currentScene: SceneState;
  history: {
    brainStates: BrainState[];
    scenes: string[];
    timestamps: number[];
  };
}
```

**Методы:**

```typescript
class BrainFacade {
  constructor(
    private stateMachine: StateMachine,
    private sceneSelector: SceneSelector,
    private effectEngine: EffectEngine,
    private config: BrainFacadeConfig
  ) {}

  update(metrics: RuntimeMetrics): BrainOutput {
    // 1. Обновление State Machine
    const brainState = this.stateMachine.update(metrics.audio, metrics);
    
    // 2. Выбор сцены
    const sceneState = this.sceneSelector.selectScene(
      brainState,
      metrics,
      this.state.history.scenes
    );
    
    // 3. Генерация эффектов
    const groupEffects = this.effectEngine.generateEffects(
      sceneState,
      metrics,
      metrics.timestamp
    );
    
    // 4. Обновление истории
    this.updateHistory(brainState, sceneState.sceneId, metrics.timestamp);
    
    return {
      brainState,
      sceneState,
      groupEffects
    };
  }

  updateSlow(now: number): void {
    // Долгосрочные обновления (пересчёт mood, очистка истории и т.д.)
    this.stateMachine.updateSlow(now);
    this.sceneSelector.updateSlow(now);
  }

  reloadConfigs(): void {
    // Перезагрузка конфигураций сцен, правил и т.д.
    this.sceneSelector.reloadScenes();
    this.effectEngine.reloadEffects();
  }
}
```

### 2.3. LightingFacade

**Класс:** `LightingFacade`

**Назначение:** Объединяет Patch, Attributes, Merge, DMX Renderer.

**Интерфейсы:**

```typescript
// src/lighting/facade.ts

export interface LightingFacadeConfig {
  artNet: ArtNetConfig;
  mergeRules: MergeRules;
}
```

**Методы:**

```typescript
class LightingFacade {
  constructor(
    private patchManager: PatchManager,
    private attributeManager: AttributeManager,
    private mergeEngine: MergeEngine,
    private dmxRenderer: DMXRenderer,
    private config: LightingFacadeConfig
  ) {}

  update(brainOutput: BrainOutput): LightingOutput {
    // 1. Применение эффектов к атрибутам
    for (const effect of brainOutput.groupEffects) {
      this.attributeManager.applyGroupEffect(effect.groupId, effect);
    }
    
    // 2. Объединение слоёв
    const baseStates = this.attributeManager.getAll();
    const effectStates = this.attributeManager.getEffects();
    const finalStates = this.mergeEngine.merge(
      baseStates,
      effectStates,
      {
        globalDim: brainOutput.sceneState.baseIntensity,
        blackout: false // из SystemState
      }
    );
    
    // 3. Рендеринг DMX фреймов
    const universeFrames = this.dmxRenderer.renderToFrames(finalStates);
    
    return {
      universeFrames,
      fixtureStates: finalStates
    };
  }

  render(output: LightingOutput): void {
    // Отправка DMX фреймов через Art-Net
    this.dmxRenderer.sendFrames(output.universeFrames);
  }

  reloadConfigs(): void {
    // Перезагрузка патча, профилей, layout
    this.patchManager.reloadAll();
  }
}
```

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



**Версия:** 0.3  
**Дата:** 2026-02-10  
**Статус:** Живой документ, регулярно обновляется с изменениями архитектуры.
