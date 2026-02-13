# Phase 2 Implementation Plan - Реальная обработка аудио и DMX вывод

## Обзор
**Цель Phase 2:** Заменить mock компоненты Phase 1 на реальную функциональность:
1. Реальная обработка аудио с FFT и beat detection
2. Реальный DMX вывод через Art-Net
3. Расширение ControlAPI с WebSocket и Web UI
4. Реализация реальных менеджеров расширяемости

**Сроки:** 3-4 недели (детальный план ниже)

## Текущее состояние (после Phase 1)
✅ **Выполнено в Phase 1:**
- Полная архитектура с фасадами (Engine, BrainFacade, LightingFacade)
- Data-driven конфигурации (scenes, rules, effects, plugins)
- Mock runtime для тестирования
- Базовые утилиты (Logger, ConfigLoader, Math)
- Скелетные реализации менеджеров расширяемости

## Цели Phase 2

### 1. Реальный Audio Analyzer
**Текущее состояние:** Mock реализация в `src/audio/analyzer.ts`
**Цель:** Реальная обработка аудио с:
- FFT анализ для спектральных характеристик
- Алгоритм beat detection из DESIGN.md
- BPM estimation с адаптивной фильтрацией
- Mood classification на основе энергии и BPM
- Поддержка различных источников аудио (микрофон, файл, stream)
- **Реальное время переключение между источниками**

### 2. Реальный DMX Output
**Текущее состояние:** Mock DMX в `src/outputs/manager.ts`
**Цель:** Реальный вывод DMX через:
- Art-Net протокол (библиотека `artnet` уже в зависимостях)
- Поддержка multiple universes
- Оптимизация производительности для 40ms цикла
- Failover и мониторинг соединения

### 3. Расширенный ControlAPI
**Текущее состояние:** Скелетная реализация в `src/control/api.ts`
**Цель:** Полноценный Control API с:
- WebSocket для real-time обновлений
- REST API для конфигурации
- Web UI для визуализации и управления
- Аутентификация и авторизация

### 4. Реальные менеджеры расширяемости
**Текущее состояние:** Mock реализации
**Цель:** Рабочие менеджеры:
- `MetricSourceManager` с реальными источниками метрик
- `OutputSinkManager` с реальными выходными каналами
- `PluginManager` с загрузкой плагинов

## Детальные задачи

### Неделя 1: Реальный Audio Analyzer

#### День 1-2: Архитектура и зависимости
1. **Анализ требований к производительности:**
   - Обработка аудио фреймов за < 5ms для 40ms цикла
   - Поддержка sample rates: 44.1kHz, 48kHz
   - Frame size: 1024-4096 samples

2. **Выбор библиотек:**
   - `node-web-audio-api` или `audio-decode` для работы с аудио
   - `fft.js` или собственный FFT для анализа
   - `node-microphone` для захвата с микрофона

3. **Обновление зависимостей:**
   ```json
   {
     "dependencies": {
       "node-web-audio-api": "^0.15.0",
       "fft.js": "^4.0.4",
       "node-microphone": "^0.1.6",
       "audio-decode": "^1.4.0"
     }
   }
   ```

#### День 3-4: Реализация Audio Analyzer
1. **FFT анализ:**
   ```typescript
   class FFTAnalyzer {
     private fft: FFT;
     private window: Float32Array;
     
     analyze(samples: Float32Array): SpectralAnalysis {
       // Применение window function
       // Выполнение FFT
       // Вычисление спектральных характеристик
     }
   }
   ```

2. **Beat detection алгоритм:**
   ```typescript
   class BeatDetector {
     detect(energyHistory: number[], currentEnergy: number): BeatDetection {
       // Алгоритм из DESIGN.md:
       // 1. Вычисление moving average
       // 2. Вычисление variance
       // 3. Порог: c * variance
       // 4. Обнаружение пиков
     }
   }
   ```

