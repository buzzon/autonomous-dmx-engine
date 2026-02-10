# DESIGN.md — Autonomous Audio‑Driven DMX Engine («Свой MaestroDMX»)

## 0. Overview

Этот проект — автономный «lighting designer in a box», похожий по идее на MaestroDMX, Oculizer и другие intelligent lighting системы: он анализирует музыку и другие входы в реальном времени и сам генерирует DMX/Art‑Net световые шоу без участия светорежиссёра.

Ключевые особенности:

- Реакция на живую музыку (line‑in / loopback).  
- Минимальная ручная настройка (патч приборов, расположение, выбор стиля).  
- Автоматический выбор сцен и эффектов по «энергии» и «настроению» музыки.  
- Генерация DMX/Art‑Net для реальных приборов.  

В перспективе:

- учёт камеры, сенсоров, времени, контекста помещения;  
- интеграция с собственным визуальным рендером.

---

## 1. Цели и сценарии

### 1.1. Основная цель

Сделать автономный световой движок, который:

- Принимает аудио‑сигнал, видео с камер и другие сенсоры.  
- На основе истории и текущего состояния аудио и окружения выбирает:
  - режим (idle / chill / party),  
  - сцены (какие группы/цвета/направления задействованы),  
  - эффекты (круги, чейзы, пульсы, цветовые волны).  
- Генерирует DMX‑данные (через Art‑Net) для разных типов приборов.

Система должна быть максимально **автономной**: включил питание, подключил звук, — и свет ведёт себя адекватно происходящему.

### 1.2. Целевая аудитория

- Бары/клубы/залы, где нет выделенного LD, но хочется «живой» свет по музыке.  
- Инсталляции, где свет должен реагировать на музыку и людей.  
- Личное использование (домашний клуб, студия).

### 1.3. Основные сценарии

- **«Музыка в баре»** — система слушает микс, автоматически выбирает спокойные/энергичные сцены и эффекты.  
- **«Вечеринка без светорежиссёра»** — владелец выбирает стиль (например, EDM/Pop), система сама строит шоу.  
- **«Интерактивная инсталляция»** — музыка + движение людей/заполненность влияют на свет (в прогрессивной версии).

---

## 2. Высокоуровневая архитектура

### 2.1. Модули

1. **Input Layer**
   - Audio Analyzer — анализ музыки и генерация метрик.  
   - System Inputs — команды от web‑UI / OSC / расписаний.  
   - (Later) Vision Analyzer — камера, сенсоры.

2. **Show Brain**
   - State Machine — режимы (Idle/Chill/Party/Manual).  
   - Scene / Style Selector — выбор сцены и палитры.  
   - Effect Engine — генерация параметров эффектов.

3. **Lighting Engine**
   - Patch / Fixture Model — описание приборов и адресов.  
   - Attribute Layer — виртуальные атрибуты (dim, color, position и т.п.).  
   - Merge — объединение базовых состояний, эффектов и overrides.  
   - DMX Renderer — Art‑Net output.

4. **Control & UI**
   - Web‑панель для наблюдения и базового управления.  
   - API (REST/WebSocket/OSC) для внешних систем.

### 2.2. Поток данных (MVP)

```
┌──────────────┐
│ Audio Input  │
│ (line-in)    │
└──────┬───────┘
       │
       ▼
┌──────────────────┐      ┌─────────────┐
│ Audio Analyzer   │      │ User Input  │
│ - energy         │      │ (web/OSC)   │
│ - beat           │      └──────┬──────┘
│ - bpm            │             │
│ - mood           │             │
└────────┬─────────┘             │
         │                       │
         └───────────┬───────────┘
                     ▼
            ┌────────────────┐
            │  Show Brain    │
            │ - State Machine│
            │ - Scene Select │
            │ - Effect Engine│
            └────────┬───────┘
                     │
                     ▼
            ┌────────────────┐
            │Lighting Engine │
            │ - Patch        │
            │ - Attributes   │
            │ - Merge        │
            │ - DMX Renderer │
            └────────┬───────┘
                     │
                     ▼
            ┌────────────────┐
            │ Art-Net Output │
            │ (UDP 6454)     │
            └────────────────┘
```

---

## 3. Входные данные

### 3.1. Статическая конфигурация

1. **Fixture Profiles** (профили приборов)  
   - Для каждого типа:
     - количество каналов, режимы;  
     - назначение каналов: dim, strobe, colorIndex, goboIndex, pan, tilt, fine‑каналы и т.д.;  
     - диапазоны значений (DMX‑диапазоны цветов, гобо, строба).
   - Структура: JSON в `config/fixtures.json`.

2. **Patch** (адресация приборов)  
   - Для каждого физического прибора:
     - universe, startAddress;  
     - ссылка на профиль;  
     - группа (BEAMS, WASH, FX, BLINDERS...).  
   - Структура: JSON в `config/patch.json`.

