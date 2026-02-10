# Phase 1 Implementation Plan - Базовый каркас

## Обзор
Цель Phase 1: Создать работающий прототип с минимальной функциональностью, включая фасадные модули, базовые утилиты и mock runtime для тестирования.

## Сроки: 2-3 недели

## Задачи

### 1. Структура проекта и фасадные модули

#### 1.1. Создание директорий и файлов
```
src/
├── engine/           # Главный фасад и циклы
│   ├── index.ts
│   ├── engine.ts
│   ├── fastLoop.ts
│   ├── slowLoop.ts
│   └── types.ts
├── brain/
│   ├── facade.ts     # BrainFacade
│   └── types.ts
├── lighting/
│   ├── facade.ts     # LightingFacade
│   └── types.ts
└── utils/
    ├── logger.ts
    ├── config.ts
    └── math.ts
```

#### 1.2. Engine фасад
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
    private brainFacade: BrainFacade,
    private lightingFacade: LightingFacade,
    private config: EngineConfig
  ) {}

  start(): void {
    // Запуск двух таймеров
    setInterval(() => this.fastTick(), this.config.fastTickInterval);
    setInterval(() => this.slowTick(), this.config.slowTickInterval);
  }

  private fastTick(): void {
    // Mock audio data для Phase 1
    const mockAudioMetrics = this.generateMockAudioMetrics();
    
    // Brain processing
    const brainOutput = this.brainFacade.update(mockAudioMetrics);
    
    // Lighting processing
    const lightingOutput = this.lightingFacade.update(brainOutput);
    
    // Mock DMX output (логирование)
    this.logDMXOutput(lightingOutput);
  }

  private slowTick(): void {
    // Долгосрочные обновления
    this.brainFacade.updateSlow(Date.now());
  }
}
```

#### 1.3. BrainFacade
**Файл:** `src/brain/facade.ts`
```typescript
interface BrainFacadeConfig {
  stateMachine: StateMachineConfig;
  sceneSelector: SceneSelectorConfig;
}

class BrainFacade {
  constructor(
    private stateMachine: StateMachine,
    private sceneSelector: SceneSelector,
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
    
    // 3. Генерация эффектов (упрощённая для Phase 1)
    const groupEffects = this.generateSimpleEffects(sceneState, metrics);
    
    return {
      brainState,
      sceneState,
      groupEffects
    };
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

### 3. Mock runtime для тестирования

#### 3.1. Scripts для офлайн-тестирования
**Файл:** `scripts/mock-runtime.ts`
```typescript
import { Engine } from '../src/engine/engine';
import { BrainFacade } from '../src/brain/facade';
import { LightingFacade } from '../src/lighting/facade';

async function runMockRuntime() {
  console.log('Starting mock runtime...');
  
  // Загрузка конфигов
  const configLoader = new ConfigLoader();
  const configs = await configLoader.loadAll();
  
  // Инициализация фасадов
  const brainFacade = new BrainFacade(/* ... */);
  const lightingFacade = new LightingFacade(/* ... */);
  
  // Создание Engine
  const engine = new Engine(brainFacade, lightingFacade, {
    fastTickInterval: 40,
    slowTickInterval: 500,
    enableHotReload: false
  });
  
  // Запуск
  engine.start();
  
  console.log('Mock runtime started. Press Ctrl+C to stop.');
}

runMockRuntime().catch(console.error);
```

#### 3.2. Тестовые данные
**Файл:** `test-data/mock-audio-metrics.json`
```json
{
  "frames": [
    {
      "timestamp": 0,
      "energy": 0.1,
      "beat": false,
      "bpm": null,
      "mood": "calm"
    },
    {
      "timestamp": 40,
      "energy": 0.15,
      "beat": false,
      "bpm": null,
      "mood": "calm"
    },
    // ... 100+ фреймов для тестирования
  ]
}
```

### 4. Конфигурационные файлы (обновление)

#### 4.1. Упрощённые конфиги для Phase 1
**Файл:** `config/scenes-simple.json`
```json
{
  "scenes": [
    {
      "id": "idle-static",
      "name": "Idle Static",
      "allowedStates": ["Idle"],
      "paletteId": "warm",
      "baseIntensity": 0.3,
      "effectDescriptors": {
        "BEAMS": {
          "dimEffectType": "none",
          "posEffectType": "none"
        }
      }
    },
    {
      "id": "chill-pulse",
      "name": "Chill Pulse",
      "allowedStates": ["Chill"],
      "paletteId": "cool",
      "baseIntensity": 0.6,
      "effectDescriptors": {
        "BEAMS": {
          "dimEffectType": "pulse",
          "posEffectType": "none"
        }
      }
    }
  ]
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

## Порядок выполнения

### Неделя 1: Подготовка инфраструктуры
1. **День 1-2:** Создание структуры проекта и базовых утилит
   - Создать директории `src/engine/`, `src/brain/`, `src/lighting/`, `src/utils/`
   - Реализовать `Logger` и `ConfigLoader`
   - Настроить TypeScript конфигурацию

2. **День 3-4:** Интерфейсы и типы
   - Определить все TypeScript интерфейсы из ARCHITECTURE.md
   - Создать файлы `types.ts` для каждого модуля
   - Настроить импорты и зависимости

3. **День 5:** Mock runtime
   - Создать `scripts/mock-runtime.ts`
   - Подготовить тестовые данные
   - Настроить запуск через npm scripts

### Неделя 2: Реализация фасадов
1. **День 1-2:** BrainFacade
   - Реализовать StateMachine (упрощённую версию)
   - Реализовать SceneSelector (базовую логику)
   - Интегрировать в BrainFacade

2. **День 3-4:** LightingFacade
   - Реализовать PatchManager (загрузку конфигов)
   - Реализовать AttributeManager (управление атрибутами)
   - Интегрировать в LightingFacade

3. **День 5:** Engine и интеграция
   - Реализовать Engine с двумя циклами
   - Интегрировать все фасады
   - Настроить логирование и мониторинг

### Неделя 3: Тестирование и отладка
1. **День 1-2:** Unit тесты
   - Написать тесты для ключевых модулей
   - Настроить Jest конфигурацию

2. **День 3-4:** Интеграционные тесты
   - Протестировать end-to-end flow
   - Отладить взаимодействие между модулями

3. **День 5:** Документация и финализация
   - Обновить README с инструкциями по запуску
   - Создать документацию по API Phase 1
   - Подготовить демонстрацию работы системы

## Критерии успеха Phase 1

- [ ] Проект компилируется без ошибок TypeScript
- [ ] Mock runtime запускается и работает без падений
- [ ] BrainFacade корректно обрабатывает mock audio данные
- [ ] LightingFacade генерирует DMX данные (в логах)
- [ ] Engine управляет fast/slow циклами
- [ ] Все unit тесты проходят
- [ ] Интеграционный тест проходит end-to-end
- [ ] Логирование работает на разных уровнях
- [ ] Конфиги загружаются корректно

## Следующие шаги после Phase 1

1. **Phase 2:** Реализация Audio Analyzer с реальной обработкой аудио
2. **Phase 3:** Реализация DMX Renderer с Art-Net output
3. **Phase 4:** Web UI и Control API
4. **Phase 5:** Data-driven эффекты и правила сцен

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