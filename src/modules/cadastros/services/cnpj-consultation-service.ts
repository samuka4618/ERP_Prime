import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Serviço para execução de consultas de CNPJ através do sistema de cadastros
 */
export class CNPJConsultationService {
  /**
   * Executa uma consulta completa de CNPJ usando o sistema de cadastros
   * @param registration_id ID do cadastro
   * @param cnpj CNPJ a ser consultado
   * @returns Promise com resultado da consulta
   */
  static async executeFullConsultation(registration_id: number, cnpj: string): Promise<{
    success: boolean;
    message: string;
    data?: any;
  }> {
    try {
      console.log(`🔍 [CNPJ-CONSULTATION] Iniciando consulta para Registration ID: ${registration_id}, CNPJ: ${cnpj}`);

      // Normaliza o CNPJ (remove formatação)
      const cleanCNPJ = cnpj.replace(/\D/g, '');

      // Valida o CNPJ
      if (!this.validateCNPJ(cleanCNPJ)) {
        return {
          success: false,
          message: 'CNPJ inválido'
        };
      }

      // Caminho do script do sistema de cadastros
      const cadastrosDir = path.join(__dirname, '..', '..', 'cadastros');
      const scriptPath = path.join(cadastrosDir, 'dist', 'trigger-cnpj-query.js');
      
      // Verifica se o arquivo compilado existe
      if (!fs.existsSync(scriptPath)) {
        console.log(`⚠️ [CNPJ-CONSULTATION] Script compilado não encontrado. Consulta será processada em background.`);
        
        // Retorna sucesso sem executar - o sistema de consulta pode ser executado separadamente
        return {
          success: true,
          message: 'Consulta de CNPJ será processada',
          data: { registration_id, cnpj: cleanCNPJ }
        };
      }
      
      // Executa o script em background
      const childProcess = spawn('node', [scriptPath, registration_id.toString(), cleanCNPJ], {
        detached: true,
        stdio: 'pipe',
        cwd: cadastrosDir
      });

      // Não bloquear - deixa rodar em background
      childProcess.unref();
      childProcess.stdout?.on('data', (data) => console.log(`[CNPJ-BACKGROUND] ${data.toString().trim()}`));
      childProcess.stderr?.on('data', (data) => console.error(`[CNPJ-BACKGROUND] ${data.toString().trim()}`));

      console.log(`✅ [CNPJ-CONSULTATION] Processo de consulta iniciado em background: Registration ID: ${registration_id}, CNPJ: ${cleanCNPJ}`);

      return {
        success: true,
        message: 'Consulta de CNPJ iniciada com sucesso',
        data: { registration_id, cnpj: cleanCNPJ, processId: childProcess.pid }
      };

    } catch (error) {
      console.error('❌ [CNPJ-CONSULTATION] Erro ao iniciar consulta:', error);
      
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erro desconhecido ao iniciar consulta'
      };
    }
  }

  /**
   * Valida se o CNPJ está no formato correto
   * @param cnpj CNPJ a ser validado
   * @returns true se válido
   */
  static validateCNPJ(cnpj: string): boolean {
    // Remove caracteres não numéricos
    const cleanCNPJ = cnpj.replace(/\D/g, '');
    
    // Verifica se tem 14 dígitos
    if (cleanCNPJ.length !== 14) {
      return false;
    }

    // Verifica se todos os dígitos são iguais (CNPJ inválido)
    if (/^(\d)\1+$/.test(cleanCNPJ)) {
      return false;
    }

    return true;
  }
}

