import React, { useState, useEffect } from 'react';
import {
  DocumentTextIcon,
  CalendarIcon,
  PlayIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  XMarkIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../utils/logger';

interface Report {
  id: number;
  name: string;
  description?: string;
  type: 'sla_performance' | 'ticket_volume' | 'attendant_performance' | 'category_analysis' | 'tickets_by_attendant' | 'general_tickets' | 'custom';
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

  const reportTypes = {
    sla_performance: 'Performance de SLA',
    ticket_volume: 'Volume de Chamados',
    attendant_performance: 'Performance de Atendentes',
    category_analysis: 'Análise por Categoria',
    tickets_by_attendant: 'Chamados por Atendente',
    general_tickets: 'Relatório Geral de Chamados',
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
      setReports([]); // Em caso de erro, definir como array vazio
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
      await apiService.executeReport(reportId, parameters);
      fetchExecutions();
      setShowExecuteModal(false);
    } catch (error) {
      console.error('Erro ao executar relatório:', error);
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
      
      // Obter token de autenticação
      const token = localStorage.getItem('token');
      if (!token) {
        logger.error('Token de autenticação não encontrado para download', {}, 'REPORTS');
        alert('Sessão expirada. Faça login novamente.');
        return;
      }
      
      logger.debug('Dados de autenticação para download', { 
        userId: user.id, 
        hasToken: !!token,
        tokenPrefix: token.substring(0, 20) + '...'
      }, 'REPORTS');
      
      // Usar o método original com blob para manter autenticação
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Relatórios</h1>
            <p className="text-gray-600 dark:text-gray-400 dark:text-gray-400">Gerencie relatórios de chamados e métricas de SLA</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
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
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
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
          onClose={() => {
            setShowExecuteModal(false);
            setSelectedReport(null);
          }}
          onExecute={(parameters) => {
            executeReport(selectedReport.id, parameters);
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
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white dark:bg-gray-800">
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
                <option value="sla_performance">Performance de SLA</option>
                <option value="ticket_volume">Volume de Chamados</option>
                <option value="attendant_performance">Performance de Atendentes</option>
                <option value="category_analysis">Análise por Categoria</option>
                <option value="tickets_by_attendant">Chamados por Atendente</option>
                <option value="general_tickets">Relatório Geral de Chamados</option>
                <option value="custom">Personalizado</option>
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
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
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
  onClose: () => void;
  onExecute: (parameters: any) => void;
}> = ({ report, onClose, onExecute }) => {
  const [parameters, setParameters] = useState({
    start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    include_charts: true,
    export_format: 'json' as const
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onExecute(parameters);
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white dark:bg-gray-800">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Executar Relatório</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-400 mb-4">{report.name}</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300">Data Início</label>
                <input
                  type="date"
                  value={parameters.start_date}
                  onChange={(e) => setParameters({ ...parameters, start_date: e.target.value })}
                  className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300">Data Fim</label>
                <input
                  type="date"
                  value={parameters.end_date}
                  onChange={(e) => setParameters({ ...parameters, end_date: e.target.value })}
                  className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300">Formato de Exportação</label>
              <select
                value={parameters.export_format}
                onChange={(e) => setParameters({ ...parameters, export_format: e.target.value as any })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="json">JSON</option>
                <option value="csv">CSV</option>
              </select>
            </div>
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                Executar
              </button>
            </div>
          </form>
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
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white dark:bg-gray-800">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Agendar Relatório</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-400 mb-4">{report.name}</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300">Nome do Agendamento</label>
              <input
                type="text"
                value={scheduleData.name}
                onChange={(e) => setScheduleData({ ...scheduleData, name: e.target.value })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300">Frequência</label>
              <select
                value={scheduleData.frequency}
                onChange={(e) => setScheduleData({ ...scheduleData, frequency: e.target.value as any })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="daily">Diário</option>
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensal</option>
              </select>
            </div>
            {scheduleData.frequency === 'weekly' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300">Dia da Semana</label>
                <select
                  value={scheduleData.day_of_week}
                  onChange={(e) => setScheduleData({ ...scheduleData, day_of_week: parseInt(e.target.value) })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300">Dia do Mês</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={scheduleData.day_of_month}
                  onChange={(e) => setScheduleData({ ...scheduleData, day_of_month: parseInt(e.target.value) })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300">Horário</label>
              <input
                type="time"
                value={scheduleData.time}
                onChange={(e) => setScheduleData({ ...scheduleData, time: e.target.value })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300">Destinatários</label>
              {scheduleData.recipients.map((email, index) => (
                <div key={index} className="flex space-x-2 mt-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => updateRecipient(index, e.target.value)}
                    className="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="email@exemplo.com"
                  />
                  <button
                    type="button"
                    onClick={() => removeRecipient(index)}
                    className="px-3 py-2 text-red-600 hover:text-red-800"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addRecipient}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800"
              >
                + Adicionar destinatário
              </button>
            </div>
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
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

  const addField = (field: CustomField) => {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && config.fields.length > 0) {
      onCreate(name, description);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white dark:bg-gray-800">
        <div className="mt-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Construtor de Relatórios Personalizados</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:text-gray-400"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Informações básicas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300 mb-1">
                  Nome do Relatório
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Chamados por Status e Categoria"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300 mb-1">
                  Descrição
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Descrição opcional do relatório"
                />
              </div>
            </div>

            {/* Campos disponíveis */}
            <div>
              <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">Campos Disponíveis</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-40 overflow-y-auto border rounded-md p-3">
                {Array.isArray(availableFields) && availableFields.map((field, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => addField(field)}
                    className="text-left p-2 text-sm bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded border"
                  >
                    <div className="font-medium">{field.label}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{field.table}.{field.column}</div>
                    {field.aggregation && (
                      <div className="text-xs text-blue-600">{field.aggregation.toUpperCase()}</div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Campos selecionados */}
            <div>
              <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">
                Campos Selecionados ({config.fields.length})
              </h4>
              {config.fields.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">Nenhum campo selecionado</p>
              ) : (
                <div className="space-y-2">
                  {Array.isArray(config.fields) && config.fields.map((field, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-blue-50 rounded border">
                      <div>
                        <span className="font-medium">{field.label}</span>
                        <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">({field.table}.{field.column})</span>
                        {field.aggregation && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded ml-2">
                            {field.aggregation.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeField(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Botões */}
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!name.trim() || config.fields.length === 0}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Criar Relatório
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Reports;
