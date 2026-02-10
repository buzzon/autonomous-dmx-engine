# Phase 1 Implementation Plan - Базовый каркас (Обновлённый)

## Обзор
Цель Phase 1: Создать работающий прототип с минимальной функциональностью, включая фасадные модули, базовые утилиты, mock runtime для тестирования и скелетные реализации для расширяемости.

## Сроки: 2-3 недели

## Задачи

### 1. Структура проекта и фасадные модули

#### 1.1. Создание директорий и файлов (расширенная структура)
```
src/
├── engine/           # Главный фасад и циклы
│   ├── index.ts
│   ├── engine.ts
│   ├── fastLoop.ts
│   ├── slowLoop.ts
│   └── types.ts
├── audio/            # Audio Analyzer
│   ├── analyzer.ts
│   ├── types.ts
│   └── utils.ts
├── brain/            # Show Brain
│   ├── facade.ts     # BrainFacade
│   ├── stateMachine.ts
│   ├── sceneSelector.ts
│   ├── effects/      # Система эффектов
│   │   ├── registry.ts
│   │   ├── handlers/ # Обработчики эффектов
│   │   └── types.ts
│   └── types.ts
├── lighting/         # Lighting Engine
│   ├── facade.ts     # LightingFacade
│   ├── patch.ts
│   ├── fixtures.ts
│   ├── attributes.ts
│   ├── merge.ts
│   ├── renderer.ts
│   └── types.ts
├── control/          # Control & UI
│   ├── api.ts
│   └── types.ts
├── metrics/          # Система метрик (расширение)
│   ├── sources/
│   ├── manager.ts
│   └── types.ts
├── outputs/          # Выходные каналы (расширение)
│   ├── sinks/
│   ├── manager.ts
│   └── types.ts
├── plugins/          # Plugin система (расширение)
│   ├── manager.ts
│   ├── types.ts
│   └── builtin/
└── utils/            # Утилиты
    ├── logger.ts
    ├── config.ts
    └── math.ts
```

#### 1.2. Engine фасад (обновлённый согласно ARCHITECTURE.md)
**Файл:** `src/engine/engine.ts`
```typescript
// Основной интерфейс Engine
interface EngineConfig {
  fastTickInterval: number;    // 40ms
  slowTickInterval: number;    // 500-1000ms
  enableHotReload: boolean;
}

class Engine {
  constructor(
    private audioAnalyzer: AudioAnalyzer,
    private brainFacade: BrainFacade,
    private lightingFacade: LightingFacade,
    private controlAPI: ControlAPI,
    private config: EngineConfig
  ) {}

  start(): void {
    // Запуск двух таймеров
    setInterval(() => this.fastTick(), this.config.fastTickInterval);
    setInterval(() => this.slowTick(), this.config.slowTickInterval);
  }

  private fastTick(): void {
    const startTime = performance.now();
    
    // Mock audio data для Phase 1 (временное решение)
    const mockAudioFrame = this.generateMockAudioFrame();
    const audioMetrics = this.audioAnalyzer.processFrame(mockAudioFrame, Date.now());
    
    // Сбор всех метрик (расширяемая структура)
    const runtimeMetrics: RuntimeMetrics = {
      audio: audioMetrics,
      timestamp: Date.now()
    };
    
    // Brain processing
    const brainOutput = this.brainFacade.update(runtimeMetrics);
    
    // Lighting processing
    const lightingOutput = this.lightingFacade.update(brainOutput);
    
    // Mock DMX output (логирование)
    this.logDMXOutput(lightingOutput);
    
    // Мониторинг производительности
    const processingTime = performance.now() - startTime;
    if (processingTime > 20) { // 20ms для 50 FPS
      console.warn(`Fast loop exceeded time budget: ${processingTime}ms`);
    }
  }

  private slowTick(): void {
    // Долгосрочные обновления
    this.brainFacade.updateSlow(Date.now());
    
    // Hot-reload конфигов (если включено)
    if (this.config.enableHotReload) {
      this.brainFacade.reloadConfigs();
      this.lightingFacade.reloadConfigs();
    }
  }
}
```

