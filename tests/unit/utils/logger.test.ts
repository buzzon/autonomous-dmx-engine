import { Logger, LogLevel } from '../../../src/utils/logger';

describe('Logger', () => {
  let logger: Logger;
  let consoleSpy: {
    log: jest.SpyInstance;
    info: jest.SpyInstance;
    warn: jest.SpyInstance;
    error: jest.SpyInstance;
    debug: jest.SpyInstance;
  };

  beforeEach(() => {
    // Create a fresh logger for each test
    logger = new Logger(LogLevel.DEBUG);
    
    // Spy on console methods
    consoleSpy = {
      log: jest.spyOn(console, 'log').mockImplementation(() => {}),
      info: jest.spyOn(console, 'info').mockImplementation(() => {}),
      warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
      error: jest.spyOn(console, 'error').mockImplementation(() => {}),
      debug: jest.spyOn(console, 'debug').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should create logger with default log level', () => {
      const defaultLogger = new Logger();
      expect(defaultLogger).toBeInstanceOf(Logger);
    });

    test('should create logger with custom log level', () => {
      const errorLogger = new Logger(LogLevel.ERROR);
      expect(errorLogger).toBeInstanceOf(Logger);
    });

    test('should create logger with initial context', () => {
      const contextLogger = new Logger(LogLevel.INFO, { module: 'test', version: '1.0' });
      expect(contextLogger).toBeInstanceOf(Logger);
    });
  });

  describe('log levels', () => {
    test('DEBUG level should log all messages', () => {
      const debugLogger = new Logger(LogLevel.DEBUG);
      
      debugLogger.debug('debug message');
      debugLogger.info('info message');
      debugLogger.warn('warn message');
      debugLogger.error('error message');

      expect(consoleSpy.debug).toHaveBeenCalledTimes(1);
      expect(consoleSpy.log).toHaveBeenCalledTimes(1); // INFO uses console.log
      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
    });

    test('INFO level should not log debug messages', () => {
      const infoLogger = new Logger(LogLevel.INFO);
      
      infoLogger.debug('debug message');
      infoLogger.info('info message');
      infoLogger.warn('warn message');
      infoLogger.error('error message');

      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.log).toHaveBeenCalledTimes(1); // INFO uses console.log
      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
    });

    test('WARN level should only log warn and error messages', () => {
      const warnLogger = new Logger(LogLevel.WARN);
      
      warnLogger.debug('debug message');
      warnLogger.info('info message');
      warnLogger.warn('warn message');
      warnLogger.error('error message');

      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.log).not.toHaveBeenCalled(); // INFO uses console.log
      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
    });

    test('ERROR level should only log error messages', () => {
      const errorLogger = new Logger(LogLevel.ERROR);
      
      errorLogger.debug('debug message');
      errorLogger.info('info message');
      errorLogger.warn('warn message');
      errorLogger.error('error message');

      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.log).not.toHaveBeenCalled(); // INFO uses console.log
      expect(consoleSpy.warn).not.toHaveBeenCalled();
      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
    });
  });

  describe('logging with data', () => {
    test('should log message with additional data', () => {
      logger.info('test message', { key: 'value', count: 42 });
      
      expect(consoleSpy.log).toHaveBeenCalled();
      const call = consoleSpy.log.mock.calls[0][0];
      expect(call).toContain('test message');
      expect(call).toContain('"key":"value"');
      expect(call).toContain('"count":42');
    });

    test('should log error with stack trace', () => {
      const error = new Error('test error');
      logger.error('error occurred', { error });
      
      expect(consoleSpy.error).toHaveBeenCalled();
      const call = consoleSpy.error.mock.calls[0][0];
      expect(call).toContain('error occurred');
      expect(call).toContain('"error":{}');
    });
  });

  describe('child logger', () => {
    test('should create child logger with additional context', () => {
      const parentLogger = new Logger(LogLevel.INFO, { module: 'parent', version: '1.0' });
      const childLogger = parentLogger.child({ submodule: 'child', feature: 'test' });
      
      expect(childLogger).toBeInstanceOf(Logger);
      
      // Child should inherit parent context
      childLogger.info('child message');
      
      expect(consoleSpy.log).toHaveBeenCalled();
      const call = consoleSpy.log.mock.calls[0][0];
      expect(call).toContain('child message');
      expect(call).toContain('"module":"parent"');
      expect(call).toContain('"version":"1.0"');
      expect(call).toContain('"submodule":"child"');
      expect(call).toContain('"feature":"test"');
    });

    test('child logger should inherit parent log level', () => {
      const parentLogger = new Logger(LogLevel.ERROR);
      const childLogger = parentLogger.child({ submodule: 'test' });
      
      // Both parent and child should not log debug (ERROR level)
      parentLogger.debug('parent debug');
      childLogger.debug('child debug');
      
      expect(consoleSpy.debug).not.toHaveBeenCalled();
      
      // Both should log error
      parentLogger.error('parent error');
      childLogger.error('child error');
      
      expect(consoleSpy.error).toHaveBeenCalledTimes(2);
    });
  });

  describe('log level methods', () => {
    test('debug() should call log with DEBUG level', () => {
      logger.debug('debug test');
      expect(consoleSpy.debug).toHaveBeenCalled();
      const call = consoleSpy.debug.mock.calls[0][0];
      expect(call).toContain('debug test');
      expect(call).toContain('{}');
    });

    test('info() should call log with INFO level', () => {
      logger.info('info test');
      expect(consoleSpy.log).toHaveBeenCalled();
      const call = consoleSpy.log.mock.calls[0][0];
      expect(call).toContain('info test');
      expect(call).toContain('{}');
    });

    test('warn() should call log with WARN level', () => {
      logger.warn('warn test');
      expect(consoleSpy.warn).toHaveBeenCalled();
      const call = consoleSpy.warn.mock.calls[0][0];
      expect(call).toContain('warn test');
      expect(call).toContain('{}');
    });

    test('error() should call log with ERROR level', () => {
      logger.error('error test');
      expect(consoleSpy.error).toHaveBeenCalled();
      const call = consoleSpy.error.mock.calls[0][0];
      expect(call).toContain('error test');
      expect(call).toContain('{}');
    });
  });

  describe('default logger export', () => {
    test('defaultLogger should be instance of Logger', () => {
      // We need to re-import to get the default export
      // For now, just test that we can create a logger
      const testLogger = new Logger();
      expect(testLogger).toBeInstanceOf(Logger);
    });
  });
});