import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Edit, CheckCircle, XCircle, Clock, Send, User, ShoppingCart, History, Plus } from 'lucide-react';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '../../components/LoadingSpinner';
import FormattedDate from '../../components/FormattedDate';
import { useAuth } from '../../contexts/AuthContext';

interface SolicitacaoCompraItem {
  id: number;
  item_numero: number;
  descricao: string;
  quantidade: number;
  unidade_medida: string;
  valor_unitario: number;
  valor_total: number;
  observacoes?: string;
}

interface SolicitacaoCompra {
  id: number;
  numero_solicitacao: string;
  solicitante_id: number;
  comprador_id?: number;
  centro_custo?: string;
  descricao: string;
  justificativa?: string;
  status: string;
  prioridade: string;
  valor_total: number;
  data_necessidade?: string;
  observacoes?: string;
  created_at: string;
  updated_at: string;
  aprovada_em?: string;
  rejeitada_em?: string;
  itens?: SolicitacaoCompraItem[];
  solicitante?: {
    id: number;
    name: string;
    email: string;
  };
  comprador?: {
    id: number;
    name: string;
    email: string;
  };
  comprador_user_id?: number;
}

interface HistoricoItem {
  id: number;
  acao: string;
  descricao: string;
  created_at: string;
  usuario?: {
    id: number;
    name: string;
    email: string;
  };
}

interface Orcamento {
  id: number;
  fornecedor_nome: string;
  valor_total: number;
  status: string;
  created_at: string;
}

const SolicitacaoCompraDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, isAdmin } = useAuth();
  const [solicitacao, setSolicitacao] = useState<SolicitacaoCompra | null>(null);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [compradores, setCompradores] = useState<any[]>([]);
  const [showAprovacaoModal, setShowAprovacaoModal] = useState(false);
  const [showRejeicaoModal, setShowRejeicaoModal] = useState(false);
  const [showAtribuirCompradorModal, setShowAtribuirCompradorModal] = useState(false);
  const [aprovacaoObservacoes, setAprovacaoObservacoes] = useState('');
  const [rejeicaoMotivo, setRejeicaoMotivo] = useState('');
  const [compradorSelecionado, setCompradorSelecionado] = useState<number | ''>('');
  const [showAprovacaoOrcamentoModal, setShowAprovacaoOrcamentoModal] = useState(false);
  const [showRejeicaoOrcamentoModal, setShowRejeicaoOrcamentoModal] = useState(false);
  const [showDevolverOrcamentoModal, setShowDevolverOrcamentoModal] = useState(false);
  const [orcamentoSelecionado, setOrcamentoSelecionado] = useState<number | null>(null);
  const [aprovacaoOrcamentoObservacoes, setAprovacaoOrcamentoObservacoes] = useState('');
  const [rejeicaoOrcamentoMotivo, setRejeicaoOrcamentoMotivo] = useState('');
  const [devolverOrcamentoMotivo, setDevolverOrcamentoMotivo] = useState('');

  useEffect(() => {
    if (id) {
      fetchSolicitacao();
      fetchHistorico();
      fetchOrcamentos();
      if (isAdmin) {
        fetchCompradores();
      }
    }
  }, [id, isAdmin]);

  const fetchSolicitacao = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/solicitacoes-compra/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Erro ao carregar solicitação');

      const data = await response.json();
      setSolicitacao(data.data.solicitacao);
    } catch (error) {
      toast.error('Erro ao carregar solicitação');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistorico = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/solicitacoes-compra/${id}/historico`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setHistorico(data.data.historico || []);
      }
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    }
  };

  const fetchOrcamentos = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/orcamentos/solicitacao/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setOrcamentos(data.data.orcamentos || []);
      }
    } catch (error) {
      console.error('Erro ao carregar orçamentos:', error);
    }
  };

  const fetchCompradores = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/compradores', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCompradores(data.data.compradores || []);
      }
    } catch (error) {
      console.error('Erro ao carregar compradores:', error);
    }
  };

  const handleAprovar = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/solicitacoes-compra/${id}/aprovar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          observacoes: aprovacaoObservacoes || undefined
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao aprovar');
      }

      toast.success('Solicitação aprovada com sucesso!');
      setShowAprovacaoModal(false);
      setAprovacaoObservacoes('');
      fetchSolicitacao();
      fetchHistorico();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao aprovar solicitação');
    }
  };

  const handleRejeitar = async () => {
    if (!rejeicaoMotivo.trim()) {
      toast.error('Informe o motivo da rejeição');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/solicitacoes-compra/${id}/rejeitar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          motivo: rejeicaoMotivo
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao rejeitar');
      }

      toast.success('Solicitação rejeitada');
      setShowRejeicaoModal(false);
      setRejeicaoMotivo('');
      fetchSolicitacao();
      fetchHistorico();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao rejeitar solicitação');
    }
  };

  const handleEnviarAprovacao = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/solicitacoes-compra/${id}/enviar-aprovacao`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao enviar para aprovação');
      }

      toast.success('Solicitação enviada para aprovação!');
      fetchSolicitacao();
      fetchHistorico();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao enviar para aprovação');
    }
  };

  const handleAtribuirComprador = async () => {
    if (!compradorSelecionado) {
      toast.error('Selecione um comprador');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/solicitacoes-compra/${id}/atribuir-comprador`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          comprador_id: compradorSelecionado
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao atribuir comprador');
      }

      toast.success('Comprador atribuído com sucesso!');
      setShowAtribuirCompradorModal(false);
      setCompradorSelecionado('');
      fetchSolicitacao();
      fetchHistorico();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao atribuir comprador');
    }
  };

  const handleAprovarOrcamento = async () => {
    if (!orcamentoSelecionado) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/orcamentos/${orcamentoSelecionado}/aprovar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          observacoes: aprovacaoOrcamentoObservacoes
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao aprovar orçamento');
      }

      toast.success('Orçamento aprovado!');
      setShowAprovacaoOrcamentoModal(false);
      setOrcamentoSelecionado(null);
      setAprovacaoOrcamentoObservacoes('');
      fetchSolicitacao();
      fetchOrcamentos();
      fetchHistorico();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao aprovar orçamento');
    }
  };

  const handleRejeitarOrcamento = async () => {
    if (!orcamentoSelecionado || !rejeicaoOrcamentoMotivo.trim()) {
      toast.error('Informe o motivo da rejeição');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/orcamentos/${orcamentoSelecionado}/rejeitar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          motivo: rejeicaoOrcamentoMotivo
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao rejeitar orçamento');
      }

      toast.success('Orçamento rejeitado!');
      setShowRejeicaoOrcamentoModal(false);
      setOrcamentoSelecionado(null);
      setRejeicaoOrcamentoMotivo('');
      fetchSolicitacao();
      fetchOrcamentos();
      fetchHistorico();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao rejeitar orçamento');
    }
  };

  const handleDevolverOrcamento = async () => {
    if (!orcamentoSelecionado || !devolverOrcamentoMotivo.trim()) {
      toast.error('Informe o motivo da devolução');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/orcamentos/${orcamentoSelecionado}/devolver`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          motivo: devolverOrcamentoMotivo
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao devolver orçamento');
      }

      toast.success('Orçamento devolvido para correção!');
      setShowDevolverOrcamentoModal(false);
      setOrcamentoSelecionado(null);
      setDevolverOrcamentoMotivo('');
      fetchSolicitacao();
      fetchOrcamentos();
      fetchHistorico();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao devolver orçamento');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'rascunho':
        return <Clock className="w-5 h-5 text-gray-500" />;
      case 'pendente_aprovacao':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'aprovada':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'rejeitada':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'em_cotacao':
        return <Clock className="w-5 h-5 text-blue-500" />;
      case 'comprada':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      rascunho: 'Rascunho',
      pendente_aprovacao: 'Pendente Aprovação',
      aprovada: 'Aprovada',
      rejeitada: 'Rejeitada',
      em_cotacao: 'Em Cotação',
      cotacao_recebida: 'Cotação Recebida',
      orcamento_aprovado: 'Orçamento Aprovado',
      orcamento_rejeitado: 'Orçamento Rejeitado',
      em_compra: 'Em Compra',
      comprada: 'Comprada',
      cancelada: 'Cancelada',
      devolvida: 'Devolvida'
    };
    return statusMap[status] || status;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgente':
        return 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300';
      case 'alta':
        return 'bg-orange-100 dark:bg-orange-900/20 text-orange-800 dark:text-orange-300';
      case 'normal':
        return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300';
      case 'baixa':
        return 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
    }
  };

  const getPriorityText = (priority: string) => {
    const priorityMap: Record<string, string> = {
      urgente: 'Urgente',
      alta: 'Alta',
      normal: 'Normal',
      baixa: 'Baixa'
    };
    return priorityMap[priority] || priority;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!solicitacao) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-400">Solicitação não encontrada</p>
        <Link to="/compras/solicitacoes" className="btn btn-primary mt-4">
          Voltar para Solicitações
        </Link>
      </div>
    );
  }

  const canEdit = solicitacao.status === 'rascunho' && (isAdmin || solicitacao.solicitante_id === user?.id);
  const canApprove = solicitacao.status === 'pendente_aprovacao' && isAdmin;
  const canReject = solicitacao.status === 'pendente_aprovacao' && isAdmin;
  const canSendToApproval = solicitacao.status === 'rascunho' && (isAdmin || solicitacao.solicitante_id === user?.id);
  const canAssignBuyer = solicitacao.status === 'aprovada' && isAdmin;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            to="/compras/solicitacoes"
            className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar para Solicitações
          </Link>
          
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {solicitacao.numero_solicitacao}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">{solicitacao.descricao}</p>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                {getStatusIcon(solicitacao.status)}
                <span className="text-lg font-medium text-gray-900 dark:text-white">
                  {getStatusText(solicitacao.status)}
                </span>
              </div>
              <span className={`px-3 py-1 text-sm font-semibold rounded-full ${getPriorityColor(solicitacao.prioridade)}`}>
                {getPriorityText(solicitacao.prioridade)}
              </span>
            </div>
          </div>
        </div>

        {/* Ações */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap gap-3">
            {canEdit && (
              <Link
                to={`/compras/solicitacoes/${id}/editar`}
                className="btn btn-outline flex items-center space-x-2"
              >
                <Edit className="w-4 h-4" />
                <span>Editar</span>
              </Link>
            )}
            {canSendToApproval && (
              <button
                onClick={handleEnviarAprovacao}
                className="btn btn-primary flex items-center space-x-2"
              >
                <Send className="w-4 h-4" />
                <span>Enviar para Aprovação</span>
              </button>
            )}
            {canApprove && (
              <button
                onClick={() => setShowAprovacaoModal(true)}
                className="btn btn-success flex items-center space-x-2"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Aprovar</span>
              </button>
            )}
            {canReject && (
              <button
                onClick={() => setShowRejeicaoModal(true)}
                className="btn btn-danger flex items-center space-x-2"
              >
                <XCircle className="w-4 h-4" />
                <span>Rejeitar</span>
              </button>
            )}
            {canAssignBuyer && (
              <button
                onClick={() => setShowAtribuirCompradorModal(true)}
                className="btn btn-primary flex items-center space-x-2"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>Atribuir Comprador</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Conteúdo Principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Detalhes */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Detalhes da Solicitação</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Centro de Custo</label>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">
                    {solicitacao.centro_custo || 'Não informado'}
                  </p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Data de Necessidade</label>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">
                    {solicitacao.data_necessidade ? (
                      <FormattedDate date={solicitacao.data_necessidade} />
                    ) : (
                      'Não informada'
                    )}
                  </p>
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Descrição</label>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                    {solicitacao.descricao}
                  </p>
                </div>

                {solicitacao.justificativa && (
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Justificativa</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                      {solicitacao.justificativa}
                    </p>
                  </div>
                )}

                {solicitacao.observacoes && (
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Observações</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                      {solicitacao.observacoes}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Itens */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Itens da Solicitação</h2>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Item</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Descrição</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Quantidade</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Valor Unit.</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Valor Total</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {solicitacao.itens && solicitacao.itens.length > 0 ? (
                      solicitacao.itens.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{item.item_numero}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{item.descricao}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {item.quantidade} {item.unidade_medida}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            R$ {item.valor_unitario.toFixed(2).replace('.', ',')}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                            R$ {item.valor_total.toFixed(2).replace('.', ',')}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400">
                          Nenhum item encontrado
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-white">
                        Total:
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-white">
                        R$ {solicitacao.valor_total.toFixed(2).replace('.', ',')}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Orçamentos */}
            {orcamentos.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Orçamentos Recebidos</h2>
                
                <div className="space-y-4">
                  {orcamentos.map((orcamento) => (
                    <div key={orcamento.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900 dark:text-white">{orcamento.fornecedor_nome}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            Valor: R$ {orcamento.valor_total.toFixed(2).replace('.', ',')}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                            <FormattedDate date={orcamento.created_at} />
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            orcamento.status === 'aprovado' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' :
                            orcamento.status === 'rejeitado' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300' :
                            orcamento.status === 'devolvido' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300' :
                            'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                          }`}>
                            {orcamento.status === 'aprovado' ? 'Aprovado' :
                             orcamento.status === 'rejeitado' ? 'Rejeitado' :
                             orcamento.status === 'devolvido' ? 'Devolvido' :
                             'Pendente'}
                          </span>
                          <Link
                            to={`/compras/orcamentos/${orcamento.id}`}
                            className="px-3 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700"
                          >
                            Ver detalhes
                          </Link>
                          {(orcamento.status === 'pendente' || orcamento.status === 'devolvido') && 
                           (solicitacao?.solicitante_id === user?.id || isAdmin) && (
                            <div className="flex space-x-2">
                              <button
                                onClick={() => {
                                  setOrcamentoSelecionado(orcamento.id);
                                  setShowAprovacaoOrcamentoModal(true);
                                }}
                                className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                              >
                                Aprovar
                              </button>
                              <button
                                onClick={() => {
                                  setOrcamentoSelecionado(orcamento.id);
                                  setShowRejeicaoOrcamentoModal(true);
                                }}
                                className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                              >
                                Rejeitar
                              </button>
                              <button
                                onClick={() => {
                                  setOrcamentoSelecionado(orcamento.id);
                                  setShowDevolverOrcamentoModal(true);
                                }}
                                className="px-3 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700"
                              >
                                Devolver
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Botão para criar orçamento (apenas para comprador) */}
            {solicitacao?.status === 'em_cotacao' && solicitacao?.comprador_user_id === user?.id && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <Link
                  to={`/compras/solicitacoes/${id}/orcamento/novo`}
                  className="btn btn-primary inline-flex items-center"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Novo Orçamento
                </Link>
              </div>
            )}

            {/* Histórico */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <History className="w-5 h-5 mr-2" />
                Histórico
              </h2>
              
              <div className="space-y-4">
                {historico.length > 0 ? (
                  historico.map((item) => (
                    <div key={item.id} className="border-l-4 border-blue-500 pl-4 py-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{item.descricao}</p>
                          {item.usuario && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Por {item.usuario.name}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          <FormattedDate date={item.created_at} />
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum histórico disponível</p>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Informações */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Informações</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Solicitante</label>
                  <div className="mt-1 flex items-center space-x-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <p className="text-sm text-gray-900 dark:text-white">
                      {solicitacao.solicitante?.name || 'N/A'}
                    </p>
                  </div>
                </div>

                {solicitacao.comprador && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Comprador</label>
                    <div className="mt-1 flex items-center space-x-2">
                      <ShoppingCart className="w-4 h-4 text-gray-400" />
                      <p className="text-sm text-gray-900 dark:text-white">
                        {solicitacao.comprador.name}
                      </p>
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Criado em</label>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">
                    <FormattedDate date={solicitacao.created_at} />
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Atualizado em</label>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">
                    <FormattedDate date={solicitacao.updated_at} />
                  </p>
                </div>

                {solicitacao.aprovada_em && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Aprovada em</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      <FormattedDate date={solicitacao.aprovada_em} />
                    </p>
                  </div>
                )}

                {solicitacao.rejeitada_em && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Rejeitada em</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      <FormattedDate date={solicitacao.rejeitada_em} />
                    </p>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Valor Total</label>
                  <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">
                    R$ {solicitacao.valor_total.toFixed(2).replace('.', ',')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Aprovação */}
      {showAprovacaoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Aprovar Solicitação</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Observações (opcional)
                </label>
                <textarea
                  value={aprovacaoObservacoes}
                  onChange={(e) => setAprovacaoObservacoes(e.target.value)}
                  rows={3}
                  className="input w-full"
                  placeholder="Observações sobre a aprovação..."
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                  setShowAprovacaoModal(false);
                  setAprovacaoObservacoes('');
                }}
                  className="btn btn-outline"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAprovar}
                  className="btn btn-success"
                >
                  Aprovar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Rejeição */}
      {showRejeicaoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Rejeitar Solicitação</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Motivo da Rejeição *
                </label>
                <textarea
                  value={rejeicaoMotivo}
                  onChange={(e) => setRejeicaoMotivo(e.target.value)}
                  rows={3}
                  required
                  className="input w-full"
                  placeholder="Informe o motivo da rejeição..."
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowRejeicaoModal(false);
                    setRejeicaoMotivo('');
                  }}
                  className="btn btn-outline"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleRejeitar}
                  className="btn btn-danger"
                >
                  Rejeitar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Atribuir Comprador */}
      {showAtribuirCompradorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Atribuir Comprador</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Comprador *
                </label>
                <select
                  value={compradorSelecionado}
                  onChange={(e) => setCompradorSelecionado(e.target.value ? parseInt(e.target.value) : '')}
                  className="input w-full"
                  required
                >
                  <option value="">Selecione um comprador</option>
                  {compradores.filter(c => c.is_active).map((comprador) => (
                    <option key={comprador.id} value={comprador.id}>
                      {comprador.usuario?.name || 'N/A'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowAtribuirCompradorModal(false);
                    setCompradorSelecionado('');
                  }}
                  className="btn btn-outline"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAtribuirComprador}
                  className="btn btn-primary"
                >
                  Atribuir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Aprovar Orçamento */}
      {showAprovacaoOrcamentoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Aprovar Orçamento</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Observações (opcional)
                </label>
                <textarea
                  value={aprovacaoOrcamentoObservacoes}
                  onChange={(e) => setAprovacaoOrcamentoObservacoes(e.target.value)}
                  rows={3}
                  className="input w-full"
                  placeholder="Observações sobre a aprovação..."
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowAprovacaoOrcamentoModal(false);
                    setOrcamentoSelecionado(null);
                    setAprovacaoOrcamentoObservacoes('');
                  }}
                  className="btn btn-outline"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAprovarOrcamento}
                  className="btn btn-primary"
                >
                  Aprovar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Rejeitar Orçamento */}
      {showRejeicaoOrcamentoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Rejeitar Orçamento</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Motivo da Rejeição *
                </label>
                <textarea
                  value={rejeicaoOrcamentoMotivo}
                  onChange={(e) => setRejeicaoOrcamentoMotivo(e.target.value)}
                  rows={3}
                  className="input w-full"
                  placeholder="Informe o motivo da rejeição..."
                  required
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowRejeicaoOrcamentoModal(false);
                    setOrcamentoSelecionado(null);
                    setRejeicaoOrcamentoMotivo('');
                  }}
                  className="btn btn-outline"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleRejeitarOrcamento}
                  className="btn btn-danger"
                >
                  Rejeitar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Devolver Orçamento */}
      {showDevolverOrcamentoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Devolver Orçamento</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Motivo da Devolução *
                </label>
                <textarea
                  value={devolverOrcamentoMotivo}
                  onChange={(e) => setDevolverOrcamentoMotivo(e.target.value)}
                  rows={3}
                  className="input w-full"
                  placeholder="Informe o motivo da devolução e o que precisa ser corrigido..."
                  required
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowDevolverOrcamentoModal(false);
                    setOrcamentoSelecionado(null);
                    setDevolverOrcamentoMotivo('');
                  }}
                  className="btn btn-outline"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDevolverOrcamento}
                  className="btn btn-warning"
                >
                  Devolver
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SolicitacaoCompraDetail;

