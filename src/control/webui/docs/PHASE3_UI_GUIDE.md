# Phase 3 UI Guide - Autonomous DMX Engine

## Обзор

Phase 3 UI представляет собой расширенный интерфейс управления для Autonomous DMX Engine, включающий визуализацию аудио, мониторинг DMX, редакторы сцен и эффектов, а также систему безопасности.

## Архитектура

### Компоненты

```
src/control/webui/
├── App.tsx              # Главный компонент приложения
├── main.ts              # Точка входа
├── layouts/             # Макеты интерфейса
├── pages/              # Страницы приложения
├── components/         # Переиспользуемые компоненты
├── store/              # Управление состоянием
├── utils/              # Вспомогательные утилиты
├── types/              # TypeScript типы
└── test/               # Тесты
```

### Управление состоянием

**Основной Store (`store.ts`)**:
- Системное состояние (режим, интенсивность)
- UI состояние (тема, layout, текущая страница)
- Аудио метрики (энергия, BPM, биты)
- Реалтайм данные (waveform, spectrum, DMX)
- Состояние сокета

**Расширенный Store (`store-extended.ts`)**:
- Конфигурация сцен и эффектов
- Управление фикстурами
- Правила автоматизации
- Система безопасности
- Мобильная адаптация

## Страницы приложения

### 1. Dashboard (Главная страница)
**Назначение**: Обзор системы и быстрый доступ к основным функциям.

**Компоненты**:
- Системный статус (режим, интенсивность, blackout)
- Аудио метрики в реальном времени
- Быстрые действия (переключение режимов)
- Навигация по страницам

**API**:
```typescript
interface DashboardHomeProps {
  onNavigate: (page: string) => void;
  onCommand: (type: string, payload: any) => void;
  systemState: UISystemState;
  audioMetrics: AudioMetrics;
  realtimeData: RealtimeData;
}
```

### 2. Audio Visualization (Визуализация аудио)
**Назначение**: Визуализация аудио потока в реальном времени.

**Компоненты**:
- WaveformView: Визуализация формы волны
- SpectrumVisualizer: Спектральный анализ
- MeterComponent: Измерители уровня
- Beat detection display

**Данные**:
```typescript
interface AudioData {
  waveform: number[];    // 100 samples
  spectrum: number[];    // 32 frequency bands
  peaks: number[];       // Beat peaks
}

interface AudioMetrics {
  energy: number;        // 0-1
  isBeat: boolean;       // Beat detected
  bpm: number;           // Beats per minute
  mood: string;          // Mood classification
}
```

### 3. DMX Monitor (Мониторинг DMX)
**Назначение**: Мониторинг и управление DMX каналами.

**Компоненты**:
- DMXChannelGrid: Сетка каналов 512x1
- Channel details panel
- Universe selector
- Fixture patching

**Данные**:
```typescript
interface DMXData {
  channels: number[];    // 512 channels, values 0-1
  universes: number;     // Active universes
  fixtures: Fixture[];   // Patched fixtures
}
```

### 4. Scene Editor (Редактор сцен)
**Назначение**: Создание и редактирование световых сцен.

**Функции**:
- Создание/редактирование/удаление сцен
- Привязка фикстур к сценам
- Настройка интенсивности и эффектов
- Предпросмотр сцен

**Структура сцены**:
```typescript
interface SceneDefinition {
  id: string;
  name: string;
  description: string;
  fixtures: SceneFixture[];
  effects: string[];     // Effect IDs
  intensity: number;     // 0-1
  duration: number;      // ms
  transition: string;    // Transition type
}
```

### 5. Effect Editor (Редактор эффектов)
**Назначение**: Создание и управление световыми эффектами.

**Типы эффектов**:
- BeatSync: Синхронизация с битом
- Rainbow: Радужные переходы
- Strobe: Стробоскоп
- Pulse: Пульсация
- Custom: Пользовательские эффекты

**API эффектов**:
```typescript
interface EffectDescriptor {
  id: string;
  name: string;
  type: EffectType;
  parameters: EffectParameters;
  enabled: boolean;
  priority: number;
}
```

### 6. Fixture Manager (Менеджер фикстур)
**Назначение**: Управление световыми приборами.

**Функции**:
- Добавление/удаление фикстур
- Настройка адресов и универсов
- Управление профилями
- Тестирование фикстур

**Структура фикстуры**:
```typescript
interface Fixture {
  id: string;
  name: string;
  type: string;
  address: number;
  universe: number;
  channels: number;
  profile: FixtureProfile;
  status: 'active' | 'inactive' | 'error';
}
```

