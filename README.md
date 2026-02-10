# Autonomous DMX Engine

Автономный «lighting designer in a box» — система, которая анализирует музыку в реальном времени и генерирует DMX/Art-Net световые шоу без участия светорежиссёра.

## Особенности

- 🎵 **Реакция на музыку**: анализ энергии, ритма, BPM, настроения
- 🤖 **Автономность**: сам выбирает сцены и эффекты
- 💡 **DMX/Art-Net**: поддержка любых приборов
- 🌐 **Web-интерфейс**: простое управление и мониторинг
- 🔧 **Расширяемость**: модульная архитектура

## Быстрый старт

### Требования

- Node.js 18+
- TypeScript 5+

### Установка

```bash
npm install
```

### Конфигурация

1. Настройте профили приборов в `config/fixtures.json`
2. Пропишите патч в `config/patch.json`
3. Опишите расположение в `config/layout.json`
4. Определите сцены в `config/scenes.json`

### Запуск

```bash
npm run dev
```

Веб-панель доступна по адресу: `http://localhost:8080`

## Документация

- [DESIGN.md](./DESIGN.md) — полный дизайн-документ с алгоритмами
- [ARCHITECTURE.md](./ARCHITECTURE.md) — модули, интерфейсы, структура кода

## Roadmap

### MVP (v0.1)
- [x] Audio Analyzer (energy, beat, BPM, mood)
- [ ] Show Brain (State Machine, Scene Selector, Effect Engine)
- [ ] Lighting Engine (патч, рендер, Art-Net output)
- [ ] Web UI (базовое управление)

### v0.2+
- [ ] Vision Analyzer (камера, заполненность)
- [ ] Расширенные эффекты
- [ ] ML для выбора сцен
- [ ] Интеграция с визуальным рендером

## Технологии

- **Backend**: Node.js, TypeScript
- **Audio**: Web Audio API / node audio libraries
- **DMX**: Art-Net (npm: `artnet`)
- **UI**: React/Vue

## Лицензия

MIT

## Контакты

Проект в разработке. Вопросы и предложения — welcome!