3. **Layout / позиции приборов**  
   - Для каждого прибора:
     - `x`, `y` (и опционально `z`) в координатах сцены/зала (‑1..1 или 0..1);  
     - зона/ряд (front, back, left, right, ceiling).
   - Структура: `config/layout.json`.

4. **Сцены, палитры, стили**  
   - Набор сцен (типов светового состояния) и цветовых палитр:
     - Palettes: Warm, Cool, Party, Neutral.  
     - Scenes: IdleWarmStatic, ChillSoftMovement, PartyBeams, PartyStrobe, etc.  
   - Структура: `config/styles.json` / `config/scenes.json`.

### 3.2. Динамические входы (MVP)

1. **AudioMetrics** (из Audio Analyzer)  
   - `energy` 0..1 — нормализованная энергия;  
   - `beat` — флаг/импульс ударов;  
   - `bpm` — оценка темпа;  
   - `mood` — calm/medium/hard.  

2. **System Inputs**  
   - Команды от web‑UI / API:
     - `setMode(mode)` — auto/chill/party/manual;  
     - `setGlobalIntensity(value)` — 0..1;  
     - `setBlackout(on/off)`;  
     - `setStyle(styleId)`.

3. **Time/Day**  
   - Системное время и расписание: ограничения по яркости/режимам в разные часы/дни.

### 3.3. Динамические входы (Progressive)

1. **VisionMetrics** (камера)  
   - `occupancy` 0..1 — заполненность;  
   - `motionLevel` 0..1 — активность;  
   - (опционально) карта зон.

2. **SensorMetrics**  
   - Датчики движения, света, интеграция с умным домом/automation.

---

## 4. Audio Analyzer

### 4.1. Задачи

- Реальное время, низкая задержка.  
- Выделение:
  - текущей энергии;  
  - ударов/ритма;  
  - примерного BPM;  
  - грубого mood (calm/medium/hard).

### 4.2. Параметры обработки

- `sampleRate`: 44_100 Hz.  
- `frameSize`: 1024 samples (~23 ms).  
- `hopSize`: 512 samples (~11.6 ms).  
- Обновление `AudioMetrics` — каждые `hopSize` (≈80–90 Гц), дальше при необходимости можно редуцировать до 25–50 FPS.

### 4.3. Окна истории

- **Короткое окно энергии**:
  - `K_short` ≈ 64 фрейма (≈0.7–1 сек).  
- **Среднее окно**:
  - статистика энергии и beat'ов за 5–10 секунд (храним агрегаты).  
