/**
 * Logger utility for the autonomous DMX engine
 * Supports different log levels and structured logging
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
}

export class Logger {
  private level: LogLevel;
  private context: Record<string, any> = {};

  constructor(level: LogLevel = LogLevel.INFO, initialContext: Record<string, any> = {}) {
    this.level = level;
    this.context = { ...initialContext };
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext: Record<string, any>): Logger {
    return new Logger(this.level, { ...this.context, ...additionalContext });
  }

  /**
   * Log a debug message
   */
  debug(message: string, data?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  /**
   * Log an info message
   */
  info(message: string, data?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, data);
  }

  /**
   * Log a warning message
   */
  warn(message: string, data?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, data);
  }

  /**
   * Log an error message
   */
  error(message: string, data?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, data);
  }

  /**
   * Internal log method
   */
  private log(level: LogLevel, message: string, data?: Record<string, any>): void {
    if (level < this.level) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context: { ...this.context, ...data }
    };

    this.writeToConsole(entry);
  }

  /**
   * Write log entry to console with appropriate formatting
   */
  private writeToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const levelStr = LogLevel[entry.level].padEnd(5);
    const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : '';

    const logMessage = `[${timestamp}] ${levelStr} ${entry.message}${contextStr}`;

    switch (entry.level) {
      case LogLevel.ERROR:
        console.error(logMessage);
        break;
      case LogLevel.WARN:
        console.warn(logMessage);
        break;
      case LogLevel.INFO:
        console.log(logMessage);
        break;
      case LogLevel.DEBUG:
        console.debug(logMessage);
        break;
    }
  }

  /**
   * Set the log level
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Get the current log level
   */
  getLevel(): LogLevel {
    return this.level;
  }
}

/**
 * Default logger instance
 */
export const defaultLogger = new Logger(
  (typeof process !== 'undefined' && process.env.NODE_ENV === 'development')
    ? LogLevel.DEBUG
    : LogLevel.INFO
);