import React, { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Package, Truck, Users } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import { toast } from 'react-hot-toast';
import FormattedDate from '../../components/FormattedDate';

interface Agendamento {
  id: number;
  fornecedor_id: number;
  scheduled_date: string;
  scheduled_time: string;
  dock: string;
  status: 'pendente' | 'motorista_pronto' | 'em_andamento' | 'concluido';
  notes?: string;
  fornecedor?: {
    id: number;
    name: string;
    category: string;
  };
  motorista?: {
    id: number;
    driver_name: string;
    phone_number?: string;
    submitted_at: string;
  };
}

interface Motorista {
  id: number;
  driver_name: string;
  phone_number?: string;
  submitted_at: string;
  fornecedor?: {
    id: number;
    name: string;
    category: string;
  };
}

type ViewMode = 'dia' | 'semana';
type StatusFilter = 'all' | 'pendente' | 'motorista_pronto' | 'em_andamento' | 'concluido';

const GradeDescarregamento: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('dia');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    // Atualizar a cada 30 segundos
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [currentDate, statusFilter, viewMode]);

  // Função para formatar data no formato YYYY-MM-DD no fuso horário local
  const formatDateToYYYYMMDD = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([fetchAgendamentos(), fetchMotoristas()]);
    } catch (error) {
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const fetchAgendamentos = async () => {
    try {
      let startDate: string;
      let endDate: string;

      if (viewMode === 'dia') {
        const dateStr = formatDateToYYYYMMDD(currentDate);
        startDate = dateStr;
        endDate = dateStr;
      } else {
        // Semana: pegar segunda a domingo da semana atual
        const start = new Date(currentDate);
        const day = start.getDay();
        const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Ajustar para segunda-feira
        start.setDate(diff);
        startDate = formatDateToYYYYMMDD(start);
        
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        endDate = formatDateToYYYYMMDD(end);
      }

      const params = new URLSearchParams({
        limit: '1000',
        start_date: startDate,
        end_date: endDate,
        ...(statusFilter !== 'all' && { status: statusFilter })
      });

      const response = await fetch(`/api/descarregamento/agendamentos?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Erro ao carregar agendamentos');

      const data = await response.json();
      setAgendamentos(data.data.data || []);
    } catch (error) {
      console.error('Erro ao buscar agendamentos:', error);
    }
  };

  const fetchMotoristas = async () => {
    try {
      const response = await fetch('/api/descarregamento/form-responses/patio', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Erro ao carregar motoristas');

      const data = await response.json();
      setMotoristas(data.data.responses || []);
    } catch (error) {
      console.error('Erro ao buscar motoristas:', error);
    }
  };

  const navigateDate = (direction: 'prev' | 'next' | 'today') => {
    const newDate = new Date(currentDate);
    if (direction === 'today') {
      setCurrentDate(new Date());
    } else if (direction === 'prev') {
      if (viewMode === 'dia') {
        newDate.setDate(newDate.getDate() - 1);
      } else {
        newDate.setDate(newDate.getDate() - 7);
      }
      setCurrentDate(newDate);
    } else {
      if (viewMode === 'dia') {
        newDate.setDate(newDate.getDate() + 1);
      } else {
        newDate.setDate(newDate.getDate() + 7);
      }
      setCurrentDate(newDate);
    }
  };

  const formatDateHeader = (date: Date) => {
    const days = ['Domingo', 'Segunda-Feira', 'Terça-Feira', 'Quarta-Feira', 'Quinta-Feira', 'Sexta-Feira', 'Sábado'];
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    
    return {
      dayOfWeek: days[date.getDay()],
      day: date.getDate(),
      month: months[date.getMonth()],
      year: date.getFullYear()
    };
  };

  const getStatusConfig = (status: string) => {
    const configs = {
      pendente: { color: 'bg-orange-500', borderColor: 'border-orange-500', hexColor: '#f97316', label: 'Pendente' },
      motorista_pronto: { color: 'bg-blue-500', borderColor: 'border-blue-500', hexColor: '#3b82f6', label: 'Motorista Pronto' },
      em_andamento: { color: 'bg-red-500', borderColor: 'border-red-500', hexColor: '#ef4444', label: 'Em Andamento' },
      concluido: { color: 'bg-green-500', borderColor: 'border-green-500', hexColor: '#22c55e', label: 'Concluído' }
    };
    return configs[status as keyof typeof configs] || configs.pendente;
  };

  const getAgendamentosDoDia = (date: Date) => {
    const dateStr = formatDateToYYYYMMDD(date);
    return agendamentos.filter(a => a.scheduled_date === dateStr);
  };

  const getWeekDates = () => {
    const start = new Date(currentDate);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  const dateHeader = formatDateHeader(currentDate);
  const agendamentosHoje = getAgendamentosDoDia(currentDate);
  const weekDates = getWeekDates();

  const getWeekRangeLabel = () => {
    if (weekDates.length < 2) return '';
    const start = weekDates[0];
    const end = weekDates[6];
    const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    if (start.getMonth() === end.getMonth()) {
      return `Semana de ${start.getDate()} a ${end.getDate()} de ${months[start.getMonth()]} de ${start.getFullYear()}`;
    }
    return `${start.getDate()}/${start.getMonth() + 1} a ${end.getDate()}/${end.getMonth() + 1}/${end.getFullYear()}`;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Grade de Descarregamento</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {viewMode === 'semana' && weekDates.length ? getWeekRangeLabel() : `${dateHeader.dayOfWeek}, ${dateHeader.day} de ${dateHeader.month} de ${dateHeader.year}`}
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Navegação de Data */}
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg shadow-md px-3 py-2 border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => navigateDate('prev')}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <button
              onClick={() => navigateDate('today')}
              className="flex items-center gap-2 px-3 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              <Calendar className="w-4 h-4" />
              Hoje
            </button>
            <button
              onClick={() => navigateDate('next')}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>

          {/* Toggle Vista */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-1 flex border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setViewMode('dia')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'dia'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Dia
            </button>
            <button
              onClick={() => setViewMode('semana')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'semana'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Semana
            </button>
          </div>
        </div>
      </div>

      {/* Legenda e Filtros */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Status:</span>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Pendente</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Motorista Pronto</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Em Andamento</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Concluído</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filtrar:</span>
          <div className="flex gap-2">
            {(['all', 'pendente', 'motorista_pronto', 'em_andamento', 'concluido'] as StatusFilter[]).map(status => {
              const config = status === 'all' ? { color: 'bg-blue-500', label: 'Todos' } : getStatusConfig(status);
              return (
                <label key={status} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="statusFilter"
                    value={status}
                    checked={statusFilter === status}
                    onChange={() => setStatusFilter(status)}
                    className="hidden"
                  />
                  <div className={`w-3 h-3 rounded-full ${config.color} ${statusFilter === status ? 'ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-gray-800' : ''}`}></div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">{config.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card Motoristas no Pátio */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 h-full border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg">
                <Truck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Motoristas no Pátio</h2>
            </div>

            {motoristas.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">Nenhum motorista aguardando no pátio.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {motoristas.map((motorista) => (
                  <div
                    key={motorista.id}
                    className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600 hover:shadow-md transition-shadow"
                  >
                    <div className="font-semibold text-gray-900 dark:text-white mb-1">{motorista.driver_name}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">{motorista.fornecedor?.name || 'N/A'}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-500">
                      <FormattedDate date={motorista.submitted_at} includeTime={true} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Grade de Agendamentos */}
        <div className="lg:col-span-2">
          {viewMode === 'dia' ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700">
              {/* Header do Dia */}
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-6 py-4">
                <div className="text-2xl font-bold uppercase">{dateHeader.dayOfWeek}</div>
                <div className="text-4xl font-bold">{dateHeader.day}</div>
                <div className="text-lg">{dateHeader.month}</div>
              </div>

              {/* Conteúdo */}
              <div className="p-6 bg-gray-50 dark:bg-gray-900/50 min-h-[400px]">
                {agendamentosHoje.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400 text-lg">Nenhum fornecedor agendado</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">{agendamentosHoje.length} fornecedores</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {agendamentosHoje.map((agendamento) => {
                      const statusConfig = getStatusConfig(agendamento.status);
                      return (
                        <div
                          key={agendamento.id}
                          className="bg-white dark:bg-gray-800 rounded-lg p-4 border-l-4 shadow-sm hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-700"
                          style={{ borderLeftColor: statusConfig.hexColor }}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="font-bold text-gray-900 dark:text-white text-lg mb-1">
                                {agendamento.fornecedor?.name || 'N/A'}
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">{agendamento.fornecedor?.category || ''}</div>
                              <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-2">
                                <span>🕐 {agendamento.scheduled_time}</span>
                                <span>📍 Doca {agendamento.dock}</span>
                              </div>
                              {agendamento.motorista && (
                                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                                  <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                                    <Users className="w-4 h-4" />
                                    <span className="font-semibold">{agendamento.motorista.driver_name}</span>
                                    {agendamento.motorista.phone_number && (
                                      <span className="text-gray-500 dark:text-gray-400">• {agendamento.motorista.phone_number}</span>
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    Chegada: <FormattedDate date={agendamento.motorista.submitted_at} includeTime={true} />
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className={`px-3 py-1 rounded-full text-xs font-semibold text-white ${statusConfig.color}`}>
                              {statusConfig.label}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                      {agendamentosHoje.length} {agendamentosHoje.length === 1 ? 'fornecedor' : 'fornecedores'}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3">
              {weekDates.map((date) => {
                const dayAgendamentos = getAgendamentosDoDia(date);
                const isToday = formatDateToYYYYMMDD(date) === formatDateToYYYYMMDD(new Date());
                const dayHeader = formatDateHeader(date);
                return (
                  <div key={date.toISOString()} className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-200 dark:border-gray-700 flex flex-col min-h-[200px]">
                    <div className={`px-3 py-2 flex-shrink-0 ${isToday ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'}`}>
                      <div className="font-semibold uppercase text-xs tracking-wide">{dayHeader.dayOfWeek.split('-')[0]}</div>
                      <div className="flex justify-between items-baseline gap-1">
                        <span className="text-xl font-bold">{dayHeader.day}</span>
                        <span className="text-xs font-medium opacity-90">{dayAgendamentos.length}</span>
                      </div>
                    </div>
                    <div className="p-2 bg-gray-50 dark:bg-gray-900/50 flex-1 min-h-[120px] overflow-y-auto">
                      {dayAgendamentos.length === 0 ? (
                        <div className="h-full flex items-center justify-center py-3">
                          <p className="text-gray-400 dark:text-gray-500 text-xs text-center">Nenhum agendamento</p>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {dayAgendamentos.slice(0, 4).map((agendamento) => {
                            const statusConfig = getStatusConfig(agendamento.status);
                            return (
                              <div
                                key={agendamento.id}
                                className="bg-white dark:bg-gray-800 rounded p-2 border-l-2 text-xs border border-gray-200 dark:border-gray-700"
                                style={{ borderLeftColor: statusConfig.hexColor }}
                              >
                                <div className="font-semibold text-gray-900 dark:text-white truncate" title={agendamento.fornecedor?.name}>{agendamento.fornecedor?.name}</div>
                                <div className="text-gray-500 dark:text-gray-400">{agendamento.scheduled_time} · Doca {agendamento.dock}</div>
                                {agendamento.motorista && (
                                  <div className="mt-0.5 pt-0.5 border-t border-gray-100 dark:border-gray-600 flex items-center gap-0.5 text-blue-600 dark:text-blue-400">
                                    <Users className="w-3 h-3 flex-shrink-0" />
                                    <span className="truncate font-medium">{agendamento.motorista.driver_name}</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {dayAgendamentos.length > 4 && (
                            <div className="text-xs text-gray-400 dark:text-gray-500 text-center py-0.5">
                              +{dayAgendamentos.length - 4} mais
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GradeDescarregamento;