3. **BPM estimation:**
   ```typescript
   class BPMEstimator {
     estimate(beatTimestamps: number[]): BPMEstimation {
       // Интервалы между битами
       // Медианная фильтрация
       // Конвертация в BPM
       // Сглаживание
     }
   }
   ```

#### День 5: Интеграция и тестирование
1. **Интеграция с Engine:**
   - Замена mock audio данных на реальные
   - Настройка аудио источника (микрофон/файл)
   - Тестирование производительности

2. **Unit тесты:**
   - Тесты для FFT анализа
   - Тесты для beat detection
   - Тесты для BPM estimation

### Неделя 2: Реальный DMX Output

#### День 1-2: Архитектура Art-Net
1. **Изучение Art-Net протокола:**
   - Art-Net III спецификация
   - Packet structure (OpCode 0x5000: OpOutput)
   - Universe addressing

2. **Интеграция библиотеки `artnet`:**
   ```typescript
   import ArtNet from 'artnet';
   
   class ArtNetSink implements OutputSink {
     private artnet: any;
     
     async initialize(config: DMXOutputConfig): Promise<void> {
       this.artnet = ArtNet({
         host: config.host,
         port: config.port,
         refresh: config.refreshRate
       });
     }
   }
   ```

3. **Оптимизация производительности:**
   - Object pooling для DMX frames
   - Batch отправка
   - Rate limiting

#### День 3-4: Реализация DMX Renderer
1. **Расширение DMXRenderer:**
   ```typescript
   class RealDMXRenderer extends DMXRenderer {
     renderToDMX(fixtureStates: Map<string, FixtureState>): UniverseFrame[] {
       // Реальное преобразование атрибутов в DMX значения
       // Поддержка всех каналов фикстур
       // Gamma correction
       // Smooth transitions
     }
   }
   ```

2. **Fixture profiles:**
   - Реализация полных профилей фикстур
   - Поддержка различных типов (moving heads, washes, pars)
   - Автоматическое маппинг атрибутов на каналы

3. **Конфигурация:**
   - Расширение `config/fixtures.json`
   - Поддержка реальных fixture profiles
   - Universe mapping

#### День 5: Интеграция и тестирование
1. **Интеграция с OutputSinkManager:**
   - Замена mock DMX sink на реальный
   - Настройка failover
   - Мониторинг соединения

2. **Тестирование с реальным оборудованием:**
   - Тестирование с DMX девайсами
   - Измерение latency
   - Проверка стабильности

### Неделя 3: Расширенный ControlAPI

#### День 1-2: WebSocket API
1. **Реализация WebSocket сервера:**
   ```typescript
   class WebSocketAPI {
     private io: SocketIO.Server;
     
     setup(server: http.Server): void {
       this.io = new SocketIO.Server(server);
       
       this.io.on('connection', (socket) => {
         // Подписка на события
         // Отправка состояния
       });
     }
   }
   ```

2. **Real-time события:**
   - Audio metrics updates
   - Brain state changes
   - Scene transitions
   - DMX output

#### День 3-4: Web UI
1. **Базовый интерфейс:**
   - Dashboard с метриками
   - Визуализация аудио анализа
   - Управление сценами
   - Конфигурация системы

2. **Технологии:**
   - React или Vue.js для фронтенда
   - WebGL для 3D визуализации
   - Chart.js для графиков

#### День 5: REST API и аутентификация
1. **REST endpoints:**
   ```typescript
   // GET /api/state - текущее состояние
   // POST /api/scenes/:id/activate - активация сцены
   // PUT /api/config - обновление конфигурации
   ```

2. **Аутентификация:**
   - JWT tokens
   - Role-based access control
   - Rate limiting

### Неделя 4: Интеграция и оптимизация

