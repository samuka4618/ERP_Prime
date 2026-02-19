import * as XLSX from 'xlsx';
import * as path from 'path';

export interface CNPJData {
  cnpj: string;
  razaoSocial?: string;
  observacoes?: string;
}

export class ExcelUtils {
  /**
   * Lê um arquivo Excel e extrai os CNPJs
   * @param filePath Caminho para o arquivo Excel
   * @param sheetName Nome da planilha (opcional, usa a primeira se não especificado)
   * @param cnpjColumn Coluna que contém os CNPJs (padrão: 'A' ou primeira coluna)
   * @returns Array de CNPJs encontrados
   */
  static readCNPJsFromExcel(
    filePath: string, 
    sheetName?: string, 
    cnpjColumn?: string
  ): CNPJData[] {
    try {
      console.log(`Lendo arquivo Excel: ${filePath}`);
      
      // Verifica se o arquivo existe
      if (!require('fs').existsSync(filePath)) {
        throw new Error(`Arquivo não encontrado: ${filePath}`);
      }

      // Lê o arquivo Excel
      const workbook = XLSX.readFile(filePath);
      
      // Usa a planilha especificada ou a primeira disponível
      const sheet = sheetName ? workbook.Sheets[sheetName] : workbook.Sheets[workbook.SheetNames[0]];
      
      if (!sheet) {
        throw new Error(`Planilha não encontrada: ${sheetName || 'primeira planilha'}`);
      }

      // Converte para JSON
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      
      if (jsonData.length === 0) {
        throw new Error('Planilha está vazia');
      }

      // Pega a primeira linha como cabeçalho
      const headers = jsonData[0] as string[];
      console.log('Cabeçalhos encontrados:', headers);

      // Encontra a coluna do CNPJ
      let cnpjColumnIndex = 0;
      if (cnpjColumn) {
        // Se especificou uma coluna (ex: 'A', 'B', etc.)
        cnpjColumnIndex = this.columnLetterToIndex(cnpjColumn);
      } else {
        // Procura por colunas que possam conter CNPJ
        const cnpjKeywords = ['cnpj', 'CNPJ', 'documento', 'Documento', 'cpf_cnpj', 'CPF_CNPJ'];
        for (let i = 0; i < headers.length; i++) {
          if (cnpjKeywords.some(keyword => headers[i]?.toLowerCase().includes(keyword.toLowerCase()))) {
            cnpjColumnIndex = i;
            break;
          }
        }
      }

      console.log(`Usando coluna ${this.indexToColumnLetter(cnpjColumnIndex)} para CNPJs`);

      // Encontra colunas adicionais (razão social, observações)
      let razaoSocialIndex = -1;
      let observacoesIndex = -1;

      const razaoSocialKeywords = ['razao', 'razão', 'social', 'nome', 'empresa', 'fantasia'];
      const observacoesKeywords = ['obs', 'observacao', 'observação', 'nota', 'comentario', 'comentário'];

      for (let i = 0; i < headers.length; i++) {
        const header = headers[i]?.toLowerCase() || '';
        if (razaoSocialKeywords.some(keyword => header.includes(keyword))) {
          razaoSocialIndex = i;
        }
        if (observacoesKeywords.some(keyword => header.includes(keyword))) {
          observacoesIndex = i;
        }
      }

      // Extrai os CNPJs
      const cnpjs: CNPJData[] = [];
      
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i] as any[];
        const cnpjValue = row[cnpjColumnIndex];
        
        if (cnpjValue && typeof cnpjValue === 'string') {
          // Remove formatação do CNPJ (pontos, traços, barras, espaços)
          const cleanCNPJ = cnpjValue.replace(/[^\d]/g, '');
          
          // Valida se tem 14 dígitos (CNPJ válido)
          if (cleanCNPJ.length === 14) {
            const cnpjData: CNPJData = {
              cnpj: cleanCNPJ
            };

            // Adiciona razão social se disponível
            if (razaoSocialIndex >= 0 && row[razaoSocialIndex]) {
              cnpjData.razaoSocial = String(row[razaoSocialIndex]).trim();
            }

            // Adiciona observações se disponível
            if (observacoesIndex >= 0 && row[observacoesIndex]) {
              cnpjData.observacoes = String(row[observacoesIndex]).trim();
            }

            cnpjs.push(cnpjData);
          } else {
            console.warn(`CNPJ inválido na linha ${i + 1}: ${cnpjValue} (${cleanCNPJ.length} dígitos)`);
          }
        }
      }

      console.log(`Encontrados ${cnpjs.length} CNPJs válidos`);
      return cnpjs;

    } catch (error) {
      console.error('Erro ao ler arquivo Excel:', error);
      throw error;
    }
  }

  /**
   * Converte letra da coluna (A, B, C...) para índice (0, 1, 2...)
   */
  private static columnLetterToIndex(column: string): number {
    let result = 0;
    for (let i = 0; i < column.length; i++) {
      result = result * 26 + (column.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
    }
    return result - 1;
  }

  /**
   * Converte índice (0, 1, 2...) para letra da coluna (A, B, C...)
   */
  private static indexToColumnLetter(index: number): string {
    let result = '';
    while (index >= 0) {
      result = String.fromCharCode((index % 26) + 'A'.charCodeAt(0)) + result;
      index = Math.floor(index / 26) - 1;
    }
    return result;
  }

  /**
   * Cria um arquivo Excel de exemplo com CNPJs
   * @param filePath Caminho onde salvar o arquivo de exemplo
   */
  static createExampleExcel(filePath: string): void {
    const exampleData = [
      ['CNPJ', 'Razão Social', 'Observações'],
      ['11.222.333/0001-81', 'Empresa Exemplo 1 Ltda', 'Cliente VIP'],
      ['22.333.444/0001-92', 'Empresa Exemplo 2 S.A.', ''],
      ['33.444.555/0001-03', 'Empresa Exemplo 3 Eireli', 'Pendente documentação']
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(exampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'CNPJs');

    XLSX.writeFile(workbook, filePath);
    console.log(`Arquivo de exemplo criado: ${filePath}`);
  }

  /**
   * Lista as planilhas disponíveis em um arquivo Excel
   * @param filePath Caminho para o arquivo Excel
   * @returns Array com nomes das planilhas
   */
  static getSheetNames(filePath: string): string[] {
    try {
      const workbook = XLSX.readFile(filePath);
      return workbook.SheetNames;
    } catch (error) {
      console.error('Erro ao listar planilhas:', error);
      throw error;
    }
  }
}
