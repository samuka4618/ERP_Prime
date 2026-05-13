import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Edit, 
  MessageSquare, 
  Wifi,
  WifiOff,
  Paperclip,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Landmark
} from 'lucide-react';
import { Ticket, TicketFinanceApproval, TicketHistory, Attachment, CategoryField } from '../types';
import { apiService } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import StatusManager from '../components/StatusManager';
// import FileUpload from '../components/FileUpload'; // Removido - não usado mais
import { toast } from 'react-hot-toast';
import { useWebSocket } from '../hooks/useWebSocket';
import FormattedDate from '../components/FormattedDate';
import { useAuth } from '../contexts/AuthContext';
import UserAvatar from '../components/UserAvatar';
import { usePermissions } from '../contexts/PermissionsContext';
import { approvalValueFromTicket, parseApprovalAmountInput } from '../utils/approvalAmount';
import Modal from '../components/Modal';

function formatCustomAnswer(field: CategoryField | undefined, value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === '') {
    return <span className="text-gray-400">—</span>;
  }
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'object') {
    return (
      <pre className="text-xs whitespace-pre-wrap font-mono bg-gray-50 dark:bg-gray-800 p-2 rounded">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }
  const s = String(value);
  if (field?.type === 'textarea') return <span className="whitespace-pre-wrap">{s}</span>;
  if (field?.type === 'number') {
    const n = typeof value === 'number' ? value : Number(s);
    if (!Number.isNaN(n)) return n.toLocaleString('pt-BR');
  }
  return s;
}

/** Ordem: definidos na categoria; depois outras chaves no JSON (ex.: formulário alterado depois). */
function orderedCustomAnswers(ticket: Ticket): Array<{ key: string; label: string; field?: CategoryField }> {
  const data = ticket.custom_data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return [];
  const defs = ticket.category?.custom_fields ?? [];
  const seen = new Set<string>();
  const out: Array<{ key: string; label: string; field?: CategoryField }> = [];
  for (const f of defs) {
    if (!Object.prototype.hasOwnProperty.call(data, f.name)) continue;
    out.push({ key: f.name, label: f.label, field: f });
    seen.add(f.name);
  }
  const extraKeys = Object.keys(data)
    .filter((k) => !seen.has(k))
    .sort();
  for (const k of extraKeys) {
    out.push({ key: k, label: k });
  }
  return out;
}

type BillingCycleOption = 'monthly' | 'annual' | 'one_time';

const TicketDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, isAdmin, isAttendant } = useAuth();
  const { hasPermission } = usePermissions();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [financeApprovals, setFinanceApprovals] = useState<TicketFinanceApproval[]>([]);
  const [history, setHistory] = useState<TicketHistory[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachmentsError, setAttachmentsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [financeApproveCardOpen, setFinanceApproveCardOpen] = useState(false);
  const [financeApproveCardCycle, setFinanceApproveCardCycle] = useState<BillingCycleOption>('monthly');
  const [financeApproveCardAmount, setFinanceApproveCardAmount] = useState('');
  const [financeApproveCardNotes, setFinanceApproveCardNotes] = useState('');
  const [financeApproveSubmitting, setFinanceApproveSubmitting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);


  // Função para rolar para o final das mensagens
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Hook de tempo real
  const { isConnected } = useWebSocket({
    ticketId: id ? parseInt(id) : undefined,
    onMessage: (message) => {
      console.log('🔌 Nova mensagem recebida via WebSocket:', message);
      console.log('🔔 Adicionando mensagem ao histórico:', message);
      setHistory(prev => {
        console.log('🔔 Histórico anterior:', prev);
        const newHistory = [...prev, message];
        
        // Ordenar por ID para garantir ordem correta (IDs são sequenciais)
        newHistory.sort((a, b) => a.id - b.id);
        
        console.log('🔔 Novo histórico ordenado:', newHistory);
        return newHistory;
      });
      // Scroll para a nova mensagem
      setTimeout(scrollToBottom, 100);
      toast.success('Nova mensagem recebida!');
    },
    onTicketUpdate: (update) => {
      console.log('🔌 Atualização de ticket recebida via WebSocket:', update);
      setTicket(prev => prev ? { ...prev, ...update } : null);
      toast.success('Ticket atualizado!');
    }
  });

  useEffect(() => {
    if (id) {
      fetchTicket();
      fetchHistory();
      fetchAttachments();
    }
  }, [id]);

  const fetchTicket = async () => {
    try {
      const ticketId = parseInt(id!);
      if (isNaN(ticketId)) {
        toast.error('ID do chamado inválido');
        return;
      }
      const payload = await apiService.getTicket(ticketId);
      setTicket(payload.ticket);
      setFinanceApprovals(payload.finance_approvals ?? []);
    } catch (error) {
      toast.error('Erro ao carregar chamado');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const ticketId = parseInt(id!);
      if (isNaN(ticketId)) {
        toast.error('ID do chamado inválido');
        return;
      }
      const data = await apiService.getTicketHistory(ticketId);
      
      // Garantir que o histórico está ordenado por ID (IDs são sequenciais)
      const sortedData = data.sort((a, b) => a.id - b.id);
      
      setHistory(sortedData);
      // Scroll para o final após carregar histórico
      setTimeout(scrollToBottom, 100);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
      toast.error('Erro ao carregar histórico');
    }
  };

  const fetchAttachments = async () => {
    setAttachmentsError(null);
    try {
      const ticketId = parseInt(id!);
      if (isNaN(ticketId)) {
        return;
      }
      const data = await apiService.getTicketAttachments(ticketId);
      setAttachments(data.attachments);
    } catch (error) {
      console.error('Erro ao carregar anexos:', error);
      setAttachmentsError('Falha ao carregar anexos. Tente novamente.');
    }
  };

  const handleFilesSelect = (files: File[]) => {
    setSelectedFiles(prev => [...prev, ...files]);
  };

  // Funções removidas - não usadas mais com o novo design

  const handleAddMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() && selectedFiles.length === 0) return;

    setUploading(true);
    try {
      const ticketId = parseInt(id!);
      let messageId: number | undefined;
      
      // Adicionar mensagem se houver texto
      if (newMessage.trim()) {
        const response = await apiService.addTicketHistory(ticketId, { message: newMessage });
        messageId = response.id; // Pegar o ID da mensagem criada
      }
      
      // Fazer upload de arquivos se houver, associando à mensagem
      if (selectedFiles.length > 0) {
        await apiService.uploadAttachments(ticketId, selectedFiles, messageId || undefined);
        setSelectedFiles([]);
      }
      
      setNewMessage('');
      // Recarregar histórico para mostrar a própria mensagem
      fetchHistory();
      // Recarregar anexos para mostrar os novos anexos
      fetchAttachments();
      // Scroll para a nova mensagem
      setTimeout(scrollToBottom, 200);
      toast.success('Mensagem e anexos adicionados com sucesso');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao adicionar mensagem');
    } finally {
      setUploading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!id) return;

    try {
      await apiService.updateTicket(parseInt(id), { status: newStatus as any });
      setTicket(prev => prev ? { ...prev, status: newStatus as any } : null);
      fetchHistory();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao atualizar status');
    }
  };

  // Funções para o fluxo de aprovação
  const handleRequestApproval = async () => {
    if (!id) return;

    // Confirmação antes de finalizar
    const confirmed = window.confirm(
      'Tem certeza que deseja finalizar este chamado?\n\n' +
      'O chamado será enviado para aprovação do solicitante e ficará com status "Aguardando Aprovação".\n\n' +
      'O solicitante poderá aprovar ou rejeitar a finalização.'
    );

    if (!confirmed) return;

    try {
      const updatedTicket = await apiService.requestApproval(parseInt(id));
      setTicket(updatedTicket);
      fetchHistory();
      toast.success('Chamado finalizado! Aguardando aprovação do solicitante.');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao finalizar chamado');
    }
  };

  const handleApproveTicket = async () => {
    if (!id) return;

    const confirmed = window.confirm(
      'Confirmar que o problema foi resolvido?\n\n' +
      'O chamado será finalizado e encerrado definitivamente.'
    );

    if (!confirmed) return;

    try {
      const updatedTicket = await apiService.approveTicket(parseInt(id));
      setTicket(updatedTicket);
      fetchHistory();
      toast.success('✅ Chamado aprovado e finalizado com sucesso!');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao aprovar chamado');
    }
  };

  const handleRejectTicket = async () => {
    if (!id) return;

    const reason = window.prompt(
      'O problema ainda não foi resolvido?\n\n' +
      'Por favor, descreva brevemente o que ainda precisa ser feito (opcional):'
    );
    
    if (reason === null) return; // Usuário cancelou

    try {
      const updatedTicket = await apiService.rejectTicket(parseInt(id), reason || undefined);
      setTicket(updatedTicket);
      fetchHistory();
      toast.success('🔄 Chamado rejeitado e retornado para atendimento!');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao rejeitar chamado');
    }
  };

  const openFinanceApproveCardModal = () => {
    if (!ticket) return;
    const cycleRaw =
      typeof ticket.custom_data?.ciclo_faturamento === 'string'
        ? ticket.custom_data.ciclo_faturamento
        : 'monthly';
    setFinanceApproveCardCycle(
      cycleRaw === 'annual' || cycleRaw === 'one_time' ? cycleRaw : 'monthly'
    );
    const ref = approvalValueFromTicket(ticket);
    setFinanceApproveCardAmount(ref != null ? String(ref) : '');
    setFinanceApproveCardNotes('');
    setFinanceApproveCardOpen(true);
  };

  const handleFinanceApprove = async () => {
    if (!id || !ticket) return;
    if (ticket.category?.approval_type === 'finance_card') {
      openFinanceApproveCardModal();
      return;
    }
    try {
      const { ticket: updated } = await apiService.financeApproveTicket(parseInt(id, 10));
      setTicket(updated);
      toast.success('Aprovado financeiramente');
      fetchHistory();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Erro ao aprovar');
    }
  };

  const submitFinanceApproveCard = async () => {
    if (!id || !ticket) return;
    const amount = parseApprovalAmountInput(financeApproveCardAmount);
    if (amount === null || amount <= 0) {
      toast.error('Informe o valor efetivo contratado (número maior que zero).');
      return;
    }
    try {
      setFinanceApproveSubmitting(true);
      const { ticket: updated } = await apiService.financeApproveTicket(parseInt(id, 10), {
        billing_cycle: financeApproveCardCycle,
        amount,
        notes: financeApproveCardNotes.trim() || undefined
      });
      setTicket(updated);
      setFinanceApproveCardOpen(false);
      toast.success('Assinatura registrada e chamado resolvido');
      fetchHistory();
      fetchAttachments();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Erro ao aprovar');
    } finally {
      setFinanceApproveSubmitting(false);
    }
  };

  const handleFinanceReject = async () => {
    if (!id || !ticket) return;

    const reason = window.prompt('Motivo da rejeição?');
    if (!reason || reason.length < 3) {
      toast.error('Informe o motivo (mín. 3 caracteres)');
      return;
    }
    try {
      const updated = await apiService.financeRejectTicket(parseInt(id, 10), reason);
      setTicket(updated);
      toast.success('Chamado rejeitado na aprovação financeira');
      fetchHistory();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Erro ao rejeitar');
    }
  };


  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityText = (priority: string) => {
    const priorityMap = {
      urgent: 'Urgente',
      high: 'Alta',
      medium: 'Média',
      low: 'Baixa'
    };
    return priorityMap[priority as keyof typeof priorityMap] || priority;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Chamado não encontrado</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">O chamado solicitado não existe ou foi removido.</p>
        <Link to="/tickets" className="btn btn-primary mt-4">
          Voltar para Chamados
        </Link>
      </div>
    );
  }

  const customAnswerRows = orderedCustomAnswers(ticket);

  const financeApprovalField = ticket.category?.approval_value_field || 'valor_mensal';
  const financeApprovalLabel =
    ticket.category?.custom_fields?.find((f) => f.name === financeApprovalField)?.label ||
    `Valor de referência (${financeApprovalField})`;
  const financeValorRefParsed = approvalValueFromTicket(ticket);
  const financeValorRefFormatted =
    financeValorRefParsed !== null ? financeValorRefParsed.toLocaleString('pt-BR') : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            to="/tickets"
            className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Chamado #{ticket.id}
              </h1>
              {/* Indicador de conexão em tempo real */}
              <div className="flex items-center space-x-1">
                {isConnected ? (
                  <div className="flex items-center space-x-1 text-green-600">
                    <Wifi className="w-4 h-4" />
                    <span className="text-xs font-medium">Tempo Real</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-1 text-red-600">
                    <WifiOff className="w-4 h-4" />
                    <span className="text-xs font-medium">Desconectado</span>
                  </div>
                )}
              </div>
            </div>
            <p className="text-gray-600 dark:text-gray-400">{ticket.subject}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button className="btn btn-outline">
            <Edit className="w-4 h-4 mr-2" />
            Editar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Ticket Details */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Detalhes do Chamado</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Descrição</label>
                <p className="mt-1 text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                  {ticket.description}
                </p>
              </div>

              {customAnswerRows.length > 0 && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                    Informações adicionais
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    Respostas do formulário configurado nesta categoria.
                  </p>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                    {customAnswerRows.map(({ key, label, field }) => (
                      <div key={key} className="min-w-0">
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-white break-words">
                          {formatCustomAnswer(field, ticket.custom_data?.[key])}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </div>
          </div>

          {/* Chat Interface */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white dark:text-white mb-4">Chat do Chamado</h3>
            {attachmentsError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm">{attachmentsError}</span>
                <button
                  type="button"
                  onClick={() => fetchAttachments()}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <RefreshCw className="w-4 h-4" />
                  Tentar novamente
                </button>
              </div>
            )}
            {/* Messages Container */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4 h-96 overflow-y-auto">
              {history && history.length > 0 ? (() => {
                // Verificar IDs duplicados e remover duplicatas
                const uniqueHistory = history.reduce((acc, item, index) => {
                  const key = `${item.id}-${item.created_at}`;
                  if (!acc.find(existing => `${existing.id}-${existing.created_at}` === key)) {
                    acc.push({ ...item, _originalIndex: index });
                  }
                  return acc;
                }, [] as any[]);
                
                // Garantir ordenação final por ID (IDs são sequenciais)
                uniqueHistory.sort((a, b) => a.id - b.id);
                
                console.log('🔍 Histórico processado:', {
                  original: history.length,
                  único: uniqueHistory.length,
                  duplicados: history.length - uniqueHistory.length
                });
                
                return uniqueHistory.map((item, index) => (
                <div key={`message-${item.id}-${index}-${item.created_at}`} className={`flex mb-4 ${item.author?.id === ticket?.user_id ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    item.author?.id === ticket?.user_id 
                      ? 'bg-primary-600 text-white' 
                      : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-600'
                  }`}>
                    <div className="flex items-center space-x-2 mb-1">
                      <UserAvatar user={item.author} size="xs" showFallback={true} />
                      <span className="text-xs font-medium">
                        {item.author?.name || 'Usuário'}
                      </span>
                      <span className="text-xs opacity-75">
                        {item.formatted_date || <FormattedDate date={item.created_at} includeTime={false} />}
                        {/* Debug: {JSON.stringify({formatted_date: item.formatted_date, created_at: item.created_at})} */}
                      </span>
                    </div>
                    {item.message && (
                      <p className="text-sm whitespace-pre-wrap">
                        {item.message}
                      </p>
                    )}
                    {/* Anexos como parte da mensagem */}
                    {(() => {
                      const messageAttachments = attachments.filter(att => att.message_id === item.id);
                      return messageAttachments.map((attachment, attIndex) => (
                        <div key={attIndex} className="mt-2 p-2 bg-gray-200 dark:bg-gray-600 rounded border">
                          <div className="flex items-center space-x-2">
                            <Paperclip className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                            <a 
                              href={`${'http://192.168.14.143:3000'}/attachments/${attachment.id}/download`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
                            >
                              {attachment.original_name}
                            </a>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              ({Math.round(attachment.file_size / 1024)} KB)
                            </span>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
                ));
              })() : (
                <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                  <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma mensagem ainda</p>
                  <p className="text-sm">Seja o primeiro a enviar uma mensagem!</p>
                </div>
              )}
              
              
              {/* Elemento para scroll automático */}
              <div ref={messagesEndRef} />
            </div>


            {/* Add Message Form - Estilo WhatsApp */}
            <form onSubmit={handleAddMessage} className="flex items-end space-x-2">
              <div className="flex-1">
                <textarea
                  id="message"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  rows={2}
                  className="w-full input resize-none"
                  placeholder="Digite sua mensagem..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAddMessage(e);
                    }
                  }}
                />
                {/* Anexos selecionados */}
                {selectedFiles.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedFiles.map((file, index) => (
                      <div key={index} className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded text-sm">
                        <Paperclip className="w-3 h-3" />
                        <span className="truncate max-w-32">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== index))}
                          className="text-red-500 hover:text-red-700"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex space-x-1">
                {/* Botão de anexo */}
                <input
                  type="file"
                  id="file-upload-inline"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    handleFilesSelect(files);
                  }}
                  className="hidden"
                />
                <label
                  htmlFor="file-upload-inline"
                  className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border border-gray-300 dark:border-gray-600"
                  title="Anexar arquivo"
                >
                  <Paperclip className="w-5 h-5" />
                </label>
                {/* Botão de enviar */}
                <button
                  type="submit"
                  className="btn btn-primary px-4 py-2 h-auto"
                  disabled={(!newMessage.trim() && selectedFiles.length === 0) || uploading}
                >
                  {uploading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <MessageSquare className="w-4 h-4" />
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status and Priority */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Status</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Status Atual</label>
                <div className="mt-1">
                  <StatusManager
                    currentStatus={ticket.status}
                    onStatusChange={handleStatusChange}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Prioridade</label>
                <div className="mt-1">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(ticket.priority)}`}>
                    {getPriorityText(ticket.priority)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Status de Aguardando Aprovação - para atendentes/admins */}
          {ticket.status === 'pending_approval' && (isAdmin || isAttendant) && user?.id !== ticket.user_id && (
            <div className="card p-6 border-2 border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20">
              <div className="flex items-center space-x-2 mb-4">
                <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200">
                  Aguardando Aprovação do Solicitante
                </h3>
              </div>
              <div className="bg-yellow-100 dark:bg-yellow-800/30 p-4 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  Este chamado foi finalizado e está aguardando a confirmação do solicitante. 
                  O solicitante receberá uma notificação para aprovar ou rejeitar a finalização.
                </p>
              </div>
            </div>
          )}

          {/* Fluxo de Aprovação - apenas para o solicitante */}
          {ticket.status === 'pending_approval' && user?.id === ticket.user_id && (
            <div className="card p-6 border-2 border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20">
              <div className="flex items-center space-x-2 mb-4">
                <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200">
                  Chamado Finalizado - Aguardando Sua Aprovação
                </h3>
              </div>
              <div className="bg-yellow-100 dark:bg-yellow-800/30 p-4 rounded-lg mb-4">
                <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium mb-2">
                  O atendente finalizou este chamado e está aguardando sua confirmação.
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Por favor, verifique se o problema foi realmente resolvido e confirme a finalização.
                </p>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={handleApproveTicket}
                  className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors font-medium"
                >
                  <CheckCircle className="w-5 h-5" />
                  <span>Sim, Problema Resolvido</span>
                </button>
                <button
                  onClick={handleRejectTicket}
                  className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-medium"
                >
                  <XCircle className="w-5 h-5" />
                  <span>Não, Ainda Tem Problema</span>
                </button>
              </div>
            </div>
          )}

          {ticket.status === 'pending_finance_approval' && hasPermission('chamados.finance_approval.approve') && (
            <div className="card p-6 border-2 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
              <div className="flex items-center space-x-2 mb-4">
                <Landmark className="w-5 h-5 text-amber-700 dark:text-amber-300" />
                <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-100">Aprovação financeira</h3>
              </div>
              <p className="text-sm text-amber-900/90 dark:text-amber-100/90 mb-4">
                {ticket.category?.approval_type === 'finance_card' ? (
                  <>
                    Categoria de <strong>assinatura digital</strong>: plataforma e credenciais vêm da abertura do chamado.
                    Ao aprovar, confirme o <strong>ciclo de faturamento</strong>, o <strong>valor efetivo contratado</strong> e,
                    se quiser, <strong>observações</strong> — o chamado será resolvido e a assinatura registada.
                  </>
                ) : (
                  <>
                    Revise as informações abaixo. O solicitante já definiu o valor de referência na abertura; você apenas
                    aprova ou rejeita pela faixa. Após a aprovação, o chamado segue para a fila de atendimento.
                  </>
                )}
              </p>
              {financeValorRefFormatted !== null ? (
                <p className="text-sm mb-4 text-amber-950 dark:text-amber-100">
                  <strong>{financeApprovalLabel}</strong> (triagem por faixa):{' '}
                  <span className="font-mono">{financeValorRefFormatted}</span>
                </p>
              ) : (
                <div className="mb-4 p-3 rounded-lg bg-white/70 dark:bg-gray-950/50 border border-amber-400/70 dark:border-amber-500/70 text-sm text-amber-950 dark:text-amber-50">
                  Falta número válido no campo «{financeApprovalField}» deste chamado. A ação de aprovação/rejeição não
                  pode prosseguir até o formulário estar correto na abertura — peça ao solicitante para reabrir ou
                  corrigir os dados conforme política da organização.
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleFinanceApprove}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4" />{' '}
                  {ticket.category?.approval_type === 'finance_card'
                    ? 'Aprovar e registrar assinatura'
                    : 'Aprovar despesa'}
                </button>
                <button
                  type="button"
                  onClick={handleFinanceReject}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  <XCircle className="w-4 h-4" /> Rejeitar
                </button>
              </div>
            </div>
          )}

          {/* Botão para finalizar chamado (para atendentes e admins) — não se aplica ao fluxo cartão/assinatura */}
          {ticket.status === 'in_progress' &&
            (isAdmin || isAttendant) &&
            ticket.category?.approval_type !== 'finance_card' && (
            <div className="card p-6 border-2 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
              <div className="flex items-center space-x-2 mb-4">
                <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200">
                  Finalizar Chamado
                </h3>
              </div>
              <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">
                Quando o atendimento estiver concluído, finalize o chamado para solicitar aprovação do solicitante.
              </p>
              <button
                onClick={handleRequestApproval}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Finalizar Chamado</span>
              </button>
            </div>
          )}

          {/* Ticket Info */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Informações</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Criado por</label>
                <p className="mt-1 text-sm text-gray-900 dark:text-white">{ticket.user?.name || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Atendente</label>
                <p className="mt-1 text-sm text-gray-900 dark:text-white">{ticket.attendant?.name || 'Não atribuído'}</p>
              </div>
              {financeApprovals.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Aprovação financeira</label>
                  <ul className="mt-1 space-y-2 text-sm">
                    {financeApprovals.map((a) => (
                      <li key={a.id} className="text-gray-900 dark:text-white">
                        <span
                          className={
                            a.decision === 'approved'
                              ? 'font-medium text-green-700 dark:text-green-400'
                              : 'font-medium text-red-700 dark:text-red-400'
                          }
                        >
                          {a.decision === 'approved' ? 'Aprovado' : 'Rejeitado'}
                        </span>
                        {' · '}
                        {a.approver_name || `Utilizador #${a.approver_id}`}
                        {' · '}
                        <FormattedDate date={a.decided_at} />
                        {a.reason ? (
                          <span className="block text-xs text-gray-500 mt-0.5">Motivo: {a.reason}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-500">Criado em</label>
                <p className="mt-1 text-sm text-gray-900 dark:text-white">
                  <FormattedDate date={ticket.created_at} />
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Atualizado em</label>
                <p className="mt-1 text-sm text-gray-900 dark:text-white">
                  <FormattedDate date={ticket.updated_at} />
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {financeApproveCardOpen && ticket && (
        <Modal
          title="Aprovar assinatura digital"
          size="md"
          onClose={() => !financeApproveSubmitting && setFinanceApproveCardOpen(false)}
          closeOnOverlayClick={!financeApproveSubmitting}
        >
          <div className="space-y-4 text-sm">
            <p className="text-gray-600 dark:text-gray-400">
              Ciclo de faturamento efetivo, valor contratado e observações. Plataforma e credenciais usam os dados já
              informados pelo solicitante na abertura.
            </p>
            <div>
              <label className="block font-medium text-gray-700 dark:text-gray-200 mb-1">Ciclo de faturamento</label>
              <select
                className="input w-full dark:bg-gray-900"
                value={financeApproveCardCycle}
                onChange={(e) => setFinanceApproveCardCycle(e.target.value as BillingCycleOption)}
              >
                <option value="monthly">Mensal</option>
                <option value="annual">Anual</option>
                <option value="one_time">Pagamento único</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-gray-700 dark:text-gray-200 mb-1">
                Valor efetivo contratado <span className="text-red-500">*</span>
              </label>
              <input
                className="input w-full dark:bg-gray-900"
                inputMode="decimal"
                value={financeApproveCardAmount}
                onChange={(e) => setFinanceApproveCardAmount(e.target.value)}
                placeholder="Ex.: 199,90"
              />
            </div>
            <div>
              <label className="block font-medium text-gray-700 dark:text-gray-200 mb-1">Observações</label>
              <textarea
                className="input w-full dark:bg-gray-900"
                rows={3}
                value={financeApproveCardNotes}
                onChange={(e) => setFinanceApproveCardNotes(e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-600">
              <button
                type="button"
                disabled={financeApproveSubmitting}
                className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600"
                onClick={() => setFinanceApproveCardOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={financeApproveSubmitting}
                className="px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
                onClick={submitFinanceApproveCard}
              >
                {financeApproveSubmitting ? 'Processando…' : 'Confirmar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default TicketDetail;