#### День 1-2: Система конфигураций площадок и менеджеры
1. **Система конфигураций площадок:**
   ```typescript
   class VenueConfigManager {
     private activeVenue: string;
     
     async switchVenue(venueId: string): Promise<void> {
       // Загрузка конфигурации площадки
       // Применение переопределений к базовым конфигам
       // Hot-reload всех компонентов
     }
     
     getCurrentVenue(): string {
       return this.activeVenue;
     }
   }
   ```

2. **MetricSourceManager:**
   ```typescript
   class RealMetricSourceManager extends MetricSourceManager {
     async collectAllMetrics(): Promise<RuntimeMetrics> {
       // Сбор метрик из всех источников
       // Audio metrics из AudioAnalyzer
       // System metrics (CPU, memory)
       // Network metrics
     }
   }
   ```

3. **PluginManager:**
   - Загрузка плагинов из файловой системы
   - Sandboxing для безопасности
   - Hot reload плагинов

#### День 3-4: Производительность и оптимизация
1. **Профилирование:**
   - Измерение времени выполнения каждого компонента
   - Выявление bottlenecks
   - Оптимизация критических путей

2. **Оптимизации:**
   - Object pooling для часто создаваемых объектов
   - Precomputed lookup tables
   - Worker threads для тяжёлых вычислений

#### День 5: Тестирование и документация
1. **End-to-end тестирование:**
   - Полный pipeline: аудио → анализ → brain → lighting → DMX
   - Стресс-тестирование
   - Long-running тесты

2. **Документация:**
   - API документация
   - Руководство по настройке
   - Примеры использования

## Критерии успеха Phase 2

### Audio Analyzer:
- [ ] Реальная обработка аудио с микрофона/файла
- [ ] Точность beat detection > 85%
- [ ] BPM estimation error < 5%
- [ ] Обработка фрейма за < 5ms
- [ ] Поддержка multiple audio sources

### DMX Output:
- [ ] Реальный вывод через Art-Net
- [ ] Поддержка до 8 universes
- [ ] Latency < 10ms
- [ ] Стабильность при 40ms refresh rate
- [ ] Failover при потере соединения

### ControlAPI:
- [ ] WebSocket для real-time обновлений
- [ ] REST API для управления
- [ ] Базовый Web UI
- [ ] Аутентификация и авторизация
- [ ] Документация API

### Система конфигураций:
- [ ] Поддержка профилей площадок
- [ ] Hot-switch между конфигурациями
- [ ] Наследование от базовых конфигов
- [ ] Управление через Web UI

### Общие:
- [ ] Все unit тесты проходят
- [ ] Интеграционные тесты с реальным оборудованием
- [ ] Производительность в пределах требований
- [ ] Документация обновлена

## Архитектурные изменения

### 1. Новая структура Audio модуля:
```
src/audio/
├── analyzer.ts           # Основной AudioAnalyzer
├── fft/                  # FFT анализ
│   ├── fftAnalyzer.ts
│   ├── windowFunctions.ts
│   └── spectralAnalysis.ts
├── beatDetection/        # Beat detection
│   ├── beatDetector.ts
│   ├── energyCalculator.ts
│   └── bpmEstimator.ts
├── sources/              # Audio sources
│   ├── microphoneSource.ts
│   ├── fileSource.ts
│   ├── streamSource.ts
│   └── sourceManager.ts  # Управление переключением источников
├── features/             # Audio features
│   ├── moodClassifier.ts
│   ├── spectralFeatures.ts
│   └── temporalFeatures.ts
└── types.ts              # Типы
```

### 4. Система конфигураций для разных площадок:
```
config/
├── base/                 # Базовые конфигурации
│   ├── fixtures.json
│   ├── patch.json
│   ├── scenes.json
│   └── effects.json
├── venues/               # Конфигурации площадок
│   ├── club-red/
│   │   ├── fixtures.json    # Переопределения
│   │   ├── patch.json
│   │   └── venue.json       # Метаданные площадки
│   ├── theater-blue/
│   │   ├── fixtures.json
│   │   └── patch.json
│   └── studio-green/
│       ├── fixtures.json
│       └── patch.json
└── active-venue.json     # Текущая активная площадка
```

