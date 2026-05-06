import { promises as fs } from 'fs';
import path from 'path';
import { AsyncLocalStorage } from 'async_hooks';

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'success';
type LogDestination = 'console' | 'file' | 'both';

interface RequestContext {
  requestId?: string;
  correlationId?: string;
  userId?: number;
}

interface LogEvent {
  timestamp: string;
  level: LogLevel;
  message: string;
  context: string;
  environment: string;
  service: string;
  pid: number;
  requestId?: string;
  correlationId?: string;
  userId?: number;
  data?: unknown;
  error?: {
    message: string;
    stack?: string;
  };
}

const requestStorage = new AsyncLocalStorage<RequestContext>();
const LOG_LEVEL_WEIGHT: Record<LogLevel, number> = { debug: 10, info: 20, success: 25, warn: 30, error: 40 };
const DEFAULT_LEVEL: LogLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug';
const ENABLE_DEV_CONSOLE = process.env.LOG_DEV_CONSOLE !== 'false';

export class Logger {
  private static logDir = path.join(process.cwd(), 'logs');
  private static initialized = false;
  private static readonly serviceName = process.env.SERVICE_NAME || 'erp-prime';
  private static readonly level = (process.env.LOG_LEVEL as LogLevel) || DEFAULT_LEVEL;
  private static readonly destination = (process.env.LOG_DESTINATION as LogDestination) || 'both';
  private static readonly sampleRate = Number(process.env.LOG_SAMPLE_RATE || 1);
  private static readonly includeStack = process.env.LOG_INCLUDE_STACK === 'true' || process.env.NODE_ENV !== 'production';
  private static readonly includeRuntime = process.env.LOG_INCLUDE_RUNTIME_METRICS === 'true';
  private static readonly SENSITIVE_KEYS = [
    'password',
    'currentPassword',
    'newPassword',
    'token',
    'secret',
    'authorization',
    'cookie',
    'set-cookie',
    'cpf',
    'cnpj',
    'access_token',
    'refresh_token'
  ];

  static runWithRequestContext<T>(context: RequestContext, callback: () => T): T {
    return requestStorage.run(context, callback);
  }

  static getRequestContext(): RequestContext | undefined {
    return requestStorage.getStore();
  }

  static sanitizeForLog(value: unknown): unknown {
    if (value == null) return value;
    if (Array.isArray(value)) return value.map((item) => this.sanitizeForLog(item));
    if (typeof value !== 'object') return value;

    const input = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};

    for (const [key, nested] of Object.entries(input)) {
      const keyLower = key.toLowerCase();
      if (this.SENSITIVE_KEYS.some((s) => keyLower.includes(s))) {
        out[key] = '[REDACTED]';
        continue;
      }
      out[key] = this.sanitizeForLog(nested);
    }
    return out;
  }

  private static shouldLog(level: LogLevel): boolean {
    if (Math.random() > this.sampleRate) return false;
    return LOG_LEVEL_WEIGHT[level] >= LOG_LEVEL_WEIGHT[this.level];
  }

  private static async ensureLogDir() {
    if (this.initialized) return;
    await fs.mkdir(this.logDir, { recursive: true });
    this.initialized = true;
  }

  private static getColor(level: LogLevel): string {
    const colors: Record<LogLevel, string> = {
      info: '\x1b[36m',
      warn: '\x1b[33m',
      error: '\x1b[31m',
      debug: '\x1b[35m',
      success: '\x1b[32m'
    };
    return colors[level] || '\x1b[0m';
  }

  private static async writeToFile(logLine: string): Promise<void> {
    if (this.destination === 'console') return;
    const logFile = path.join(this.logDir, `${new Date().toISOString().split('T')[0]}.log`);
    await this.ensureLogDir();
    await fs.appendFile(logFile, `${logLine}\n`, 'utf8');
  }

  private static writeToConsole(level: LogLevel, event: LogEvent): void {
    if (this.destination === 'file') return;
    if (process.env.NODE_ENV === 'production' && !ENABLE_DEV_CONSOLE) return;
    const color = this.getColor(level);
    const reset = '\x1b[0m';
    const contextPrefix = event.requestId ? `[${event.requestId}]` : '';
    console.log(`${color}${contextPrefix}[${event.timestamp}] ${level.toUpperCase()}: ${event.message}${reset}`);
  }

  private static writeLog(level: LogLevel, message: string, data?: unknown, context = 'SYSTEM') {
    if (!this.shouldLog(level)) return;

    const requestContext = this.getRequestContext();
    const event: LogEvent = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      environment: process.env.NODE_ENV || 'development',
      service: this.serviceName,
      pid: process.pid,
      requestId: requestContext?.requestId,
      correlationId: requestContext?.correlationId,
      userId: requestContext?.userId,
      data: this.sanitizeForLog(data)
    };

    if (this.includeRuntime) {
      event.data = {
        ...(typeof event.data === 'object' && event.data != null ? (event.data as Record<string, unknown>) : {}),
        runtime: {
          uptimeSec: Math.round(process.uptime()),
          rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024)
        }
      };
    }

    if (data instanceof Error) {
      event.error = {
        message: data.message,
        ...(this.includeStack ? { stack: data.stack } : {})
      };
    }

    const logLine = JSON.stringify(event);
    this.writeToConsole(level, event);
    void this.writeToFile(logLine).catch((error) => {
      process.stderr.write(`[LOGGER_WRITE_ERROR] ${error instanceof Error ? error.message : String(error)}\n`);
    });
  }

  static debug(message: string, data?: unknown, context?: string) {
    this.writeLog('debug', message, data, context);
  }
  static info(message: string, data?: unknown, context?: string) {
    this.writeLog('info', message, data, context);
  }
  static warn(message: string, data?: unknown, context?: string) {
    this.writeLog('warn', message, data, context);
  }
  static error(message: string, data?: unknown, context?: string) {
    this.writeLog('error', message, data, context);
  }
  static success(message: string, data?: unknown, context?: string) {
    this.writeLog('success', message, data, context);
  }

  static apiRequest(method: string, url: string, body?: unknown, user?: any) {
    this.info(`API Request: ${method} ${url}`, { method, url, body: this.sanitizeForLog(body), user: user ? { id: user.id, role: user.role } : null }, 'API');
  }

  static apiResponse(method: string, url: string, status: number, responseTime: number, data?: unknown) {
    const level: LogLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    this.writeLog(level, `API Response: ${method} ${url} - ${status}`, { method, url, status, responseTimeMs: responseTime, data }, 'API');
  }

  static authEvent(event: string, user?: any, details?: unknown) {
    this.info(`Auth Event: ${event}`, { event, user: user ? { id: user.id, role: user.role } : null, details }, 'AUTH');
  }
}

export const logger = Logger;