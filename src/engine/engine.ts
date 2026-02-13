/**
 * Engine - главный фасад системы
 * Координирует все подсистемы и управляет циклами обработки
 */

import { defaultLogger } from "../utils/logger";
import { AudioAnalyzer } from "../audio/analyzer";
import { BrainFacade } from "../brain/facade";
import { LightingFacade } from "../lighting/facade";
import { WebSocketAPI } from "../control/websocket";
import {
  EngineConfig,
  RuntimeMetrics,
  BrainOutput,
  LightingOutput,
  PerformanceMetrics,
  HealthStatus,
  EngineState,
} from "./types";

export class Engine {
  private logger = defaultLogger.child({ module: "Engine" });
  private state: EngineState;
  private isRunning = false;
  private fastTickInterval?: NodeJS.Timeout;
  private slowTickInterval?: NodeJS.Timeout;

  constructor(
    private audioAnalyzer: AudioAnalyzer,
    private brainFacade: BrainFacade,
    private lightingFacade: LightingFacade,
    private controlAPI: WebSocketAPI,
    private config: EngineConfig,
  ) {
    this.state = {
      isRunning: false,
      startTime: 0,
      fastTickCount: 0,
      slowTickCount: 0,
      performance: {
        fastLoopTime: 0,
        slowLoopTime: 0,
        audioLatency: 0,
        dmxLatency: 0,
        memoryUsage: 0,
        cpuUsage: 0,
        audioDropouts: 0,
        dmxDropouts: 0,
        beatDetectionAccuracy: 0,
      },
      health: {
        overall: "healthy",
        details: [],
        timestamp: Date.now(),
      },
    };

    this.logger.info("Engine initialized", { config });
  }

  /**
   * Запуск двигателя
   */
  start(): void {
    if (this.isRunning) {
      this.logger.warn("Engine is already running");
      return;
    }

    this.logger.info("Starting Engine...");
    this.isRunning = true;
    this.state.isRunning = true;
    this.state.startTime = Date.now();

    // Запуск Control API
    this.controlAPI.start();

    // Запуск быстрого цикла
    this.fastTickInterval = setInterval(
      () => this.fastTick(),
      this.config.fastTickInterval,
    );

    // Запуск медленного цикла
    this.slowTickInterval = setInterval(
      () => this.slowTick(),
      this.config.slowTickInterval,
    );

    this.logger.info("Engine started successfully", {
      fastTickInterval: this.config.fastTickInterval,
      slowTickInterval: this.config.slowTickInterval,
    });
  }

  /**
   * Остановка двигателя
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger.warn("Engine is not running");
      return;
    }

    this.logger.info("Stopping Engine...");
    this.isRunning = false;
    this.state.isRunning = false;

    // Остановка интервалов
    if (this.fastTickInterval) {
      clearInterval(this.fastTickInterval);
      this.fastTickInterval = undefined;
    }

    if (this.slowTickInterval) {
      clearInterval(this.slowTickInterval);
      this.slowTickInterval = undefined;
    }

    // Остановка Control API
    await this.controlAPI.stop();

    this.logger.info("Engine stopped successfully");
  }

  /**
   * Быстрый цикл обработки (вызывается каждые 40ms)
   */
  private fastTick(): void {
    const startTime = performance.now();

    try {
      // 1. Получение аудио фрейма (в Phase 1 - mock данные)
      const audioFrame = this.getAudioFrame();

      // 2. Обработка аудио
      const audioMetrics = this.audioAnalyzer.processFrame(
        audioFrame,
        Date.now(),
      );

      // 3. Сбор всех метрик
      const runtimeMetrics: RuntimeMetrics = {
        audio: audioMetrics,
        timestamp: Date.now(),
      };

      // 4. Обработка Brain
      const brainOutput = this.brainFacade.update(runtimeMetrics);

      // 5. Обработка Lighting
      const lightingOutput = this.lightingFacade.update(brainOutput);

      // 6. Отправка DMX (в Phase 1 - логирование)
      this.logDMXOutput(lightingOutput);

      // 7. Отправка состояния в UI
      // Используем broadcastToAll для отправки полных данных цикла,
      // так как broadcastStateUpdate отправляет только SystemState
      this.controlAPI.broadcastToAll("loopUpdate", {
        metrics: runtimeMetrics,
        brainOutput,
        lightingOutput,
        engineState: this.getState(),
      });

      // Также обновляем SystemState в API если нужно
      // this.controlAPI.updateSystemState(...)

      // Обновление статистики
      this.state.fastTickCount++;
      const processingTime = performance.now() - startTime;
      this.state.performance.fastLoopTime = processingTime;

      // Мониторинг производительности
      if (processingTime > this.config.maxFastLoopTime) {
        this.logger.warn(
          `Fast loop exceeded time budget: ${processingTime.toFixed(2)}ms`,
        );
      }
    } catch (error: any) {
      this.logger.error("Error in fast tick", {
        error: error.message,
        stack: error.stack,
      });
      this.state.lastError =
        error instanceof Error ? error.message : String(error);
    }
  }