- **Beat‑история**:
  - `lastBeats` длиной до 8–16 элементов (последние 8–16 beat'ов).

### 4.4. Структуры данных

```typescript
type Mood = 'calm' | 'medium' | 'hard';

interface AudioMetrics {
  timestamp: number;   // ms
  energy: number;      // 0..1
  beat: boolean;
  bpm: number | null;
  mood: Mood;
}

interface AudioAnalyzerState {
  sampleRate: number;
  frameSize: number;
  hopSize: number;

  energyHistory: number[];  // последние K_short E_frame
  energyAvg: number;        // эксп. сглаженное среднее
  energyPeak: number;       // «пик» для нормализации

  lastBeats: number[];      // timestamps beat'ов (сек или мс)
  bpm: number | null;
  lastBeatTime: number;

  mood: Mood;
  moodHistory: Mood[];

  lastUpdateTimestamp: number;
}
```

### 4.5. Энергия

#### 4.5.1. Энергия фрейма

Для каждого фрейма `x[0..N-1]`:

```
E_frame = (1/N) * Σ(x[n]²)
```

(можно взять RMS, но для относительной динамики достаточно среднего квадрата).

#### 4.5.2. Обновление истории и сглаживание

```pseudo
// вход: E_frame, t_now
push energyHistory <- E_frame
if length(energyHistory) > K_short: pop oldest

energyAvg  = 0.9 * energyAvg + 0.1 * E_frame
energyPeak = max(E_frame, energyPeak * 0.99)
```

#### 4.5.3. Нормализация 0..1

```pseudo
energyNorm = clamp(
    E_frame / max(energyAvg * 2, epsilon),
    0, 1
)
```

`energyNorm` и идёт в `AudioMetrics.energy`.

---

### 4.6. Beat detection (упрощённо)

1. Счёт среднего и std по короткому окну:

```
μ_short = (1/K) * Σ E_i
σ_short = sqrt((1/K) * Σ(E_i - μ_short)²)
```

2. Признак пика:

```pseudo
beatCandidate = E_frame > mu_short + c * sigma_short    // c ≈ 1.5–2.0
```

3. **Refractory period** (чтобы не ловить слишком часто):

```pseudo
beat = false
if beatCandidate and (t_now - lastBeatTime) > minBeatInterval:
    beat = true
    lastBeatTime = t_now
    push lastBeats <- t_now
    if length(lastBeats) > N_beats: pop oldest
```

`minBeatInterval` ≈ 0.2–0.3 сек (соответствует максимум ~200–300 BPM).

---

### 4.7. BPM estimation и сглаживание

```pseudo
if length(lastBeats) >= 4:
    intervals = diff(lastBeats)     // t[i] - t[i-1]
    deltaMed = median(intervals)
    if deltaMed > small_threshold:
        BPM_inst = 60 / deltaMed
        bpm = beta * BPM_inst + (1 - beta) * bpm_prev   // beta ≈ 0.2–0.3
else:
    // если мало данных, bpm может быть null или удерживаться
```

При отсутствии новых beat'ов длительное время (например, > 4–5 сек) `bpm` постепенно обнуляется.

---

### 4.8. Mood estimation

В каждом средне‑долгом интервале (например, раз в 0.5–1 сек) оцениваем:

- `E_mid_avg` — среднюю `energyNorm` за последние 5–10 сек;  
- `beatRate` — количество beat'ов / секунду (из `lastBeats`);  

Пример правил:

```pseudo
if E_mid_avg < 0.2 and beatRate < 1.0:
    moodCandidate = 'calm'
else if E_mid_avg < 0.5:
    moodCandidate = 'medium'
else:
    moodCandidate = 'hard'
```

Сглаживание mood:

```pseudo
push moodHistory <- moodCandidate
if length(moodHistory) > K_mood: pop oldest

mood = mode(moodHistory)   // самое частое значение
```

`mood` используется Show Brain для выбора сцен/стилей.

---

### 4.9. Основной цикл `processFrame`

```pseudo
function processFrame(x_frame, t_now) -> AudioMetrics:

    // 1) энергия фрейма
    E_frame = (1/N) * sum(x_frame[n]^2)

    // 2) обновление истории
    push energyHistory <- E_frame
    if length(energyHistory) > K_short: pop oldest

    energyAvg  = 0.9 * energyAvg + 0.1 * E_frame
    energyPeak = max(E_frame, energyPeak * 0.99)

    // 3) нормализованная энергия
    energyNorm = clamp(E_frame / max(energyAvg * 2, epsilon), 0, 1)

    // 4) beat detection
    mu_short    = mean(energyHistory)
    sigma_short = std(energyHistory)
    beatCandidate = E_frame > mu_short + c * sigma_short

    beat = false
    if beatCandidate and (t_now - lastBeatTime) > minBeatInterval:
        beat = true
        lastBeatTime = t_now
        push lastBeats <- t_now
        if length(lastBeats) > N_beats: pop oldest

    // 5) BPM update
    if length(lastBeats) >= 4:
        intervals = diff(lastBeats)
        deltaMed  = median(intervals)
        if deltaMed > epsilon:
            BPM_inst = 60 / deltaMed
            bpm = beta * BPM_inst + (1 - beta) * bpm
    // else: bpm оставляем как есть или постепенно обнуляем

    // 6) периодическое обновление mood
    if t_now - lastMoodUpdate > moodUpdateInterval:
        updateMood()
        lastMoodUpdate = t_now

    // 7) формируем AudioMetrics
    metrics = {
        timestamp: t_now,
        energy: energyNorm,
        beat: beat,
        bpm: bpm,
        mood: mood
    }

    return metrics
```

---

## 5. Show Brain

### 5.1. State Machine

**Состояния:**

- `Idle` — минимальная музыка, фоновый свет.  
- `Chill` — средняя энергия, спокойные эффекты.  
- `Party` — высокая энергия, быстрые яркие эффекты.  
- `Manual` — ручной контроль (зарезервировано).

**Переходы:**

По `AudioMetrics.energy` + пользовательским командам:

```pseudo
if userMode == 'manual':
    state = Manual
else:
    if energy < threshold_low:
        state = Idle
    else if energy < threshold_high:
        state = Chill
    else:
        state = Party
```

С гистерезисом (разные пороги для перехода вверх/вниз).

### 5.2. Scene / Style Selector

На основе текущего `state` и `mood` выбирает:

- Активную сцену (тип светового состояния).  
- Цветовую палитру.  
- Параметры эффектов (speed, size, intensity).

Смена сцены:

- Каждые N тактов (например, 8–16 beat'ов).  
- Избегать повторений (история последних сцен).

**Выход:**

```typescript
interface SceneState {
  sceneId: string;
  paletteId: string;
  baseIntensity: number;  // 0..1
  effectDescriptors: {
    [groupId: string]: {
      dimEffectType?: 'none' | 'chase' | 'pulse';
      posEffectType?: 'none' | 'circle' | 'swing';
      colorEffectType?: 'none' | 'cycle';
    }
  };
}
```

### 5.3. Effect Engine

Для каждой группы генерирует параметры эффектов по времени:

- **Dimmer effects**: chase, pulse (привязка к beat).  
- **Position effects**: circle, swing (по формулам с фазами).  
- **Color effects**: cycle, pulse.

Параметры (примеры):

```typescript
interface DimEffectState {
  type: 'none' | 'chase' | 'pulse';
  speed: number;    // оборотов/сек или beat‑множитель
  depth: number;    // 0..1
  phaseOffset: number;
}

interface PosEffectState {
  type: 'none' | 'circle';
  speed: number;
  size: number;
  centerPan: number;
  centerTilt: number;
}
```

Генерация в каждом кадре (тик):

```pseudo
for each group:
    effectState = getEffectState(group, sceneState, audioMetrics, t)
```

---

## 6. Lighting Engine

### 6.1. Patch / Fixture Model

Загружается из `config/`:

- `fixtures.json` — профили (каналы, диапазоны).  
- `patch.json` — список приборов (universe, address, profile, group).  
- `layout.json` — координаты (x, y, z), зоны.

### 6.2. Attribute Layer

Для каждого fixture хранит виртуальные атрибуты:

```typescript
interface FixtureState {
  fixtureId: string;
  dim: number;         // 0..1
  colorIndex: number;
  panNorm: number;     // -1..1
  tiltNorm: number;
  strobe: number;      // 0..1
  // ...
}
```

### 6.3. Merge

Слои:

- **Base**: из сцены (базовые значения атрибутов).  
- **Effect**: поверх базовых (offset/modulation от Effect Engine).  
- **Override**: blackout, global dimmer.

Пример правил:

```pseudo
finalDim = globalDim * (baseDim * (1 - strobeEffect) + strobeValue)
finalPan = clamp(basePan + posEffectOffsetPan, panMin, panMax)
```

### 6.4. DMX Renderer

Каждые ~25–40 мс:

1. Обновить эффекты (по времени).  
2. Собрать атрибуты для всех fixtures.  
3. Перевести атрибуты → DMX (по профилям):
   - dim → ch[dimIndex] = round(dim * 255)  
   - colorIndex → диапазон из colorMap  
   - panNorm → ch[panIndex] coarse + ch[panFineIndex] fine  
4. Отправить Art‑Net UDP пакеты.

---

## 7. Control & UI

### 7.1. Web‑панель

Минимум (MVP):

- Отображение:
  - текущие `energy`, `bpm`, `mood`;  
  - активный режим, сцена.  
- Управление:
  - кнопки режимов (Auto / Chill / Party);  
  - слайдер Global Intensity;  
  - кнопка Blackout.

### 7.2. API

REST/WebSocket:

- `GET /state` — текущее состояние.  
- `POST /mode` — изменить режим.  
- `POST /blackout` — вкл/выкл.  
- `POST /intensity` — установить 0..1.

Опционально OSC для внешних контроллеров.

---

## 8. Roadmap

### MVP (v0.1)

1. Audio Analyzer:
   - energy, beat, BPM, mood (3 класса).  
2. Show Brain:
   - State Machine (Idle/Chill/Party).  
   - 4–6 базовых сцен.  
   - Effect Engine: dim chase, pulse, circle.  
3. Lighting Engine:
   - 1–2 типа приборов, 1–2 universes.  
   - Простой merge, Art‑Net output.  
4. Web‑UI:
   - режимы, global dim, blackout.

### Progressive (v0.2+)

1. Vision Analyzer → occupancy, motionLevel.  
2. Расширенные эффекты и палитры.  
3. Advanced Show Brain (rule engine / ML).  
4. Интеграция с кастомным рендером (визуал + DMX).

---

## 9. Технологии

- **Backend**: Node.js / TypeScript.  
- **Audio**: Web Audio API / node audio libraries (например, `node-mic`, `audio` или FFT библиотеки).  
- **DMX output**: npm-пакет `artnet` или `artnet-node`.  
- **Web UI**: React/Vue или простой HTML+JS.  
- **API**: Express + WebSocket (socket.io).

---

## 10. Ссылки и референсы

- MaestroDMX — коммерческий аналог с автономным режимом.  
- Oculizer — open-source intelligent audio-reactive DMX.  
- DMXDesktop — софт с intelligent autonomous shows.  
- Различные audio-reactive LED проекты (Scott Lawson, и др.) — референсы по алгоритмам анализа аудио.

---

**Версия:** 0.3  
**Дата:** 2026-02-09  
**Статус:** Живой документ, обновляется по ходу разработки.
