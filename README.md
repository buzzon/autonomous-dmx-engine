# Autonomous DMX Engine

Автономный «lighting designer in a box» — система, которая анализирует музыку в реальном времени и генерирует DMX/Art-Net световые шоу без участия светорежиссёра.

## 🚀 Статус проекта

**Phase 1: Базовый каркас - ВЫПОЛНЕНО ✅**

Проект успешно реализовал Phase 1 с расширенной функциональностью. Полный отчёт сравнения: [`plans/phase1-implementation-comparison.md`](plans/phase1-implementation-comparison.md)

## ✨ Особенности

- 🎵 **Реакция на музыку**: анализ энергии, ритма, BPM, настроения (mock данные в Phase 1)
- 🤖 **Автономность**: data-driven выбор сцен и эффектов на основе правил
- 💡 **DMX/Art-Net**: модульная архитектура с поддержкой любых приборов
- 🌐 **Web-интерфейс**: Control API для управления и мониторинга
- 🔧 **Расширяемость**: плагинная система, менеджеры метрик и выходов
- 📊 **Data-driven архитектура**: конфигурация через JSON файлы
- 🔄 **Hot-reload**: горячая перезагрузка конфигураций без остановки

## 🏗️ Архитектура

Проект построен по модульной архитектуре с четким разделением ответственности:

```
src/
├── engine/           # Главный фасад и циклы обработки
├── audio/            # Audio Analyzer (mock в Phase 1)
├── brain/            # Show Brain с State Machine, Scene Selector, Effect Engine
├── lighting/         # Lighting Engine с Patch, Attributes, DMX Renderer
├── control/          # Control API для внешнего управления
├── metrics/          # Система метрик (расширяемая)
├── outputs/          # Выходные каналы (DMX, консоль, файлы)
├── plugins/          # Плагинная система
└── utils/            # Утилиты (Logger, ConfigLoader, Math)
```

## 🚀 Быстрый старт

### Требования

- Node.js 18+
- TypeScript 5+
- npm или yarn

### Установка

```bash
npm install
```

### Конфигурация (Data-driven подход)

Проект использует конфигурационные файлы в формате JSON:

1. **Приборы и профили**: `config/fixtures.json`, `config/patch.json`
2. **Сцены и правила**: `config/scenes.json`, `config/scenes-rules.json`
3. **Эффекты**: `config/effects.json` (регистр обработчиков эффектов)
4. **Плагины**: `config/plugins.json`
5. **Стили и расположение**: `config/styles.json`, `config/layout.json`

### Запуск mock runtime (Phase 1)

Для тестирования полного цикла обработки:

```bash
npm run mock
```

Или напрямую через ts-node:

```bash
npx ts-node scripts/mock-runtime.ts
```

### Запуск в dev режиме

```bash
npm run dev
```

### Сборка проекта

```bash
npm run build
```

### Тестирование

```bash
npm test
```

## 📁 Структура конфигурационных файлов

### Сцены (`config/scenes.json`)
Data-driven описание сцен с эффектами для групп приборов:
```json
{
  "scenes": [
    {
      "id": "ChillSoftMovement",
      "name": "Chill Soft Movement",
      "allowedStates": ["Chill"],
      "paletteId": "cool",
      "baseIntensity": 0.6,
      "effectDescriptors": [
        {
          "type": "pos/circle",
          "groupId": "BEAMS",
          "params": { "speed": 0.5, "radius": 0.3 }
        }
      ]
    }
  ]
}
```

### Правила выбора сцен (`config/scenes-rules.json`)
Сложные условия для автоматического выбора сцен:
```json
{
  "rules": [
    {
      "sceneId": "PartyBeams",
      "conditions": {
        "brainState": ["Party"],
        "energyMin": 0.7,
        "mood": ["medium", "hard"],
        "timeOfDay": { "start": "20:00", "end": "06:00" },
        "dayOfWeek": [4, 5, 6]
      },
      "weight": 1.5,
      "cooldown": 15000
    }
  ]
}
```