### 2. Новая структура Outputs модуля:
```
src/outputs/
├── sinks/                # Output sinks
│   ├── artNetSink.ts     # Реальный Art-Net sink
│   ├── webSocketSink.ts  # WebSocket для UI
│   ├── fileSink.ts       # Запись в файл
│   └── consoleSink.ts    # Консольный вывод
├── renderers/            # DMX renderers
│   ├── dmxRenderer.ts    # Базовый рендерер
│   ├── fixtureRenderer.ts # Рендеринг по типам фикстур
│   └── gammaCorrection.ts # Gamma correction
├── protocols/            # Протоколы
│   ├── artNetProtocol.ts # Art-Net protocol
│   └── sacnProtocol.ts   # sACN protocol (future)
└── types.ts              # Типы
```

### 3. Новая структура Control модуля:
```
src/control/
├── api/                  # API сервер
│   ├── webSocketServer.ts
│   ├── restServer.ts
│   └── oscServer.ts     # OSC support (future)
├── webui/               # Web UI
│   ├── server.ts        # Static file server
│   ├── public/          # Frontend assets
│   └── src/             # Frontend source code
├── authentication/      # Аутентификация
│   ├── jwtAuth.ts
│   └── sessionManager.ts
└── types.ts             # Типы
```

## Зависимости

### Новые зависимости:
```json
{
  "dependencies": {
    // Audio processing
    "node-web-audio-api": "^0.15.0",
    "fft.js": "^4.0.4",
    "node-microphone": "^0.1.6",
    "audio-decode": "^1.4.0",
    
    // Web UI
    "express": "^4.18.0",
    "socket.io": "^4.6.0",
    "jsonwebtoken": "^9.0.0",
    
    // Уже есть в package.json:
    "artnet": "^1.4.0"
  },
  "devDependencies": {
    // Testing
    "@types/fft.js": "^4.0.0",
    "@types/jsonwebtoken": "^9.0.0",
    
    // Web UI development
    "webpack": "^5.0.0",
    "typescript-webpack-plugin": "^7.0.0"
  }
}
```

## Риски и mitigation

| Риск | Вероятность | Влияние | Mitigation |
|------|-------------|---------|------------|
| Производительность аудио обработки | Высокая | Высокое | Профилирование, оптимизация, worker threads |
| Стабильность Art-Net соединения | Средняя | Высокое | Failover, reconnection logic, мониторинг |
| Сложность beat detection алгоритма | Средняя | Среднее | Поэтапная реализация, extensive testing |
| Синхронизация WebSocket событий | Низкая | Среднее | Оптимизация сообщений, batching |
| Безопасность Web API | Средняя | Высокое | Аутентификация, валидация, rate limiting |

## Следующие шаги после Phase 2

1. **Phase 3:** Расширение data-driven системы
   - Больше эффектов и обработчиков
   - Сложные правила выбора сцен
   - Машинное обучение для адаптации

2. **Phase 4:** Plugin экосистема
   - Загрузка пользовательских плагинов
   - Marketplace для эффектов и сцен
   - Sandboxing для безопасности

3. **Phase 5:** Оптимизация производительности
   - Object pooling
   - Worker threads
   - GPU acceleration для визуализации

4. **Phase 6:** Расширение платформы
   - Поддержка других протоколов (MIDI, OSC)
   - Интеграция с DAW
   - Мобильное приложение

## Команды для запуска Phase 2

```bash
# Установка новых зависимостей
npm install

# Запуск с реальным аудио
npm run start -- --audio-source=mic

# Запуск с Art-Net
npm run start -- --dmx-output=artnet --artnet-host=192.168.1.100

# Запуск Web UI
npm run ui

# Запуск тестов
npm test
```

---

**Дата создания плана:** 2026-02-11  
**Статус:** Готов к review  
**Следующий шаг:** Обсуждение с пользователем и начало реализации