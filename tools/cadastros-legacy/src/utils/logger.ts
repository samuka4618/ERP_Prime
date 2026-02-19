import * as fs from 'fs';
import * as path from 'path';

export class Logger {
  private static logDir = './logs';
  private static logFile = path.join(this.logDir, 'spc-bot.log');

  /**
   * Inicializa o sistema de log
   */
  static initialize(): void {
    // Cria o diretório de logs se não existir
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Log de informação
   */
  static info(message: string, data?: any): void {
    this.writeLog('INFO', message, data);
  }

  /**
   * Log de erro
   */
  static error(message: string, data?: any): void {
    this.writeLog('ERROR', message, data);
  }

  /**
   * Log de aviso
   */
  static warn(message: string, data?: any): void {
    this.writeLog('WARN', message, data);
  }

  /**
   * Log específico para CNPJ inválido
   */
  static cnpjInvalid(cnpj: string, additionalInfo?: string): void {
    const message = `CNPJ INVÁLIDO: ${cnpj}`;
    const data = {
      cnpj,
      additionalInfo,
      timestamp: new Date().toISOString()
    };
    
    console.log(`❌ ${message}`);
    this.writeLog('CNPJ_INVALID', message, data);
  }

  /**
   * Log de sucesso
   */
  static success(message: string, data?: any): void {
    this.writeLog('SUCCESS', message, data);
  }

  /**
   * Escreve no arquivo de log
   */
  private static writeLog(level: string, message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data
    };

    const logLine = JSON.stringify(logEntry) + '\n';
    
    try {
      fs.appendFileSync(this.logFile, logLine);
    } catch (error) {
      console.error('Erro ao escrever no log:', error);
    }
  }

  /**
   * Lê os logs do arquivo
   */
  static readLogs(): string[] {
    try {
      if (!fs.existsSync(this.logFile)) {
        return [];
      }
      
      const content = fs.readFileSync(this.logFile, 'utf8');
      return content.trim().split('\n').filter(line => line.trim());
    } catch (error) {
      console.error('Erro ao ler logs:', error);
      return [];
    }
  }

  /**
   * Limpa os logs antigos (mantém apenas os últimos 1000 registros)
   */
  static cleanOldLogs(): void {
    try {
      const logs = this.readLogs();
      if (logs.length > 1000) {
        const recentLogs = logs.slice(-1000);
        fs.writeFileSync(this.logFile, recentLogs.join('\n') + '\n');
        console.log('Logs antigos removidos, mantidos os últimos 1000 registros');
      }
    } catch (error) {
      console.error('Erro ao limpar logs antigos:', error);
    }
  }

  /**
   * Obtém estatísticas dos logs
   */
  static getStats(): { total: number; errors: number; cnpjInvalid: number; successes: number } {
    const logs = this.readLogs();
    let errors = 0;
    let cnpjInvalid = 0;
    let successes = 0;

    logs.forEach(logLine => {
      try {
        const log = JSON.parse(logLine);
        if (log.level === 'ERROR') errors++;
        if (log.level === 'CNPJ_INVALID') cnpjInvalid++;
        if (log.level === 'SUCCESS') successes++;
      } catch (e) {
        // Ignora linhas inválidas
      }
    });

    return {
      total: logs.length,
      errors,
      cnpjInvalid,
      successes
    };
  }
}
