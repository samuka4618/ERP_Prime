import axios, { AxiosResponse } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../utils/logger';

export interface TessConfig {
  apiKey: string;
  baseUrl: string;
  agentId: string;
  model: string;
  temperature: number;
  outputPath?: string;
}

export interface TessFileUploadResponse {
  id: number;
  object: string;
  bytes: number;
  created_at: string;
  filename: string;
  credits: number;
  status: string;
  metadata?: any;
}

export interface TessExecutionResponse {
  template_id: string;
  responses: Array<{
    id: number;
    status: string;
    input: string;
    output: string;
    credits: number;
    root_id: number;
    created_at: string;
    updated_at: string;
    template_id: number;
    answers?: any; // Campo adicional que pode conter a resposta do agente
  }>;
}

export interface TessProcessResult {
  success: boolean;
  filePath: string;
  fileName: string;
  fileId?: string;
  response?: string;
  error?: string;
  credits?: number;
  timestamp: Date;
}

export class TessService {
  private config: TessConfig;
  private axiosInstance: any;
  private outputDir: string;

  constructor(config: TessConfig) {
    this.config = config;
    this.axiosInstance = axios.create({
      baseURL: config.baseUrl,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 120000 // 120 segundos de timeout
    });
    // Define diretório de saída (resolvido dentro do projeto)
    const resolved = config.outputPath ? config.outputPath : './tess_responses';
    this.outputDir = path.resolve(__dirname, '..', '..', resolved);
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Faz upload de um arquivo PDF para a TESS
   */
  async uploadFile(filePath: string, retries: number = 3): Promise<string> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`Fazendo upload do arquivo: ${filePath} (tentativa ${attempt}/${retries})`);
        
        // Verifica se o arquivo existe
        if (!fs.existsSync(filePath)) {
          throw new Error(`Arquivo não encontrado: ${filePath}`);
        }

        // Cria FormData para upload
        const FormData = require('form-data');
        const formData = new FormData();
        formData.append('file', fs.createReadStream(filePath));

        // Faz o upload usando axios com FormData
        const response: AxiosResponse<TessFileUploadResponse> = await axios.post(
          `${this.config.baseUrl}/api/files`,
          formData,
          {
            headers: {
              'Authorization': `Bearer ${this.config.apiKey}`,
              ...formData.getHeaders()
            },
            timeout: 120000
          }
        );