### 7. Rule Editor (Редактор правил)
**Назначение**: Создание правил автоматизации.

**Типы условий**:
- Audio energy threshold
- Beat detection
- Time-based triggers
- Manual triggers
- External events

**Структура правила**:
```typescript
interface SceneRule {
  id: string;
  name: string;
  conditions: RuleCondition[];
  actions: RuleAction[];
  priority: number;
  enabled: boolean;
}
```

## Компоненты

### Визуализация

#### SpectrumVisualizer
```typescript
interface SpectrumVisualizerProps {
  data: number[];        // Spectrum data (32 values)
  width?: number;
  height?: number;
  color?: string;
  showGrid?: boolean;
}
```

#### WaveformView
```typescript
interface WaveformViewProps {
  data: number[];        // Waveform data (100 samples)
  width?: number;
  height?: number;
  color?: string;
  showPeaks?: boolean;
}
```

#### MeterComponent
```typescript
interface MeterComponentProps {
  value: number;         // 0-1
  label?: string;
  width?: number;
  height?: number;
  color?: string;
  showValue?: boolean;
}
```

### Утилиты

#### Performance Monitor
```typescript
class PerformanceMonitor {
  startFrame(): void;
  startRender(): void;
  endFrame(): void;
  getFPS(): number;
  getMemoryUsage(): number;
}
```

#### Config Loader
```typescript
class ConfigLoader {
  loadScenes(): Promise<SceneDefinition[]>;
  loadFixtures(): Promise<Fixture[]>;
  loadEffects(): Promise<EffectDescriptor[]>;
  loadRules(): Promise<SceneRule[]>;
  saveConfig(config: any): Promise<void>;
}
```

#### Undo Manager
```typescript
class UndoManager {
  addAction(action: UndoAction): void;
  undo(): Promise<void>;
  redo(): Promise<void>;
  canUndo(): boolean;
  canRedo(): boolean;
}
```

## API интеграция

### WebSocket соединение
```typescript
class SocketManager {
  connect(): void;
  disconnect(): void;
  sendCommand(type: string, payload: any): void;
  on(event: string, handler: Function): void;
  
  // Events
  on('connect', () => {});
  on('disconnect', () => {});
  on('error', (error) => {});
  on('data', (data) => {});
}
```

### Команды
```typescript
// System commands
sendCommand('setMode', 'auto' | 'manual' | 'off');
sendCommand('setIntensity', 0.5);
sendCommand('setBlackout', true);

// Scene commands
sendCommand('activateScene', 'scene-id');
sendCommand('deactivateScene', 'scene-id');

// Effect commands
sendCommand('toggleEffect', { id: 'effect-id', enabled: true });

// Fixture commands
sendCommand('setFixtureValue', { id: 'fixture-id', channel: 1, value: 255 });
```

## Темы и стили

### Поддерживаемые темы
- `dark` (по умолчанию): Темная тема для ночного использования
- `light`: Светлая тема для дневного использования

### Layout режимы
- `dashboard`: Полнофункциональный дашборд
- `expanded`: Развернутый режим на весь экран
- `compact`: Компактный режим для небольших экранов
- `mobile`: Мобильная адаптация

## Мобильная адаптация

### Особенности
- Touch-оптимизированные элементы управления
- Адаптивный layout
- Оффлайн режим
- Кэширование данных
- Батарея и соединение мониторинг

### Responsive дизайн
```typescript
const responsive = {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  orientation: 'portrait' | 'landscape';
  
  useResponsive(): ResponsiveState;
  onOrientationChange(callback: Function): void;
}
```

## Безопасность

### Аутентификация
- JWT токены
- Ролевая модель
- Сессии
- Refresh tokens

### Авторизация
```typescript
interface Permission {
  id: string;
  name: string;
  description: string;
}

interface Role {
  id: string;
  name: string;
  permissions: string[];
}

interface User {
  id: string;
  username: string;
  role: string;
  permissions: string[];
}
```

### Audit Log
- Логирование действий пользователей
- Отслеживание изменений конфигурации
- Security events
- System events

## Производительность

### Оптимизации
1. **Code splitting**: Разделение на chunks
2. **Lazy loading**: Загрузка страниц по требованию
3. **Memoization**: Кэширование вычислений
4. **Virtualization**: Виртуализация списков
5. **Debouncing**: Оптимизация частых обновлений

