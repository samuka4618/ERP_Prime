"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class Logger {
    static initialize() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }
    static info(message, data) {
        this.writeLog('INFO', message, data);
    }
    static error(message, data) {
        this.writeLog('ERROR', message, data);
    }
    static warn(message, data) {
        this.writeLog('WARN', message, data);
    }
    static cnpjInvalid(cnpj, additionalInfo) {
        const message = `CNPJ INVÁLIDO: ${cnpj}`;
        const data = {
            cnpj,
            additionalInfo,
            timestamp: new Date().toISOString()
        };
        console.log(`❌ ${message}`);
        this.writeLog('CNPJ_INVALID', message, data);
    }
    static success(message, data) {
        this.writeLog('SUCCESS', message, data);
    }
    static writeLog(level, message, data) {
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
        }
        catch (error) {
            console.error('Erro ao escrever no log:', error);
        }
    }
    static readLogs() {
        try {
            if (!fs.existsSync(this.logFile)) {
                return [];
            }
            const content = fs.readFileSync(this.logFile, 'utf8');
            return content.trim().split('\n').filter(line => line.trim());
        }
        catch (error) {
            console.error('Erro ao ler logs:', error);
            return [];
        }
    }
    static cleanOldLogs() {
        try {
            const logs = this.readLogs();
            if (logs.length > 1000) {
                const recentLogs = logs.slice(-1000);
                fs.writeFileSync(this.logFile, recentLogs.join('\n') + '\n');
                console.log('Logs antigos removidos, mantidos os últimos 1000 registros');
            }
        }
        catch (error) {
            console.error('Erro ao limpar logs antigos:', error);
        }
    }
    static getStats() {
        const logs = this.readLogs();
        let errors = 0;
        let cnpjInvalid = 0;
        let successes = 0;
        logs.forEach(logLine => {
            try {
                const log = JSON.parse(logLine);
                if (log.level === 'ERROR')
                    errors++;
                if (log.level === 'CNPJ_INVALID')
                    cnpjInvalid++;
                if (log.level === 'SUCCESS')
                    successes++;
            }
            catch (e) {
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
exports.Logger = Logger;
_a = Logger;
Logger.logDir = './logs';
Logger.logFile = path.join(_a.logDir, 'spc-bot.log');
//# sourceMappingURL=logger.js.map