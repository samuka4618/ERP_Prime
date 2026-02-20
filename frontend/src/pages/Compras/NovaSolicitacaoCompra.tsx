import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save, Plus, X, User, Search } from 'lucide-react';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '../../components/LoadingSpinner';

interface SolicitacaoItem {
  item_numero: number;
  descricao: string;
  quantidade: number;
  unidade_medida: string;
  valor_unitario: number;
  valor_total?: number;
  observacoes?: string;
}

const NovaSolicitacaoCompra: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [formData, setFormData] = useState({
    centro_custo: '',
    descricao: '',
    justificativa: '',
    prioridade: 'normal' as 'baixa' | 'normal' | 'alta' | 'urgente',
    data_necessidade: '',
    observacoes: ''
  });
  const [itens, setItens] = useState<SolicitacaoItem[]>([
    {
      item_numero: 1,
      descricao: '',
      quantidade: 1,
      unidade_medida: 'UN',
      valor_unitario: 0,
      observacoes: ''
    }
  ]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [aprovadoresSelecionados, setAprovadoresSelecionados] = useState<number[]>([]);
  const [searchAprovadores, setSearchAprovadores] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleItemChange = (index: number, field: keyof SolicitacaoItem, value: any) => {
    const newItens = [...itens];
    newItens[index] = {
      ...newItens[index],
      [field]: value
    };
    
    // Recalcular valor total do item
    if (field === 'quantidade' || field === 'valor_unitario') {
      const valorTotal = newItens[index].quantidade * newItens[index].valor_unitario;
      newItens[index].valor_total = valorTotal;
    }
    
    setItens(newItens);
  };

  const addItem = () => {
    setItens([
      ...itens,
      {
        item_numero: itens.length + 1,
        descricao: '',
        quantidade: 1,
        unidade_medida: 'UN',
        valor_unitario: 0,
        observacoes: ''
      }
    ]);
  };

  const removeItem = (index: number) => {
    if (itens.length === 1) {
      toast.error('É necessário ter pelo menos um item');
      return;
    }
    const newItens = itens.filter((_, i) => i !== index);
    // Renumerar itens
    newItens.forEach((item, i) => {
      item.item_numero = i + 1;
    });
    setItens(newItens);
  };

  const calcularValorTotal = () => {
    return itens.reduce((total, item) => {
      return total + (item.quantidade * item.valor_unitario);
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validações
    if (!formData.descricao.trim()) {
      toast.error('A descrição é obrigatória');
      return;
    }

    if (formData.descricao.trim().length < 3) {
      toast.error('A descrição deve ter pelo menos 3 caracteres');
      return;
    }

    // Validar itens
    const itensInvalidos = itens.filter(item => 
      !item.descricao.trim() || 
      item.quantidade <= 0 || 
      item.valor_unitario < 0
    );

    if (itensInvalidos.length > 0) {
      toast.error('Preencha todos os campos dos itens corretamente');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/solicitacoes-compra', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          aprovadores_ids: aprovadoresSelecionados.length > 0 ? aprovadoresSelecionados : undefined,
          itens: itens.map(item => ({
            item_numero: item.item_numero,
            descricao: item.descricao,
            quantidade: item.quantidade,
            unidade_medida: item.unidade_medida,
            valor_unitario: item.valor_unitario,
            observacoes: item.observacoes || undefined
          }))
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao criar solicitação');
      }

      const data = await response.json();
      const solicitacaoId = data?.data?.solicitacao?.id;

      // Enviar automaticamente para aprovação (apenas se houver aprovadores selecionados)
      if (solicitacaoId && aprovadoresSelecionados.length > 0) {
        try {
          const approvalResponse = await fetch(`/api/solicitacoes-compra/${solicitacaoId}/enviar-aprovacao`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (approvalResponse.ok) {
            toast.success('Solicitação de compra criada e enviada para aprovação com sucesso!');
          } else {
            const errorData = await approvalResponse.json();
            console.error('Erro ao enviar para aprovação:', errorData);
            toast.success('Solicitação criada com sucesso, mas não foi possível enviar para aprovação automaticamente.');
          }
        } catch (approvalError) {
          console.error('Erro ao enviar para aprovação:', approvalError);
          toast.success('Solicitação criada com sucesso, mas não foi possível enviar para aprovação automaticamente.');
        }
      } else {
        toast.success('Solicitação de compra criada com sucesso!');
      }
      
      navigate('/compras/solicitacoes');
    } catch (error) {
      console.error('Erro ao criar solicitação:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao criar solicitação de compra');
    } finally {
      setLoading(false);
    }
  };

  const prioridades = [
    { value: 'baixa', label: 'Baixa' },
    { value: 'normal', label: 'Normal' },
    { value: 'alta', label: 'Alta' },
    { value: 'urgente', label: 'Urgente' }
  ];

  const unidadesMedida = ['UN', 'KG', 'L', 'M', 'M²', 'M³', 'CX', 'PC', 'PCT', 'DZ'];

  useEffect(() => {
    fetchUsuarios();
  }, []);

  const fetchUsuarios = async () => {
    try {
      setLoadingUsers(true);
      const token = localStorage.getItem('token');
      const allUsers: any[] = [];
      let page = 1;
      let hasMore = true;
      const limit = 100; // Limite máximo da API

      // Buscar todos os usuários fazendo múltiplas requisições paginadas
      while (hasMore) {
        const response = await fetch(`/api/users?page=${page}&limit=${limit}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error(`Erro ao buscar usuários: ${response.status}`);
        }

        const data = await response.json();
        const users = data.data?.data || [];
        allUsers.push(...users.filter((u: any) => u.is_active));

        // Verificar se há mais páginas
        const totalPages = data.data?.total_pages || 1;
        hasMore = page < totalPages;
        page++;
      }

      setUsuarios(allUsers);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      toast.error('Erro ao carregar lista de usuários');
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleAprovadorToggle = (userId: number) => {
    setAprovadoresSelecionados(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            to="/compras/solicitacoes"
            className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar para Solicitações
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Nova Solicitação de Compra</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Preencha os dados da solicitação de compra</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informações Gerais */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Informações Gerais</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="centro_custo" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Centro de Custo
                </label>
                <input
                  type="text"
                  id="centro_custo"
                  name="centro_custo"
                  value={formData.centro_custo}
                  onChange={handleChange}
                  className="input w-full"
                  placeholder="Ex: TI-001"
                />
              </div>

              <div>
                <label htmlFor="prioridade" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Prioridade
                </label>
                <select
                  id="prioridade"
                  name="prioridade"
                  value={formData.prioridade}
                  onChange={handleChange}
                  className="input w-full"
                >
                  {prioridades.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label htmlFor="descricao" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Descrição *
                </label>
                <textarea
                  id="descricao"
                  name="descricao"
                  value={formData.descricao}
                  onChange={handleChange}
                  required
                  rows={3}
                  className="input w-full"
                  placeholder="Descreva a solicitação de compra..."
                />
              </div>

              <div className="md:col-span-2">
                <label htmlFor="justificativa" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Justificativa
                </label>
                <textarea
                  id="justificativa"
                  name="justificativa"
                  value={formData.justificativa}
                  onChange={handleChange}
                  rows={3}
                  className="input w-full"
                  placeholder="Justifique a necessidade desta compra..."
                />
              </div>

              <div>
                <label htmlFor="data_necessidade" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Data de Necessidade
                </label>
                <input
                  type="date"
                  id="data_necessidade"
                  name="data_necessidade"
                  value={formData.data_necessidade}
                  onChange={handleChange}
                  className="input w-full"
                />
              </div>

              <div className="md:col-span-2">
                <label htmlFor="observacoes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Observações
                </label>
                <textarea
                  id="observacoes"
                  name="observacoes"
                  value={formData.observacoes}
                  onChange={handleChange}
                  rows={2}
                  className="input w-full"
                  placeholder="Observações adicionais..."
                />
              </div>
            </div>
          </div>

          {/* Seleção de Aprovadores */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <User className="w-5 h-5 mr-2" />
              Aprovadores (Opcional)
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Selecione os usuários que devem aprovar esta solicitação. Se nenhum for selecionado, a solicitação seguirá o fluxo padrão de aprovação.
            </p>
            
            {loadingUsers ? (
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner size="sm" />
                <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Carregando usuários...</span>
              </div>
            ) : usuarios.length === 0 ? (
              <div className="text-center py-8">
                <User className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Nenhum usuário disponível
                </p>
              </div>
            ) : (
              <>
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchAprovadores}
                    onChange={(e) => setSearchAprovadores(e.target.value)}
                    placeholder="Buscar por nome ou email..."
                    className="input w-full pl-10"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
                  {usuarios
                    .filter(usuario => {
                      if (!searchAprovadores.trim()) return true;
                      const term = searchAprovadores.toLowerCase();
                      return (
                        usuario.name.toLowerCase().includes(term) ||
                        usuario.email.toLowerCase().includes(term)
                      );
                    })
                    .map((usuario) => (
                      <label
                        key={usuario.id}
                        className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={aprovadoresSelecionados.includes(usuario.id)}
                          onChange={() => handleAprovadorToggle(usuario.id)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {usuario.name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {usuario.email}
                          </div>
                        </div>
                      </label>
                    ))}
                </div>
                {searchAprovadores && usuarios.filter(usuario => {
                  const term = searchAprovadores.toLowerCase();
                  return (
                    usuario.name.toLowerCase().includes(term) ||
                    usuario.email.toLowerCase().includes(term)
                  );
                }).length === 0 && (
                  <p className="mt-4 text-sm text-center text-gray-500 dark:text-gray-400">
                    Nenhum usuário encontrado com "{searchAprovadores}"
                  </p>
                )}
              </>
            )}
            
            {aprovadoresSelecionados.length > 0 && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  {aprovadoresSelecionados.length} aprovador(es) selecionado(s)
                </p>
              </div>
            )}
          </div>

          {/* Itens */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Itens da Solicitação</h2>
              <button
                type="button"
                onClick={addItem}
                className="btn btn-outline flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Adicionar Item</span>
              </button>
            </div>

            <div className="space-y-4">
              {itens.map((item, index) => (
                <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Item {item.item_numero}
                    </span>
                    {itens.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Descrição *
                      </label>
                      <input
                        type="text"
                        value={item.descricao}
                        onChange={(e) => handleItemChange(index, 'descricao', e.target.value)}
                        required
                        className="input w-full"
                        placeholder="Descrição do item..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Quantidade *
                      </label>
                      <input
                        type="number"
                        min="0.001"
                        step="0.001"
                        value={item.quantidade}
                        onChange={(e) => handleItemChange(index, 'quantidade', parseFloat(e.target.value) || 0)}
                        required
                        className="input w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Unidade
                      </label>
                      <select
                        value={item.unidade_medida}
                        onChange={(e) => handleItemChange(index, 'unidade_medida', e.target.value)}
                        className="input w-full"
                      >
                        {unidadesMedida.map((unidade) => (
                          <option key={unidade} value={unidade}>
                            {unidade}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Valor Unitário (R$) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.valor_unitario}
                        onChange={(e) => handleItemChange(index, 'valor_unitario', parseFloat(e.target.value) || 0)}
                        required
                        className="input w-full"
                      />
                    </div>

                    <div className="md:col-span-3">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Observações
                      </label>
                      <input
                        type="text"
                        value={item.observacoes || ''}
                        onChange={(e) => handleItemChange(index, 'observacoes', e.target.value)}
                        className="input w-full"
                        placeholder="Observações do item..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Valor Total
                      </label>
                      <div className="input w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white">
                        R$ {(item.quantidade * item.valor_unitario).toFixed(2).replace('.', ',')}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Resumo */}
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex justify-end">
                <div className="text-right">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Valor Total da Solicitação</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    R$ {calcularValorTotal().toFixed(2).replace('.', ',')}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Botões */}
          <div className="flex justify-end space-x-4">
            <Link
              to="/compras/solicitacoes"
              className="btn btn-outline"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary flex items-center space-x-2"
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Salvar Solicitação</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NovaSolicitacaoCompra;

