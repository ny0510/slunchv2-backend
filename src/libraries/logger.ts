import { join } from 'path';
import { existsSync, mkdirSync } from 'node:fs';

const logsDir = join(__dirname, '..', '..', 'logs');

// Ensure logs directory exists
if (!existsSync(logsDir)) {
  mkdirSync(logsDir, { recursive: true });
}

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  duration?: number;
  data?: Record<string, any>;
}

function getLogFilePath(): string {
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  return join(logsDir, `${dateStr}.json`);
}

function readExistingLogs(filePath: string): LogEntry[] {
  try {
    const file = Bun.file(filePath);
    if (file.size > 0) {
      // Bun.file().json() is async, so we use text() synchronously
      const content = require('fs').readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    }
  } catch {
    // If file is corrupted or doesn't exist, start fresh
  }
  return [];
}

function writeLog(entry: LogEntry): void {
  const filePath = getLogFilePath();
  const logs = readExistingLogs(filePath);
  logs.push(entry);
  Bun.write(filePath, JSON.stringify(logs, null, 2));
}

function createLogEntry(level: LogLevel, category: string, message: string, data?: Record<string, any>, duration?: number): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    category,
    message,
    ...(duration !== undefined && { duration }),
    ...(data && { data }),
  };
}

export const logger = {
  info: (category: string, message: string, data?: Record<string, any>) => {
    const entry = createLogEntry('info', category, message, data);
    writeLog(entry);
    console.log(`[${category}] ${message}`, data ? JSON.stringify(data) : '');
  },

  warn: (category: string, message: string, data?: Record<string, any>) => {
    const entry = createLogEntry('warn', category, message, data);
    writeLog(entry);
    console.warn(`[${category}] ${message}`, data ? JSON.stringify(data) : '');
  },

  error: (category: string, message: string, error?: any, data?: Record<string, any>) => {
    const entry = createLogEntry('error', category, message, {
      ...data,
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
    });
    writeLog(entry);
    console.error(`[${category}] ${message}`, error);
  },

  debug: (category: string, message: string, data?: Record<string, any>) => {
    const entry = createLogEntry('debug', category, message, data);
    writeLog(entry);
    console.debug(`[${category}] ${message}`, data ? JSON.stringify(data) : '');
  },

  /**
   * Log with duration measurement
   */
  withDuration: (category: string, message: string, duration: number, data?: Record<string, any>) => {
    const entry = createLogEntry('info', category, message, data, duration);
    writeLog(entry);
    console.log(`[${category}] ${message} - ${duration}ms`, data ? JSON.stringify(data) : '');
  },

  /**
   * Create a timer for measuring duration
   */
  startTimer: (category: string, operationName: string) => {
    const startTime = Date.now();
    return {
      end: (message?: string, data?: Record<string, any>) => {
        const duration = Date.now() - startTime;
        const entry = createLogEntry('info', category, message || operationName, data, duration);
        writeLog(entry);
        console.log(`[${category}] ${message || operationName} - ${duration}ms`, data ? JSON.stringify(data) : '');
        return duration;
      },
      elapsed: () => Date.now() - startTime,
    };
  },

  /**
   * FCM 관련 로그 (기존 appendFile 로직 대체)
   */
  fcm: {
    notification: (token: string, type: string, data?: Record<string, any>) => {
      const entry = createLogEntry('info', 'FCM', `${type} notification sent`, { token, type, ...data });
      writeLog(entry);
      console.log(`[FCM] ${type} notification sent to ${token}`);
    },
    error: (token: string, type: string, error: any, data?: Record<string, any>) => {
      const entry = createLogEntry('error', 'FCM', `Error sending ${type} notification`, {
        token,
        type,
        error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
        ...data,
      });
      writeLog(entry);
      console.error(`[FCM] Error sending ${type} notification to ${token}:`, error);
    },
  },
};

export default logger;