### Bundle анализ
```
Initial bundle: ~500KB
- ImGui core: ~200KB
- Application code: ~150KB
- Utilities: ~100KB
- Styles: ~50KB

Chunked loading:
- Main chunk: ~300KB
- Audio visualization: ~100KB (lazy)
- Scene editor: ~150KB (lazy)
- Effect editor: ~100KB (lazy)
```

## Тестирование

### Unit тесты
```bash
npm test -- --testPathPattern=unit
```

### Интеграционные тесты
```bash
npm test -- --testPathPattern=integration
```

### E2E тесты (Playwright)
```bash
npx playwright test
```

### Performance тесты
```bash
npm run test:performance
```

## Разработка

### Настройка окружения
```bash
# Установка зависимостей
npm install

# Запуск dev сервера
npm run dev

# Сборка
npm run build

# Предпросмотр сборки
npm run preview
```

### Структура проекта
```
src/control/webui/
├── index.html          # HTML шаблон
├── main.ts            # Точка входа
├── App.tsx            # Главный компонент
├── vite.config.ts     # Конфигурация Vite
├── package.json       # Зависимости
└── tsconfig.json     # TypeScript конфигурация
```

### Code style
- TypeScript strict mode
- ESLint + Prettier
- Комментарии JSDoc для публичных API
- Именование: camelCase для переменных, PascalCase для компонентов
- Импорты: сгруппированы по типу (внешние, внутренние, типы)

## Развертывание

### Production сборка
```bash
npm run build
```

### Docker образ
```dockerfile
FROM node:18-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### CI/CD
- GitHub Actions для тестирования
- Docker Hub для образов
- Kubernetes для оркестрации
- CDN для статических файлов

## Отладка

### DevTools
```javascript
// Глобальный доступ к приложению
window.DMXEngine = {
  store,              // Основной store
  extendedStore,      // Расширенный store
  socketManager,      // WebSocket менеджер
  App,                // Главный компонент
  sendCommand,        // Отправка команд
  handleNavigation    // Навигация
};
```

### Debug панель
Включение: Настройки → Debug Panel → Show

**Информация**:
- Состояние системы
- Аудио метрики
- Состояние сокета
- UI состояние
- Реалтайм данные
- Производительность

### Логирование
```typescript
import { logger } from './utils/logger';

logger.debug('Debug message');
logger.info('Info message');
logger.warn('Warning message');
logger.error('Error message');
```

## Миграция с Phase 2

### Изменения API
1. **Новый store структура**: Разделение на основной и расширенный store
2. **Расширенная навигация**: Добавлены страницы Effects, Fixtures, Rules
3. **Безопасность**: Добавлена система аутентификации и авторизации
4. **Мобильность**: Добавлена responsive адаптация

### Обратная совместимость
- Старые конфигурации автоматически конвертируются
- Legacy API поддерживается через адаптеры
- Миграционные скрипты доступны

## Ресурсы

### Документация
- [API Reference](./API_REFERENCE.md)
- [Component Library](./COMPONENTS.md)
- [Testing Guide](./TESTING.md)
- [Deployment Guide](./DEPLOYMENT.md)

### Примеры
```typescript
// Создание сцены
const scene = {
  id: 'party-scene',
  name: 'Party Scene',
  fixtures: [
    { id: 'led-par-1', channels: { red: 255, green: 128, blue: 64 } }
  ],
  effects: ['beat-strobe', 'rainbow'],
  intensity: 0.8,
  duration: 5000
};

// Активация сцены
sendCommand('activateScene', 'party-scene');

// Создание правила
const rule = {
  conditions: [
    { type: 'audioEnergy', threshold: 0.7 }
  ],
  actions: [
    { type: 'activateScene', sceneId: 'party-scene' }
  ]
};
```

## Поддержка

### Известные проблемы
1. **Производительность на мобильных устройствах**: Оптимизация в процессе
2. **Memory leaks в длительных сессиях**: Мониторинг и фиксы
3. **Совместимость браузеров**: Поддержка современных браузеров

### Roadmap
- [ ] WebGL ускоренная визуализация
- [ ] PWA поддержка
- [ ] Оффлайн редактор
- [ ] Плагинная система
- [ ] Multi-user collaboration

## Лицензия

Autonomous DMX Engine Phase 3 UI распространяется под лицензией MIT.

---

*Последнее обновление: 2026-03-02*  
*Версия: Phase 3.0.0*  
*Автор: Autonomous DMX Engine Team*