#### 1.3. BrainFacade (обновлённый согласно ARCHITECTURE.md)
**Файл:** `src/brain/facade.ts`
```typescript
interface BrainFacadeConfig {
  stateMachine: StateMachineConfig;
  sceneSelector: SceneSelectorConfig;
  effectEngine: EffectEngineConfig;
}

class BrainFacade {
  constructor(
    private stateMachine: StateMachine,
    private sceneSelector: SceneSelector,
    private effectEngine: EffectEngine,  // Обязательная зависимость
    private config: BrainFacadeConfig
  ) {}

  update(metrics: RuntimeMetrics): BrainOutput {
    // 1. Обновление State Machine
    const brainState = this.stateMachine.update(metrics.audio, metrics);
    
    // 2. Выбор сцены (data-driven подход)
    const sceneState = this.sceneSelector.selectScene(
      brainState,
      metrics,
      this.state.history.scenes
    );
    
    // 3. Генерация эффектов через EffectEngine
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
    // Долгосрочные обновления
    this.stateMachine.updateSlow(now);
    this.sceneSelector.updateSlow(now);
  }

  reloadConfigs(): void {
    // Перезагрузка конфигураций сцен, правил и эффектов
    this.sceneSelector.reloadScenes();
    this.effectEngine.reloadEffects();
  }
}
```

#### 1.4. LightingFacade
**Файл:** `src/lighting/facade.ts`
```typescript
class LightingFacade {
  constructor(
    private patchManager: PatchManager,
    private attributeManager: AttributeManager,
    private config: LightingFacadeConfig
  ) {}

  update(brainOutput: BrainOutput): LightingOutput {
    // 1. Применение эффектов к атрибутам
    for (const effect of brainOutput.groupEffects) {
      this.attributeManager.applyGroupEffect(effect.groupId, effect);
    }
    
    // 2. Получение финальных состояний
    const finalStates = this.attributeManager.getAll();
    
    // 3. Рендеринг DMX (mock для Phase 1)
    const universeFrames = this.renderToDMX(finalStates);
    
    return {
      universeFrames,
      fixtureStates: finalStates
    };
  }
}
```

### 2. Базовые утилиты

#### 2.1. Logger (`src/utils/logger.ts`)
```typescript
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export class Logger {
  constructor(private level: LogLevel = LogLevel.INFO) {}
  
  info(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.INFO) {
      console.log(`[INFO] ${message}`, ...args);
    }
  }
  
  // ... другие методы
}
```

#### 2.2. Config Loader (`src/utils/config.ts`)
```typescript
export class ConfigLoader {
  async load<T>(path: string): Promise<T> {
    const content = await fs.readFile(path, 'utf-8');
    return JSON.parse(content) as T;
  }
  
  async loadAll(): Promise<AppConfig> {
    return {
      fixtures: await this.load('./config/fixtures.json'),
      patch: await this.load('./config/patch.json'),
      scenes: await this.load('./config/scenes.json'),
      styles: await this.load('./config/styles.json')
    };
  }
}
```

#### 2.3. Math utilities (`src/utils/math.ts`)
```typescript
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  return ((value - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin;
}
```

### 3. Mock runtime для тестирования с расширяемой архитектурой

