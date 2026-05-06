// Sistema de logging para o frontend
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  data?: any;
  stack?: string;
  url?: string;
  userAgent?: string;
  userId?: number;
}

class FrontendLogger {
  private static isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof navigator !== 'undefined';
  }
  private static logLevel: LogLevel =
    process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.WARN;
  private static logs: LogEntry[] = [];
  private static maxLogs = Number(process.env.NEXT_PUBLIC_LOG_MAX_ENTRIES || 300);
  private static readonly maxPayloadChars = Number(process.env.NEXT_PUBLIC_LOG_MAX_PAYLOAD_CHARS || 2000);
  private static listeners = new Set<(entry: LogEntry) => void>();
  private static readonly sensitiveKeys = ['password', 'token', 'authorization', 'cookie', 'secret', 'cpf', 'cnpj'];

  private static sanitize(value: any): any {
    if (value == null) return value;
    if (Array.isArray(value)) return value.map((item) => this.sanitize(item));
    if (typeof value !== 'object') return value;
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      const keyLower = key.toLowerCase();
      if (this.sensitiveKeys.some((s) => keyLower.includes(s))) {
        out[key] = '[REDACTED]';
      } else {
        out[key] = this.sanitize(nested);
      }
    }
    return out;
  }

  private static notifyListeners(entry: LogEntry): void {
    this.listeners.forEach((listener) => {
      try {
        listener(entry);
      } catch {
        // Evita quebrar a aplicação por erro em listeners de debug
      }
    });
  }

  private static addLog(level: LogLevel, message: string, data?: any, context?: string): void {
    const browser = this.isBrowser();
    const logEntry: LogEntry = {
      timestamp: new Date().toLocaleString('pt-BR', { 
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }),
      level,
      message,
      context: context || 'FRONTEND',
      data: this.sanitize(data),
      stack: level >= LogLevel.ERROR ? new Error().stack : undefined,
      url: browser ? window.location.href : undefined,
      userAgent: browser ? navigator.userAgent : undefined,
      userId: this.getCurrentUserId()
    };

    // Adicionar ao array de logs
    this.logs.push(logEntry);
    
    // Manter apenas os últimos maxLogs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
    this.notifyListeners(logEntry);

    // Console output com cores
    if (level >= this.logLevel) {
      const color = this.getColor(level);
      const reset = '\x1b[0m';
      const levelName = LogLevel[level];
      
      console.log(`${color}[${logEntry.timestamp}] ${levelName}: ${message}${reset}`);
      
      if (logEntry.data) {
        const payload = JSON.stringify(logEntry.data);
        console.log('Data:', payload.length > this.maxPayloadChars ? `${payload.slice(0, this.maxPayloadChars)}... [truncated]` : logEntry.data);
      }
      
      if (level >= LogLevel.ERROR && logEntry.stack) {
        console.error('Stack:', logEntry.stack);
      }
    }
  }

  private static getColor(level: LogLevel): string {
    const colors = {
      [LogLevel.DEBUG]: '\x1b[35m',    // Magenta
      [LogLevel.INFO]: '\x1b[36m',     // Cyan
      [LogLevel.WARN]: '\x1b[33m',     // Yellow
      [LogLevel.ERROR]: '\x1b[31m'     // Red
    };
    return colors[level] || '\x1b[0m';
  }

  private static getCurrentUserId(): number | undefined {
    if (!this.isBrowser()) return undefined;
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        return user.id;
      }
    } catch (error) {
      // Ignorar erro de parsing
    }
    return undefined;
  }

  static debug(message: string, data?: any, context?: string): void {
    this.addLog(LogLevel.DEBUG, message, data, context);
  }

  static info(message: string, data?: any, context?: string): void {
    this.addLog(LogLevel.INFO, message, data, context);
  }

  static warn(message: string, data?: any, context?: string): void {
    this.addLog(LogLevel.WARN, message, data, context);
  }

  static error(message: string, data?: any, context?: string): void {
    this.addLog(LogLevel.ERROR, message, data, context);
  }

  static success(message: string, data?: any, context?: string): void {
    this.addLog(LogLevel.INFO, message, data, context);
  }

  // Logs específicos para diferentes contextos
  static apiRequest(method: string, url: string, data?: any): void {
    this.info(`API Request: ${method} ${url}`, {
      method,
      url,
      data: data ? JSON.stringify(data) : null
    }, 'API');
  }

  static apiResponse(method: string, url: string, status: number, responseTime: number, data?: any): void {
    const level = status >= 400 ? LogLevel.ERROR : status >= 300 ? LogLevel.WARN : LogLevel.INFO;
    this.addLog(level, `API Response: ${method} ${url} - ${status}`, {
      method,
      url,
      status,
      responseTime: `${responseTime}ms`,
      data: data ? JSON.stringify(data) : null
    }, 'API');
  }

  static authEvent(event: string, details?: any): void {
    this.info(`Auth Event: ${event}`, {
      event,
      details
    }, 'AUTH');
  }

  static userAction(action: string, details?: any): void {
    this.info(`User Action: ${action}`, {
      action,
      details
    }, 'USER');
  }

  static componentLifecycle(component: string, lifecycle: string, details?: any): void {
    this.debug(`Component ${lifecycle}: ${component}`, {
      component,
      lifecycle,
      details
    }, 'COMPONENT');
  }

  static businessLogic(operation: string, context: string, data?: any, result?: any): void {
    this.info(`Business Logic: ${operation}`, {
      operation,
      context,
      input: data,
      result
    }, 'BUSINESS');
  }

  // Métodos utilitários
  static getLogs(): LogEntry[] {
    return [...this.logs];
  }

  static subscribe(listener: (entry: LogEntry) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  static clearLogs(): void {
    this.logs = [];
  }

  static exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  static downloadLogs(): void {
    if (!this.isBrowser()) return;
    const logs = this.exportLogs();
    const blob = new Blob([logs], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `frontend-logs-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  static setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  static getLogLevel(): LogLevel {
    return this.logLevel;
  }
}

// Exportar instância para compatibilidade
export const logger = FrontendLogger;

// Adicionar ao window para debug no console
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  (window as any).logger = FrontendLogger;
  (window as any).LogLevel = LogLevel;
}
