export declare class Logger {
    private static logDir;
    private static logFile;
    static initialize(): void;
    static info(message: string, data?: any): void;
    static error(message: string, data?: any): void;
    static warn(message: string, data?: any): void;
    static cnpjInvalid(cnpj: string, additionalInfo?: string): void;
    static success(message: string, data?: any): void;
    private static writeLog;
    static readLogs(): string[];
    static cleanOldLogs(): void;
    static getStats(): {
        total: number;
        errors: number;
        cnpjInvalid: number;
        successes: number;
    };
}
//# sourceMappingURL=logger.d.ts.map