#### 3.1. Scripts для офлайн-тестирования (обновлённый)
**Файл:** `scripts/mock-runtime.ts`
```typescript
import { Engine } from '../src/engine/engine';
import { AudioAnalyzer } from '../src/audio/analyzer';
import { BrainFacade } from '../src/brain/facade';
import { LightingFacade } from '../src/lighting/facade';
import { ControlAPI } from '../src/control/api';
import { MetricSourceManager } from '../src/metrics/manager';
import { OutputSinkManager } from '../src/outputs/manager';
import { PluginManager } from '../src/plugins/manager';

async function runMockRuntime() {
  console.log('Starting mock runtime with expandable architecture...');
  
  // Загрузка data-driven конфигов
  const configLoader = new ConfigLoader();
  const configs = await configLoader.loadAll();
  
  // Инициализация менеджеров расширяемости
  const metricSourceManager = new MetricSourceManager();
  const outputSinkManager = new OutputSinkManager();
  const pluginManager = new PluginManager();
  
  // Инициализация AudioAnalyzer (mock версия для Phase 1)
  const audioAnalyzer = new AudioAnalyzer(configs.audio);
  
  // Инициализация фасадов с data-driven зависимостями
  const brainFacade = new BrainFacade(/* ... */);
  const lightingFacade = new LightingFacade(/* ... */);
  
  // Инициализация ControlAPI
  const controlAPI = new ControlAPI(8080);
  
  // Создание Engine с полным набором зависимостей
  const engine = new Engine(
    audioAnalyzer,
    brainFacade,
    lightingFacade,
    controlAPI,
    {
      fastTickInterval: 40,
      slowTickInterval: 500,
      enableHotReload: true
    }
  );
  
  // Запуск
  engine.start();
  
  console.log('Mock runtime started with expandable architecture. Press Ctrl+C to stop.');
}

runMockRuntime().catch(console.error);
```

#### 3.2. Тестовые данные в формате RuntimeMetrics
**Файл:** `test-data/mock-runtime-metrics.json`
```json
{
  "frames": [
    {
      "timestamp": 0,
      "audio": {
        "energy": 0.1,
        "beat": false,
        "bpm": null,
        "mood": "calm"
      },
      "vision": null,
      "sensors": null
    },
    {
      "timestamp": 40,
      "audio": {
        "energy": 0.15,
        "beat": false,
        "bpm": null,
        "mood": "calm"
      },
      "vision": null,
      "sensors": null
    },
    // ... 100+ фреймов в расширяемом формате
  ]
}
```

#### 3.3. Скелетные реализации для расширяемости
**Файл:** `src/metrics/manager.ts` (пример)
```typescript
export class MetricSourceManager {
  private sources: Map<string, MetricSource> = new Map();
  
  registerSource(source: MetricSource): void {
    this.sources.set(source.name, source);
  }
  
  async collectAllMetrics(): Promise<RuntimeMetrics> {
    const metrics: RuntimeMetrics = {
      audio: null as any, // будет заполнено AudioAnalyzer
      timestamp: Date.now()
    };
    
    // В Phase 1 собираем только audio метрики
    return metrics;
  }
}
```

**Файл:** `src/plugins/manager.ts` (скелетная реализация)
```typescript
export class PluginManager {
  private plugins: Map<string, Plugin> = new Map();
  
  async loadPlugin(pluginPath: string): Promise<void> {
    console.log(`Plugin loading would be implemented in Phase 4: ${pluginPath}`);
  }
  
  // Скелетные методы для Phase 1
}
```

### 4. Конфигурационные файлы (обновление согласно data-driven архитектуре)

#### 4.1. Основные конфигурационные файлы для Phase 1
**Файл:** `config/scenes.json` (data-driven формат)
```json
{
  "scenes": [
    {
      "id": "idle-static",
      "name": "Idle Static",
      "allowedStates": ["Idle"],
      "paletteId": "warm",
      "baseIntensity": 0.3,
      "effectDescriptors": [
        {
          "type": "dim/none",
          "groupId": "BEAMS",
          "params": {}
        },
        {
          "type": "pos/none",
          "groupId": "BEAMS",
          "params": {}
        }
      ]
    },
    {
      "id": "chill-pulse",
      "name": "Chill Pulse",
      "allowedStates": ["Chill"],
      "paletteId": "cool",
      "baseIntensity": 0.6,
      "effectDescriptors": [
        {
          "type": "dim/pulse",
          "groupId": "BEAMS",
          "params": {
            "speed": 1.0,
            "depth": 0.5
          }
        }
      ]
    }
  ]
}
```

#### 4.2. Новые data-driven конфигурационные файлы (скелетные)
**Файл:** `config/scenes-rules.json` (правила выбора сцен)
```json
{
  "rules": [
    {
      "sceneId": "idle-static",
      "conditions": {
        "brainState": ["Idle"],
        "energyMax": 0.3
      },
      "weight": 1.0,
      "cooldown": 30000
    },
    {
      "sceneId": "chill-pulse",
      "conditions": {
        "brainState": ["Chill"],
        "energyMin": 0.3,
        "energyMax": 0.7
      },
      "weight": 1.0
    }
  ]
}
```

