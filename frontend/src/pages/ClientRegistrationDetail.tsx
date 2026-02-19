import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Building, Phone, Briefcase, DollarSign, Clock, FileText, AlertCircle, Mail, Globe, MapPin, RefreshCw, Calendar, X } from 'lucide-react';
import { ClientRegistration, ClientRegistrationHistory, UpdateClientRegistrationStatusRequest, AnaliseCredito } from '../types';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { ClientStatusBadge } from '../components/ClientStatusBadge';
import { ClientStatusTimeline } from '../components/ClientStatusTimeline';

export const ClientRegistrationDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [registration, setRegistration] = useState<ClientRegistration | null>(null);
  const [history, setHistory] = useState<ClientRegistrationHistory[]>([]);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusUpdate, setStatusUpdate] = useState<UpdateClientRegistrationStatusRequest>({
    status: 'cadastro_enviado',
    observacoes: '',
    prazo_aprovado: '',
    limite_aprovado: ''
  });
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [analiseCredito, setAnaliseCredito] = useState<AnaliseCredito | null>(null);
  const [loadingAnalise, setLoadingAnalise] = useState(false);
  const [showFinancialModal, setShowFinancialModal] = useState(false);
  const [financialData, setFinancialData] = useState({
    condicao_pagamento_id: '',
    limite_credito: '',
    codigo_carteira: '',
    codigo_forma_cobranca: ''
  });
  const [savingFinancial, setSavingFinancial] = useState(false);
  // Tipo simplificado para condições de pagamento do Atak
  interface CondicaoPagamentoAtak {
    id: string;
    nome: string;
    descricao?: string;
  }
  const [condicoesPagamento, setCondicoesPagamento] = useState<CondicaoPagamentoAtak[]>([]);
  const [loadingCondicoes, setLoadingCondicoes] = useState(false);
  const [showCondicoesDropdown, setShowCondicoesDropdown] = useState(false);
  const [condicaoPagamentoInput, setCondicaoPagamentoInput] = useState('');
  const [showAtakModal, setShowAtakModal] = useState(false);
  const [atakData, setAtakData] = useState<any>(null);
  const [loadingAtak, setLoadingAtak] = useState(false);
  const atakResposta = React.useMemo(() => {
    if (!registration?.atak_resposta_json) return null;
    try {
      return JSON.parse(registration.atak_resposta_json as any);
    } catch {
      return null;
    }
  }, [registration]);

  // Função para normalizar caminhos de imagens
  const normalizeImagePath = (path: string | undefined): string => {
    if (!path) return '';
    // Converte barras invertidas em barras normais
    const normalized = path.replace(/\\/g, '/');
    // Garante que comece com /
    return normalized.startsWith('/') ? normalized : `/${normalized}`;
  };

  useEffect(() => {
    if (id) {
      loadRegistration();
    }
  }, [id]);

  // Buscar análise de crédito quando registration carregar
  useEffect(() => {
    if (registration && (user?.role === 'admin' || user?.role === 'attendant')) {
      loadAnaliseCredito();
      // Carregar dados financeiros existentes (se houver)
      // Os valores de carteira e forma de cobrança serão buscados do banco automaticamente
      setFinancialData({
        condicao_pagamento_id: registration.condicao_pagamento_id || '',
        limite_credito: registration.limite_credito ? registration.limite_credito.toString() : '',
        codigo_carteira: '', // Será buscado do banco automaticamente
        codigo_forma_cobranca: '' // Será buscado do banco automaticamente
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registration, user?.role]);

  const loadRegistration = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await apiService.getClientRegistration(parseInt(id!));
      setRegistration(result.registration);
      setHistory(result.history);
    } catch (err) {
      setError('Erro ao carregar cadastro de cliente');
      console.error('Erro ao carregar cadastro:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async () => {
    try {
      setLoading(true);
      await apiService.updateClientRegistrationStatus(parseInt(id!), statusUpdate);
      setShowStatusModal(false);
      loadRegistration(); // Recarregar dados
    } catch (err) {
      setError('Erro ao atualizar status');
      console.error('Erro ao atualizar status:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAnaliseCredito = async () => {
    if (!registration?.cnpj) return;
    
    try {
      setLoadingAnalise(true);
      const data = await apiService.getAnaliseCredito(registration.cnpj);
      setAnaliseCredito(data);
    } catch (err) {
      console.error('Erro ao carregar análise de crédito:', err);
      setAnaliseCredito(null);
    } finally {
      setLoadingAnalise(false);
    }
  };

  const loadCondicoesPagamento = async () => {
    try {
      setLoadingCondicoes(true);
      const condicoes = await apiService.getCondicoesPagamentoAtak();
      // Converter para formato esperado pelo select
      // O ID da condição é o valor que será enviado ao Atak
      const condicoesFormatted: CondicaoPagamentoAtak[] = condicoes.map((cond: { id: string; nome: string; descricao?: string }) => ({
        id: cond.id, // ID da condição (será usado como value)
        nome: cond.nome || cond.descricao || cond.id, // Nome/descrição para exibição
        descricao: cond.descricao
      }));
      setCondicoesPagamento(condicoesFormatted);
      
      // Se já havia um valor selecionado, atualizar o input
      if (registration?.condicao_pagamento_id) {
        const condicaoAtual = condicoesFormatted.find(c => c.id === registration.condicao_pagamento_id);
        if (condicaoAtual) {
          setCondicaoPagamentoInput(`${condicaoAtual.id} - ${condicaoAtual.nome}`);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar condições de pagamento do Atak:', err);
      setCondicoesPagamento([]);
      alert('Erro ao carregar condições de pagamento do Atak. Verifique a conexão e tente novamente.');
    } finally {
      setLoadingCondicoes(false);
    }
  };

  const handleOpenFinancialModal = () => {
    setShowFinancialModal(true);
    // Inicializar o input com o valor atual se existir
    if (registration?.condicao_pagamento_id) {
      setCondicaoPagamentoInput(registration.condicao_pagamento_id);
    } else {
      setCondicaoPagamentoInput('');
    }
    loadCondicoesPagamento();
  };

  const handleOpenAtakModal = async () => {
    if (!id || !registration?.atak_cliente_id) {
      alert('Cliente ainda não foi cadastrado no Atak');
      return;
    }

    setShowAtakModal(true);
    setLoadingAtak(true);

    try {
      const data = await apiService.getAtakCustomerData(parseInt(id));
      setAtakData(data);
    } catch (err: any) {
      console.error('Erro ao buscar dados do Atak:', err);
      const errorMsg = err.response?.data?.message || err.response?.data?.error || 'Erro ao buscar dados do Atak';
      alert(errorMsg);
      setShowAtakModal(false);
    } finally {
      setLoadingAtak(false);
    }
  };

  const handleSaveFinancialData = async () => {
    if (!id) return;

    // Validar se tem atak_cliente_id
    if (!registration?.atak_cliente_id) {
      alert('Cliente ainda não foi cadastrado no Atak. Complete o cadastro antes de definir condições financeiras.');
      return;
    }

    // Validar condição de pagamento
    if (!financialData.condicao_pagamento_id && !condicaoPagamentoInput.trim()) {
      alert('Por favor, selecione ou digite uma condição de pagamento.');
      return;
    }

    // Se o usuário digitou mas não selecionou, tentar encontrar o código
    let condicaoId = financialData.condicao_pagamento_id;
    if (!condicaoId && condicaoPagamentoInput.trim()) {
      // Tentar extrair o código do início do input (formato: "CODIGO - Nome")
      const match = condicaoPagamentoInput.match(/^(\d+)\s*-/);
      if (match) {
        condicaoId = match[1];
      } else {
        // Tentar encontrar pelo nome ou código completo
        const matchingCondicao = condicoesPagamento.find(c => 
          c.id === condicaoPagamentoInput.trim() ||
          c.nome.toLowerCase() === condicaoPagamentoInput.toLowerCase().trim() ||
          `${c.id} - ${c.nome}`.toLowerCase() === condicaoPagamentoInput.toLowerCase().trim()
        );
        if (matchingCondicao) {
          condicaoId = matchingCondicao.id;
        } else {
          // Se não encontrou, usar o valor digitado como código
          condicaoId = condicaoPagamentoInput.trim();
        }
      }
    }

    try {
      setSavingFinancial(true);
      
      const data = {
        condicao_pagamento_id: condicaoId || undefined,
        limite_credito: financialData.limite_credito ? parseFloat(financialData.limite_credito.replace(/[^\d,.-]/g, '').replace(',', '.')) : undefined,
        codigo_carteira: financialData.codigo_carteira ? financialData.codigo_carteira : undefined,
        codigo_forma_cobranca: financialData.codigo_forma_cobranca ? financialData.codigo_forma_cobranca : undefined
      };

      await apiService.updateClientFinancialData(parseInt(id), data);
      
      setShowFinancialModal(false);
      loadRegistration(); // Recarregar dados
      
      // Mostrar mensagem de sucesso
      alert('Condições financeiras definidas com sucesso!');
    } catch (err: any) {
      console.error('Erro ao salvar dados financeiros:', err);
      
      let errorMsg = 'Erro ao salvar dados financeiros';
      
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        errorMsg = 'A requisição está demorando mais que o esperado. Os dados podem ter sido salvos no banco, mas a atualização no Atak pode ainda estar em andamento. Verifique os logs do servidor.';
      } else if (err.response?.data?.warning) {
        // Se houver warning (como quando o Atak não está configurado), mostrar mensagem mais amigável
        errorMsg = `Dados financeiros salvos no sistema. ${err.response.data.warning}`;
      } else if (err.response?.data?.message) {
        errorMsg = err.response.data.message;
      } else if (err.response?.data?.error) {
        errorMsg = err.response.data.error;
      } else if (err.message) {
        errorMsg = err.message;
      }
      
      alert(errorMsg);
    } finally {
      setSavingFinancial(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCNPJ = (cnpj: string) => {
    return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  };

  const [reprocessing, setReprocessing] = useState(false);

  const handleReprocess = async () => {
    if (!id || !registration) return;
    
    if (!window.confirm('Deseja realmente reprocessar este cadastro? Isso irá reiniciar a consulta SPC, TESS, CNPJÁ e o cadastro no Atak.')) {
      return;
    }

    try {
      setReprocessing(true);
      await apiService.reprocessClientRegistration(parseInt(id));
      alert('Cadastro adicionado à fila de reprocessamento com sucesso!');
      // Recarregar após um pequeno delay
      setTimeout(() => {
        loadRegistration();
      }, 2000);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erro ao reprocessar cadastro');
      console.error('Erro ao reprocessar:', err);
    } finally {
      setReprocessing(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !registration) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">Erro</h3>
        <p className="mt-1 text-sm text-gray-500">{error || 'Cadastro não encontrado'}</p>
        <div className="mt-6">
          <button
            onClick={() => navigate('/client-registrations')}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para Lista
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/client-registrations')}
            className="p-2 text-gray-400 hover:text-gray-600"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{registration.nome_cliente}</h1>
            <p className="mt-1 text-sm text-gray-500">
              Cadastro criado em {formatDate(registration.created_at)}
            </p>
          </div>
        </div>
        <div className="flex space-x-3">
          <ClientStatusBadge status={registration.status} />
          <button
            onClick={() => navigate(`/client-registrations/${id}/edit`)}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Edit className="h-4 w-4 mr-2" />
            Editar
          </button>
          {user?.role === 'admin' && (
            <>
              <button
                onClick={() => setShowStatusModal(true)}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Edit className="h-4 w-4 mr-2" />
                Atualizar Status
              </button>
              <button
                onClick={handleReprocess}
                disabled={reprocessing}
                className="inline-flex items-center px-3 py-2 border border-orange-300 text-sm leading-4 font-medium rounded-md text-orange-700 bg-orange-50 hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Reprocessar consulta SPC, TESS, CNPJÁ e cadastro Atak"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${reprocessing ? 'animate-spin' : ''}`} />
                Reprocessar
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Informações Principais */}
        <div className="lg:col-span-2 space-y-6">
          {/* Informações Básicas */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center mb-4">
              <Building className="h-5 w-5 text-blue-600 mr-2" />
              <h2 className="text-lg font-medium text-gray-900">Informações Básicas</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nome do Cliente</label>
                <p className="mt-1 text-sm text-gray-900">{registration.nome_cliente}</p>
              </div>
              
              {registration.nome_fantasia && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nome Fantasia</label>
                  <p className="mt-1 text-sm text-gray-900">{registration.nome_fantasia}</p>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700">CNPJ</label>
                <p className="mt-1 text-sm text-gray-900">{formatCNPJ(registration.cnpj)}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <p className="mt-1 text-sm text-gray-900 flex items-center">
                  <Mail className="h-4 w-4 mr-2 text-gray-400" />
                  {registration.email}
                </p>
              </div>
            </div>
          </div>

          {/* Configurações Comerciais */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center mb-4">
              <Briefcase className="h-5 w-5 text-green-600 mr-2" />
              <h2 className="text-lg font-medium text-gray-900">Configurações Comerciais</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">Ramo de Atividade</label>
                <p className="mt-1 text-sm text-gray-900">{registration.ramo_atividade_nome}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Vendedor</label>
                <p className="mt-1 text-sm text-gray-900">{registration.vendedor_nome}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Gestor</label>
                <p className="mt-1 text-sm text-gray-900">{registration.gestor_nome}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Código da Carteira</label>
                <p className="mt-1 text-sm text-gray-900">{registration.codigo_carteira_nome}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Lista de Preço</label>
                <p className="mt-1 text-sm text-gray-900">{registration.lista_preco_nome}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Forma de Pagamento Desejada</label>
                <p className="mt-1 text-sm text-gray-900">{registration.forma_pagamento_desejada_nome}</p>
              </div>
            </div>
          </div>

          {/* Informações Adicionais */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center mb-4">
              <DollarSign className="h-5 w-5 text-purple-600 mr-2" />
              <h2 className="text-lg font-medium text-gray-900">Informações Adicionais</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {registration.prazo_desejado && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Prazo Desejado</label>
                  <p className="mt-1 text-sm text-gray-900">{registration.prazo_desejado} dias</p>
                </div>
              )}
              
              {registration.periodicidade_pedido && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Periodicidade de Pedido</label>
                  <p className="mt-1 text-sm text-gray-900">{registration.periodicidade_pedido}</p>
                </div>
              )}
              
              {registration.valor_estimado_pedido && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Valor Estimado de Pedido</label>
                  <p className="mt-1 text-sm text-gray-900">{formatCurrency(registration.valor_estimado_pedido)}</p>
                </div>
              )}
              
              {registration.forma_contato && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Forma de Contato</label>
                  <p className="mt-1 text-sm text-gray-900">{registration.forma_contato}</p>
                </div>
              )}
            </div>
          </div>

          {/* Contato e Redes Sociais */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center mb-4">
              <Phone className="h-5 w-5 text-orange-600 mr-2" />
              <h2 className="text-lg font-medium text-gray-900">Contato e Redes Sociais</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {registration.whatsapp_cliente && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">WhatsApp</label>
                  <p className="mt-1 text-sm text-gray-900 flex items-center">
                    <Phone className="h-4 w-4 mr-2 text-gray-400" />
                    {registration.whatsapp_cliente}
                  </p>
                </div>
              )}
              
              {registration.rede_social && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Rede Social</label>
                  <p className="mt-1 text-sm text-gray-900 flex items-center">
                    <Globe className="h-4 w-4 mr-2 text-gray-400" />
                    {registration.rede_social}
                  </p>
                </div>
              )}
              
              {registration.link_google_maps && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Link do Google Maps</label>
                  <a
                    href={registration.link_google_maps}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 text-sm text-blue-600 hover:text-blue-800 flex items-center"
                  >
                    <MapPin className="h-4 w-4 mr-2" />
                    Ver no Google Maps
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Imagens e Anexos */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center mb-4">
              <FileText className="h-5 w-5 text-indigo-600 mr-2" />
              <h2 className="text-lg font-medium text-gray-900">Imagens e Anexos</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Imagem Externa</label>
                <img
                  src={normalizeImagePath(registration.imagem_externa_path)}
                  alt="Imagem externa"
                  className="w-full h-48 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-75 transition-opacity"
                  onClick={() => setSelectedImage(normalizeImagePath(registration.imagem_externa_path))}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Imagem Interna</label>
                <img
                  src={normalizeImagePath(registration.imagem_interna_path)}
                  alt="Imagem interna"
                  className="w-full h-48 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-75 transition-opacity"
                  onClick={() => setSelectedImage(normalizeImagePath(registration.imagem_interna_path))}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
              
              {registration.anexos_path && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Anexos</label>
                  <div className="space-y-2">
                    {registration.anexos_path.split(',').map((path, index) => {
                      const normalizedPath = normalizeImagePath(path);
                      const fileName = path.split(/[/\\]/).pop() || '';
                      const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName);
                      
                      return (
                        <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                          <span className="text-sm text-gray-700">{fileName}</span>
                          {isImage ? (
                            <button
                              onClick={() => setSelectedImage(normalizedPath)}
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                            >
                              Visualizar
                            </button>
                          ) : (
                            <a
                              href={normalizedPath}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 text-sm"
                            >
                              Baixar
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Timeline do Status */}
        <div className="lg:col-span-1">
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center mb-4">
              <Clock className="h-5 w-5 text-gray-600 mr-2" />
              <h2 className="text-lg font-medium text-gray-900">Histórico de Status</h2>
            </div>
            <ClientStatusTimeline history={history} />
          </div>
        </div>
      </div>

      {/* Bloco Resposta do Atak (antes da Análise de Crédito) */}
      {(registration?.atak_cliente_id || registration?.atak_resposta_json || registration?.atak_erro) && (
        <div className="mt-6">
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center mb-4">
              <FileText className="h-5 w-5 text-blue-600 mr-2" />
              <h2 className="text-lg font-medium text-gray-900">Resposta do Atak</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-gray-500">Cliente ID</div>
                <div className="text-sm font-medium text-gray-900">{registration.atak_cliente_id || (atakResposta?.ID || atakResposta?.id) || '-'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Tipo de Cadastro</div>
                <div className="text-sm font-medium text-gray-900">{atakResposta?.tipoDeCadastro || '-'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Situação</div>
                <div className="text-sm font-medium text-gray-900">{atakResposta?.situacaoDocadastro || atakResposta?.situacao || '-'}</div>
              </div>
            </div>
            {registration.atak_erro && (
              <div className="mt-4 flex items-start text-red-600">
                <AlertCircle className="h-4 w-4 mt-0.5 mr-2" />
                <span className="text-sm">{registration.atak_erro}</span>
              </div>
            )}
            {registration.atak_resposta_json && (
              <details className="mt-4">
                <summary className="text-sm text-gray-600 cursor-pointer">Ver JSON completo</summary>
                <pre className="mt-2 bg-gray-50 p-3 rounded text-xs overflow-auto">{registration.atak_resposta_json}</pre>
              </details>
            )}
          </div>
        </div>
      )}

      {/* Seção de Análise de Crédito - Apenas para Admin e Atendentes */}
      {(user?.role === 'admin' || user?.role === 'attendant') && (
        <div className="mt-6">
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <DollarSign className="h-5 w-5 text-green-600 mr-2" />
                <h2 className="text-lg font-medium text-gray-900">Análise de Crédito</h2>
                {loadingAnalise && (
                  <div className="ml-4 animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                )}
              </div>
              {registration?.atak_cliente_id && (
                <div className="flex gap-2">
                  <button
                    onClick={handleOpenFinancialModal}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Definir Prazo
                  </button>
                  <button
                    onClick={handleOpenAtakModal}
                    className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium"
                  >
                    <Building className="h-4 w-4 mr-2" />
                    Cadastro ATAK
                  </button>
                </div>
              )}
            </div>

            {loadingAnalise ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-sm text-gray-500">Carregando análise de crédito...</p>
              </div>
            ) : !analiseCredito ? (
              <div className="text-center py-8">
                <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm text-gray-500">Nenhuma análise de crédito disponível para este CNPJ</p>
                <p className="mt-1 text-xs text-gray-400">Certifique-se de que a consulta foi processada completamente</p>
                <button
                  onClick={loadAnaliseCredito}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                >
                  Tentar Novamente
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Dados Básicos */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">CNPJ</label>
                    <p className="mt-1 text-sm text-gray-900">{analiseCredito.cnpj}</p>
                  </div>
                  {analiseCredito.inscricao_estadual && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Inscrição Estadual</label>
                      <p className="mt-1 text-sm text-gray-900">{analiseCredito.inscricao_estadual}</p>
                    </div>
                  )}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Razão Social</label>
                    <p className="mt-1 text-sm text-gray-900">{analiseCredito.razao_social}</p>
                  </div>
                  {analiseCredito.nome_fantasia && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">Nome Fantasia</label>
                      <p className="mt-1 text-sm text-gray-900">{analiseCredito.nome_fantasia}</p>
                    </div>
                  )}
                  {analiseCredito.situacao_cnpj && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Situação CNPJ</label>
                      <p className="mt-1 text-sm text-gray-900">{analiseCredito.situacao_cnpj}</p>
                    </div>
                  )}
                </div>

                {/* Dados de Contato */}
                {analiseCredito.contato && (analiseCredito.contato.telefones && analiseCredito.contato.telefones.length > 0 || analiseCredito.contato.emails && analiseCredito.contato.emails.length > 0) && (
                  <div className="border-t pt-4">
                    <h3 className="text-md font-medium text-gray-900 mb-2">Contato</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {analiseCredito.contato.telefones && analiseCredito.contato.telefones.length > 0 && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Telefones</label>
                          <div className="mt-1 space-y-1">
                            {analiseCredito.contato.telefones.map((telefone, index) => (
                              <p key={index} className="text-sm text-gray-900">{telefone}</p>
                            ))}
                          </div>
                        </div>
                      )}
                      {analiseCredito.contato.emails && analiseCredito.contato.emails.length > 0 && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">E-mails</label>
                          <div className="mt-1 space-y-1">
                            {analiseCredito.contato.emails.map((email, index) => (
                              <p key={index} className="text-sm text-gray-900">{email}</p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Endereço */}
                {analiseCredito.endereco && (
                  <div className="border-t pt-4">
                    <h3 className="text-md font-medium text-gray-900 mb-2">Endereço</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {analiseCredito.endereco.logradouro && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Logradouro</label>
                          <p className="mt-1 text-sm text-gray-900">{analiseCredito.endereco.logradouro}</p>
                        </div>
                      )}
                      {analiseCredito.endereco.numero && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Número</label>
                          <p className="mt-1 text-sm text-gray-900">{analiseCredito.endereco.numero}</p>
                        </div>
                      )}
                      {analiseCredito.endereco.complemento && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Complemento</label>
                          <p className="mt-1 text-sm text-gray-900">{analiseCredito.endereco.complemento}</p>
                        </div>
                      )}
                      {analiseCredito.endereco.bairro && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Bairro</label>
                          <p className="mt-1 text-sm text-gray-900">{analiseCredito.endereco.bairro}</p>
                        </div>
                      )}
                      {analiseCredito.endereco.cidade && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Cidade</label>
                          <p className="mt-1 text-sm text-gray-900">{analiseCredito.endereco.cidade}</p>
                        </div>
                      )}
                      {analiseCredito.endereco.estado && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Estado</label>
                          <p className="mt-1 text-sm text-gray-900">{analiseCredito.endereco.estado}</p>
                        </div>
                      )}
                      {analiseCredito.endereco.cep && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">CEP</label>
                          <p className="mt-1 text-sm text-gray-900">{analiseCredito.endereco.cep}</p>
                        </div>
                      )}
                      {(analiseCredito.endereco.longitude !== undefined && analiseCredito.endereco.latitude !== undefined) && (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Longitude</label>
                            <p className="mt-1 text-sm text-gray-900">{analiseCredito.endereco.longitude}</p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Latitude</label>
                            <p className="mt-1 text-sm text-gray-900">{analiseCredito.endereco.latitude}</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Score de Crédito */}
                {analiseCredito.score_credito && (
                  <div className="border-t pt-4">
                    <h3 className="text-md font-medium text-gray-900 mb-2">Score de Crédito</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {analiseCredito.score_credito.score !== undefined && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Score</label>
                          <p className="mt-1 text-sm text-gray-900">{analiseCredito.score_credito.score}</p>
                        </div>
                      )}
                      {analiseCredito.score_credito.risco && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Risco</label>
                          <p className="mt-1 text-sm text-gray-900">{analiseCredito.score_credito.risco}</p>
                        </div>
                      )}
                      {analiseCredito.score_credito.probabilidade_inadimplencia !== undefined && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Probabilidade Inadimplência</label>
                          <p className="mt-1 text-sm text-gray-900">{analiseCredito.score_credito.probabilidade_inadimplencia}%</p>
                        </div>
                      )}
                      {analiseCredito.score_credito.limite_credito_valor !== undefined && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Limite de Crédito</label>
                          <p className="mt-1 text-sm text-gray-900">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(analiseCredito.score_credito.limite_credito_valor)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Sócios */}
                {(analiseCredito.socios && analiseCredito.socios.length > 0) && (
                  <div className="border-t pt-4">
                    <h3 className="text-md font-medium text-gray-900 mb-2">Sócios</h3>
                    <div className="space-y-2">
                      {analiseCredito.socios.map((socio, index) => (
                        <div key={index} className="bg-gray-50 p-3 rounded-lg">
                          <p className="text-sm font-medium text-gray-900">{socio.nome}</p>
                          <p className="text-xs text-gray-500">CPF: {socio.cpf}</p>
                          {socio.entrada && (
                            <p className="text-xs text-gray-500">
                              Entrada: {new Date(socio.entrada).toLocaleDateString('pt-BR')}
                            </p>
                          )}
                          {socio.cargo && <p className="text-xs text-gray-500">Cargo: {socio.cargo}</p>}
                          {socio.percentual_participacao !== undefined && (
                            <p className="text-xs text-gray-500">Participação: {socio.percentual_participacao}%</p>
                          )}
                          {socio.valor_participacao !== undefined && (
                            <p className="text-xs text-gray-500">
                              Valor: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(socio.valor_participacao)}
                            </p>
                          )}
                          {socio.participacao !== undefined && (
                            <p className="text-xs text-gray-500">
                              Participação Valor: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(socio.participacao)}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(analiseCredito.quadro_administrativo && analiseCredito.quadro_administrativo.length > 0) && (
                  <div className="border-t pt-4">
                    <h3 className="text-md font-medium text-gray-900 mb-2">Quadro Administrativo</h3>
                    <div className="space-y-2">
                      {analiseCredito.quadro_administrativo.map((admin, index) => (
                        <div key={index} className="bg-gray-50 p-3 rounded-lg">
                          <p className="text-sm font-medium text-gray-900">{admin.nome}</p>
                          <p className="text-xs text-gray-500">CPF: {admin.cpf}</p>
                          {admin.cargo && <p className="text-xs text-gray-500">Cargo: {admin.cargo}</p>}
                          {admin.eleito_em && (
                            <p className="text-xs text-gray-500">
                              Eleito em: {new Date(admin.eleito_em).toLocaleDateString('pt-BR')}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Ocorrências */}
                {analiseCredito.ocorrencias && (
                  <div className="border-t pt-4">
                    <h3 className="text-md font-medium text-gray-900 mb-2">Ocorrências e Histórico</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {analiseCredito.ocorrencias.score_pj !== undefined && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Score PJ</label>
                          <p className="mt-1 text-sm text-gray-900">{analiseCredito.ocorrencias.score_pj}</p>
                        </div>
                      )}
                      {analiseCredito.ocorrencias.historico_scr !== undefined && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Histórico SCR</label>
                          <p className="mt-1 text-sm text-gray-900">{analiseCredito.ocorrencias.historico_scr} ocorrências</p>
                        </div>
                      )}
                      {analiseCredito.ocorrencias.historico_pagamentos_positivo !== undefined && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Histórico Pagamentos Positivos</label>
                          <p className="mt-1 text-sm text-gray-900">{analiseCredito.ocorrencias.historico_pagamentos_positivo} pagamentos</p>
                        </div>
                      )}
                      {analiseCredito.ocorrencias.limite_credito_pj !== undefined && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Limite de Crédito PJ</label>
                          <p className="mt-1 text-sm text-gray-900">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(analiseCredito.ocorrencias.limite_credito_pj)}
                          </p>
                        </div>
                      )}
                      {analiseCredito.ocorrencias.consultas_realizadas !== undefined && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Consultas Realizadas</label>
                          <p className="mt-1 text-sm text-gray-900">{analiseCredito.ocorrencias.consultas_realizadas} consultas</p>
                        </div>
                      )}
                      {analiseCredito.ocorrencias.gasto_financeiro_estimado !== undefined && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Gasto Financeiro Estimado</label>
                          <p className="mt-1 text-sm text-gray-900">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(analiseCredito.ocorrencias.gasto_financeiro_estimado)}
                          </p>
                        </div>
                      )}
                      {analiseCredito.ocorrencias.controle_societario !== undefined && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Controle Societário</label>
                          <p className="mt-1 text-sm text-gray-900">{analiseCredito.ocorrencias.controle_societario === 1 ? 'Sim' : 'Não'}</p>
                        </div>
                      )}
                      {analiseCredito.ocorrencias.quadro_administrativo !== undefined && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Quadro Administrativo</label>
                          <p className="mt-1 text-sm text-gray-900">{analiseCredito.ocorrencias.quadro_administrativo} registros</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Histórico de Pagamento Positivo */}
                {analiseCredito.historico_pagamento && (
                  <div className="border-t pt-4">
                    <h3 className="text-md font-medium text-gray-900 mb-2">Histórico de Pagamento</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {analiseCredito.historico_pagamento.compromissos_ativos && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Compromissos Ativos</label>
                          <p className="mt-1 text-sm text-gray-900">{analiseCredito.historico_pagamento.compromissos_ativos}</p>
                        </div>
                      )}
                      {analiseCredito.historico_pagamento.contratos_ativos !== undefined && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Contratos Ativos</label>
                          <p className="mt-1 text-sm text-gray-900">{analiseCredito.historico_pagamento.contratos_ativos}</p>
                        </div>
                      )}
                      {analiseCredito.historico_pagamento.credores !== undefined && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Credores</label>
                          <p className="mt-1 text-sm text-gray-900">{analiseCredito.historico_pagamento.credores}</p>
                        </div>
                      )}
                      {analiseCredito.historico_pagamento.parcelas_a_vencer_percentual !== undefined && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Parcelas a Vencer (%)</label>
                          <p className="mt-1 text-sm text-gray-900">{analiseCredito.historico_pagamento.parcelas_a_vencer_percentual}%</p>
                        </div>
                      )}
                      {analiseCredito.historico_pagamento.parcelas_pagas_percentual !== undefined && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Parcelas Pagas (%)</label>
                          <p className="mt-1 text-sm text-gray-900">{analiseCredito.historico_pagamento.parcelas_pagas_percentual}%</p>
                        </div>
                      )}
                      {analiseCredito.historico_pagamento.parcelas_abertas_percentual !== undefined && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Parcelas Abertas (%)</label>
                          <p className="mt-1 text-sm text-gray-900">{analiseCredito.historico_pagamento.parcelas_abertas_percentual}%</p>
                        </div>
                      )}
                      {analiseCredito.historico_pagamento.contratos_pagos && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Contratos Pagos</label>
                          <p className="mt-1 text-sm text-gray-900">{analiseCredito.historico_pagamento.contratos_pagos}</p>
                        </div>
                      )}
                      {analiseCredito.historico_pagamento.contratos_abertos && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Contratos Abertos</label>
                          <p className="mt-1 text-sm text-gray-900">{analiseCredito.historico_pagamento.contratos_abertos}</p>
                        </div>
                      )}
                      {analiseCredito.historico_pagamento.uso_cheque_especial !== undefined && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Uso Cheque Especial</label>
                          <p className="mt-1 text-sm text-gray-900">{analiseCredito.historico_pagamento.uso_cheque_especial ? 'Sim' : 'Não'}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* SCR */}
                {analiseCredito.scr && (
                  <div className="border-t pt-4">
                    <h3 className="text-md font-medium text-gray-900 mb-2">Dados SCR</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {analiseCredito.scr.quantidade_operacoes !== undefined && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Quantidade de Operações</label>
                          <p className="mt-1 text-sm text-gray-900">{analiseCredito.scr.quantidade_operacoes}</p>
                        </div>
                      )}
                      {analiseCredito.scr.inicio_relacionamento && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Início Relacionamento</label>
                          <p className="mt-1 text-sm text-gray-900">{new Date(analiseCredito.scr.inicio_relacionamento).toLocaleDateString('pt-BR')}</p>
                        </div>
                      )}
                      {analiseCredito.scr.valor_contratado && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Valor Contratado</label>
                          <p className="mt-1 text-sm text-gray-900">{analiseCredito.scr.valor_contratado}</p>
                        </div>
                      )}
                      {analiseCredito.scr.instituicoes !== undefined && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Instituições</label>
                          <p className="mt-1 text-sm text-gray-900">{analiseCredito.scr.instituicoes}</p>
                        </div>
                      )}
                      {analiseCredito.scr.carteira_ativa_total && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Carteira Ativa Total</label>
                          <p className="mt-1 text-sm text-gray-900">{analiseCredito.scr.carteira_ativa_total}</p>
                        </div>
                      )}
                      {analiseCredito.scr.vencimento_ultima_parcela && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Vencimento Última Parcela</label>
                          <p className="mt-1 text-sm text-gray-900">{analiseCredito.scr.vencimento_ultima_parcela}</p>
                        </div>
                      )}
                      {analiseCredito.scr.garantias_quantidade_maxima !== undefined && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Qtd. Máxima Garantias</label>
                          <p className="mt-1 text-sm text-gray-900">{analiseCredito.scr.garantias_quantidade_maxima}</p>
                        </div>
                      )}
                      {analiseCredito.scr.tipos_garantias && analiseCredito.scr.tipos_garantias.length > 0 && (
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700">Tipos de Garantia</label>
                          <div className="mt-1 flex flex-wrap gap-2">
                            {analiseCredito.scr.tipos_garantias.map((tipo, idx) => (
                              <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-md">
                                {tipo}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Consultas Realizadas */}
                {analiseCredito.consultas_realizadas && analiseCredito.consultas_realizadas.length > 0 && (
                  <div className="border-t pt-4">
                    <h3 className="text-md font-medium text-gray-900 mb-2">Histórico de Consultas Realizadas</h3>
                    <div className="space-y-2">
                      {analiseCredito.consultas_realizadas.map((consulta, index) => (
                        <div key={index} className="bg-gray-50 p-3 rounded-lg">
                          {consulta.data_hora && (
                            <p className="text-xs text-gray-500">
                              Data: {new Date(consulta.data_hora).toLocaleString('pt-BR')}
                            </p>
                          )}
                          {consulta.associado && (
                            <p className="text-sm text-gray-900">Associado: {consulta.associado}</p>
                          )}
                          {consulta.cidade && (
                            <p className="text-xs text-gray-500">Cidade: {consulta.cidade}</p>
                          )}
                          {consulta.origem && (
                            <p className="text-xs text-gray-500">Origem: {consulta.origem}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Atualização de Status */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Atualizar Status</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Novo Status
                  </label>
                  <select
                    value={statusUpdate.status}
                    onChange={(e) => setStatusUpdate(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="cadastro_enviado">Cadastro Enviado</option>
                    <option value="aguardando_analise_credito">Aguardando Análise de Crédito</option>
                    <option value="cadastro_finalizado">Cadastro Finalizado</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Observações
                  </label>
                  <textarea
                    value={statusUpdate.observacoes}
                    onChange={(e) => setStatusUpdate(prev => ({ ...prev, observacoes: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Adicione observações sobre a mudança de status..."
                  />
                </div>
                
                {statusUpdate.status === 'cadastro_finalizado' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Prazo Aprovado
                      </label>
                      <input
                        type="text"
                        value={statusUpdate.prazo_aprovado}
                        onChange={(e) => setStatusUpdate(prev => ({ ...prev, prazo_aprovado: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Ex: 30 dias"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Limite Aprovado
                      </label>
                      <input
                        type="text"
                        value={statusUpdate.limite_aprovado}
                        onChange={(e) => setStatusUpdate(prev => ({ ...prev, limite_aprovado: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Ex: R$ 10.000,00"
                      />
                    </div>
                  </>
                )}
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowStatusModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleStatusUpdate}
                  disabled={loading}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {loading ? 'Atualizando...' : 'Atualizar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Definir Prazo/Condição de Pagamento */}
      {showFinancialModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Definir Condição de Pagamento</h3>
                <button
                  onClick={() => setShowFinancialModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Condição de Pagamento <span className="text-red-500">*</span>
                  </label>
                  {loadingCondicoes ? (
                    <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                      <span className="text-sm text-gray-500">Carregando condições...</span>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="text"
                        value={condicaoPagamentoInput}
                        onChange={(e) => {
                          const value = e.target.value;
                          setCondicaoPagamentoInput(value);
                          setShowCondicoesDropdown(true);
                          
                          // Se o usuário digitar um código que existe, usar o ID
                          const matchingCondicao = condicoesPagamento.find(c => 
                            c.id === value || 
                            `${c.id} - ${c.nome}`.toLowerCase().includes(value.toLowerCase()) ||
                            c.nome.toLowerCase().includes(value.toLowerCase())
                          );
                          
                          if (matchingCondicao && (value === matchingCondicao.id || value === `${matchingCondicao.id} - ${matchingCondicao.nome}`)) {
                            setFinancialData(prev => ({ ...prev, condicao_pagamento_id: matchingCondicao.id }));
                          } else if (value.trim() === '') {
                            setFinancialData(prev => ({ ...prev, condicao_pagamento_id: '' }));
                          }
                        }}
                        onFocus={() => setShowCondicoesDropdown(true)}
                        onBlur={() => {
                          // Delay para permitir clique no dropdown
                          setTimeout(() => setShowCondicoesDropdown(false), 200);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Digite o código ou nome da condição..."
                        required
                      />
                      {showCondicoesDropdown && condicoesPagamento.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                          {condicoesPagamento
                            .filter(condicao => {
                              const searchTerm = condicaoPagamentoInput.toLowerCase();
                              return !searchTerm || 
                                condicao.id.toLowerCase().includes(searchTerm) ||
                                condicao.nome.toLowerCase().includes(searchTerm) ||
                                `${condicao.id} - ${condicao.nome}`.toLowerCase().includes(searchTerm);
                            })
                            .slice(0, 20) // Limitar a 20 resultados para melhor performance
                            .map((condicao) => (
                              <div
                                key={condicao.id}
                                onClick={() => {
                                  setCondicaoPagamentoInput(`${condicao.id} - ${condicao.nome}`);
                                  setFinancialData(prev => ({ ...prev, condicao_pagamento_id: condicao.id }));
                                  setShowCondicoesDropdown(false);
                                }}
                                className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                              >
                                <div className="font-medium text-sm text-gray-900">{condicao.id} - {condicao.nome}</div>
                                {condicao.descricao && condicao.descricao !== condicao.nome && (
                                  <div className="text-xs text-gray-500 mt-0.5">{condicao.descricao}</div>
                                )}
                              </div>
                            ))}
                          {condicoesPagamento.filter(condicao => {
                            const searchTerm = condicaoPagamentoInput.toLowerCase();
                            return !searchTerm || 
                              condicao.id.toLowerCase().includes(searchTerm) ||
                              condicao.nome.toLowerCase().includes(searchTerm) ||
                              `${condicao.id} - ${condicao.nome}`.toLowerCase().includes(searchTerm);
                          }).length === 0 && (
                            <div className="px-3 py-2 text-sm text-gray-500">Nenhuma condição encontrada</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {condicoesPagamento.length === 0 && !loadingCondicoes && (
                    <p className="mt-1 text-xs text-red-500">Nenhuma condição de pagamento disponível. Contate o administrador.</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">Digite o código ou nome da condição de pagamento. As opções aparecerão automaticamente.</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Limite de Crédito
                  </label>
                  <input
                    type="text"
                    value={financialData.limite_credito}
                    onChange={(e) => {
                      // Permite apenas números, vírgula e ponto
                      const value = e.target.value.replace(/[^\d,.-]/g, '');
                      setFinancialData(prev => ({ ...prev, limite_credito: value }));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Ex: 10000.00 ou 10000,00"
                  />
                  <p className="mt-1 text-xs text-gray-500">Valor do limite de crédito em R$ (número decimal)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Código da Carteira <span className="text-gray-400 text-xs">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={financialData.codigo_carteira}
                    onChange={(e) => {
                      // Permite apenas números
                      const value = e.target.value.replace(/\D/g, '');
                      setFinancialData(prev => ({ ...prev, codigo_carteira: value }));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Ex: 101"
                  />
                  <p className="mt-1 text-xs text-gray-500">Deixe em branco para usar o valor atual do cadastro</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Código da Forma de Cobrança <span className="text-gray-400 text-xs">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={financialData.codigo_forma_cobranca}
                    onChange={(e) => {
                      // Permite apenas números
                      const value = e.target.value.replace(/\D/g, '');
                      setFinancialData(prev => ({ ...prev, codigo_forma_cobranca: value }));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Ex: 1"
                  />
                  <p className="mt-1 text-xs text-gray-500">Deixe em branco para usar o valor atual do cadastro</p>
                </div>

                {registration?.dados_financeiros_enviados_atak && (
                  <div className="bg-green-50 border border-green-200 rounded-md p-3">
                    <p className="text-sm text-green-800">
                      ✓ Dados financeiros já foram enviados ao Atak
                    </p>
                  </div>
                )}
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowFinancialModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  disabled={savingFinancial}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveFinancialData}
                  disabled={savingFinancial}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {savingFinancial ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Visualização de Imagem */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div 
            className="relative max-w-7xl max-h-full"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors"
              aria-label="Fechar"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={selectedImage}
              alt="Visualização ampliada"
              className="max-w-full max-h-screen object-contain rounded-lg"
            />
          </div>
        </div>
      )}

      {/* Modal de Cadastro ATAK */}
      {showAtakModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white max-h-[90vh] overflow-y-auto">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <Building className="h-5 w-5 text-green-600 mr-2" />
                  <h3 className="text-lg font-medium text-gray-900">Cadastro ATAK</h3>
                </div>
                <button
                  onClick={() => setShowAtakModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {loadingAtak ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                  <p className="mt-2 text-sm text-gray-500">Carregando dados do Atak...</p>
                </div>
              ) : atakData ? (
                <div className="space-y-6">
                  {/* Dados Básicos */}
                  <div className="border-t pt-4">
                    <h3 className="text-md font-medium text-gray-900 mb-3">Dados Básicos</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {atakData.id !== undefined && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">ID</label>
                          <p className="mt-1 text-sm text-gray-900">{atakData.id}</p>
                        </div>
                      )}
                      {atakData.RazaoSocial && (
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700">Razão Social</label>
                          <p className="mt-1 text-sm text-gray-900">{atakData.RazaoSocial}</p>
                        </div>
                      )}
                      {atakData.nomeFantasia && (
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700">Nome Fantasia</label>
                          <p className="mt-1 text-sm text-gray-900">{atakData.nomeFantasia}</p>
                        </div>
                      )}
                      {atakData.cpfCnpj && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">CPF/CNPJ</label>
                          <p className="mt-1 text-sm text-gray-900">{atakData.cpfCnpj}</p>
                        </div>
                      )}
                      {atakData.CNPJCPF && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">CNPJ/CPF</label>
                          <p className="mt-1 text-sm text-gray-900">{atakData.CNPJCPF}</p>
                        </div>
                      )}
                      {atakData.rg && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">RG</label>
                          <p className="mt-1 text-sm text-gray-900">{atakData.rg}</p>
                        </div>
                      )}
                      {atakData.RGIE && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">RG/IE</label>
                          <p className="mt-1 text-sm text-gray-900">{atakData.RGIE}</p>
                        </div>
                      )}
                      {atakData.tipoDePessoa && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Tipo de Pessoa</label>
                          <p className="mt-1 text-sm text-gray-900">{atakData.tipoDePessoa === 'F' ? 'Física' : atakData.tipoDePessoa === 'J' ? 'Jurídica' : atakData.tipoDePessoa}</p>
                        </div>
                      )}
                      {atakData.codigoDaSituacao && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Situação</label>
                          <p className="mt-1 text-sm text-gray-900">
                            {atakData.codigoDaSituacao === 'A' ? 'Ativo' : 
                             atakData.codigoDaSituacao === 'B' ? 'Bloqueado' : 
                             atakData.codigoDaSituacao === 'I' ? 'Inativo' : 
                             atakData.codigoDaSituacao}
                          </p>
                        </div>
                      )}
                      {atakData.tipoDeCadastro && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Tipo de Cadastro</label>
                          <p className="mt-1 text-sm text-gray-900">{atakData.tipoDeCadastro}</p>
                        </div>
                      )}
                      {atakData.codigoDaArea && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Código da Área</label>
                          <p className="mt-1 text-sm text-gray-900">{atakData.codigoDaArea}</p>
                        </div>
                      )}
                      {atakData.CodigoDaFilial && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Código da Filial</label>
                          <p className="mt-1 text-sm text-gray-900">{atakData.CodigoDaFilial}</p>
                        </div>
                      )}
                      {atakData.identificadorEstadual !== undefined && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Indicador IE</label>
                          <p className="mt-1 text-sm text-gray-900">
                            {atakData.identificadorEstadual === 0 ? 'Não aplicável' :
                             atakData.identificadorEstadual === 1 ? 'Contribuinte ICMS' :
                             atakData.identificadorEstadual === 2 ? 'Contribuinte Isento' :
                             atakData.identificadorEstadual === 9 ? 'Não Contribuinte' :
                             atakData.identificadorEstadual}
                          </p>
                        </div>
                      )}
                      {atakData.observacao && (
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700">Observação</label>
                          <p className="mt-1 text-sm text-gray-900">{atakData.observacao}</p>
                        </div>
                      )}
                      {atakData.dataDoCadastro && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Data do Cadastro</label>
                          <p className="mt-1 text-sm text-gray-900">
                            {new Date(atakData.dataDoCadastro).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      )}
                      {atakData.DataCadastro && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Data do Cadastro</label>
                          <p className="mt-1 text-sm text-gray-900">
                            {new Date(atakData.DataCadastro).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      )}
                      {atakData.dataAlteracaoDoCadastro && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Data de Alteração</label>
                          <p className="mt-1 text-sm text-gray-900">
                            {new Date(atakData.dataAlteracaoDoCadastro).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      )}
                      {atakData.DataAlteracao && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Data de Alteração</label>
                          <p className="mt-1 text-sm text-gray-900">
                            {new Date(atakData.DataAlteracao).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Endereços */}
                  {atakData.Enderecos && (
                    <div className="border-t pt-4">
                      <h3 className="text-md font-medium text-gray-900 mb-3">Endereços</h3>
                      
                      {/* Endereço de Faturamento */}
                      {(atakData.Enderecos.ConteudoEnderecoF || atakData.Enderecos.BairroF || atakData.Enderecos.CidadeF) && (
                        <div className="mb-4 bg-blue-50 rounded-lg p-4">
                          <h4 className="text-sm font-semibold text-gray-800 mb-2">Faturamento</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {atakData.Enderecos.ConteudoEnderecoF && (
                              <div className="md:col-span-2">
                                <label className="block text-xs font-medium text-gray-600">Endereço</label>
                                <p className="mt-1 text-sm text-gray-900">{atakData.Enderecos.ConteudoEnderecoF}</p>
                              </div>
                            )}
                            {atakData.Enderecos.NumeroF && (
                              <div>
                                <label className="block text-xs font-medium text-gray-600">Número</label>
                                <p className="mt-1 text-sm text-gray-900">{atakData.Enderecos.NumeroF}</p>
                              </div>
                            )}
                            {atakData.Enderecos.BairroF && (
                              <div>
                                <label className="block text-xs font-medium text-gray-600">Bairro</label>
                                <p className="mt-1 text-sm text-gray-900">{atakData.Enderecos.BairroF}</p>
                              </div>
                            )}
                            {atakData.Enderecos.CidadeF && (
                              <div>
                                <label className="block text-xs font-medium text-gray-600">Cidade</label>
                                <p className="mt-1 text-sm text-gray-900">{atakData.Enderecos.CidadeF}</p>
                              </div>
                            )}
                            {atakData.Enderecos.UFF && (
                              <div>
                                <label className="block text-xs font-medium text-gray-600">UF</label>
                                <p className="mt-1 text-sm text-gray-900">{atakData.Enderecos.UFF}</p>
                              </div>
                            )}
                            {atakData.Enderecos.CEPF && (
                              <div>
                                <label className="block text-xs font-medium text-gray-600">CEP</label>
                                <p className="mt-1 text-sm text-gray-900">{atakData.Enderecos.CEPF}</p>
                              </div>
                            )}
                            {atakData.Enderecos.TelefoneF && (
                              <div>
                                <label className="block text-xs font-medium text-gray-600">Telefone</label>
                                <p className="mt-1 text-sm text-gray-900">{atakData.Enderecos.TelefoneF}</p>
                              </div>
                            )}
                            {atakData.Enderecos.FaxF && (
                              <div>
                                <label className="block text-xs font-medium text-gray-600">Fax</label>
                                <p className="mt-1 text-sm text-gray-900">{atakData.Enderecos.FaxF}</p>
                              </div>
                            )}
                            {atakData.Enderecos.EmailF && (
                              <div>
                                <label className="block text-xs font-medium text-gray-600">Email</label>
                                <p className="mt-1 text-sm text-gray-900">{atakData.Enderecos.EmailF}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Endereço de Cobrança */}
                      {(atakData.Enderecos.ConteudoEnderecoC || atakData.Enderecos.BairroC || atakData.Enderecos.CidadeC) && (
                        <div className="mb-4 bg-green-50 rounded-lg p-4">
                          <h4 className="text-sm font-semibold text-gray-800 mb-2">Cobrança</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {atakData.Enderecos.ConteudoEnderecoC && (
                              <div className="md:col-span-2">
                                <label className="block text-xs font-medium text-gray-600">Endereço</label>
                                <p className="mt-1 text-sm text-gray-900">{atakData.Enderecos.ConteudoEnderecoC}</p>
                              </div>
                            )}
                            {atakData.Enderecos.NumeroC && (
                              <div>
                                <label className="block text-xs font-medium text-gray-600">Número</label>
                                <p className="mt-1 text-sm text-gray-900">{atakData.Enderecos.NumeroC}</p>
                              </div>
                            )}
                            {atakData.Enderecos.BairroC && (
                              <div>
                                <label className="block text-xs font-medium text-gray-600">Bairro</label>
                                <p className="mt-1 text-sm text-gray-900">{atakData.Enderecos.BairroC}</p>
                              </div>
                            )}
                            {atakData.Enderecos.CidadeC && (
                              <div>
                                <label className="block text-xs font-medium text-gray-600">Cidade</label>
                                <p className="mt-1 text-sm text-gray-900">{atakData.Enderecos.CidadeC}</p>
                              </div>
                            )}
                            {atakData.Enderecos.UFC && (
                              <div>
                                <label className="block text-xs font-medium text-gray-600">UF</label>
                                <p className="mt-1 text-sm text-gray-900">{atakData.Enderecos.UFC}</p>
                              </div>
                            )}
                            {atakData.Enderecos.CEPC && (
                              <div>
                                <label className="block text-xs font-medium text-gray-600">CEP</label>
                                <p className="mt-1 text-sm text-gray-900">{atakData.Enderecos.CEPC}</p>
                              </div>
                            )}
                            {atakData.Enderecos.TelefoneC && (
                              <div>
                                <label className="block text-xs font-medium text-gray-600">Telefone</label>
                                <p className="mt-1 text-sm text-gray-900">{atakData.Enderecos.TelefoneC}</p>
                              </div>
                            )}
                            {atakData.Enderecos.EmailC && (
                              <div>
                                <label className="block text-xs font-medium text-gray-600">Email</label>
                                <p className="mt-1 text-sm text-gray-900">{atakData.Enderecos.EmailC}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Endereço de Entrega */}
                      {(atakData.Enderecos.ConteudoEnderecoE || atakData.Enderecos.BairroE || atakData.Enderecos.CidadeE) && (
                        <div className="mb-4 bg-purple-50 rounded-lg p-4">
                          <h4 className="text-sm font-semibold text-gray-800 mb-2">Entrega</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {atakData.Enderecos.ConteudoEnderecoE && (
                              <div className="md:col-span-2">
                                <label className="block text-xs font-medium text-gray-600">Endereço</label>
                                <p className="mt-1 text-sm text-gray-900">{atakData.Enderecos.ConteudoEnderecoE}</p>
                              </div>
                            )}
                            {atakData.Enderecos.NumeroE && (
                              <div>
                                <label className="block text-xs font-medium text-gray-600">Número</label>
                                <p className="mt-1 text-sm text-gray-900">{atakData.Enderecos.NumeroE}</p>
                              </div>
                            )}
                            {atakData.Enderecos.BairroE && (
                              <div>
                                <label className="block text-xs font-medium text-gray-600">Bairro</label>
                                <p className="mt-1 text-sm text-gray-900">{atakData.Enderecos.BairroE}</p>
                              </div>
                            )}
                            {atakData.Enderecos.CidadeE && (
                              <div>
                                <label className="block text-xs font-medium text-gray-600">Cidade</label>
                                <p className="mt-1 text-sm text-gray-900">{atakData.Enderecos.CidadeE}</p>
                              </div>
                            )}
                            {atakData.Enderecos.UFE && (
                              <div>
                                <label className="block text-xs font-medium text-gray-600">UF</label>
                                <p className="mt-1 text-sm text-gray-900">{atakData.Enderecos.UFE}</p>
                              </div>
                            )}
                            {atakData.Enderecos.CEPE && (
                              <div>
                                <label className="block text-xs font-medium text-gray-600">CEP</label>
                                <p className="mt-1 text-sm text-gray-900">{atakData.Enderecos.CEPE}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Dados Financeiros */}
                  {atakData.Financeiro && (
                    <div className="border-t pt-4">
                      <h3 className="text-md font-medium text-gray-900 mb-3">Dados Financeiros</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {atakData.Financeiro.ValorDoLimiteDeCredito !== undefined && atakData.Financeiro.ValorDoLimiteDeCredito !== null && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Limite de Crédito</label>
                            <p className="mt-1 text-sm text-gray-900">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(atakData.Financeiro.ValorDoLimiteDeCredito)}
                            </p>
                          </div>
                        )}
                        {atakData.Financeiro.CodigoDaCarteira !== undefined && atakData.Financeiro.CodigoDaCarteira !== null && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Código da Carteira</label>
                            <p className="mt-1 text-sm text-gray-900">{atakData.Financeiro.CodigoDaCarteira}</p>
                          </div>
                        )}
                        {atakData.Financeiro.CodigoDaListaDePreco !== undefined && atakData.Financeiro.CodigoDaListaDePreco !== null && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Código da Lista de Preço</label>
                            <p className="mt-1 text-sm text-gray-900">{atakData.Financeiro.CodigoDaListaDePreco}</p>
                          </div>
                        )}
                        {atakData.Financeiro.CodigoFormaDeCobranca !== undefined && atakData.Financeiro.CodigoFormaDeCobranca !== null && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Forma de Cobrança</label>
                            <p className="mt-1 text-sm text-gray-900">{atakData.Financeiro.CodigoFormaDeCobranca}</p>
                          </div>
                        )}
                        {atakData.IdDaCondicaoDePagamento && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Condição de Pagamento</label>
                            <p className="mt-1 text-sm text-gray-900">{atakData.IdDaCondicaoDePagamento}</p>
                          </div>
                        )}
                        {atakData.Financeiro.CodigoDoVendedor !== undefined && atakData.Financeiro.CodigoDoVendedor !== null && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Código do Vendedor</label>
                            <p className="mt-1 text-sm text-gray-900">{atakData.Financeiro.CodigoDoVendedor}</p>
                          </div>
                        )}
                        {atakData.Financeiro.CodigoDeRisco !== undefined && atakData.Financeiro.CodigoDeRisco !== null && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Código de Risco</label>
                            <p className="mt-1 text-sm text-gray-900">{atakData.Financeiro.CodigoDeRisco}</p>
                          </div>
                        )}
                        {atakData.Financeiro.PercentualDeDesconto !== undefined && atakData.Financeiro.PercentualDeDesconto !== null && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Percentual de Desconto</label>
                            <p className="mt-1 text-sm text-gray-900">{atakData.Financeiro.PercentualDeDesconto}%</p>
                          </div>
                        )}
                        {atakData.Financeiro.PrazoMedioMaximo !== undefined && atakData.Financeiro.PrazoMedioMaximo !== null && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Prazo Médio Máximo</label>
                            <p className="mt-1 text-sm text-gray-900">{atakData.Financeiro.PrazoMedioMaximo} dias</p>
                          </div>
                        )}
                        {atakData.Financeiro.DataRenovacaoDoCredito && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Data de Renovação do Crédito</label>
                            <p className="mt-1 text-sm text-gray-900">
                              {new Date(atakData.Financeiro.DataRenovacaoDoCredito).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                        )}
                        {atakData.Financeiro.ValorDaUltimaCompra !== undefined && atakData.Financeiro.ValorDaUltimaCompra !== null && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Valor da Última Compra</label>
                            <p className="mt-1 text-sm text-gray-900">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(atakData.Financeiro.ValorDaUltimaCompra)}
                            </p>
                          </div>
                        )}
                        {atakData.Financeiro.ValorDaMaiorCompra !== undefined && atakData.Financeiro.ValorDaMaiorCompra !== null && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Valor da Maior Compra</label>
                            <p className="mt-1 text-sm text-gray-900">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(atakData.Financeiro.ValorDaMaiorCompra)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Dados de Vendedor/Comissão */}
                  {(atakData.PercentualDeComissaoDoVendedor !== undefined || atakData.TipoDoVendedor || atakData.TipoDaComissaoDoVendedor || atakData.PercentualDescontoMaxDaVenda !== undefined) && (
                    <div className="border-t pt-4">
                      <h3 className="text-md font-medium text-gray-900 mb-3">Vendedor e Comissão</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {atakData.PercentualDeComissaoDoVendedor !== undefined && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Percentual de Comissão do Vendedor</label>
                            <p className="mt-1 text-sm text-gray-900">{atakData.PercentualDeComissaoDoVendedor}%</p>
                          </div>
                        )}
                        {atakData.TipoDoVendedor && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Tipo do Vendedor</label>
                            <p className="mt-1 text-sm text-gray-900">{atakData.TipoDoVendedor}</p>
                          </div>
                        )}
                        {atakData.TipoDaComissaoDoVendedor && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Tipo da Comissão</label>
                            <p className="mt-1 text-sm text-gray-900">
                              {atakData.TipoDaComissaoDoVendedor === 'V' ? 'Venda' : 
                               atakData.TipoDaComissaoDoVendedor === 'R' ? 'Recebimento' : 
                               atakData.TipoDaComissaoDoVendedor}
                            </p>
                          </div>
                        )}
                        {atakData.PercentualDescontoMaxDaVenda !== undefined && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Percentual de Desconto Máximo da Venda</label>
                            <p className="mt-1 text-sm text-gray-900">{atakData.PercentualDescontoMaxDaVenda}%</p>
                          </div>
                        )}
                        {atakData.CodigoDoSupervisorDaVenda !== undefined && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Código do Supervisor de Venda</label>
                            <p className="mt-1 text-sm text-gray-900">{atakData.CodigoDoSupervisorDaVenda}</p>
                          </div>
                        )}
                        {atakData.CodigoDoGerenteDaVenda !== undefined && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Código do Gerente de Venda</label>
                            <p className="mt-1 text-sm text-gray-900">{atakData.CodigoDoGerenteDaVenda}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Validações */}
                  {(atakData.DataDaValidacaoComercial || atakData.DataDaValidacaoContabil || atakData.DataDaValidacaoFinanceiro) && (
                    <div className="border-t pt-4">
                      <h3 className="text-md font-medium text-gray-900 mb-3">Validações</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {atakData.DataDaValidacaoComercial && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Validação Comercial</label>
                            <p className="mt-1 text-sm text-gray-900">
                              {new Date(atakData.DataDaValidacaoComercial).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                        )}
                        {atakData.DataDaValidacaoContabil && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Validação Contábil</label>
                            <p className="mt-1 text-sm text-gray-900">
                              {new Date(atakData.DataDaValidacaoContabil).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                        )}
                        {atakData.DataDaValidacaoFinanceiro && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Validação Financeiro</label>
                            <p className="mt-1 text-sm text-gray-900">
                              {new Date(atakData.DataDaValidacaoFinanceiro).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Dados Completos em JSON (para debug) */}
                  <details className="border-t pt-4">
                    <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                      Ver dados completos (JSON)
                    </summary>
                    <pre className="mt-2 text-xs overflow-auto bg-gray-50 p-3 rounded border max-h-96">
                      {JSON.stringify(atakData, null, 2)}
                    </pre>
                  </details>
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-2 text-sm text-gray-500">Não foi possível carregar os dados do Atak</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
