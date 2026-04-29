import React, { useState, useEffect, useRef } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Package, Truck, Users, RefreshCw, LogIn, CheckCircle, MonitorUp, Maximize2, Minimize2 } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import { toast } from 'react-hot-toast';
import FormattedDate from '../../components/FormattedDate';
import { usePermissions } from '../../contexts/PermissionsContext';
import { apiUrl } from '../../utils/apiUrl';
import { toYyyyMmDd } from '../../utils/dateUtils';
import LiberarParaDocaModal, { DocaOption } from '../../components/descarregamento/LiberarParaDocaModal';

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
  discharge_started_at?: string;
  fornecedor?: {
    id: number;
    name: string;
    category: string;
  };
  agendamento?: {
    id: number;
    dock: string;
    scheduled_date: string;
    scheduled_time: string;
    status: string;
  };
}

type ViewMode = 'dia' | 'semana';
type StatusFilter = 'all' | 'pendente' | 'motorista_pronto' | 'em_andamento' | 'concluido';

const GradeDescarregamento: React.FC = () => {
  const { hasPermission } = usePermissions();
  const canLiberar = hasPermission('descarregamento.motoristas.liberar');
  const [viewMode, setViewMode] = useState<ViewMode>('dia');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const hasLoadedOnce = useRef(false);
  const [docas, setDocas] = useState<DocaOption[]>([]);
  const [loadingDocas, setLoadingDocas] = useState(false);
  const [liberarModal, setLiberarModal] = useState<{ id: number; name: string; defaultDock: string } | null>(null);
  const [liberarSubmitting, setLiberarSubmitting] = useState(false);
  const [tvMode, setTvMode] = useState(() => new URLSearchParams(window.location.search).get('tv') === '1');
  const [tvRefreshSeconds, setTvRefreshSeconds] = useState<number>(() => {
    const raw = Number(new URLSearchParams(window.location.search).get('tv_refresh'));
    return [15, 30, 60].includes(raw) ? raw : 15;
  });
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    const loadDocas = async () => {
      try {
        setLoadingDocas(true);
        const response = await fetch(apiUrl('descarregamento/docas?activeOnly=true'), {
          credentials: 'include',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (!response.ok) return;
        const data = await response.json();
        setDocas(data.data?.docas || []);
      } catch {
        /* vazio */
      } finally {
        setLoadingDocas(false);
      }
    };
    loadDocas();
  }, []);

  useEffect(() => {
    fetchData(true);
    const interval = setInterval(() => fetchData(false), tvMode ? tvRefreshSeconds * 1000 : 30000);
    return () => clearInterval(interval);
  }, [currentDate, statusFilter, viewMode, tvMode, tvRefreshSeconds]);

  useEffect(() => {
    if (!tvMode) return;
    const rotation = setInterval(() => {
      setViewMode((prev) => (prev === 'dia' ? 'semana' : 'dia'));
    }, 20000);
    return () => clearInterval(rotation);
  }, [tvMode]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && tvMode) {
        setTvMode(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [tvMode]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (tvMode) {
      params.set('tv', '1');
      params.set('tv_refresh', String(tvRefreshSeconds));
    } else {
      params.delete('tv');
      params.delete('tv_refresh');
    }
    const queryString = params.toString();
    const newUrl = `${window.location.pathname}${queryString ? `?${queryString}` : ''}${window.location.hash}`;
    window.history.replaceState({}, '', newUrl);
  }, [tvMode, tvRefreshSeconds]);

  // Função para formatar data no formato YYYY-MM-DD no fuso horário local
  const formatDateToYYYYMMDD = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const fetchData = async (isInitialOrUserAction: boolean) => {
    const showFullLoading = isInitialOrUserAction && !hasLoadedOnce.current;
    if (showFullLoading) {
      setLoadError(null);
      setLoading(true);
    } else {
      setIsRefreshing(true);
    }
    try {
      await Promise.all([fetchAgendamentos(), fetchMotoristas()]);
      hasLoadedOnce.current = true;
      setLastUpdatedAt(new Date());
    } catch (error) {
      const msg = 'Falha ao carregar agendamentos e motoristas. Tente novamente.';
      setLoadError(msg);
      if (!hasLoadedOnce.current) toast.error(msg);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
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

      const response = await fetch(apiUrl(`descarregamento/agendamentos?${params}`), {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Erro ao carregar agendamentos');

      const data = await response.json();
      setAgendamentos(data.data.data || []);
    } catch (error) {
      console.error('Erro ao buscar agendamentos:', error);
      throw error;
    }
  };

  const fetchMotoristas = async () => {
    try {
      const response = await fetch(apiUrl('descarregamento/form-responses/patio'), {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Erro ao carregar motoristas');

      const data = await response.json();
      setMotoristas(data.data.responses || []);
    } catch (error) {
      console.error('Erro ao buscar motoristas:', error);
      throw error;
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
    return agendamentos.filter((a) => toYyyyMmDd(a.scheduled_date) === dateStr);
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

  const openLiberarModal = (m: Motorista) => {
    const defaultDock = (m.agendamento?.dock || '').trim();
    setLiberarModal({ id: m.id, name: m.driver_name, defaultDock });
  };

  const handleConfirmLiberar = async (dockNumero: string) => {
    if (!liberarModal) return;
    setActionLoadingId(liberarModal.id);
    setLiberarSubmitting(true);
    try {
      const res = await fetch(apiUrl(`descarregamento/form-responses/${liberarModal.id}/start-discharge`), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ dock: dockNumero })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao iniciar descarga');
      }
      toast.success('Liberado para doca. Confirme a conclusão quando terminar.');
      setLiberarModal(null);
      fetchData(false);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao iniciar descarga');
    } finally {
      setLiberarSubmitting(false);
      setActionLoadingId(null);
    }
  };

  const handleFinishDischarge = async (m: Motorista) => {
    if (!window.confirm(`Confirmar que o descarregamento de ${m.driver_name} foi concluído? O motorista será liberado e receberá o SMS.`)) return;
    setActionLoadingId(m.id);
    try {
      const res = await fetch(apiUrl(`descarregamento/form-responses/${m.id}/checkout`), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao liberar');
      }
      toast.success('Motorista liberado. Tempo de descarga registrado.');
      fetchData(false);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao liberar');
    } finally {
      setActionLoadingId(null);
    }
  };

  const toggleTvMode = async () => {
    const next = !tvMode;
    setTvMode(next);
    if (next) {
      setViewMode('dia');
      setStatusFilter('all');
      if (document.fullscreenEnabled && !document.fullscreenElement) {
        try {
          await document.documentElement.requestFullscreen();
        } catch {
          /* ignorar falha de fullscreen */
        }
      }
      return;
    }
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        /* ignorar falha ao sair de fullscreen */
      }
    }
  };

  return (
    <div className={tvMode ? 'fixed inset-0 z-50 bg-gray-950 text-white p-4 sm:p-6 overflow-auto space-y-4' : 'p-6 space-y-6'}>
      <LiberarParaDocaModal
        open={!!liberarModal}
        driverName={liberarModal?.name || ''}
        defaultDockNumero={liberarModal?.defaultDock}
        docas={docas}
        loadingDocas={loadingDocas}
        submitting={liberarSubmitting}
        onCancel={() => !liberarSubmitting && setLiberarModal(null)}
        onConfirm={handleConfirmLiberar}
      />
      {loadError && (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 flex flex-wrap items-center justify-between gap-3">
          <span>{loadError}</span>
          <button
            type="button"
            onClick={() => fetchData(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <RefreshCw className="w-4 h-4" />
            Tentar novamente
          </button>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className={`text-3xl font-bold ${tvMode ? 'text-white' : 'text-gray-900 dark:text-white'}`}>Grade de Descarregamento</h1>
            <p className={`${tvMode ? 'text-gray-300' : 'text-gray-600 dark:text-gray-400'} mt-1`}>
              {viewMode === 'semana' && weekDates.length ? getWeekRangeLabel() : `${dateHeader.dayOfWeek}, ${dateHeader.day} de ${dateHeader.month} de ${dateHeader.year}`}
            </p>
            {tvMode && (
              <p className="text-xs text-gray-400 mt-1">
                Rotação automática Dia/Semana · Pressione Esc para sair
              </p>
            )}
          </div>
          {isRefreshing && (
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400" aria-live="polite">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Atualizando...</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => fetchData(true)}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              tvMode
                ? 'bg-gray-800 hover:bg-gray-700 text-gray-100 border border-gray-700'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
            }`}
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>
          <button
            type="button"
            onClick={toggleTvMode}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              tvMode
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            <MonitorUp className="w-4 h-4" />
            {tvMode ? (
              <>
                <Minimize2 className="w-4 h-4" />
                Sair do modo TV
              </>
            ) : (
              <>
                <Maximize2 className="w-4 h-4" />
                Modo TV
              </>
            )}
          </button>
          {/* Navegação de Data */}
          <div className={`flex items-center gap-2 rounded-lg shadow-md px-3 py-2 border ${
            tvMode
              ? 'bg-gray-900 border-gray-700'
              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
          }`}>
            <button
              onClick={() => navigateDate('prev')}
              className={`p-1 rounded transition-colors ${tvMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            >
              <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <button
              onClick={() => navigateDate('today')}
              className={`flex items-center gap-2 px-3 py-1 rounded transition-colors text-sm font-medium ${
                tvMode ? 'text-gray-100 hover:bg-gray-800' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Calendar className="w-4 h-4" />
              Hoje
            </button>
            <button
              onClick={() => navigateDate('next')}
              className={`p-1 rounded transition-colors ${tvMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            >
              <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>

          {/* Toggle Vista */}
          <div className={`rounded-lg shadow-md p-1 flex border ${tvMode ? 'bg-gray-900 border-gray-700' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
            <button
              onClick={() => setViewMode('dia')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'dia'
                  ? 'bg-blue-600 text-white'
                  : tvMode
                    ? 'text-gray-300 hover:bg-gray-800'
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
                  : tvMode
                    ? 'text-gray-300 hover:bg-gray-800'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Semana
            </button>
          </div>
        </div>
      </div>

      {tvMode && (
        <div className="rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm text-gray-300 flex items-center gap-2">
            Exibição para monitor operacional
            <span className="text-xs text-gray-400">Atualização:</span>
            <select
              value={tvRefreshSeconds}
              onChange={(e) => setTvRefreshSeconds(Number(e.target.value))}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100"
            >
              <option value={15}>15s</option>
              <option value={30}>30s</option>
              <option value={60}>60s</option>
            </select>
          </div>
          <div className="text-xs text-gray-400">
            Última atualização: {lastUpdatedAt ? lastUpdatedAt.toLocaleTimeString('pt-BR') : '--:--:--'}
          </div>
        </div>
      )}

      {/* Legenda e Filtros */}
      <div className={`rounded-lg shadow-md p-4 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border ${
        tvMode
          ? 'bg-gray-900 border-gray-700'
          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
      }`}>
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
          <div className="flex flex-wrap gap-1">
            {(['all', 'pendente', 'motorista_pronto', 'em_andamento', 'concluido'] as StatusFilter[]).map(status => {
              const config = status === 'all' ? { color: 'bg-blue-500', label: 'Todos' } : getStatusConfig(status);
              return (
                <label key={status} className="flex items-center gap-2 cursor-pointer py-2 px-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors select-none">
                  <input
                    type="radio"
                    name="statusFilter"
                    value={status}
                    checked={statusFilter === status}
                    onChange={() => setStatusFilter(status)}
                    className="sr-only"
                  />
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${config.color} ${statusFilter === status ? 'ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-gray-800' : ''}`}></div>
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
                {motoristas.map((motorista) => {
                  const realizando = !!motorista.discharge_started_at;
                  const loading = actionLoadingId === motorista.id;
                  return (
                    <div
                      key={motorista.id}
                      className={`rounded-lg p-4 border transition-shadow ${
                        realizando
                          ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700'
                          : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 hover:shadow-md'
                      }`}
                    >
                      <div className="font-semibold text-gray-900 dark:text-white mb-1">{motorista.driver_name}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">{motorista.fornecedor?.name || 'N/A'}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-500 mb-3">
                        <FormattedDate date={motorista.submitted_at} includeTime={true} />
                      </div>
                      {canLiberar && !tvMode && (
                        <div className="flex flex-wrap gap-2">
                          {!realizando ? (
                            <button
                              type="button"
                              onClick={() => openLiberarModal(motorista)}
                              disabled={loading}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50"
                            >
                              <LogIn className="w-4 h-4" />
                              {loading ? '...' : 'Liberar para doca'}
                            </button>
                          ) : (
                            <>
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-200 dark:bg-amber-800/50 text-amber-800 dark:text-amber-200 text-xs font-medium">
                                Realizando descarga
                              </span>
                              <button
                                type="button"
                                onClick={() => handleFinishDischarge(motorista)}
                                disabled={loading}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium disabled:opacity-50"
                              >
                                <CheckCircle className="w-4 h-4" />
                                {loading ? '...' : 'Concluir descarga'}
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
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
                                <span>🕐 {agendamento.scheduled_time?.trim() || '—'}</span>
                                <span>
                                  📍{' '}
                                  {(agendamento.dock || '').trim()
                                    ? `Doca ${agendamento.dock}`
                                    : 'Doca a definir'}
                                </span>
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
                                <div className="text-gray-500 dark:text-gray-400">
                                  {agendamento.scheduled_time?.trim() || '—'} ·{' '}
                                  {(agendamento.dock || '').trim() ? `Doca ${agendamento.dock}` : 'doca a definir'}
                                </div>
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