**Файл:** `config/effects.json` (регистр эффектов)
```json
{
  "handlers": {
    "dim/none": {
      "description": "No dimming effect",
      "defaultParams": {}
    },
    "dim/pulse": {
      "description": "Pulsing dim effect",
      "defaultParams": {
        "speed": 1.0,
        "depth": 0.5,
        "phase": 0
      }
    },
    "pos/none": {
      "description": "No position effect",
      "defaultParams": {}
    }
  }
}
```

**Файл:** `config/plugins.json` (конфигурация плагинов)
```json
{
  "enabled": [
    "core-audio",
    "core-dmx"
  ],
  
  "plugins": {
    "core-audio": {
      "type": "builtin",
      "config": {
        "sampleRate": 44100,
        "frameSize": 1024
      }
    },
    "core-dmx": {
      "type": "builtin",
      "config": {
        "artNetHost": "127.0.0.1",
        "artNetPort": 6454
      }
    }
  }
}
```

### 5. Тестирование Phase 1

#### 5.1. Unit тесты
```typescript
// tests/engine/engine.test.ts
describe('Engine', () => {
  test('should start and run fast/slow ticks', () => {
    const engine = new Engine(/* ... */);
    engine.start();
    // Проверка что таймеры запущены
  });
});

// tests/brain/facade.test.ts
describe('BrainFacade', () => {
  test('should update brain state based on audio metrics', () => {
    const facade = new BrainFacade(/* ... */);
    const metrics = { audio: { energy: 0.5, beat: false, bpm: null, mood: 'calm' } };
    const output = facade.update(metrics);
    expect(output.brainState).toBeDefined();
  });
});
```

#### 5.2. Интеграционные тесты
```typescript
// tests/integration/mock-runtime.test.ts
describe('Mock Runtime', () => {
  test('should process mock audio data end-to-end', async () => {
    await runMockRuntime();
    // Проверка что система не падает и логирует корректно
  });
});
```

## Порядок выполнения (обновлённый)

### Неделя 1: Подготовка инфраструктуры и базовых интерфейсов
1. **День 1-2:** Создание расширенной структуры проекта
   - Создать все директории согласно ARCHITECTURE.md: `src/engine/`, `src/audio/`, `src/brain/`, `src/lighting/`, `src/control/`, `src/metrics/`, `src/outputs/`, `src/plugins/`, `src/utils/`
   - Реализовать `Logger` и `ConfigLoader`
   - Настроить TypeScript конфигурацию и пути импорта

2. **День 3-4:** Интерфейсы и типы (data-driven подход)
   - Определить все TypeScript интерфейсы из ARCHITECTURE.md с акцентом на data-driven архитектуру
   - Создать файлы `types.ts` для каждого модуля, включая интерфейсы для плагинов, метрик и выходов
   - Реализовать базовые интерфейсы: `MetricSource`, `OutputSink`, `Plugin`, `EffectDescriptor`, `SceneRule`

3. **День 5:** Конфигурационные файлы и mock runtime
   - Создать все конфигурационные файлы в data-driven формате: `scenes.json`, `scenes-rules.json`, `effects.json`, `plugins.json`
   - Создать `scripts/mock-runtime.ts` с поддержкой расширяемой архитектуры
   - Подготовить тестовые данные в формате совместимом с `RuntimeMetrics`

### Неделя 2: Реализация фасадов и ядра системы
1. **День 1-2:** BrainFacade с EffectEngine
   - Реализовать StateMachine (упрощённую версию)
   - Реализовать SceneSelector с data-driven правилами
   - Реализовать EffectEngine с регистром обработчиков эффектов
   - Интегрировать все компоненты в BrainFacade

