import fs from 'fs';
import path from 'path';

export class Logger {
  private static logDir = path.join(process.cwd(), 'logs');
  private static ensureLogDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private static writeLog(level: string, message: string, data?: any, context?: string) {
    this.ensureLogDir();
    
    // Usar timezone do Brasil para logs
    const now = new Date();
    const timestamp = now.toLocaleString('pt-BR', { 
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    const logEntry = {
      timestamp,
      level,
      message,
      context: context || 'SYSTEM',
      data: data || null,
      stack: level === 'error' && data instanceof Error ? data.stack : undefined,
      pid: process.pid,
      memory: process.memoryUsage(),
      uptime: process.uptime()
    };

    const logFile = path.join(this.logDir, `${new Date().toISOString().split('T')[0]}.log`);
    const logLine = JSON.stringify(logEntry) + '\n';
    
    fs.appendFileSync(logFile, logLine);
    
    // Console output com cores
    const color = this.getColor(level);
    const reset = '\x1b[0m';
    console.log(`${color}[${timestamp}] ${level.toUpperCase()}: ${message}${reset}`);
    
    if (data && level === 'error') {
      console.error('Data:', data);
      if (data instanceof Error) {
        console.error('Stack:', data.stack);
      }
    }
  }

  private static getColor(level: string): string {
    const colors = {
      info: '\x1b[36m',    // Cyan
      warn: '\x1b[33m',    // Yellow
      error: '\x1b[31m',   // Red
      debug: '\x1b[35m',   // Magenta
      success: '\x1b[32m'  // Green
    };
    return colors[level as keyof typeof colors] || '\x1b[0m';
  }

  static info(message: string, data?: any, context?: string) {
    this.writeLog('info', message, data, context);
  }

  static warn(message: string, data?: any, context?: string) {
    this.writeLog('warn', message, data, context);
  }

  static error(message: string, data?: any, context?: string) {
    this.writeLog('error', message, data, context);
  }

  static debug(message: string, data?: any, context?: string) {
    if (process.env.NODE_ENV === 'development') {
      this.writeLog('debug', message, data, context);
    }
  }

  static success(message: string, data?: any, context?: string) {
    this.writeLog('success', message, data, context);
  }

  // Logs específicos para diferentes contextos
  static apiRequest(method: string, url: string, body?: any, user?: any) {
    this.info(`API Request: ${method} ${url}`, {
      method,
      url,
      body: body ? JSON.stringify(body) : null,
      user: user ? { id: user.id, role: user.role } : null
    }, 'API');
  }

  static apiResponse(method: string, url: string, status: number, responseTime: number) {
    const level = status >= 400 ? 'error' : status >= 300 ? 'warn' : 'info';
    this[level](`API Response: ${method} ${url} - ${status}`, {
      method,
      url,
      status,
      responseTime: `${responseTime}ms`
    }, 'API');
  }

  static authEvent(event: string, user?: any, details?: any) {
    this.info(`Auth Event: ${event}`, {
      event,
      user: user ? { id: user.id, email: user.email, role: user.role } : null,
      details
    }, 'AUTH');
  }

  static databaseOperation(operation: string, table: string, data?: any, error?: any) {
    if (error) {
      this.error(`Database Error: ${operation} on ${table}`, {
        operation,
        table,
        error: error.message,
        stack: error.stack
      }, 'DATABASE');
    } else {
      this.debug(`Database Operation: ${operation} on ${table}`, {
        operation,
        table,
        data: data ? JSON.stringify(data) : null
      }, 'DATABASE');
    }
  }

  static businessLogic(operation: string, context: string, data?: any, result?: any) {
    this.info(`Business Logic: ${operation}`, {
      operation,
      context,
      input: data,
      result
    }, 'BUSINESS');
  }
}

// Exportar instância para compatibilidade
export const logger = Logger;