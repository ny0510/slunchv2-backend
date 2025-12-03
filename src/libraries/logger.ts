import { join } from 'path';
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync } from 'node:fs';
import { $ } from 'bun';

const logsDir = join(__dirname, '..', '..', 'logs');

// Ensure logs directory exists
if (!existsSync(logsDir)) {
  mkdirSync(logsDir, { recursive: true });
}

type LogLevel = 'info' | 'warn' | 'error' | 'debug';
type LogType = 'general' | 'error' | 'fcm';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  duration?: number;
  data?: Record<string, any>;
}

function getDateStr(): string {
  const date = new Date();
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
}

function getWeekNumber(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

function parseDateFromFilename(filename: string): Date | null {
  const match = filename.match(/^(\d{4})(\d{2})(\d{2})/);
  if (match) {
    return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
  }
  return null;
}

/**
 * 1주일 지난 로그 파일들을 주 단위로 tar.zst로 압축
 */
export async function compressOldLogs(): Promise<void> {
  try {
    const files = readdirSync(logsDir);
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const currentWeek = getWeekNumber(now);

    // 주별로 파일 그룹화
    const weeklyFiles: Map<string, string[]> = new Map();

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const fileDate = parseDateFromFilename(file);
      if (!fileDate || fileDate >= oneWeekAgo) continue;

      const { year, week } = getWeekNumber(fileDate);
      // 현재 주는 스킵
      if (year === currentWeek.year && week === currentWeek.week) continue;

      const weekKey = `${year}-W${String(week).padStart(2, '0')}`;
      if (!weeklyFiles.has(weekKey)) {
        weeklyFiles.set(weekKey, []);
      }
      weeklyFiles.get(weekKey)!.push(file);
    }

    // 주별로 압축
    for (const [weekKey, fileList] of weeklyFiles) {
      const archiveName = `logs_${weekKey}.tar.zst`;
      const archivePath = join(logsDir, archiveName);

      // 이미 압축 파일이 존재하면 스킵
      if (existsSync(archivePath)) {
        console.log(`[LOGGER] Archive already exists: ${archiveName}`);
        continue;
      }

      // tar로 묶고 zstd로 압축
      const fileArgs = fileList.join(' ');
      await $`cd ${logsDir} && tar -cf - ${fileList} | zstd -19 -o ${archiveName}`;

      // 원본 파일 삭제
      for (const file of fileList) {
        unlinkSync(join(logsDir, file));
      }

      console.log(`[LOGGER] Compressed ${fileList.length} files -> ${archiveName}`);
    }
  } catch (error) {
    console.error('[LOGGER] Failed to compress old logs:', error);
  }
}

function getLogFilePath(type: LogType = 'general'): string {
  const dateStr = getDateStr();
  switch (type) {
    case 'error':
      return join(logsDir, `${dateStr}_errors.json`);
    case 'fcm':
      return join(logsDir, `${dateStr}_fcm.json`);
    default:
      return join(logsDir, `${dateStr}.json`);
  }
}

function readExistingLogs(filePath: string): LogEntry[] {
  try {
    if (existsSync(filePath)) {
      const content = readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    }
  } catch {
    // If file is corrupted or doesn't exist, start fresh
  }
  return [];
}

function writeLog(entry: LogEntry, type: LogType = 'general'): void {
  const filePath = getLogFilePath(type);
  const logs = readExistingLogs(filePath);
  logs.push(entry);
  // 배열 형식 유지, 각 항목은 한 줄로
  const output = '[\n' + logs.map(log => '  ' + JSON.stringify(log)).join(',\n') + '\n]';
  Bun.write(filePath, output);
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
    writeLog(entry, 'general');
    console.log(`[${category}] ${message}`, data ? JSON.stringify(data) : '');
  },

  warn: (category: string, message: string, data?: Record<string, any>) => {
    const entry = createLogEntry('warn', category, message, data);
    writeLog(entry, 'general');
    console.warn(`[${category}] ${message}`, data ? JSON.stringify(data) : '');
  },

  error: (category: string, message: string, error?: any, data?: Record<string, any>) => {
    const entry = createLogEntry('error', category, message, {
      ...data,
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
    });
    writeLog(entry, 'error');
    console.error(`[${category}] ${message}`, error);
  },

  debug: (category: string, message: string, data?: Record<string, any>) => {
    const entry = createLogEntry('debug', category, message, data);
    writeLog(entry, 'general');
    console.debug(`[${category}] ${message}`, data ? JSON.stringify(data) : '');
  },

  /**
   * Log with duration measurement
   */
  withDuration: (category: string, message: string, duration: number, data?: Record<string, any>) => {
    const entry = createLogEntry('info', category, message, data, duration);
    writeLog(entry, 'general');
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
        writeLog(entry, 'general');
        console.log(`[${category}] ${message || operationName} - ${duration}ms`, data ? JSON.stringify(data) : '');
        return duration;
      },
      elapsed: () => Date.now() - startTime,
    };
  },

  /**
   * FCM 관련 로그 (별도 파일에 저장)
   */
  fcm: {
    notification: (token: string, type: string, data?: Record<string, any>) => {
      const entry = createLogEntry('info', 'FCM', `${type} notification sent`, { token, type, ...data });
      writeLog(entry, 'fcm');
      console.log(`[FCM] ${type} notification sent to ${token}`);
    },
    error: (token: string, type: string, error: any, data?: Record<string, any>) => {
      const entry = createLogEntry('error', 'FCM', `Error sending ${type} notification`, {
        token,
        type,
        error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
        ...data,
      });
      // FCM 에러는 fcm 로그와 error 로그 둘 다에 저장
      writeLog(entry, 'fcm');
      writeLog(entry, 'error');
      console.error(`[FCM] Error sending ${type} notification to ${token}:`, error);
    },
  },
};

export default logger;