2. **День 3-4:** LightingFacade и управление состоянием
   - Реализовать PatchManager (загрузку конфигов fixtures, patch, layout)
   - Реализовать AttributeManager с поддержкой data-driven эффектов
   - Реализовать MergeEngine для объединения слоёв
   - Интегрировать в LightingFacade

3. **День 5:** Engine и система расширяемости
   - Реализовать Engine с двумя циклами и мониторингом производительности
   - Создать скелетные реализации менеджеров: `MetricSourceManager`, `OutputSinkManager`, `PluginManager`
   - Интегрировать ControlAPI (базовую версию)
   - Настроить логирование и мониторинг производительности

### Неделя 3: Тестирование, интеграция и отладка
1. **День 1-2:** Unit тесты для data-driven компонентов
   - Написать тесты для SceneSelector с правилами
   - Написать тесты для EffectEngine и регистра эффектов
   - Написать тесты для фасадов с mock зависимостями
   - Настроить Jest конфигурацию для TypeScript

2. **День 3-4:** Интеграционные тесты и end-to-end проверка
   - Протестировать полный data-driven flow: конфиги → правила → эффекты → DMX
   - Протестировать hot-reload конфигураций
   - Отладить взаимодействие между всеми модулями
   - Проверить производительность fast loop с мониторингом

3. **День 5:** Документация, финализация и подготовка к Phase 2
   - Обновить README с инструкциями по запуску и конфигурации
   - Создать документацию по data-driven API Phase 1
   - Подготовить демонстрацию работы системы с mock данными
   - Создать план миграции существующих конфигов в data-driven формат

## Критерии успеха Phase 1 (обновлённые)

- [ ] Проект компилируется без ошибок TypeScript с расширенной структурой
- [ ] Mock runtime запускается и работает без падений с data-driven конфигами
- [ ] BrainFacade корректно обрабатывает mock audio данные через EffectEngine
- [ ] SceneSelector работает с data-driven правилами из scenes-rules.json
- [ ] LightingFacade генерирует DMX данные на основе data-driven эффектов
- [ ] Engine управляет fast/slow циклами с мониторингом производительности
- [ ] Все unit тесты проходят для data-driven компонентов
- [ ] Интеграционный тест проходит end-to-end с полным data-driven flow
- [ ] Логирование работает на разных уровнях с производительностью fast loop
- [ ] Конфиги в data-driven формате загружаются и валидируются корректно
- [ ] Скелетные реализации менеджеров расширяемости созданы (MetricSourceManager, OutputSinkManager, PluginManager)
- [ ] ControlAPI интегрирован в Engine конструктор

## Следующие шаги после Phase 1

1. **Phase 2:** Реализация Audio Analyzer с реальной обработкой аудио и интеграцией как MetricSource
2. **Phase 3:** Реализация DMX Renderer с Art-Net output как OutputSink
3. **Phase 4:** Web UI и полноценный Control API с WebSocket
4. **Phase 5:** Расширение data-driven системы: больше эффектов, сложные правила, plugin экосистема
5. **Phase 6:** Оптимизация производительности: object pooling, worker threads, предварительные вычисления

## Риски и mitigation

| Риск | Вероятность | Влияние | Mitigation |
|------|-------------|---------|------------|
| Сложность интеграции модулей | Средняя | Высокое | Чёткие интерфейсы, mock-first подход |
| Проблемы с производительностью | Низкая | Низкое | Phase 1 использует mock данные |
| Недостаток тестовых данных | Средняя | Среднее | Создание разнообразных mock сценариев |
| Сложность отладки асинхронного кода | Высокая | Среднее | Детальное логирование, step-by-step отладка |

## Требования к окружению

- Node.js 18+
- TypeScript 5.0+
- npm или yarn
- Редактор с поддержкой TypeScript (VS Code рекомендовано)

## Команды для запуска

```bash
# Установка зависимостей
npm install

# Компиляция TypeScript
npm run build

# Запуск mock runtime
npm run mock

# Запуск тестов
npm test

# Запуск в dev режиме (watch)
npm run dev
```

---

**Дата создания плана:** 2026-02-10  
**Статус:** Готов к review  
**Следующий шаг:** Обсуждение с пользователем и переход к реализации