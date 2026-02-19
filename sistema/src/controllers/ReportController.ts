import { Request, Response } from 'express';
import { ReportModel } from '../models/Report';
import { UserModel } from '../models/User';
import { ReportService } from '../services/ReportService';
import { ExcelReportService } from '../services/ExcelReportService';
import { CustomReportService } from '../services/CustomReportService';
import { ReportType, ReportParameters, ReportStatus } from '../types';
import { logger } from '../utils/logger';
import path from 'path';
import fs from 'fs';

export class ReportController {
  // Métodos para Reports
  static async createReport(req: Request, res: Response) {
    try {
      logger.info('=== INÍCIO CREATE REPORT ===');
      logger.info('Request body:', JSON.stringify(req.body, null, 2));
      
      const userId = (req as any).user?.id;
      logger.info('User ID:', userId);
      
      if (!userId) {
        logger.error('User ID não encontrado na requisição');
        res.status(401).json({
          success: false,
          message: 'Usuário não autenticado'
        });
        return;
      }
      
      const reportData = req.body;
      logger.info('Report data:', JSON.stringify(reportData, null, 2));

      logger.info('Chamando ReportModel.create...');
      const report = await ReportModel.create(userId, reportData);
      logger.info('Relatório criado com sucesso:', JSON.stringify(report, null, 2));

      logger.info(`Relatório criado: ${report.name} (ID: ${report.id})`);
      res.status(201).json({
        success: true,
        message: 'Relatório criado com sucesso',
        data: report
      });
    } catch (error) {
      logger.error('=== ERRO NO CREATE REPORT ===');
      logger.error('Erro detalhado:', error);
      logger.error('Stack trace:', error instanceof Error ? error.stack : 'N/A');
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }

  static async getReports(req: Request, res: Response): Promise<void> {
    try {
      const { page = 1, limit = 10, search } = req.query;

      logger.info('Buscando relatórios', { page, limit, search }, 'REPORTS');

      const reports = await ReportModel.findAll({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        search: search as string
      });

      logger.info('Relatórios encontrados', { 
        count: reports.data.length, 
        total: reports.total,
        reports: reports.data.map(r => ({ id: r.id, name: r.name, type: r.type }))
      }, 'REPORTS');

      res.json({
        success: true,
        data: reports
      });
    } catch (error) {
      logger.error('Erro ao buscar relatórios:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }

  static async getReportById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const report = await ReportModel.findById(parseInt(id));

      if (!report) {
        res.status(404).json({
          success: false,
          message: 'Relatório não encontrado'
        });
      }

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      logger.error('Erro ao buscar relatório:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }

  static async updateReport(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const report = await ReportModel.update(parseInt(id), updateData);

      if (!report) {
        res.status(404).json({
          success: false,
          message: 'Relatório não encontrado'
        });
      }

      logger.info(`Relatório atualizado: ${report?.name} (ID: ${report?.id})`);
      res.json({
        success: true,
        message: 'Relatório atualizado com sucesso',
        data: report
      });
    } catch (error) {
      logger.error('Erro ao atualizar relatório:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }

  static async deleteReport(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      await ReportModel.delete(parseInt(id));

      logger.info(`Relatório excluído: ID ${id}`);
      res.json({
        success: true,
        message: 'Relatório excluído com sucesso'
      });
    } catch (error) {
      logger.error('Erro ao excluir relatório:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }

  // Métodos para execução de relatórios
  static async executeReport(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = (req as any).user.id;
      const parameters: ReportParameters = req.body;

      const report = await ReportModel.findById(parseInt(id));
      if (!report) {
        res.status(404).json({
          success: false,
          message: 'Relatório não encontrado'
        });
      }

      // Criar execução
      const execution = await ReportModel.createExecution({
        report_id: parseInt(id),
        executed_by: userId,
        parameters
      });

      // Executar relatório em background
      setImmediate(async () => {
        try {
          let reportData: any;
          
          if (report!.type === 'custom') {
            // Para relatórios personalizados, usar CustomReportService
            logger.info('=== DEBUG RELATÓRIO PERSONALIZADO ===');
            logger.info('Report ID:', report!.id);
            logger.info('Report Name:', report!.name);
            logger.info('Report Type:', report!.type);
            logger.info('Custom Fields (raw):', report!.custom_fields);
            logger.info('Custom Fields type:', typeof report!.custom_fields);
            logger.info('Custom Fields is null?', report!.custom_fields === null);
            logger.info('Custom Fields is undefined?', report!.custom_fields === undefined);
            
            if (!report!.custom_fields) {
              throw new Error('Relatório personalizado não possui configuração de campos (custom_fields é null/undefined)');
            }
            
            let customFields;
            try {
              customFields = JSON.parse(report!.custom_fields);
              logger.info('Custom Fields parsed successfully:', customFields);
              logger.info('Custom Fields type after parse:', typeof customFields);
              logger.info('Custom Fields keys:', Object.keys(customFields));
              logger.info('Has fields property?', 'fields' in customFields);
              logger.info('Fields value:', customFields.fields);
              logger.info('Fields is array?', Array.isArray(customFields.fields));
              logger.info('Fields length:', customFields.fields ? customFields.fields.length : 'undefined');
            } catch (parseError) {
              logger.error('Erro ao fazer parse do custom_fields:', parseError);
              throw new Error('Erro ao processar configuração do relatório personalizado: ' + (parseError instanceof Error ? parseError.message : 'Erro desconhecido'));
            }
            
            reportData = await CustomReportService.executeCustomReport(customFields);
          } else {
            // Para outros tipos de relatório, usar ReportService
            reportData = await ReportService.generateReport(report!.type, parameters);
          }
          
          // Salvar dados do relatório
          await ReportModel.updateExecution(execution.id, {
            status: ReportStatus.COMPLETED,
            result_data: JSON.stringify(reportData)
          });

          logger.info(`Relatório executado com sucesso: ${report!.name} (Execução ID: ${execution.id})`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
          logger.error(`Erro na execução do relatório ${report!.name}:`, error);
          logger.error('Detalhes do erro:', {
            message: errorMessage,
            stack: error instanceof Error ? error.stack : undefined,
            reportType: report!.type,
            parameters: parameters
          });
          
          await ReportModel.updateExecution(execution.id, {
            status: ReportStatus.FAILED,
            error_message: errorMessage
          });
        }
      });

      res.json({
        success: true,
        message: 'Relatório em execução',
        data: {
          execution_id: execution.id,
          status: 'running'
        }
      });
    } catch (error) {
      logger.error('Erro ao executar relatório:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }

  static async getExecutionStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const executions = await ReportModel.findExecutionsByReport(parseInt(id));

      res.json({
        success: true,
        data: executions
      });
    } catch (error) {
      logger.error('Erro ao buscar status de execução:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }

  static async getExecutionResult(req: Request, res: Response): Promise<void> {
    try {
      const { executionId } = req.params;
      
      // Buscar execução específica
      const executions = await ReportModel.findExecutionsByReport(0, 1000); // Buscar todas para encontrar a específica
      const execution = executions.find(e => e.id === parseInt(executionId));

      if (!execution) {
        res.status(404).json({
          success: false,
          message: 'Execução não encontrada'
        });
      }

      if (execution && execution.status !== 'completed') {
        res.status(400).json({
          success: false,
          message: 'Execução ainda não foi concluída',
          status: execution.status
        });
        return;
      }

      const resultData = execution?.result_data ? JSON.parse(execution.result_data) : null;

      res.json({
        success: true,
        data: {
          execution: {
            id: execution?.id,
            status: execution?.status,
            started_at: execution?.started_at,
            completed_at: execution?.completed_at
          },
          result: resultData
        }
      });
    } catch (error) {
      logger.error('Erro ao buscar resultado da execução:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }

  // Métodos para agendamentos
  static async createSchedule(req: Request, res: Response) {
    try {
      const scheduleData = req.body;

      const schedule = await ReportModel.createSchedule(scheduleData);

      logger.info(`Agendamento criado: ${schedule.name} (ID: ${schedule.id})`);
      res.status(201).json({
        success: true,
        message: 'Agendamento criado com sucesso',
        data: schedule
      });
    } catch (error) {
      logger.error('Erro ao criar agendamento:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }

  static async getSchedules(req: Request, res: Response): Promise<void> {
    try {
      const { reportId } = req.params;
      const schedules = await ReportModel.findSchedulesByReport(parseInt(reportId));

      res.json({
        success: true,
        data: schedules
      });
    } catch (error) {
      logger.error('Erro ao buscar agendamentos:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }

  static async deleteSchedule(req: Request, res: Response): Promise<void> {
    try {
      const { scheduleId } = req.params;

      await ReportModel.deleteSchedule(parseInt(scheduleId));

      logger.info(`Agendamento excluído: ID ${scheduleId}`);
      res.json({
        success: true,
        message: 'Agendamento excluído com sucesso'
      });
    } catch (error) {
      logger.error('Erro ao excluir agendamento:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }

  // Método para processar agendamentos (chamado por cron job)
  static async processScheduledReports() {
    try {
      const dueSchedules = await ReportModel.findDueSchedules();

      for (const schedule of dueSchedules) {
        try {
          if (!schedule.report) continue;

          const parameters = JSON.parse(schedule.report.parameters);
          const reportData = await ReportService.generateReport(schedule.report.type, parameters);

          // Aqui você pode implementar o envio por email
          // await EmailService.sendReport(schedule.recipients, reportData, schedule.name);

          // Atualizar próxima execução
          await ReportModel.updateScheduleNextExecution(schedule.id);

          logger.info(`Relatório agendado executado: ${schedule.name} (ID: ${schedule.id})`);
        } catch (error) {
          logger.error(`Erro ao executar relatório agendado ${schedule.name}:`, error);
        }
      }
    } catch (error) {
      logger.error('Erro ao processar relatórios agendados:', error);
    }
  }

  // Obter campos disponíveis para relatórios personalizados
  static async getAvailableFields(req: Request, res: Response): Promise<void> {
    try {
      const fields = CustomReportService.getAvailableFields();
      const tables = CustomReportService.getAvailableTables();
      
      res.json({
        success: true,
        data: {
          fields,
          tables
        }
      });
    } catch (error) {
      logger.error('Erro ao obter campos disponíveis:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }

  // Criar relatório personalizado
  static async createCustomReport(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const { name, description, customFields, customQuery } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Usuário não autenticado'
        });
        return;
      }

      // Validar se o usuário é admin
      const user = await UserModel.findById(userId);
      if (!user || user.role !== 'admin') {
        res.status(403).json({
          success: false,
          message: 'Apenas administradores podem criar relatórios personalizados'
        });
        return;
      }

      // Validar configuração
      const validation = CustomReportService.validateConfig(customFields);
      if (!validation.valid) {
        res.status(400).json({
          success: false,
          message: 'Configuração inválida',
          errors: validation.errors
        });
        return;
      }

      // Criar relatório personalizado
      logger.info('=== DEBUG CRIAÇÃO DE RELATÓRIO PERSONALIZADO ===');
      logger.info('Name:', name);
      logger.info('Description:', description);
      logger.info('CustomFields received:', JSON.stringify(customFields, null, 2));
      logger.info('CustomFields type:', typeof customFields);
      logger.info('CustomFields keys:', Object.keys(customFields));
      logger.info('Has fields?', 'fields' in customFields);
      logger.info('Fields value:', customFields.fields);
      logger.info('Fields is array?', Array.isArray(customFields.fields));
      logger.info('Fields length:', customFields.fields ? customFields.fields.length : 'undefined');
      
      const customFieldsString = JSON.stringify(customFields);
      logger.info('CustomFields stringified:', customFieldsString);
      
      const reportData = {
        name,
        description: description || null,
        type: 'custom' as ReportType,
        parameters: {},
        custom_fields: customFieldsString,
        custom_query: customQuery || null
      };

      logger.info('ReportData to save:', JSON.stringify(reportData, null, 2));
      
      const report = await ReportModel.create(userId, reportData);

      logger.info(`Relatório personalizado criado: ${report.id} por usuário ${userId}`);

      res.status(201).json({
        success: true,
        message: 'Relatório personalizado criado com sucesso',
        data: report
      });

    } catch (error) {
      logger.error('Erro ao criar relatório personalizado:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }

  // Executar relatório personalizado
  static async executeCustomReport(req: Request, res: Response): Promise<void> {
    try {
      const { reportId } = req.params;
      const { parameters = {} } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Usuário não autenticado'
        });
        return;
      }

      // Buscar relatório
      const report = await ReportModel.findById(parseInt(reportId));
      if (!report) {
        res.status(404).json({
          success: false,
          message: 'Relatório não encontrado'
        });
        return;
      }

      if (report.type !== 'custom') {
        res.status(400).json({
          success: false,
          message: 'Este não é um relatório personalizado'
        });
        return;
      }

      // Criar execução
      const execution = await ReportModel.createExecution({
        report_id: parseInt(reportId),
        executed_by: userId,
        parameters
      });

      try {
        // Executar relatório personalizado
        const customFields = JSON.parse(report.custom_fields || '{}');
        const results = await CustomReportService.executeCustomReport(customFields);

        // Atualizar execução com sucesso
        await ReportModel.updateExecution(execution.id, {
          status: ReportStatus.COMPLETED,
          result_data: JSON.stringify(results)
        });

        res.json({
          success: true,
          message: 'Relatório personalizado executado com sucesso',
          data: {
            execution_id: execution.id,
            results
          }
        });

      } catch (executionError) {
        // Atualizar execução com erro
        await ReportModel.updateExecution(execution.id, {
          status: ReportStatus.FAILED,
          error_message: executionError instanceof Error ? executionError.message : 'Erro desconhecido'
        });

        res.status(500).json({
          success: false,
          message: 'Erro ao executar relatório personalizado',
          error: executionError instanceof Error ? executionError.message : 'Erro desconhecido'
        });
      }

    } catch (error) {
      logger.error('Erro ao executar relatório personalizado:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }

  // Método para exportar relatório
  // Excluir execução de relatório
  static async deleteExecution(req: Request, res: Response): Promise<void> {
    try {
      const { executionId } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Usuário não autenticado'
        });
        return;
      }

      // Verificar se a execução existe
      const execution = await ReportModel.findExecutionById(parseInt(executionId));
      if (!execution) {
        res.status(404).json({
          success: false,
          message: 'Execução não encontrada'
        });
        return;
      }

      // Verificar se o usuário tem permissão (apenas admin ou criador do relatório)
      const report = await ReportModel.findById(execution.report_id);
      if (!report) {
        res.status(404).json({
          success: false,
          message: 'Relatório não encontrado'
        });
        return;
      }

      // Verificar se é admin ou criador do relatório
      const user = await UserModel.findById(userId);
      if (!user || (user.role !== 'admin' && report.created_by !== userId)) {
        res.status(403).json({
          success: false,
          message: 'Sem permissão para excluir esta execução'
        });
        return;
      }

      // Excluir a execução
      await ReportModel.deleteExecution(parseInt(executionId));

      logger.info(`Execução ${executionId} excluída pelo usuário ${userId}`);

      res.json({
        success: true,
        message: 'Execução excluída com sucesso'
      });

    } catch (error) {
      logger.error('Erro ao excluir execução:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }

  static async exportReport(req: Request, res: Response): Promise<void> {
    try {
      const { executionId } = req.params;
      const { format = 'json' } = req.query;

      // Buscar execução específica
      const execution = await ReportModel.findExecutionById(parseInt(executionId));

      if (!execution) {
        res.status(404).json({
          success: false,
          message: `Execução com ID ${executionId} não encontrada`
        });
        return;
      }

      if (execution && execution.status !== 'completed') {
        res.status(400).json({
          success: false,
          message: 'Execução ainda não foi concluída'
        });
        return;
      }

      const resultData = execution?.result_data ? JSON.parse(execution.result_data) : null;

      if (!resultData) {
        res.status(400).json({
          success: false,
          message: 'Nenhum dado encontrado para exportar'
        });
        return;
      }

      if (format === 'json') {
        // Formatar JSON de forma mais legível
        const formattedData = ReportController.formatReportForJSON(resultData, parseInt(executionId));
        
        // Headers de segurança e download
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="relatorio_${executionId}.json"`);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        
        res.json(formattedData);
      } else if (format === 'excel') {
        // Gerar relatório Excel profissional
        const excelService = new ExcelReportService();
        
        // Buscar informações do relatório para determinar o tipo
        const report = await ReportModel.findById(execution.report_id);
        if (!report) {
          res.status(404).json({
            success: false,
            message: 'Relatório não encontrado'
          });
          return;
        }

        const excelBuffer = await excelService.generateReport(report.type as any, resultData, parseInt(executionId));
        
        // Headers de segurança e download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="relatorio_${executionId}.xlsx"`);
        res.setHeader('Content-Length', excelBuffer.length.toString());
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        
        res.send(excelBuffer);
      } else {
        res.status(400).json({
          success: false,
          message: 'Formato de exportação não suportado. Use: json ou excel'
        });
      }
    } catch (error) {
      logger.error('Erro ao exportar relatório:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }

  // Método para formatar relatórios para CSV de forma organizada
  private static formatReportForCSV(data: any, executionId: number): string {
    const lines: string[] = [];
    const now = new Date().toLocaleString('pt-BR');
    const reportType = this.detectReportType(data);
    
    // Cabeçalho profissional do relatório
    lines.push('='.repeat(80));
    lines.push('SISTEMA DE CHAMADOS FINANCEIRO');
    lines.push('RELATÓRIO GERENCIAL');
    lines.push('='.repeat(80));
    lines.push('');
    
    // Informações do relatório
    lines.push('INFORMAÇÕES DO RELATÓRIO');
    lines.push('-'.repeat(40));
    lines.push(`Tipo de Relatório: ${reportType}`);
    lines.push(`Data de Geração: ${now}`);
    lines.push(`ID da Execução: ${executionId}`);
    lines.push(`Sistema: Sistema de Chamados Financeiro v1.0`);
    lines.push('');
    
    if (!data) {
      lines.push('AVISO: Nenhum dado disponível para exibição');
      return lines.join('\n');
    }
    
    // Formatar baseado no tipo de dados
    if (data.total_tickets !== undefined && data.sla_first_response_rate !== undefined) {
      // Relatório de SLA Performance
      lines.push('RESUMO EXECUTIVO - DESEMPENHO DE SLA');
      lines.push('='.repeat(50));
      lines.push('');
      
      // Métricas principais em formato de tabela
      lines.push('MÉTRICAS PRINCIPAIS');
      lines.push('-'.repeat(30));
      lines.push(`Total de Chamados Analisados;${data.total_tickets}`);
      lines.push(`Violações de Primeira Resposta;${data.sla_first_response_violations}`);
      lines.push(`Violações de Resolução;${data.sla_resolution_violations}`);
      lines.push(`Taxa de SLA (Primeira Resposta);${data.sla_first_response_rate?.toFixed(2)}%`);
      lines.push(`Taxa de SLA (Resolução);${data.sla_resolution_rate?.toFixed(2)}%`);
      lines.push(`Tempo Médio de Primeira Resposta;${data.avg_first_response_time?.toFixed(2)} horas`);
      lines.push(`Tempo Médio de Resolução;${data.avg_resolution_time?.toFixed(2)} horas`);
      lines.push('');
      
      // SLA por Categoria
      if (data.sla_by_category && data.sla_by_category.length > 0) {
        lines.push('ANÁLISE POR CATEGORIA');
        lines.push('='.repeat(30));
        lines.push('');
        lines.push('Categoria;Total Chamados;Violações SLA;Taxa SLA (%);Tempo Médio Resposta (h);Tempo Médio Resolução (h)');
        lines.push('-'.repeat(80));
        data.sla_by_category.forEach((item: any) => {
          lines.push(`${item.category_name};${item.total_tickets};${item.sla_violations};${item.sla_rate?.toFixed(2)};${item.avg_response_time?.toFixed(2)};${item.avg_resolution_time?.toFixed(2)}`);
        });
        lines.push('');
      }
      
      // SLA por Atendente
      if (data.sla_by_attendant && data.sla_by_attendant.length > 0) {
        lines.push('ANÁLISE POR ATENDENTE');
        lines.push('='.repeat(30));
        lines.push('');
        lines.push('Atendente;Total Chamados;Violações SLA;Taxa SLA (%);Tempo Médio Resposta (h);Tempo Médio Resolução (h)');
        lines.push('-'.repeat(80));
        data.sla_by_attendant.forEach((item: any) => {
          lines.push(`${item.attendant_name};${item.total_tickets};${item.sla_violations};${item.sla_rate?.toFixed(2)};${item.avg_response_time?.toFixed(2)};${item.avg_resolution_time?.toFixed(2)}`);
        });
        lines.push('');
      }
      
      // Tendência de SLA
      if (data.sla_trend && data.sla_trend.length > 0) {
        lines.push('TENDÊNCIA TEMPORAL DE SLA');
        lines.push('='.repeat(35));
        lines.push('');
        lines.push('Data;Taxa SLA (%);Total Chamados;Violações');
        lines.push('-'.repeat(50));
        data.sla_trend.forEach((item: any) => {
          lines.push(`${item.date};${item.sla_rate?.toFixed(2)};${item.total_tickets};${item.violations}`);
        });
        lines.push('');
      }
      
    } else if (data.tickets_by_status !== undefined && data.period_summary === undefined) {
      // Relatório de Volume de Tickets
      lines.push('RESUMO EXECUTIVO - VOLUME DE CHAMADOS');
      lines.push('='.repeat(45));
      lines.push('');
      
      // Métricas principais
      lines.push('MÉTRICAS PRINCIPAIS');
      lines.push('-'.repeat(25));
      lines.push(`Total de Chamados;${data.total_tickets}`);
      lines.push('');
      
      // Chamados por Status
      lines.push('DISTRIBUIÇÃO POR STATUS');
      lines.push('='.repeat(30));
      lines.push('');
      lines.push('Status;Quantidade;Percentual (%)');
      lines.push('-'.repeat(40));
      Object.entries(data.tickets_by_status).forEach(([status, count]) => {
        const percentage = data.total_tickets > 0 ? ((count as number) / data.total_tickets * 100).toFixed(2) : '0.00';
        lines.push(`${status};${count};${percentage}`);
      });
      lines.push('');
      
      // Chamados por Prioridade
      lines.push('DISTRIBUIÇÃO POR PRIORIDADE');
      lines.push('='.repeat(35));
      lines.push('');
      lines.push('Prioridade;Quantidade;Percentual (%)');
      lines.push('-'.repeat(40));
      Object.entries(data.tickets_by_priority).forEach(([priority, count]) => {
        const percentage = data.total_tickets > 0 ? ((count as number) / data.total_tickets * 100).toFixed(2) : '0.00';
        lines.push(`${priority};${count};${percentage}`);
      });
      lines.push('');
      
      // Chamados por Categoria
      if (data.tickets_by_category && data.tickets_by_category.length > 0) {
        lines.push('ANÁLISE POR CATEGORIA');
        lines.push('='.repeat(25));
        lines.push('');
        lines.push('Categoria;Total;Percentual (%)');
        lines.push('-'.repeat(40));
        data.tickets_by_category.forEach((item: any) => {
          lines.push(`${item.category_name};${item.total_tickets};${item.percentage?.toFixed(2)}`);
        });
        lines.push('');
      }
      
      // Chamados por Atendente
      if (data.tickets_by_attendant && data.tickets_by_attendant.length > 0) {
        lines.push('ANÁLISE POR ATENDENTE');
        lines.push('='.repeat(25));
        lines.push('');
        lines.push('Atendente;Total;Resolvidos;Pendentes;Taxa de Resolução (%)');
        lines.push('-'.repeat(60));
        data.tickets_by_attendant.forEach((item: any) => {
          const resolutionRate = item.total_tickets > 0 ? ((item.resolved_tickets / item.total_tickets) * 100).toFixed(2) : '0.00';
          lines.push(`${item.attendant_name};${item.total_tickets};${item.resolved_tickets};${item.pending_tickets};${resolutionRate}`);
        });
        lines.push('');
      }
      
      // Tendência de Volume
      if (data.volume_trend && data.volume_trend.length > 0) {
        lines.push('TENDÊNCIA TEMPORAL DE VOLUME');
        lines.push('='.repeat(35));
        lines.push('');
        lines.push('Data;Total;Criados;Resolvidos;Fechados');
        lines.push('-'.repeat(50));
        data.volume_trend.forEach((item: any) => {
          lines.push(`${item.date};${item.total_tickets};${item.created_tickets};${item.resolved_tickets};${item.closed_tickets}`);
        });
        lines.push('');
      }
      
      // Horários de Pico
      if (data.peak_hours && data.peak_hours.length > 0) {
        lines.push('ANÁLISE DE HORÁRIOS DE PICO');
        lines.push('='.repeat(35));
        lines.push('');
        lines.push('Horário;Quantidade de Chamados;Percentual (%)');
        lines.push('-'.repeat(50));
        data.peak_hours.forEach((item: any) => {
          const percentage = data.total_tickets > 0 ? ((item.ticket_count / data.total_tickets) * 100).toFixed(2) : '0.00';
          lines.push(`${item.hour}:00;${item.ticket_count};${percentage}`);
        });
        lines.push('');
      }
      
    } else if (data.total_attendants !== undefined && data.performance_summary !== undefined) {
      // Relatório de Performance de Atendentes
      lines.push('RESUMO EXECUTIVO - PERFORMANCE DE ATENDENTES');
      lines.push('='.repeat(50));
      lines.push('');
      
      // Métricas gerais
      lines.push('MÉTRICAS GERAIS');
      lines.push('-'.repeat(20));
      lines.push(`Total de Atendentes;${data.total_attendants}`);
      lines.push(`Média de Chamados por Atendente;${data.performance_summary?.avg_tickets_per_attendant?.toFixed(2)}`);
      lines.push(`Tempo Médio de Resolução;${data.performance_summary?.avg_resolution_time?.toFixed(2)} horas`);
      lines.push(`Taxa Média de SLA;${data.performance_summary?.avg_sla_rate?.toFixed(2)}%`);
      lines.push('');
      
      if (data.attendant_details && data.attendant_details.length > 0) {
        lines.push('DETALHAMENTO POR ATENDENTE');
        lines.push('='.repeat(35));
        lines.push('');
        lines.push('Atendente;Total Chamados;Resolvidos;Pendentes;Tempo Médio Resolução (h);Violações SLA;Taxa SLA (%)');
        lines.push('-'.repeat(90));
        data.attendant_details.forEach((attendant: any) => {
          lines.push(`${attendant.attendant_name};${attendant.total_tickets};${attendant.resolved_tickets};${attendant.pending_tickets};${attendant.avg_resolution_time?.toFixed(2)};${attendant.sla_violations};${attendant.sla_rate?.toFixed(2)}`);
        });
        lines.push('');
      }
      
    } else if (data.total_categories !== undefined) {
      // Relatório de Análise por Categoria
      lines.push('RESUMO EXECUTIVO - ANÁLISE POR CATEGORIA');
      lines.push('='.repeat(45));
      lines.push('');
      
      lines.push('MÉTRICAS GERAIS');
      lines.push('-'.repeat(20));
      lines.push(`Total de Categorias;${data.total_categories}`);
      lines.push('');
      
      if (data.category_summary && data.category_summary.length > 0) {
        lines.push('ANÁLISE DETALHADA POR CATEGORIA');
        lines.push('='.repeat(40));
        lines.push('');
        lines.push('Categoria;Total Chamados;Tempo Médio Resolução (h);Violações SLA;Taxa SLA (%)');
        lines.push('-'.repeat(80));
        data.category_summary.forEach((category: any) => {
          lines.push(`${category.category_name};${category.total_tickets};${category.avg_resolution_time?.toFixed(2)};${category.sla_violations};${category.sla_rate?.toFixed(2)}`);
        });
        lines.push('');
      }
      
    } else if (data.total_attendants !== undefined && data.attendant_summary !== undefined) {
      // Relatório de Chamados por Atendente
      lines.push('RESUMO EXECUTIVO - CHAMADOS POR ATENDENTE');
      lines.push('='.repeat(45));
      lines.push('');
      
      lines.push('MÉTRICAS GERAIS');
      lines.push('-'.repeat(20));
      lines.push(`Total de Atendentes;${data.total_attendants}`);
      lines.push(`Total de Chamados;${data.total_tickets}`);
      lines.push('');
      
      if (data.attendant_summary && data.attendant_summary.length > 0) {
        lines.push('DETALHAMENTO POR ATENDENTE');
        lines.push('='.repeat(35));
        lines.push('');
        lines.push('Atendente;Email;Total Chamados;Tempo Médio Resolução (h);Violações SLA;Taxa SLA (%);Primeiro Chamado;Último Chamado');
        lines.push('-'.repeat(120));
        data.attendant_summary.forEach((attendant: any) => {
          lines.push(`${attendant.attendant_name};${attendant.attendant_email};${attendant.total_tickets};${attendant.avg_resolution_time?.toFixed(2)};${attendant.sla_violations};${attendant.sla_rate?.toFixed(2)};${attendant.first_ticket_date};${attendant.last_ticket_date}`);
        });
        lines.push('');
        
        // Ranking de Performance
        if (data.performance_ranking && data.performance_ranking.length > 0) {
          lines.push('RANKING DE PERFORMANCE');
          lines.push('='.repeat(30));
          lines.push('');
          lines.push('Posição;Atendente;Pontuação');
          lines.push('-'.repeat(40));
          data.performance_ranking.forEach((ranking: any) => {
            lines.push(`${ranking.position};${ranking.attendant_name};${ranking.score?.toFixed(2)}`);
          });
          lines.push('');
        }
      }
      
    } else if (data.period_summary !== undefined) {
      // Relatório Geral de Chamados
      lines.push('RELATÓRIO GERAL DE CHAMADOS');
      lines.push('='.repeat(40));
      lines.push('');
      
      // Informações do período
      lines.push('INFORMAÇÕES DO PERÍODO');
      lines.push('-'.repeat(25));
      lines.push(`Período Analisado;${data.period_summary.start_date} a ${data.period_summary.end_date}`);
      lines.push(`Dias Analisados;${data.period_summary.days_analyzed}`);
      lines.push(`Total de Chamados;${data.total_tickets}`);
      lines.push('');
      
      // Análise de Tempo
      if (data.time_analysis) {
        lines.push('ANÁLISE DE TEMPO E SLA');
        lines.push('='.repeat(30));
        lines.push('');
        lines.push('Métrica;Valor');
        lines.push('-'.repeat(30));
        lines.push(`Tempo Médio de Resolução;${data.time_analysis.avg_resolution_time?.toFixed(2)} horas`);
        lines.push(`Tempo Médio de Primeira Resposta;${data.time_analysis.avg_first_response_time?.toFixed(2)} horas`);
        lines.push(`Violações de SLA;${data.time_analysis.sla_violations}`);
        lines.push(`Taxa de SLA;${data.time_analysis.sla_rate?.toFixed(2)}%`);
        lines.push('');
      }
      
      // Chamados por Status
      lines.push('DISTRIBUIÇÃO POR STATUS');
      lines.push('='.repeat(30));
      lines.push('');
      lines.push('Status;Quantidade;Percentual (%)');
      lines.push('-'.repeat(40));
      Object.entries(data.tickets_by_status).forEach(([status, count]) => {
        const percentage = data.total_tickets > 0 ? ((count as number) / data.total_tickets * 100).toFixed(2) : '0.00';
        lines.push(`${status};${count};${percentage}`);
      });
      lines.push('');
      
      // Chamados por Prioridade
      lines.push('DISTRIBUIÇÃO POR PRIORIDADE');
      lines.push('='.repeat(35));
      lines.push('');
      lines.push('Prioridade;Quantidade;Percentual (%)');
      lines.push('-'.repeat(40));
      Object.entries(data.tickets_by_priority).forEach(([priority, count]) => {
        const percentage = data.total_tickets > 0 ? ((count as number) / data.total_tickets * 100).toFixed(2) : '0.00';
        lines.push(`${priority};${count};${percentage}`);
      });
      lines.push('');
      
      // Chamados por Categoria
      if (data.tickets_by_category && data.tickets_by_category.length > 0) {
        lines.push('ANÁLISE POR CATEGORIA');
        lines.push('='.repeat(25));
        lines.push('');
        lines.push('Categoria;Total;Percentual (%);Tempo Médio Resolução (h)');
        lines.push('-'.repeat(60));
        data.tickets_by_category.forEach((category: any) => {
          lines.push(`${category.category_name};${category.total_tickets};${category.percentage?.toFixed(2)};${category.avg_resolution_time?.toFixed(2)}`);
        });
        lines.push('');
      }
      
      // Chamados por Atendente
      if (data.tickets_by_attendant && data.tickets_by_attendant.length > 0) {
        lines.push('ANÁLISE POR ATENDENTE');
        lines.push('='.repeat(25));
        lines.push('');
        lines.push('Atendente;Total;Resolvidos;Pendentes;Tempo Médio Resolução (h)');
        lines.push('-'.repeat(70));
        data.tickets_by_attendant.forEach((attendant: any) => {
          lines.push(`${attendant.attendant_name};${attendant.total_tickets};${attendant.resolved_tickets};${attendant.pending_tickets};${attendant.avg_resolution_time?.toFixed(2)}`);
        });
        lines.push('');
      }
      
      // Chamados por Usuário
      if (data.tickets_by_user && data.tickets_by_user.length > 0) {
        lines.push('ANÁLISE POR USUÁRIO');
        lines.push('='.repeat(25));
        lines.push('');
        lines.push('Usuário;Email;Total;Abertos;Resolvidos');
        lines.push('-'.repeat(60));
        data.tickets_by_user.forEach((user: any) => {
          lines.push(`${user.user_name};${user.user_email};${user.total_tickets};${user.open_tickets};${user.resolved_tickets}`);
        });
        lines.push('');
      }
      
      // Tendência Diária
      if (data.daily_trend && data.daily_trend.length > 0) {
        lines.push('TENDÊNCIA DIÁRIA');
        lines.push('='.repeat(20));
        lines.push('');
        lines.push('Data;Criados;Resolvidos;Fechados;Abertos');
        lines.push('-'.repeat(50));
        data.daily_trend.forEach((trend: any) => {
          lines.push(`${trend.date};${trend.tickets_created};${trend.tickets_resolved};${trend.tickets_closed};${trend.open_tickets}`);
        });
        lines.push('');
      }
      
      // Distribuição Horária
      if (data.hourly_distribution && data.hourly_distribution.length > 0) {
        lines.push('DISTRIBUIÇÃO HORÁRIA');
        lines.push('='.repeat(25));
        lines.push('');
        lines.push('Horário;Quantidade de Chamados;Percentual (%)');
        lines.push('-'.repeat(50));
        data.hourly_distribution.forEach((hour: any) => {
          const percentage = data.total_tickets > 0 ? ((hour.ticket_count / data.total_tickets) * 100).toFixed(2) : '0.00';
          lines.push(`${hour.hour}:00;${hour.ticket_count};${percentage}`);
        });
        lines.push('');
      }
      
      // Resumo Mensal
      if (data.monthly_summary && data.monthly_summary.length > 0) {
        lines.push('RESUMO MENSAL');
        lines.push('='.repeat(20));
        lines.push('');
        lines.push('Mês;Total Chamados;Resolvidos;Tempo Médio Resolução (h)');
        lines.push('-'.repeat(60));
        data.monthly_summary.forEach((month: any) => {
          lines.push(`${month.month};${month.total_tickets};${month.resolved_tickets};${month.avg_resolution_time?.toFixed(2)}`);
        });
        lines.push('');
      }
      
    } else {
      // Dados genéricos - converter para formato legível
      lines.push('DADOS DO RELATÓRIO');
      lines.push('='.repeat(20));
      lines.push('');
      if (Array.isArray(data)) {
        if (data.length > 0) {
          const headers = Object.keys(data[0]);
          lines.push(headers.join(';'));
          lines.push('-'.repeat(headers.join(';').length));
          data.forEach((row: any) => {
            const values = headers.map(header => {
              const value = row[header];
              return typeof value === 'string' && value.includes(';') ? `"${value}"` : value;
            });
            lines.push(values.join(';'));
          });
        } else {
          lines.push('Nenhum registro encontrado');
        }
      } else {
        lines.push('Dados não estruturados:');
        lines.push(JSON.stringify(data, null, 2));
      }
    }
    
    // Rodapé profissional
    lines.push('');
    lines.push('='.repeat(80));
    lines.push('RELATÓRIO GERADO AUTOMATICAMENTE PELO SISTEMA DE CHAMADOS FINANCEIRO');
    lines.push(`Data/Hora de Geração: ${now}`);
    lines.push('='.repeat(80));
    
    return lines.join('\n');
  }

  // Método para formatar relatórios para JSON de forma organizada
  private static formatReportForJSON(data: any, executionId: number): any {
    const now = new Date().toLocaleString('pt-BR');
    
    const formattedReport = {
      relatorio: {
        titulo: 'Relatório de Chamados - Sistema Financeiro',
        data_geracao: now,
        id_execucao: executionId,
        tipo: this.detectReportType(data),
        resumo: this.generateSummary(data),
        dados: data
      }
    };
    
    return formattedReport;
  }

  // Detectar tipo de relatório baseado nos dados
  private static detectReportType(data: any): string {
    if (data.total_tickets !== undefined && data.sla_first_response_rate !== undefined) {
      return 'Desempenho de SLA';
    } else if (data.tickets_by_status !== undefined && data.period_summary === undefined) {
      return 'Volume de Chamados';
    } else if (data.total_attendants !== undefined && data.attendant_summary !== undefined) {
      return 'Chamados por Atendente';
    } else if (data.total_attendants !== undefined && data.performance_summary !== undefined) {
      return 'Performance de Atendentes';
    } else if (data.total_categories !== undefined) {
      return 'Análise por Categoria';
    } else if (data.period_summary !== undefined) {
      return 'Relatório Geral de Chamados';
    }
    return 'Relatório Personalizado';
  }

  // Gerar resumo executivo do relatório
  private static generateSummary(data: any): any {
    if (data.total_tickets !== undefined && data.sla_first_response_rate !== undefined) {
      // Relatório de SLA
      return {
        total_chamados: data.total_tickets,
        taxa_sla_primeira_resposta: `${data.sla_first_response_rate?.toFixed(2)}%`,
        taxa_sla_resolucao: `${data.sla_resolution_rate?.toFixed(2)}%`,
        violacoes_primeira_resposta: data.sla_first_response_violations,
        violacoes_resolucao: data.sla_resolution_violations,
        tempo_medio_primeira_resposta: `${data.avg_first_response_time?.toFixed(2)} horas`,
        tempo_medio_resolucao: `${data.avg_resolution_time?.toFixed(2)} horas`
      };
    } else if (data.tickets_by_status !== undefined) {
      // Relatório de Volume
      const statusCounts = Object.values(data.tickets_by_status) as number[];
      const totalTickets = statusCounts.reduce((sum, count) => sum + count, 0);
      return {
        total_chamados: totalTickets,
        chamados_abertos: data.tickets_by_status?.open || 0,
        chamados_em_atendimento: data.tickets_by_status?.in_progress || 0,
        chamados_resolvidos: data.tickets_by_status?.resolved || 0,
        chamados_fechados: data.tickets_by_status?.closed || 0,
        chamados_pendentes: (data.tickets_by_status?.pending_user || 0) + (data.tickets_by_status?.pending_third_party || 0)
      };
    } else if (data.total_attendants !== undefined) {
      // Relatório de Performance
      return {
        total_atendentes: data.total_attendants,
        media_chamados_por_atendente: data.performance_summary?.avg_tickets_per_attendant?.toFixed(2),
        tempo_medio_resolucao: `${data.performance_summary?.avg_resolution_time?.toFixed(2)} horas`,
        taxa_media_sla: `${data.performance_summary?.avg_sla_rate?.toFixed(2)}%`
      };
    } else if (data.total_categories !== undefined) {
      // Relatório de Categorias
      return {
        total_categorias: data.total_categories,
        categorias_analisadas: data.category_summary?.length || 0
      };
    } else if (data.total_attendants !== undefined && data.attendant_summary !== undefined) {
      // Relatório de Chamados por Atendente
      return {
        total_atendentes: data.total_attendants,
        total_chamados: data.total_tickets,
        atendentes_analisados: data.attendant_summary?.length || 0,
        ranking_disponivel: data.performance_ranking?.length > 0
      };
    } else if (data.period_summary !== undefined) {
      // Relatório Geral de Chamados
      return {
        total_chamados: data.total_tickets,
        periodo_analisado: `${data.period_summary.start_date} a ${data.period_summary.end_date}`,
        dias_analisados: data.period_summary.days_analyzed,
        taxa_sla: data.time_analysis?.sla_rate ? `${data.time_analysis.sla_rate.toFixed(2)}%` : 'N/A',
        tempo_medio_resolucao: data.time_analysis?.avg_resolution_time ? `${data.time_analysis.avg_resolution_time.toFixed(2)} horas` : 'N/A'
      };
    }
    
    return {
      tipo: 'Dados personalizados',
      registros: Array.isArray(data) ? data.length : 1
    };
  }
}