### Эффекты (`config/effects.json`)
Регистр обработчиков эффектов с категориями и группами:
```json
{
  "handlers": {
    "dim/pulse": {
      "description": "Pulsing dim effect",
      "defaultParams": { "speed": 1.0, "depth": 0.5 },
      "category": "dim",
      "supportedGroups": ["BEAMS", "WASH", "SPOTS"]
    }
  }
}
```

## 🔧 Основные команды

| Команда | Описание |
|---------|----------|
| `npm install` | Установка зависимостей |
| `npm run build` | Сборка TypeScript в JavaScript |
| `npm run dev` | Запуск в режиме разработки |
| `npm run mock` | Запуск mock runtime для тестирования |
| `npm test` | Запуск unit тестов |
| `npm run lint` | Проверка кода с ESLint |

## 📊 Roadmap

### ✅ Phase 1: Базовый каркас (ВЫПОЛНЕНО)
- [x] Модульная архитектура с фасадами
- [x] Data-driven конфигурационные файлы
- [x] Mock runtime для end-to-end тестирования
- [x] Logger и ConfigLoader с hot-reload
- [x] BrainFacade с State Machine, Scene Selector, Effect Engine
- [x] LightingFacade с Patch Manager, Attribute Manager, DMX Renderer
- [x] Engine с fast/slow циклами и мониторингом производительности

### 🚧 Phase 2: Реальная обработка аудио
- [ ] Реализация Audio Analyzer с FFT и beat detection
- [ ] Интеграция с реальными аудио источниками (микрофон, файлы)
- [ ] Улучшенная система метрик

### 📅 Phase 3: Реальный DMX вывод
- [ ] Интеграция с Art-Net/real DMX
- [ ] Поддержка различных протоколов вывода
- [ ] Оптимизация производительности рендеринга

### 🎨 Phase 4: Web UI и управление
- [ ] Полноценный Web интерфейс
- [ ] WebSocket API для реального управления
- [ ] Визуализация состояний и метрик

### 🔮 Phase 5+: Расширенные возможности
- [ ] Vision Analyzer (анализ заполненности помещения)
- [ ] ML для улучшения выбора сцен
- [ ] Расширенная плагинная система
- [ ] Интеграция с визуальным рендером

## 🧪 Тестирование

Проект включает тестовую инфраструктуру:

- **Unit тесты**: `tests/unit/` для основных утилит
- **Mock runtime**: Полный end-to-end тест в `scripts/mock-runtime.ts`
- **Jest конфигурация**: Настроен для TypeScript

Для запуска тестов:
```bash
npm test
```

## 📚 Документация

- **[DESIGN.md](./DESIGN.md)** — полный дизайн-документ с алгоритмами и концепциями
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — модули, интерфейсы, структура кода
- **[plans/phase1-implementation.md](./plans/phase1-implementation.md)** — план реализации Phase 1
- **[plans/phase1-implementation-comparison.md](./plans/phase1-implementation-comparison.md)** — отчёт сравнения реализации с планом

## 🛠️ Технологии

- **Backend**: Node.js, TypeScript
- **Архитектура**: Модульная, event-driven, data-driven
- **Audio**: Web Audio API (в будущем), mock данные (Phase 1)
- **DMX**: Art-Net (npm: `artnet`) - подготовлено для интеграции
- **Сеть**: Express, Socket.IO для Control API
- **Тестирование**: Jest, ts-node для mock runtime
- **Логирование**: Структурированные логи с контекстом

## 📈 Производительность

- **Fast loop**: 40ms (25 FPS) для обработки аудио и генерации DMX
- **Slow loop**: 500ms для долгосрочных обновлений и health checks
- **Мониторинг**: Встроенный мониторинг времени обработки и использования памяти
- **Hot-reload**: Перезагрузка конфигураций без остановки системы

## 🤝 Вклад в проект

Проект находится в активной разработке. Вопросы, предложения и pull requests приветствуются!

## 📄 Лицензия

MIT

## 📞 Контакты
buzzondev@gmail.com
Проект в разработке. Вопросы и предложения — welcome!