        if (response.data && response.data.id) {
          console.log(`Upload realizado com sucesso. File ID: ${response.data.id}`);
          return response.data.id.toString();
        } else {
          console.error('Resposta inválida do servidor TESS:', response.data);
          throw new Error(`Resposta inválida do servidor TESS. Status: ${response.status}, Dados: ${JSON.stringify(response.data)}`);
        }

      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'] || 10;
          console.log(`Rate limit atingido no upload. Aguardando ${retryAfter} segundos antes de tentar novamente...`);
          await new Promise(resolve => setTimeout(resolve, parseInt(retryAfter) * 1000));
          continue;
        }
        
        console.error(`Erro ao fazer upload do arquivo (tentativa ${attempt}):`, error);
        
        if (attempt === retries) {
          if (axios.isAxiosError(error)) {
            console.error('Detalhes do erro Axios:');
            console.error('Status:', error.response?.status);
            console.error('Status Text:', error.response?.statusText);
            console.error('Headers:', error.response?.headers);
            console.error('Data:', error.response?.data);
            console.error('Message:', error.message);
            throw new Error(`Falha no upload: ${error.response?.status} - ${error.response?.statusText} - ${JSON.stringify(error.response?.data)}`);
          } else {
            throw new Error(`Falha no upload: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
          }
        }
        
        // Aguarda antes da próxima tentativa
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    throw new Error('Todas as tentativas de upload falharam');
  }


  /**
   * Processa um arquivo usando um agente da TESS (tenta diferentes formatos)
   */
  async processFile(fileId: string, prompt?: string, rootId?: number): Promise<TessExecutionResponse> {
    try {
      console.log(`Processando arquivo com ID: ${fileId}`);

      // Usar somente o formato principal com até 4 tentativas
      const maxAttempts = 4;
      let lastError: any = null;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        console.log(`\n🔄 Tentativa ${attempt}/${maxAttempts}: file_ids`);

        const requestData: any = {
          file_ids: [fileId],
          model: this.config.model,
          temperature: this.config.temperature.toString(),
          tools: 'no-tools',
          wait_execution: true,
          messages: [
            {
              role: 'user',
              content: prompt || 'Processe o documento anexado.'
            }
          ]
        };

        if (rootId) {
          requestData.root_id = rootId;
        }

        console.log('Dados da requisição:', JSON.stringify(requestData, null, 2));

        try {
          const response: AxiosResponse<TessExecutionResponse> = await this.axiosInstance.post(
            `/api/agents/${this.config.agentId}/execute?wait_execution=true`,
            requestData
          );

          console.log('Resposta do agente TESS:');
          console.log('Status:', response.status);
          console.log('Data:', JSON.stringify(response.data, null, 2));

          if (response.data && response.data.responses && response.data.responses.length > 0) {
            return response.data;
          } else {
            throw new Error('Resposta inválida do processamento TESS');
          }
        } catch (error) {
          lastError = error;
          console.log(`❌ Falha na tentativa ${attempt}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
          if (attempt < maxAttempts) {
            // breve backoff
            await new Promise(r => setTimeout(r, 1000 * attempt));
            continue;
          }
        }
      }

      throw new Error(`Todas as tentativas com file_ids falharam: ${lastError instanceof Error ? lastError.message : 'Erro desconhecido'}`);
    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      throw new Error(`Falha no processamento: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  /**
   * Dispara o processamento do arquivo pela TESS
   */
  async processFileUpload(fileId: string, retries: number = 3): Promise<void> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`Disparando processamento do arquivo ${fileId} (tentativa ${attempt}/${retries})`);
        
        const response = await this.axiosInstance.post(`/api/files/${fileId}/process`);
        
        if (response.status === 200 || response.status === 202) {
          console.log('✅ Processamento do arquivo disparado com sucesso');
          return;
        } else {
          throw new Error(`Status inesperado: ${response.status}`);
        }

      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'] || 10;
          console.log(`Rate limit atingido. Aguardando ${retryAfter} segundos...`);
          await new Promise(resolve => setTimeout(resolve, parseInt(retryAfter) * 1000));
          continue;
        }
        
        console.error(`Erro ao disparar processamento (tentativa ${attempt}):`, error);
        
        if (attempt === retries) {
          throw new Error(`Falha ao disparar processamento: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  /**
   * Aguarda o processamento do arquivo pela TESS
   */
  async waitForFileProcessing(fileId: string, maxWaitTime: number = 120000): Promise<void> {
    const startTime = Date.now();
    const pollInterval = 2000; // 2 segundos

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const response = await this.axiosInstance.get(`/api/files/${fileId}`);
        const fileData = response.data;

        console.log(`Status do arquivo ${fileId}: ${fileData.status}`);

        if (fileData.status === 'processed' || fileData.status === 'completed') {
          console.log('✅ Arquivo processado com sucesso!');
          return;
        } else if (fileData.status === 'failed') {
          throw new Error('Falha no processamento do arquivo');
        }

        // Aguarda antes da próxima verificação
        await new Promise(resolve => setTimeout(resolve, pollInterval));

      } catch (error) {
        console.log(`Erro ao verificar status do arquivo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }

    throw new Error('Timeout aguardando processamento do arquivo');
  }

  /**
   * Busca a resposta completa do agente usando o endpoint específico
   */
  async getAgentResponse(responseId: number): Promise<TessExecutionResponse> {
    try {
      console.log(`Buscando resposta completa do agente: ${responseId}`);
      
      const response = await this.axiosInstance.get(`/api/agent-responses/${responseId}`);
      
      console.log('Resposta completa do agente:');
      console.log('Status:', response.status);
      console.log('Data:', JSON.stringify(response.data, null, 2));
      
      // Verifica se a resposta tem o formato esperado
      if (!response.data) {
        throw new Error('Resposta vazia do agente');
      }
      
      // Converte a resposta individual para o formato esperado
      const fullResponse: TessExecutionResponse = {
        template_id: response.data.template_id?.toString() || '',
        responses: [{
          id: response.data.id || responseId,
          status: response.data.status || 'unknown',
          input: response.data.input || '',
          output: response.data.output || '',
          credits: response.data.credits || 0,
          root_id: response.data.root_id || 0,
          created_at: response.data.created_at || new Date().toISOString(),
          updated_at: response.data.updated_at || new Date().toISOString(),
          template_id: response.data.template_id || 0,
          answers: response.data.answers || null
        }]
      };
      
      // Log detalhado para debug
      const firstResponse = fullResponse.responses[0];
      console.log('Resposta processada:');
      console.log(`- ID: ${firstResponse.id}`);
      console.log(`- Status: ${firstResponse.status}`);
      console.log(`- Input: ${firstResponse.input ? firstResponse.input.substring(0, 100) + '...' : 'vazio'}`);
      console.log(`- Output: ${firstResponse.output ? firstResponse.output.substring(0, 200) + '...' : 'vazio'}`);
      console.log(`- Créditos: ${firstResponse.credits}`);
      console.log(`- Answers: ${firstResponse.answers ? JSON.stringify(firstResponse.answers).substring(0, 100) + '...' : 'null'}`);
      
      return fullResponse;
    } catch (error) {
      console.error('Erro ao buscar resposta completa:', error);
      
      // Se falhar, retorna uma resposta vazia mas válida
      console.log('Retornando resposta vazia devido ao erro');
      const emptyResponse: TessExecutionResponse = {
        template_id: '',
        responses: [{
          id: responseId,
          status: 'error',
          input: '',
          output: '',
          credits: 0,
          root_id: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          template_id: 0,
          answers: null
        }]
      };
      
      return emptyResponse;
    }
  }

  /**
   * Processa um PDF completo (upload + processamento)
   */
  async processPDF(filePath: string, prompt?: string): Promise<TessProcessResult> {
    const result: TessProcessResult = {
      success: false,
      filePath,
      fileName: path.basename(filePath),
      timestamp: new Date()
    };

    try {
      console.log(`Iniciando processamento do PDF: ${filePath}`);

      const fileId = await this.uploadFile(filePath);
      result.fileId = fileId;

      console.log('Disparando processamento do arquivo...');
      await this.processFileUpload(fileId);

      console.log('Aguardando processamento do arquivo...');
      await this.waitForFileProcessing(fileId);

      const executionResponse = await this.processFile(fileId, prompt);

      if (executionResponse.responses && executionResponse.responses.length > 0) {
        const firstResponse = executionResponse.responses[0];

        if (firstResponse.status === 'succeeded') {
          // Log detalhado da resposta para debug
          console.log('Resposta completa do agente:', JSON.stringify(firstResponse, null, 2));
          
          // Tenta capturar a resposta de diferentes campos possíveis
          let responseContent = '';
          
          console.log('Analisando resposta do agente...');
          console.log(`- Status: ${firstResponse.status}`);
          console.log(`- Output: ${firstResponse.output ? `"${firstResponse.output.substring(0, 100)}..."` : 'vazio'}`);
          console.log(`- Answers: ${firstResponse.answers ? 'presente' : 'ausente'}`);
          
          if (firstResponse.output && firstResponse.output.trim()) {
            responseContent = firstResponse.output;
            console.log('✅ Resposta encontrada no campo output');
          } else if (firstResponse.answers && typeof firstResponse.answers === 'object') {
            // Verifica se há conteúdo nos answers
            const answersStr = JSON.stringify(firstResponse.answers, null, 2);
            console.log(`Answers encontrado: ${answersStr.substring(0, 200)}...`);
            
            if (answersStr.length > 50) { // Se não for só os parâmetros básicos
              responseContent = `Resposta do agente (formato answers):\n${answersStr}`;
              console.log('✅ Resposta encontrada no campo answers');
            } else {
              console.log('⚠️ Answers muito pequeno, ignorando');
            }
          } else {
            console.log('⚠️ Nenhum campo de resposta encontrado');
          }
          
          // Se ainda não encontrou conteúdo, pode ser que o agente não conseguiu processar o PDF
          if (!responseContent) {
            console.log('❌ Nenhuma resposta válida encontrada');
            responseContent = `⚠️ ATENÇÃO: O agente processou a requisição com sucesso, mas não retornou conteúdo processado do PDF.\n\nIsso pode indicar que:\n1. O agente não conseguiu acessar o arquivo PDF\n2. O arquivo PDF não contém texto processável\n3. O agente precisa de configuração adicional\n4. O agente processou mas não gerou output\n\nDetalhes da resposta:\n- Status: ${firstResponse.status}\n- ID: ${firstResponse.id}\n- Créditos: ${firstResponse.credits}\n- Input: ${firstResponse.input || 'não fornecido'}\n- Output: ${firstResponse.output || 'vazio'}\n- Answers: ${firstResponse.answers ? JSON.stringify(firstResponse.answers) : 'null'}\n\nResposta completa para análise:\n${JSON.stringify(firstResponse, null, 2)}`;
          } else {
            console.log(`✅ Resposta capturada com sucesso (${responseContent.length} caracteres)`);
          }
          
          // Valida se o agente está pedindo reenvio de PDF (não consideramos sucesso)
          const needsPdfRegex = /(enviar\s+o\s+arquivo\s+pdf|enviar\s+o\s+pdf|enviar\s+arquivo|send\s+the\s+pdf|attach\s+the\s+pdf|upload\s+the\s+pdf)/i;
          const onlyAskingForPdf = responseContent && needsPdfRegex.test(responseContent);

          if (onlyAskingForPdf) {
            console.log('⚠️  Agente solicitou reenvio do PDF. Considerando como falha para reprocessar.');
            result.success = false;
            result.response = responseContent;
            result.credits = firstResponse.credits;
            result.error = 'TESS solicitou reenvio do PDF';
            return result;
          }

          result.response = responseContent;
          result.credits = firstResponse.credits;

          // Se não houver conteúdo, considere falha para bloquear envio ao Atak
          if (!result.response || !result.response.trim()) {
            result.success = false;
            result.error = 'TESS retornou sucesso sem conteúdo (output vazio)';
            console.error(`Falha: ${result.error}`);
            return result;
          }

          result.success = true;
          // Salvar resposta individual automaticamente
          try {
            const outName = result.fileName.replace(/\.pdf$/i, '_tess_response.txt');
            const outPath = path.join(this.outputDir, outName);
            const content = `=== Resposta TESS para ${result.fileName} ===\nData: ${result.timestamp.toISOString()}\nFile ID: ${result.fileId}\nCréditos utilizados: ${result.credits}\n\n=== Conteúdo Processado ===\n${result.response}\n\n=== Fim da Resposta ===\n`;
            fs.writeFileSync(outPath, content, 'utf8');
            console.log(`Resposta TESS salva: ${outPath}`);
          } catch (writeErr) {
            console.log('Falha ao salvar resposta TESS em arquivo:', writeErr);
          }
          
          console.log(`PDF processado com sucesso: ${result.fileName}`);
          console.log(`Resposta capturada: ${result.response.substring(0, 200)}...`);
        } else {
          result.error = `Status de processamento: ${firstResponse.status}`;
          console.error(`Falha no processamento: ${result.error}`);
        }
      } else {
        result.error = 'Nenhuma resposta recebida do processamento';
        console.error(result.error);
      }

    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error(`Erro ao processar PDF ${result.fileName}:`, error);
    }

    return result;
  }

  /**
   * Processa todos os PDFs da pasta downloads
   */
  async processAllPDFs(downloadsPath: string, prompt?: string): Promise<TessProcessResult[]> {
    try {
      console.log(`Processando todos os PDFs da pasta: ${downloadsPath}`);

      // Verifica se a pasta existe
      if (!fs.existsSync(downloadsPath)) {
        throw new Error(`Pasta não encontrada: ${downloadsPath}`);
      }

      // Lista todos os arquivos PDF
      const files = fs.readdirSync(downloadsPath)
        .filter(file => file.toLowerCase().endsWith('.pdf'))
        .map(file => path.join(downloadsPath, file));

      if (files.length === 0) {
        console.log('Nenhum arquivo PDF encontrado na pasta');
        return [];
      }

      console.log(`Encontrados ${files.length} arquivos PDF para processar`);

      // Processa cada arquivo
      const results: TessProcessResult[] = [];
      for (const filePath of files) {
        try {
          const result = await this.processPDF(filePath, prompt);
          results.push(result);
          
          // Aguarda 1.5 segundos entre processamentos para respeitar rate limiting (1 req/seg)
          await new Promise(resolve => setTimeout(resolve, 1500));
        } catch (error) {
          console.error(`Erro ao processar ${filePath}:`, error);
          results.push({
            success: false,
            filePath,
            fileName: path.basename(filePath),
            error: error instanceof Error ? error.message : 'Erro desconhecido',
            timestamp: new Date()
          });
        }
      }

      // Log do resumo
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      const totalCredits = results.reduce((sum, r) => sum + (r.credits || 0), 0);

      console.log(`\n=== Resumo do Processamento TESS ===`);
      console.log(`Total de arquivos: ${results.length}`);
      console.log(`Sucessos: ${successful}`);
      console.log(`Falhas: ${failed}`);
      console.log(`Total de créditos utilizados: ${totalCredits.toFixed(6)}`);

      Logger.success(`Processamento TESS concluído`, { 
        total: results.length, 
        successful, 
        failed, 
        totalCredits 
      });

      return results;

    } catch (error) {
      console.error('Erro ao processar PDFs:', error);
      Logger.error('Erro no processamento em lote TESS', { error: error instanceof Error ? error.message : 'Erro desconhecido' });
      throw error;
    }
  }

  /**
   * Salva as respostas da TESS em arquivos de texto
   */
  async saveResponses(results: TessProcessResult[], outputPath: string): Promise<void> {
    try {
      console.log(`Salvando respostas em: ${outputPath}`);

      // Cria o diretório de saída se não existir
      if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath, { recursive: true });
      }

      // Salva cada resposta
      for (const result of results) {
        if (result.success && result.response) {
          const outputFileName = result.fileName.replace('.pdf', '_tess_response.txt');
          const outputFilePath = path.join(outputPath, outputFileName);
          
          const content = `=== Resposta TESS para ${result.fileName} ===
Data: ${result.timestamp.toISOString()}
File ID: ${result.fileId}
Créditos utilizados: ${result.credits}

=== Conteúdo Processado ===
${result.response}

=== Fim da Resposta ===
`;

          fs.writeFileSync(outputFilePath, content, 'utf8');
          console.log(`Resposta salva: ${outputFilePath}`);
        }
      }

      // Salva um resumo geral
      const summaryFileName = `tess_summary_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
      const summaryFilePath = path.join(outputPath, summaryFileName);
      
      const summary = `=== Resumo do Processamento TESS ===
Data: ${new Date().toISOString()}
Total de arquivos: ${results.length}
Sucessos: ${results.filter(r => r.success).length}
Falhas: ${results.filter(r => !r.success).length}
Total de créditos: ${results.reduce((sum, r) => sum + (r.credits || 0), 0).toFixed(6)}

=== Detalhes por Arquivo ===
${results.map(r => 
  `${r.fileName}: ${r.success ? 'SUCESSO' : 'FALHA'} ${r.credits ? `(${r.credits} créditos)` : ''} ${r.error ? `- ${r.error}` : ''}`
).join('\n')}
`;

      fs.writeFileSync(summaryFilePath, summary, 'utf8');
      console.log(`Resumo salvo: ${summaryFilePath}`);

    } catch (error) {
      console.error('Erro ao salvar respostas:', error);
      throw error;
    }
  }
}
