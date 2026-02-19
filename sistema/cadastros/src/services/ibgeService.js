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
Object.defineProperty(exports, "__esModule", { value: true });
exports.IBGEService = void 0;
const XLSX = __importStar(require("xlsx"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class IBGEService {
    static buscarCodigoIBGE(nomeMunicipio, uf) {
        if (!nomeMunicipio || !nomeMunicipio.trim()) {
            return null;
        }
        const nomeNormalizado = nomeMunicipio.trim().toUpperCase();
        const cacheKey = `${nomeNormalizado}_${uf?.toUpperCase() || ''}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey) || null;
        }
        try {
            if (!fs.existsSync(this.IBGE_DIR)) {
                console.warn(`⚠️ [IBGE] Pasta codIBGE não encontrada: ${this.IBGE_DIR}`);
                return null;
            }
            const files = fs.readdirSync(this.IBGE_DIR);
            const excelFiles = files.filter(file => /\.(xlsx|xls)$/i.test(file));
            if (excelFiles.length === 0) {
                console.warn(`⚠️ [IBGE] Nenhum arquivo Excel encontrado em: ${this.IBGE_DIR}`);
                return null;
            }
            for (const excelFile of excelFiles) {
                const filePath = path.join(this.IBGE_DIR, excelFile);
                const codigo = this.buscarCodigoNoArquivo(filePath, nomeNormalizado, uf);
                if (codigo) {
                    this.cache.set(cacheKey, codigo);
                    console.log(`✅ [IBGE] Código encontrado para ${nomeMunicipio}: ${codigo}`);
                    return codigo;
                }
            }
            console.warn(`⚠️ [IBGE] Código IBGE não encontrado para: ${nomeMunicipio}${uf ? ` (${uf})` : ''}`);
            return null;
        }
        catch (error) {
            console.error(`❌ [IBGE] Erro ao buscar código IBGE para ${nomeMunicipio}:`, error);
            return null;
        }
    }
    static buscarCodigoNoArquivo(filePath, nomeMunicipio, uf) {
        try {
            const workbook = XLSX.readFile(filePath);
            for (const sheetName of workbook.SheetNames) {
                const sheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
                if (jsonData.length === 0)
                    continue;
                const COLUNA_NOME_MUNICIPIO = 8;
                const COLUNA_CODIGO_IBGE = 7;
                for (let i = 0; i < jsonData.length; i++) {
                    const row = jsonData[i];
                    if (!row || row.length <= COLUNA_NOME_MUNICIPIO)
                        continue;
                    const nomeNaPlanilha = String(row[COLUNA_NOME_MUNICIPIO] || '').trim().toUpperCase();
                    if (nomeNaPlanilha === nomeMunicipio || nomeNaPlanilha.includes(nomeMunicipio) || nomeMunicipio.includes(nomeNaPlanilha)) {
                        const codigoIBGE = row[COLUNA_CODIGO_IBGE];
                        if (codigoIBGE) {
                            return String(codigoIBGE).trim();
                        }
                    }
                }
            }
            return null;
        }
        catch (error) {
            console.error(`❌ [IBGE] Erro ao ler arquivo ${filePath}:`, error);
            return null;
        }
    }
    static limparCache() {
        this.cache.clear();
        console.log('🧹 [IBGE] Cache limpo');
    }
    static getCacheStats() {
        return {
            tamanho: this.cache.size,
            chaves: Array.from(this.cache.keys())
        };
    }
}
exports.IBGEService = IBGEService;
IBGEService.cache = new Map();
IBGEService.IBGE_DIR = path.join(__dirname, '../../codIBGE');
//# sourceMappingURL=ibgeService.js.map