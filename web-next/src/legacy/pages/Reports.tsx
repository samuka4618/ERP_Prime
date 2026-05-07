import React, { useState, useEffect } from 'react';
import {
  DocumentTextIcon,
  CalendarIcon,
  PlayIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  XMarkIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../utils/logger';

interface Report {
  id: number;
  name: string;
  description?: string;
  type: 'sla_performance' | 'ticket_volume' | 'attendant_performance' | 'category_analysis' | 'tickets_by_attendant' | 'general_tickets' | 'compras_solicitacoes' | 'compras_orcamentos' | 'compras_aprovacoes' | 'compras_geral' | 'custom';
  parameters: string;
  created_by: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ReportExecution {
  id: number;
  report_id: number;
  executed_by: number;
  status: 'running' | 'completed' | 'failed';
  parameters: string;
  result_data?: string;
  file_path?: string;
  error_message?: string;
  started_at: string;
  completed_at?: string;
}

interface ReportSchedule {
  id: number;
  report_id: number;
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  day_of_week?: number;
  day_of_month?: number;
  time: string;
  recipients: string;
  is_active: boolean;
  last_executed?: string;
  next_execution?: string;
}

interface CustomField {
  name: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  table: string;
  column: string;
  aggregation?: 'count' | 'sum' | 'avg' | 'min' | 'max';
  groupBy?: boolean;
  orderBy?: 'asc' | 'desc';
}

interface CustomReportConfig {
  fields: CustomField[];
  filters: {
    table: string;
    column: string;
    operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'IN' | 'BETWEEN';
    value: any;
  }[];
  groupBy: string[];
  orderBy: {
    column: string;
    direction: 'ASC' | 'DESC';
  }[];
  limit?: number;
}

const Reports: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [executions, setExecutions] = useState<ReportExecution[]>([]);
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'reports' | 'executions' | 'schedules' | 'custom'>('reports');
  
  // Estados para relatórios personalizados
  const [availableFields, setAvailableFields] = useState<CustomField[]>([]);
  const [customReportConfig, setCustomReportConfig] = useState<CustomReportConfig>({
    fields: [],
    filters: [],
    groupBy: [],
    orderBy: [],
    limit: 100
  });
  const [showCustomBuilder, setShowCustomBuilder] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showExecuteModal, setShowExecuteModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [deletingReport, setDeletingReport] = useState<number | null>(null);
  const [executingReport, setExecutingReport] = useState(false);
  const [reportsError, setReportsError] = useState<string | null>(null);

  const reportTypes = {
    sla_performance: 'Performance de SLA',
    ticket_volume: 'Volume de Chamados',
    attendant_performance: 'Performance de Atendentes',
    category_analysis: 'Análise por Categoria',
    tickets_by_attendant: 'Chamados por Atendente',
    general_tickets: 'Relatório Geral de Chamados',
    compras_solicitacoes: 'Solicitações de Compra',
    compras_orcamentos: 'Orçamentos',
    compras_aprovacoes: 'Aprovações',
    compras_geral: 'Relatório Geral de Compras',
    custom: 'Personalizado'
  };

  const statusColors = {
    running: 'text-yellow-600 bg-yellow-100',
    completed: 'text-green-600 bg-green-100',
    failed: 'text-red-600 bg-red-100'
  };

  const statusIcons = {
    running: ClockIcon,
    completed: CheckCircleIcon,
    failed: XCircleIcon
  };

  useEffect(() => {
    fetchReports();
  }, []);

  useEffect(() => {
    if (reports.length > 0) {
      fetchExecutions();
      fetchSchedules();
    }
  }, [reports]);

  useEffect(() => {
    if (activeTab === 'custom' && availableFields.length === 0) {
      fetchAvailableFields();
    }
  }, [activeTab]);

  const fetchReports = async () => {
    setReportsError(null);
    try {
      logger.info('Buscando relatórios...', {}, 'REPORTS');
      const data = await apiService.getReports();
      logger.info('Dados recebidos da API:', { data, isArray: Array.isArray(data), length: Array.isArray(data) ? data.length : 'N/A' }, 'REPORTS');
      
      // Garantir que data é um array
      const reportsArray = Array.isArray(data) ? data : [];
      logger.info('Relatórios processados:', { count: reportsArray.length, reports: reportsArray.map(r => ({ id: r.id, name: r.name, type: r.type })) }, 'REPORTS');
      
      setReports(reportsArray);
    } catch (error) {
      logger.error('Erro ao buscar relatórios:', { error: error instanceof Error ? error.message : 'Unknown error' }, 'REPORTS');
      setReports([]);
      setReportsError('Falha ao carregar relatórios. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const fetchExecutions = async () => {
    try {
      // Buscar execuções de todos os relatórios
      const allExecutions: ReportExecution[] = [];
      for (const report of reports) {
        const data = await apiService.getReportExecutions(report.id);
        if (Array.isArray(data)) {
          allExecutions.push(...data);
        }
      }
      setExecutions(allExecutions);
    } catch (error) {
      console.error('Erro ao buscar execuções:', error);
      setExecutions([]);
    }
  };

  const fetchSchedules = async () => {
    try {
      // Buscar agendamentos de todos os relatórios
      const allSchedules: ReportSchedule[] = [];
      for (const report of reports) {
        const data = await apiService.getReportSchedules(report.id);
        if (Array.isArray(data)) {
          allSchedules.push(...data);
        }
      }
      setSchedules(allSchedules);
    } catch (error) {
      console.error('Erro ao buscar agendamentos:', error);
      setSchedules([]);
    }
  };

  const executeReport = async (reportId: number, parameters: any) => {
    try {
      const result = await apiService.executeReport(reportId, parameters);
      const executionId = result?.execution_id;
      if (!executionId) {
        fetchExecutions();
        setShowExecuteModal(false);
        return;
      }
      // Poll até a execução concluir e então disparar o download no formato escolhido
      const exportFormat = parameters?.export_format || 'json';
      const maxWaitMs = 90000;
      const pollIntervalMs = 1500;
      const startedAt = Date.now();
      const pollUntilDone = async (): Promise<'completed' | 'failed'> => {
        const list = await apiService.getReportExecutions(reportId);
        const exec = Array.isArray(list) ? list.find((e: any) => e.id === executionId) : null;
        if (exec) {
          if (exec.status === 'completed') return 'completed';
          if (exec.status === 'failed') return 'failed';
        }
        if (Date.now() - startedAt >= maxWaitMs) return 'failed';
        await new Promise((r) => setTimeout(r, pollIntervalMs));
        return pollUntilDone();
      };
      const status = await pollUntilDone();
      if (status === 'completed') {
        const blob = await apiService.exportReportExecution(executionId, exportFormat);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.style.display = 'none';
        const ext = exportFormat === 'excel' ? 'xlsx' : exportFormat === 'csv' ? 'csv' : 'json';
        a.download = `relatorio_${executionId}.${ext}`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }, 100);
      } else if (status === 'failed') {
        const list = await apiService.getReportExecutions(reportId);
        const exec = Array.isArray(list) ? list.find((e: any) => e.id === executionId) : null;
        const msg = exec?.error_message || 'A execução do relatório falhou.';
        alert(msg);
      }
      fetchExecutions();
      setShowExecuteModal(false);
    } catch (error: any) {
      console.error('Erro ao executar relatório:', error);
      alert(error?.response?.data?.message || error?.message || 'Erro ao executar relatório.');
    }
  };

  const exportReport = async (executionId: number, format: string = 'json') => {
    try {
      logger.info('Iniciando exportação de relatório', { executionId, format }, 'REPORTS');
      
      // Verificar se o usuário está autenticado
      if (!user) {
        logger.error('Usuário não autenticado para download', {}, 'REPORTS');
        alert('Sessão expirada. Faça login novamente.');
        return;
      }

      // Download via apiService (cookie httpOnly / withCredentials)
      const blob = await apiService.exportReportExecution(executionId, format);
      
      // Criar URL segura para download
      const url = window.URL.createObjectURL(blob);
      
      // Criar elemento de download temporário
      const a = document.createElement('a');
      a.href = url;
      a.style.display = 'none';
      
      const fileExtension = format === 'excel' ? 'xlsx' : format;
      a.download = `relatorio_${executionId}.${fileExtension}`;
      
      // Adicionar ao DOM temporariamente
      document.body.appendChild(a);
      
      // Simular clique para iniciar download
      a.click();
      
      // Limpar recursos
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);
      
      logger.success('Relatório exportado com sucesso', { executionId, format }, 'REPORTS');
    } catch (error: any) {
      logger.error('Erro ao exportar relatório', { 
        executionId, 
        format, 
        error: error.message,
        status: error.response?.status,
        response: error.response?.data
      }, 'REPORTS');
      
      if (error.response?.status === 401) {
        alert('Sessão expirada. Faça login novamente.');
        // Redirecionar para login
        window.location.href = '/login';
      } else {
        alert('Erro de conexão ao exportar relatório');
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const formatTime = (timeString: string) => {
    return timeString.substring(0, 5);
  };

  const deleteExecution = async (executionId: number) => {
    if (!confirm('Tem certeza que deseja excluir esta execução? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      await apiService.deleteReportExecution(executionId);
      alert('Execução excluída com sucesso!');
      fetchExecutions();
    } catch (error) {
      console.error('Erro ao excluir execução:', error);
      alert('Erro ao excluir execução');
    }
  };

  const deleteReport = async (reportId: number) => {
    if (!confirm('Tem certeza que deseja excluir este relatório? Esta ação não pode ser desfeita e excluirá também todas as execuções e agendamentos relacionados.')) {
      return;
    }

    setDeletingReport(reportId);
    try {
      await apiService.deleteReport(reportId);
      alert('Relatório excluído com sucesso!');
      fetchReports();
      fetchExecutions();
      fetchSchedules();
    } catch (error) {
      console.error('Erro ao excluir relatório:', error);
      alert('Erro ao excluir relatório');
    } finally {
      setDeletingReport(null);
    }
  };

  // Funções para relatórios personalizados
  const fetchAvailableFields = async () => {
    try {
      const data = await apiService.getCustomFields();
      setAvailableFields(Array.isArray(data?.fields) ? data.fields : []);
    } catch (error) {
      console.error('Erro ao carregar campos disponíveis:', error);
      setAvailableFields([]);
    }
  };

  const createCustomReport = async (name: string, description: string) => {
    try {
      logger.info('Iniciando criação de relatório personalizado', { name, description, isAdmin }, 'REPORTS');
      
      // Verificar se o usuário é admin
      if (!isAdmin) {
        logger.warn('Tentativa de criar relatório personalizado por usuário não-admin', { isAdmin }, 'REPORTS');
        alert('Apenas administradores podem criar relatórios personalizados');
        return;
      }
      
      // Verificar se há campos configurados
      if (!customReportConfig.fields || customReportConfig.fields.length === 0) {
        logger.warn('Tentativa de criar relatório personalizado sem campos', { fieldsCount: customReportConfig.fields?.length || 0 }, 'REPORTS');
        alert('Adicione pelo menos um campo ao relatório personalizado');
        return;
      }
      
      const reportData = {
        name,
        description,
        customFields: customReportConfig
      };
      
      logger.info('Dados do relatório personalizado preparados', { 
        reportData, 
        customReportConfig,
        fieldsCount: customReportConfig.fields.length 
      }, 'REPORTS');
      
      const result = await apiService.createCustomReport(reportData);
      logger.success('Relatório personalizado criado com sucesso', { result }, 'REPORTS');
      
      alert('Relatório personalizado criado com sucesso!');
      setShowCustomBuilder(false);
      setCustomReportConfig({
        fields: [],
        filters: [],
        groupBy: [],
        orderBy: [],
        limit: 100
      });
      
      // Recarregar a lista de relatórios
      logger.info('Recarregando lista de relatórios após criação', {}, 'REPORTS');
      await fetchReports();
    } catch (error: any) {
      logger.error('Erro ao criar relatório personalizado', { 
        error: error.message, 
        response: error.response?.data,
        status: error.response?.status 
      }, 'REPORTS');
      alert(`Erro ao criar relatório personalizado: ${error.response?.data?.message || error.message}`);
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-2 border-gray-300 dark:border-gray-600 border-t-blue-600" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Carregando relatórios...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {reportsError && (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 flex flex-wrap items-center justify-between gap-3">
          <span>{reportsError}</span>
          <button
            type="button"
            onClick={() => fetchReports()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <ArrowPathIcon className="w-4 h-4" />
            Tentar novamente
          </button>
        </div>
      )}
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Relatórios</h1>
            <p className="text-gray-600 dark:text-gray-400 dark:text-gray-400">Gerencie relatórios de chamados, compras e métricas do sistema</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary flex items-center space-x-2"
            >
              <DocumentTextIcon className="h-5 w-5" />
              <span>Novo Relatório</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8 px-6">
            {[
              { id: 'reports', name: 'Relatórios', count: reports.length },
              { id: 'executions', name: 'Execuções', count: executions.length },
              { id: 'schedules', name: 'Agendamentos', count: schedules.length },
              { id: 'custom', name: 'Personalizados', count: 0 }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300 dark:text-gray-300 hover:border-gray-300'
                }`}
              >
                {tab.name}
                <span className="ml-2 bg-gray-100 dark:bg-gray-700 dark:bg-gray-700 text-gray-900 dark:text-white py-0.5 px-2.5 rounded-full text-xs">
                  {tab.count}
                </span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Tab: Relatórios */}
          {activeTab === 'reports' && (
            <div className="space-y-4">
              {reports.length === 0 ? (
                <div className="text-center py-12">
                  <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Nenhum relatório</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Comece criando um novo relatório.</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {Array.isArray(reports) && reports.map((report) => (
                    <div key={report.id} className="bg-gray-50 dark:bg-gray-700 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-medium text-gray-900 dark:text-white">{report.name}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-400 mt-1">{report.description}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                            {reportTypes[report.type]}
                          </p>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => {
                              setSelectedReport(report);
                              setShowExecuteModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-800"
                            title="Executar"
                          >
                            <PlayIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedReport(report);
                              setShowScheduleModal(true);
                            }}
                            className="text-green-600 hover:text-green-800"
                            title="Agendar"
                          >
                            <CalendarIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => deleteReport(report.id)}
                            disabled={deletingReport === report.id}
                            className="text-red-600 hover:text-red-800 disabled:opacity-50"
                            title="Excluir"
                          >
                            {deletingReport === report.id ? (
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-600"></div>
                            ) : (
                              <TrashIcon className="h-5 w-5" />
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>Criado em {formatDate(report.created_at)}</span>
                        <span className={`px-2 py-1 rounded-full ${
                          report.is_active ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300'
                        }`}>
                          {report.is_active ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab: Execuções */}
          {activeTab === 'executions' && (
            <div className="space-y-4">
              {executions.length === 0 ? (
                <div className="text-center py-12">
                  <ClockIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Nenhuma execução</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Execute um relatório para ver as execuções.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Relatório
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Iniciado
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Concluído
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200">
                      {Array.isArray(executions) && executions.map((execution) => {
                        const StatusIcon = statusIcons[execution.status];
                        return (
                          <tr key={execution.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                              {reports.find(r => r.id === execution.report_id)?.name || 'Relatório não encontrado'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[execution.status]}`}>
                                <StatusIcon className="h-4 w-4 mr-1" />
                                {execution.status === 'running' ? 'Executando' : 
                                 execution.status === 'completed' ? 'Concluído' : 'Falhou'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                              {formatDate(execution.started_at)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                              {execution.completed_at ? formatDate(execution.completed_at) : '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              {execution.status === 'completed' && (
                                <div className="flex space-x-2">
                                  <button
                                    onClick={() => exportReport(execution.id, 'json')}
                                    className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                                  >
                                    JSON
                                  </button>
                                  <button
                                    onClick={() => exportReport(execution.id, 'excel')}
                                    className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                                  >
                                    📊 Excel
                                  </button>
                                  <button
                                    onClick={() => deleteExecution(execution.id)}
                                    className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                                    title="Excluir execução"
                                  >
                                    🗑️
                                  </button>
                                </div>
                              )}
                              {execution.status === 'failed' && execution.error_message && (
                                <div className="text-red-600 text-xs max-w-xs">
                                  <div className="font-medium">Erro:</div>
                                  <div className="truncate" title={execution.error_message}>
                                    {execution.error_message}
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab: Agendamentos */}
          {activeTab === 'schedules' && (
            <div className="space-y-4">
              {schedules.length === 0 ? (
                <div className="text-center py-12">
                  <CalendarIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Nenhum agendamento</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Agende um relatório para execução automática.</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {Array.isArray(schedules) && schedules.map((schedule) => (
                    <div key={schedule.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-medium text-gray-900 dark:text-white">{schedule.name}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-400 mt-1">
                            {schedule.frequency === 'daily' ? 'Diário' :
                             schedule.frequency === 'weekly' ? 'Semanal' : 'Mensal'}
                            {schedule.frequency === 'weekly' && schedule.day_of_week !== undefined && 
                              ` - ${['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][schedule.day_of_week]}`}
                            {schedule.frequency === 'monthly' && schedule.day_of_month !== undefined && 
                              ` - Dia ${schedule.day_of_month}`}
                            {` às ${formatTime(schedule.time)}`}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                            Próxima execução: {schedule.next_execution ? formatDate(schedule.next_execution) : 'Não agendado'}
                          </p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          schedule.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {schedule.is_active ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab: Relatórios Personalizados */}
          {activeTab === 'custom' && (
            <div className="space-y-6 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">Construtor de Relatórios Personalizados</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-400">Crie relatórios customizados escolhendo os campos desejados</p>
                </div>
                <button
                  onClick={() => setShowCustomBuilder(true)}
                  className="btn btn-primary flex items-center space-x-2"
                >
                  <DocumentTextIcon className="h-5 w-5" />
                  <span>Novo Relatório Personalizado</span>
                </button>
              </div>

              {/* Lista de relatórios personalizados */}
              <div className="space-y-4">
                {reports.filter(r => r.type === 'custom').length === 0 ? (
                  <div className="text-center py-12">
                    <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Nenhum relatório personalizado</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Crie seu primeiro relatório personalizado.</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {Array.isArray(reports) && reports.filter(r => r.type === 'custom').map((report) => (
                      <div key={report.id} className="bg-white dark:bg-gray-800 border rounded-lg p-4 shadow-sm">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="text-lg font-medium text-gray-900 dark:text-white">{report.name}</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-400 mt-1">{report.description}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                              Criado em {formatDate(report.created_at)}
                            </p>
                          </div>
                          <span className="px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-800">
                            Personalizado
                          </span>
                        </div>
                        <div className="mt-4 flex space-x-2">
                          <button
                            onClick={() => {
                              setSelectedReport(report);
                              setShowExecuteModal(true);
                            }}
                            className="flex-1 bg-blue-100 text-blue-700 px-3 py-2 rounded text-sm hover:bg-blue-200"
                          >
                            Executar
                          </button>
                          <button
                            onClick={() => {
                              alert('Execute o relatório primeiro para poder exportá-lo');
                            }}
                            className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-3 py-2 rounded text-sm cursor-not-allowed"
                            disabled
                          >
                            Exportar
                          </button>
                          <button
                            onClick={() => deleteReport(report.id)}
                            disabled={deletingReport === report.id}
                            className="bg-red-100 text-red-700 px-3 py-2 rounded text-sm hover:bg-red-200 disabled:opacity-50"
                            title="Excluir"
                          >
                            {deletingReport === report.id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                            ) : (
                              <TrashIcon className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modais */}
      {showCreateModal && (
        <CreateReportModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchReports();
          }}
        />
      )}

      {showExecuteModal && selectedReport && (
        <ExecuteReportModal
          report={selectedReport}
          isExecuting={executingReport}
          onClose={() => {
            if (!executingReport) {
              setShowExecuteModal(false);
              setSelectedReport(null);
            }
          }}
          onExecute={async (parameters) => {
            setExecutingReport(true);
            try {
              await executeReport(selectedReport.id, parameters);
            } finally {
              setExecutingReport(false);
            }
          }}
        />
      )}

      {showScheduleModal && selectedReport && (
        <ScheduleReportModal
          report={selectedReport}
          onClose={() => {
            setShowScheduleModal(false);
            setSelectedReport(null);
          }}
          onSchedule={() => {
            setShowScheduleModal(false);
            setSelectedReport(null);
            fetchSchedules();
          }}
        />
      )}

      {/* Modal de Construtor de Relatórios Personalizados */}
      {showCustomBuilder && (
        <CustomReportBuilderModal
          availableFields={availableFields}
          config={customReportConfig}
          onConfigChange={setCustomReportConfig}
          onClose={() => setShowCustomBuilder(false)}
          onCreate={createCustomReport}
        />
      )}
    </div>
  );
};

// Componente para criar relatório
const CreateReportModal: React.FC<{
  onClose: () => void;
  onSuccess: () => void;
}> = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'sla_performance' as const,
    parameters: {
      start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      end_date: new Date().toISOString().split('T')[0],
      include_charts: true,
      export_format: 'json' as const
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiService.createReport(formData);
      onSuccess();
    } catch (error) {
      console.error('Erro ao criar relatório:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 dark:bg-black dark:bg-opacity-60 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border border-gray-200 dark:border-gray-700 w-96 shadow-lg rounded-md bg-white dark:bg-gray-800">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Criar Relatório</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300">Nome</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300">Descrição</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                rows={3}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300">Tipo</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <optgroup label="Chamados">
                  <option value="sla_performance">Performance de SLA</option>
                  <option value="ticket_volume">Volume de Chamados</option>
                  <option value="attendant_performance">Performance de Atendentes</option>
                  <option value="category_analysis">Análise por Categoria</option>
                  <option value="tickets_by_attendant">Chamados por Atendente</option>
                  <option value="general_tickets">Relatório Geral de Chamados</option>
                </optgroup>
                <optgroup label="Compras">
                  <option value="compras_solicitacoes">Solicitações de Compra</option>
                  <option value="compras_orcamentos">Orçamentos</option>
                  <option value="compras_aprovacoes">Aprovações</option>
                  <option value="compras_geral">Relatório Geral de Compras</option>
                </optgroup>
                <optgroup label="Outros">
                  <option value="custom">Personalizado</option>
                </optgroup>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300">Data Início</label>
                <input
                  type="date"
                  value={formData.parameters.start_date}
                  onChange={(e) => setFormData({
                    ...formData,
                    parameters: { ...formData.parameters, start_date: e.target.value }
                  })}
                  className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300">Data Fim</label>
                <input
                  type="date"
                  value={formData.parameters.end_date}
                  onChange={(e) => setFormData({
                    ...formData,
                    parameters: { ...formData.parameters, end_date: e.target.value }
                  })}
                  className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-outline"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-primary"
              >
                Criar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Componente para executar relatório
const ExecuteReportModal: React.FC<{
  report: Report;
  isExecuting?: boolean;
  onClose: () => void;
  onExecute: (parameters: any) => void | Promise<void>;
}> = ({ report, isExecuting = false, onClose, onExecute }) => {
  const [parameters, setParameters] = useState({
    start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    include_charts: true,
    export_format: 'excel' as const
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onExecute(parameters);
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 dark:bg-black dark:bg-opacity-60 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border border-gray-200 dark:border-gray-700 w-96 shadow-lg rounded-md bg-white dark:bg-gray-800">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Executar Relatório</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{report.name}</p>
          {isExecuting ? (
            <div className="py-8 text-center">
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4" />
              <p className="text-sm text-gray-600 dark:text-gray-400">Executando relatório... O download começará quando estiver pronto.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Data Início</label>
                  <input
                    type="date"
                    value={parameters.start_date}
                    onChange={(e) => setParameters({ ...parameters, start_date: e.target.value })}
                    className="input mt-1 block w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Data Fim</label>
                  <input
                    type="date"
                    value={parameters.end_date}
                    onChange={(e) => setParameters({ ...parameters, end_date: e.target.value })}
                    className="input mt-1 block w-full"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Formato de Exportação</label>
                <select
                  value={parameters.export_format}
                  onChange={(e) => setParameters({ ...parameters, export_format: e.target.value as any })}
                  className="input mt-1 block w-full"
                >
                  <option value="json">JSON</option>
                  <option value="excel">Excel</option>
                </select>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn btn-outline"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  Executar
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

// Componente para agendar relatório
const ScheduleReportModal: React.FC<{
  report: Report;
  onClose: () => void;
  onSchedule: () => void;
}> = ({ report, onClose, onSchedule }) => {
  const [scheduleData, setScheduleData] = useState({
    name: `${report.name} - Agendado`,
    frequency: 'weekly' as 'daily' | 'weekly' | 'monthly',
    day_of_week: 1,
    day_of_month: 1,
    time: '09:00',
    recipients: ['']
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiService.createSchedule({
        ...scheduleData,
        report_id: report.id,
        recipients: scheduleData.recipients.filter(email => email.trim() !== '')
      });
      onSchedule();
    } catch (error) {
      console.error('Erro ao agendar relatório:', error);
    }
  };

  const addRecipient = () => {
    setScheduleData({
      ...scheduleData,
      recipients: [...scheduleData.recipients, '']
    });
  };

  const updateRecipient = (index: number, value: string) => {
    const newRecipients = [...scheduleData.recipients];
    newRecipients[index] = value;
    setScheduleData({ ...scheduleData, recipients: newRecipients });
  };

  const removeRecipient = (index: number) => {
    const newRecipients = scheduleData.recipients.filter((_, i) => i !== index);
    setScheduleData({ ...scheduleData, recipients: newRecipients });
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 dark:bg-black dark:bg-opacity-60 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border border-gray-200 dark:border-gray-700 w-96 shadow-lg rounded-md bg-white dark:bg-gray-800">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Agendar Relatório</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{report.name}</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nome do Agendamento</label>
              <input
                type="text"
                value={scheduleData.name}
                onChange={(e) => setScheduleData({ ...scheduleData, name: e.target.value })}
                className="input mt-1 block w-full"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Frequência</label>
              <select
                value={scheduleData.frequency}
                onChange={(e) => setScheduleData({ ...scheduleData, frequency: e.target.value as any })}
                className="input mt-1 block w-full"
              >
                <option value="daily">Diário</option>
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensal</option>
              </select>
            </div>
            {scheduleData.frequency === 'weekly' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Dia da Semana</label>
                <select
                  value={scheduleData.day_of_week}
                  onChange={(e) => setScheduleData({ ...scheduleData, day_of_week: parseInt(e.target.value) })}
                  className="input mt-1 block w-full"
                >
                  <option value={0}>Domingo</option>
                  <option value={1}>Segunda-feira</option>
                  <option value={2}>Terça-feira</option>
                  <option value={3}>Quarta-feira</option>
                  <option value={4}>Quinta-feira</option>
                  <option value={5}>Sexta-feira</option>
                  <option value={6}>Sábado</option>
                </select>
              </div>
            )}
            {scheduleData.frequency === 'monthly' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Dia do Mês</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={scheduleData.day_of_month}
                  onChange={(e) => setScheduleData({ ...scheduleData, day_of_month: parseInt(e.target.value) })}
                  className="input mt-1 block w-full"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Horário</label>
              <input
                type="time"
                value={scheduleData.time}
                onChange={(e) => setScheduleData({ ...scheduleData, time: e.target.value })}
                className="input mt-1 block w-full"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Destinatários</label>
              {scheduleData.recipients.map((email, index) => (
                <div key={index} className="flex space-x-2 mt-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => updateRecipient(index, e.target.value)}
                    className="input flex-1"
                    placeholder="email@exemplo.com"
                  />
                  <button
                    type="button"
                    onClick={() => removeRecipient(index)}
                    className="px-3 py-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addRecipient}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                + Adicionar destinatário
              </button>
            </div>
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-outline"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-primary"
              >
                Agendar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Componente para construtor de relatórios personalizados
const CustomReportBuilderModal: React.FC<{
  availableFields: CustomField[];
  config: CustomReportConfig;
  onConfigChange: (config: CustomReportConfig) => void;
  onClose: () => void;
  onCreate: (name: string, description: string) => void;
}> = ({ availableFields, config, onConfigChange, onClose, onCreate }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['tickets', 'solicitacoes_compra']));

  // Agrupar campos por tabela/módulo
  const groupedFields = availableFields.reduce((acc, field) => {
    const category = field.table;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(field);
    return acc;
  }, {} as Record<string, CustomField[]>);

  // Mapear tabelas para nomes amigáveis
  const categoryNames: Record<string, string> = {
    'tickets': 'Chamados',
    'ticket_categories': 'Categorias',
    'ticket_messages': 'Mensagens',
    'ticket_history': 'Histórico',
    'attachments': 'Anexos',
    'users': 'Usuários',
    'notifications': 'Notificações',
    'solicitacoes_compra': 'Solicitações de Compra',
    'solicitacoes_compra_itens': 'Itens de Solicitação',
    'orcamentos': 'Orçamentos',
    'orcamentos_itens': 'Itens de Orçamento',
    'aprovacoes_solicitacao': 'Aprovações de Solicitação',
    'aprovacoes_orcamento': 'Aprovações de Orçamento',
    'solicitacoes_compra_historico': 'Histórico de Compras',
    'compras_anexos': 'Anexos de Compras',
    'compradores': 'Compradores',
    'aprovadores': 'Aprovadores',
    'reports': 'Relatórios',
    'report_executions': 'Execuções',
    'system_config': 'Configurações'
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const filteredFields = availableFields.filter(field => {
    const matchesSearch = field.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         field.table.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         field.column.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || field.table === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const addField = (field: CustomField) => {
    // Verificar se o campo já foi adicionado
    if (config.fields.some(f => f.name === field.name)) {
      return;
    }
    onConfigChange({
      ...config,
      fields: [...config.fields, field]
    });
  };

  const removeField = (index: number) => {
    onConfigChange({
      ...config,
      fields: config.fields.filter((_, i) => i !== index)
    });
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    const newFields = [...config.fields];
    if (direction === 'up' && index > 0) {
      [newFields[index - 1], newFields[index]] = [newFields[index], newFields[index - 1]];
    } else if (direction === 'down' && index < newFields.length - 1) {
      [newFields[index], newFields[index + 1]] = [newFields[index + 1], newFields[index]];
    }
    onConfigChange({
      ...config,
      fields: newFields
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && config.fields.length > 0) {
      onCreate(name, description);
    }
  };

  const isFieldSelected = (field: CustomField) => {
    return config.fields.some(f => f.name === field.name);
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 dark:bg-black dark:bg-opacity-60 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Construtor de Relatórios Personalizados</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Selecione os campos que deseja incluir no relatório</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          {/* Informações básicas */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nome do Relatório <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Ex: Chamados por Status e Categoria"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Descrição
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Descrição opcional do relatório"
                />
              </div>
            </div>
          </div>

          {/* Conteúdo principal - duas colunas */}
          <div className="flex-1 flex overflow-hidden">
            {/* Coluna esquerda - Campos disponíveis */}
            <div className="w-1/2 border-r border-gray-200 dark:border-gray-700 flex flex-col">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  Campos Disponíveis ({filteredFields.length})
                </h4>
                
                {/* Busca */}
                <div className="relative mb-3">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar campos..."
                    className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                {/* Filtro por categoria */}
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="all">Todas as Categorias</option>
                  {Object.keys(groupedFields).map(category => (
                    <option key={category} value={category}>
                      {categoryNames[category] || category}
                    </option>
                  ))}
                </select>
              </div>

              {/* Lista de campos agrupados */}
              <div className="flex-1 overflow-y-auto p-4">
                {selectedCategory === 'all' ? (
                  // Mostrar agrupado por categoria
                  Object.entries(groupedFields).map(([category, fields]) => {
                    const categoryFields = fields.filter(f => 
                      f.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      f.table.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      f.column.toLowerCase().includes(searchTerm.toLowerCase())
                    );
                    
                    if (categoryFields.length === 0) return null;
                    
                    const isExpanded = expandedCategories.has(category);
                    
                    return (
                      <div key={category} className="mb-4">
                        <button
                          type="button"
                          onClick={() => toggleCategory(category)}
                          className="w-full flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md mb-2"
                        >
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">
                            {categoryNames[category] || category} ({categoryFields.length})
                          </span>
                          {isExpanded ? (
                            <ChevronUpIcon className="h-4 w-4 text-gray-500" />
                          ) : (
                            <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                          )}
                        </button>
                        
                        {isExpanded && (
                          <div className="space-y-1 ml-2">
                            {categoryFields.map((field, index) => {
                              const selected = isFieldSelected(field);
                              return (
                                <button
                                  key={index}
                                  type="button"
                                  onClick={() => !selected && addField(field)}
                                  disabled={selected}
                                  className={`w-full text-left p-2 text-sm rounded-md border transition-all ${
                                    selected
                                      ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 cursor-not-allowed opacity-60'
                                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-700 cursor-pointer'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                      <div className="font-medium text-gray-900 dark:text-white">{field.label}</div>
                                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                        {field.table}.{field.column}
                                      </div>
                                      {field.aggregation && (
                                        <span className="inline-block mt-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                                          {field.aggregation.toUpperCase()}
                                        </span>
                                      )}
                                    </div>
                                    {selected && (
                                      <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400 ml-2" />
                                    )}
                                    {!selected && (
                                      <PlusIcon className="h-4 w-4 text-gray-400 ml-2" />
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  // Mostrar apenas campos filtrados
                  <div className="space-y-2">
                    {filteredFields.map((field, index) => {
                      const selected = isFieldSelected(field);
                      return (
                        <button
                          key={index}
                          type="button"
                          onClick={() => !selected && addField(field)}
                          disabled={selected}
                          className={`w-full text-left p-3 text-sm rounded-md border transition-all ${
                            selected
                              ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 cursor-not-allowed opacity-60'
                              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-700 cursor-pointer'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="font-medium text-gray-900 dark:text-white">{field.label}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                {field.table}.{field.column}
                              </div>
                              {field.aggregation && (
                                <span className="inline-block mt-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                                  {field.aggregation.toUpperCase()}
                                </span>
                              )}
                            </div>
                            {selected && (
                              <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400 ml-2" />
                            )}
                            {!selected && (
                              <PlusIcon className="h-4 w-4 text-gray-400 ml-2" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Coluna direita - Campos selecionados */}
            <div className="w-1/2 flex flex-col">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Campos Selecionados ({config.fields.length})
                </h4>
                {config.fields.length === 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Nenhum campo selecionado. Clique nos campos à esquerda para adicionar.
                  </p>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {config.fields.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <DocumentTextIcon className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-3" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Nenhum campo selecionado
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      Selecione campos da lista à esquerda
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {config.fields.map((field, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md"
                      >
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded">
                              {index + 1}
                            </span>
                            <span className="font-medium text-gray-900 dark:text-white">{field.label}</span>
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-8">
                            {field.table}.{field.column}
                          </div>
                          {field.aggregation && (
                            <span className="inline-block mt-1 ml-8 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                              {field.aggregation.toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-1 ml-2">
                          <button
                            type="button"
                            onClick={() => moveField(index, 'up')}
                            disabled={index === 0}
                            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Mover para cima"
                          >
                            <ChevronUpIcon className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveField(index, 'down')}
                            disabled={index === config.fields.length - 1}
                            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Mover para baixo"
                          >
                            <ChevronDownIcon className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeField(index)}
                            className="p-1 text-red-400 hover:text-red-600 dark:hover:text-red-300"
                            title="Remover"
                          >
                            <XMarkIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer com botões */}
          <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {config.fields.length > 0 ? (
                <span className="text-green-600 dark:text-green-400 font-medium">
                  {config.fields.length} campo{config.fields.length !== 1 ? 's' : ''} selecionado{config.fields.length !== 1 ? 's' : ''}
                </span>
              ) : (
                <span>Selecione pelo menos um campo para continuar</span>
              )}
            </div>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-outline"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!name.trim() || config.fields.length === 0}
                className="btn btn-primary flex items-center space-x-2"
              >
                <DocumentTextIcon className="h-4 w-4" />
                <span>Criar Relatório</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Reports;
