import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Serviço para buscar códigos IBGE de municípios
 */
export class IBGEService {
  private static cache: Map<string, string> = new Map();
  private static readonly IBGE_DIR = path.join(__dirname, '../../codIBGE');
  
  /**
   * Busca o código IBGE completo do município
   * @param nomeMunicipio Nome do município (coluna I)
   * @param uf UF do município (opcional, para filtragem)
   * @returns Código IBGE completo (coluna H) ou null se não encontrado
   */
  static buscarCodigoIBGE(nomeMunicipio: string, uf?: string): string | null {
    if (!nomeMunicipio || !nomeMunicipio.trim()) {
      return null;
    }

    // Normaliza o nome do município para comparação
    const nomeNormalizado = nomeMunicipio.trim().toUpperCase();
    
    // Verifica cache primeiro
    const cacheKey = `${nomeNormalizado}_${uf?.toUpperCase() || ''}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) || null;
    }

    try {
      // Busca arquivos na pasta codIBGE
      if (!fs.existsSync(this.IBGE_DIR)) {
        console.warn(`⚠️ [IBGE] Pasta codIBGE não encontrada: ${this.IBGE_DIR}`);
        return null;
      }

      const files = fs.readdirSync(this.IBGE_DIR);
      const excelFiles = files.filter(file => 
        /\.(xlsx|xls)$/i.test(file)
      );

      if (excelFiles.length === 0) {
        console.warn(`⚠️ [IBGE] Nenhum arquivo Excel encontrado em: ${this.IBGE_DIR}`);
        return null;
      }

      // Tenta encontrar o código em todos os arquivos Excel
      for (const excelFile of excelFiles) {
        const filePath = path.join(this.IBGE_DIR, excelFile);
        const codigo = this.buscarCodigoNoArquivo(filePath, nomeNormalizado, uf);
        
        if (codigo) {
          // Salva no cache
          this.cache.set(cacheKey, codigo);
          console.log(`✅ [IBGE] Código encontrado para ${nomeMunicipio}: ${codigo}`);
          return codigo;
        }
      }

      console.warn(`⚠️ [IBGE] Código IBGE não encontrado para: ${nomeMunicipio}${uf ? ` (${uf})` : ''}`);
      return null;

    } catch (error) {
      console.error(`❌ [IBGE] Erro ao buscar código IBGE para ${nomeMunicipio}:`, error);
      return null;
    }
  }

  /**
   * Busca o código IBGE em um arquivo Excel específico
   * @param filePath Caminho do arquivo Excel
   * @param nomeMunicipio Nome normalizado do município
   * @param uf UF (opcional)
   * @returns Código IBGE ou null
   */
  private static buscarCodigoNoArquivo(filePath: string, nomeMunicipio: string, uf?: string): string | null {
    try {
      const workbook = XLSX.readFile(filePath);
      
      // Procura em todas as planilhas
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];

        if (jsonData.length === 0) continue;

        // Coluna I = índice 8 (0-based)
        const COLUNA_NOME_MUNICIPIO = 8;
        // Coluna H = índice 7 (0-based)
        const COLUNA_CODIGO_IBGE = 7;

        // Procura o município na coluna I
        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length <= COLUNA_NOME_MUNICIPIO) continue;

          const nomeNaPlanilha = String(row[COLUNA_NOME_MUNICIPIO] || '').trim().toUpperCase();
          
          // Compara o nome (exato ou parcial)
          if (nomeNaPlanilha === nomeMunicipio || nomeNaPlanilha.includes(nomeMunicipio) || nomeMunicipio.includes(nomeNaPlanilha)) {
            // Se especificou UF, pode adicionar validação aqui se necessário
            // Por enquanto, pega o primeiro que encontrar
            
            const codigoIBGE = row[COLUNA_CODIGO_IBGE];
            if (codigoIBGE) {
              // Retorna como string, removendo espaços
              return String(codigoIBGE).trim();
            }
          }
        }
      }

      return null;
    } catch (error) {
      console.error(`❌ [IBGE] Erro ao ler arquivo ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Limpa o cache de códigos IBGE
   */
  static limparCache(): void {
    this.cache.clear();
    console.log('🧹 [IBGE] Cache limpo');
  }

  /**
   * Retorna estatísticas do cache
   */
  static getCacheStats(): { tamanho: number; chaves: string[] } {
    return {
      tamanho: this.cache.size,
      chaves: Array.from(this.cache.keys())
    };
  }
}