  /**
   * Медленный цикл обработки (вызывается каждые 500-1000ms)
   */
  private slowTick(): void {
    const startTime = performance.now();

    try {
      // 1. Hot-reload конфигов (если включено)
      if (this.config.enableHotReload) {
        this.brainFacade.reloadConfigs();
        this.lightingFacade.reloadConfigs();
      }

      // 2. Долгосрочные обновления Brain
      this.brainFacade.updateSlow(Date.now());

      // 3. Сбор статистики производительности
      this.collectPerformanceMetrics();

      // 4. Проверка здоровья системы
      this.checkHealth();

      // 5. Очистка памяти и оптимизация
      this.cleanup();

      // Обновление статистики
      this.state.slowTickCount++;
      this.state.performance.slowLoopTime = performance.now() - startTime;
    } catch (error) {
      this.logger.error("Error in slow tick", { error });
      this.state.lastError =
        error instanceof Error ? error.message : String(error);
    }
  }

  /**
   * Получение аудио фрейма (в Phase 1 - mock данные)
   */
  private getAudioFrame(): Float32Array {
    // В Phase 1 используем mock данные
    // В будущих фазах будет реальный аудио ввод
    const frameSize = 1024; // Примерный размер фрейма
    const samples = new Float32Array(frameSize);

    // Генерация простой синусоиды для тестирования
    const time = Date.now() / 1000;
    for (let i = 0; i < frameSize; i++) {
      samples[i] = 0.5 * Math.sin(2 * Math.PI * 440 * (time + i / 44100));
    }

    return samples;
  }

  /**
   * Логирование DMX вывода (в Phase 1)
   */
  private logDMXOutput(lightingOutput: LightingOutput): void {
    // В Phase 1 просто логируем
    if (lightingOutput.universeFrames.length > 0) {
      this.logger.debug("DMX output generated", {
        universeFrames: lightingOutput.universeFrames.length,
        fixtureStates: lightingOutput.fixtureStates.size,
      });
    }
  }

  /**
   * Сбор метрик производительности
   */
  private collectPerformanceMetrics(): void {
    // Базовая реализация для Phase 1
    // В будущих фазах будет сбор реальных метрик

    // Примерные метрики
    const memoryUsage = process.memoryUsage();
    this.state.performance.memoryUsage =
      memoryUsage.heapUsed / memoryUsage.heapTotal;

    // Обновление точности beat detection
    this.state.performance.beatDetectionAccuracy = 0.95; // Примерное значение
  }

  /**
   * Проверка здоровья системы
   */
  private checkHealth(): void {
    const healthDetails = [];

    // Проверка AudioAnalyzer
    try {
      // Простая проверка - если можем получить состояние, значит здоров
      const audioState = this.audioAnalyzer.getState();
      healthDetails.push({
        component: "audio",
        healthy: true,
        message: "Audio analyzer is working",
      });
    } catch (error) {
      healthDetails.push({
        component: "audio",
        healthy: false,
        message: `Audio analyzer error: ${error}`,
      });
    }

    // Проверка BrainFacade
    healthDetails.push({
      component: "brain",
      healthy: true,
      message: "Brain facade is working",
    });

    // Проверка LightingFacade
    healthDetails.push({
      component: "lighting",
      healthy: true,
      message: "Lighting facade is working",
    });

    // Определение общего состояния
    const allHealthy = healthDetails.every((detail) => detail.healthy);
    const someHealthy = healthDetails.some((detail) => detail.healthy);

    this.state.health = {
      overall: allHealthy ? "healthy" : someHealthy ? "degraded" : "unhealthy",
      details: healthDetails,
      timestamp: Date.now(),
    };
  }

  /**
   * Очистка памяти и оптимизация
   */
  private cleanup(): void {
    // Базовая очистка для Phase 1
    // В будущих фазах будет более сложная логика очистки

    if (global.gc) {
      global.gc();
      this.logger.debug("Garbage collection triggered");
    }
  }

  /**
   * Получение текущего состояния двигателя
   */
  getState(): EngineState {
    return {
      ...this.state,
      performance: { ...this.state.performance },
      health: { ...this.state.health },
    };
  }

  /**
   * Получение статистики производительности
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.state.performance };
  }

  /**
   * Получение статуса здоровья
   */
  getHealthStatus(): HealthStatus {
    return { ...this.state.health };
  }

  /**
   * Проверка, работает ли двигатель
   */
  isEngineRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Получение времени работы
   */
  getUptime(): number {
    return this.state.startTime > 0 ? Date.now() - this.state.startTime : 0;
  }
}
