/**
 * ControlAPI - упрощённая реализация для Phase 1
 * Предоставляет API для управления системой и получения состояния
 */

import { defaultLogger } from '../utils/logger';
import { 
  UserCommand, 
  SystemState, 
  WebSocketMessage, 
  ApiResponse, 
  ControlAPIConfig,
  ControlAPIState,
  UserCommandType,
  WebUIConfig,
  OSCConfig,
  Preset,
  UserSession,
  ApiEndpoint,
  CommandValidation,
  RateLimitInfo,
  AuthToken,
  UserRole,
  PermissionLevel
} from './types';

const logger = defaultLogger.child({ module: 'ControlAPI' });

/**
 * Упрощённый ControlAPI для Phase 1
 */
export class ControlAPI {
  private config: ControlAPIConfig;
  private state: ControlAPIState;
  private isRunning = false;
  private commandHandlers: Map<UserCommandType, (command: UserCommand) => Promise<void>> = new Map();
  private systemState: SystemState = {
    mode: 'auto',
    globalIntensity: 1.0,
    blackout: false,
    manualOverrides: new Map(),
    lastUserActivity: Date.now()
  };

  constructor(config: ControlAPIConfig) {
    this.config = config;
    
    this.state = {
      isRunning: false,
      startTime: 0,
      connectedClients: 0,
      webSocketConnections: 0,
      totalCommands: 0,
      errors: []
    };
    
    this.registerDefaultHandlers();
    logger.info('ControlAPI initialized', { config });
  }

  /**
   * Запуск API
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('ControlAPI is already running');
      return;
    }

    try {
      logger.info('Starting ControlAPI...');
      
      this.isRunning = true;
      this.state.isRunning = true;
      this.state.startTime = Date.now();
      
      logger.info('ControlAPI started successfully');
      
    } catch (error) {
      logger.error('Failed to start ControlAPI', { error });
      throw error;
    }
  }

  /**
   * Остановка API
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('ControlAPI is not running');
      return;
    }

    try {
      logger.info('Stopping ControlAPI...');
      
      this.isRunning = false;
      this.state.isRunning = false;
      
      logger.info('ControlAPI stopped successfully');
      
    } catch (error) {
      logger.error('Error stopping ControlAPI', { error });
    }
  }

  /**
   * Обработка пользовательской команды
   */
  async handleCommand(command: UserCommand): Promise<ApiResponse> {
    const startTime = Date.now();
    
    try {
      logger.debug('Handling user command', { command });
      
      // Проверка типа команды
      const handler = this.commandHandlers.get(command.type);
      if (!handler) {
        throw new Error(`No handler for command type: ${command.type}`);
      }
      
      // Выполнение команды
      await handler(command);
      
      // Обновление состояния
      this.state.totalCommands++;
      this.state.lastCommand = command;
      this.systemState.lastUserActivity = Date.now();
      
      return {
        success: true,
        data: { message: 'Command executed successfully' },
        timestamp: Date.now()
      };
      
    } catch (error) {
      logger.error('Error handling command', { command, error });
      
      // Запись ошибки
      this.state.errors.push({
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // Ограничение размера истории ошибок
      if (this.state.errors.length > 100) {
        this.state.errors = this.state.errors.slice(-100);
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      };
    }
  }

  /**
   * Обновление состояния системы
   */
  updateSystemState(systemState: Partial<SystemState>): void {
    this.systemState = {
      ...this.systemState,
      ...systemState,
      lastUserActivity: Date.now()
    };
    
    logger.debug('System state updated', { systemState: this.systemState });
  }

  /**
   * Получение текущего состояния API
   */
  getState(): ControlAPIState {
    return { ...this.state };
  }

  /**
   * Получение состояния системы
   */
  getSystemState(): SystemState {
    return { 
      ...this.systemState,
      manualOverrides: new Map(this.systemState.manualOverrides)
    };
  }

  /**
   * Регистрация обработчика команды
   */
  registerCommandHandler(type: UserCommandType, handler: (command: UserCommand) => Promise<void>): void {
    this.commandHandlers.set(type, handler);
    logger.debug('Command handler registered', { type });
  }

  /**
   * Отправка сообщения через WebSocket
   */
  sendWebSocketMessage(message: WebSocketMessage): void {
    // В Phase 1 просто логируем
    logger.debug('WebSocket message would be sent', { message });
  }

  /**
   * Вещание состояния системы
   */
  broadcastState(state: any): void {
    // В Phase 1 просто логируем
    logger.debug('State broadcast would be sent', { state });
  }

  /**
   * Регистрация обработчиков по умолчанию
   */
  private registerDefaultHandlers(): void {
    // Обработчик команды переключения режима
    this.registerCommandHandler('setMode', async (command) => {
      logger.info('Setting system mode', { mode: command.payload.mode });
      this.systemState.mode = command.payload.mode;
    });
    
    // Обработчик команды установки интенсивности
    this.registerCommandHandler('setIntensity', async (command) => {
      const intensity = command.payload.intensity;
      logger.info('Setting global intensity', { intensity });
      this.systemState.globalIntensity = Math.max(0, Math.min(1, intensity));
    });
    
    // Обработчик команды blackout
    this.registerCommandHandler('setBlackout', async (command) => {
      const enable = command.payload.enable ?? true;
      logger.info(enable ? 'Enabling blackout' : 'Disabling blackout');
      this.systemState.blackout = enable;
    });
    
    // Обработчик команды установки сцены
    this.registerCommandHandler('setScene', async (command) => {
      logger.info('Setting scene', { sceneId: command.payload.sceneId });
      this.systemState.activeSceneId = command.payload.sceneId;
    });
    
    // Обработчик команды перезагрузки конфигурации
    this.registerCommandHandler('reloadConfigs', async () => {
      logger.info('Reload config command received');
      // В Phase 1 просто логируем
    });
    
    // Обработчик команды emergency stop
    this.registerCommandHandler('setBlackout', async (command) => {
      if (command.payload.enable === true) {
        logger.warn('Emergency stop via blackout');
        this.systemState.blackout = true;
        this.systemState.globalIntensity = 0;
      }
    });
  }
}

/**
 * Создание экземпляра ControlAPI с конфигурацией по умолчанию
 */
export function createControlAPI(config?: Partial<ControlAPIConfig>): ControlAPI {
  const defaultConfig: ControlAPIConfig = {
    port: 3000,
    enableWebSocket: true,
    enableREST: true,
    enableOSC: false,
    corsOrigins: ['http://localhost:8080'],
    rateLimit: {
      windowMs: 60000,
      maxRequests: 100
    },
    authentication: {
      enabled: false
    }
  };
  
  return new ControlAPI({
    ...defaultConfig,
    ...config
  });
}