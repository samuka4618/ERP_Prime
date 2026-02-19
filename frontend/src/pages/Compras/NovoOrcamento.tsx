import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save, Upload, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '../../components/LoadingSpinner';

interface OrcamentoItem {
  item_solicitacao_id: number;
  descricao: string;
  quantidade: number;
  unidade_medida: string;
  valor_unitario: number;
  valor_total?: number;
  observacoes?: string;
}

interface SolicitacaoItem {
  id: number;
  item_numero: number;
  descricao: string;
  quantidade: number;
  unidade_medida: string;
  valor_unitario: number;
  valor_total: number;
  observacoes?: string;
}

const NovoOrcamento: React.FC = () => {
  const { solicitacaoId } = useParams<{ solicitacaoId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [loadingSolicitacao, setLoadingSolicitacao] = useState(true);
  const [solicitacao, setSolicitacao] = useState<any>(null);
  const [formData, setFormData] = useState({
    fornecedor_nome: '',
    fornecedor_cnpj: '',
    fornecedor_contato: '',
    fornecedor_email: '',
    fornecedor_telefone: '',
    numero_orcamento: '',
    data_orcamento: '',
    data_validade: '',
    condicoes_pagamento: '',
    prazo_entrega: '',
    observacoes: ''
  });
  const [itens, setItens] = useState<OrcamentoItem[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  useEffect(() => {
    if (solicitacaoId) {
      fetchSolicitacao();
    }
  }, [solicitacaoId]);

  const fetchSolicitacao = async () => {
    try {
      setLoadingSolicitacao(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/solicitacoes-compra/${solicitacaoId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Erro ao carregar solicitação');
      }

      const data = await response.json();
      const solicitacaoData = data.data.solicitacao;
      setSolicitacao(solicitacaoData);

      // Inicializar itens do orçamento com base nos itens da solicitação
      const itensIniciais: OrcamentoItem[] = (solicitacaoData.itens || []).map((item: SolicitacaoItem) => ({
        item_solicitacao_id: item.id,
        descricao: item.descricao,
        quantidade: item.quantidade,
        unidade_medida: item.unidade_medida,
        valor_unitario: 0,
        observacoes: ''
      }));
      setItens(itensIniciais);
    } catch (error) {
      toast.error('Erro ao carregar solicitação');
      navigate('/compras/solicitacoes');
    } finally {
      setLoadingSolicitacao(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleItemChange = (index: number, field: keyof OrcamentoItem, value: any) => {
    const newItens = [...itens];
    newItens[index] = {
      ...newItens[index],
      [field]: value
    };

    // Calcular valor_total quando quantidade ou valor_unitario mudar
    if (field === 'quantidade' || field === 'valor_unitario') {
      newItens[index].valor_total = newItens[index].quantidade * newItens[index].valor_unitario;
    }

    setItens(newItens);
  };

  const calcularValorTotal = () => {
    return itens.reduce((sum, item) => sum + (item.valor_total || 0), 0);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...files]);
    }
  };

  const handleFileRemove = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.fornecedor_nome.trim()) {
      toast.error('Informe o nome do fornecedor');
      return;
    }

    if (itens.length === 0) {
      toast.error('Adicione pelo menos um item ao orçamento');
      return;
    }

    if (itens.some(item => item.valor_unitario <= 0)) {
      toast.error('Todos os itens devem ter valor unitário maior que zero');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/orcamentos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          solicitacao_id: parseInt(solicitacaoId!),
          ...formData,
          itens: itens.map(item => ({
            item_solicitacao_id: item.item_solicitacao_id,
            descricao: item.descricao,
            quantidade: item.quantidade,
            unidade_medida: item.unidade_medida,
            valor_unitario: item.valor_unitario,
            valor_total: item.valor_total || item.quantidade * item.valor_unitario,
            observacoes: item.observacoes || ''
          }))
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao criar orçamento');
      }

      const data = await response.json();
      const orcamentoId = data.data.orcamento.id;

      // Se houver arquivos, fazer upload
      if (selectedFiles.length > 0) {
        const formDataUpload = new FormData();
        selectedFiles.forEach(file => {
          formDataUpload.append('attachments', file);
        });
        formDataUpload.append('orcamentoId', orcamentoId.toString());
        formDataUpload.append('tipo', 'orcamento');

        const uploadResponse = await fetch('/api/compras-anexos/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formDataUpload
        });

        if (!uploadResponse.ok) {
          console.error('Erro ao fazer upload dos arquivos, mas orçamento foi criado');
          toast.error('Orçamento criado, mas houve erro ao fazer upload dos arquivos');
        }
      }

      toast.success('Orçamento criado com sucesso!');
      navigate(`/compras/solicitacoes/${solicitacaoId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao criar orçamento');
    } finally {
      setLoading(false);
    }
  };

  if (loadingSolicitacao) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link
            to={`/compras/solicitacoes/${solicitacaoId}`}
            className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar para solicitação
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Novo Orçamento
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Solicitação: {solicitacao?.numero_solicitacao}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Dados do Fornecedor */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Dados do Fornecedor
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nome do Fornecedor *
                </label>
                <input
                  type="text"
                  name="fornecedor_nome"
                  value={formData.fornecedor_nome}
                  onChange={handleChange}
                  className="input w-full"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  CNPJ
                </label>
                <input
                  type="text"
                  name="fornecedor_cnpj"
                  value={formData.fornecedor_cnpj}
                  onChange={handleChange}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Contato
                </label>
                <input
                  type="text"
                  name="fornecedor_contato"
                  value={formData.fornecedor_contato}
                  onChange={handleChange}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="fornecedor_email"
                  value={formData.fornecedor_email}
                  onChange={handleChange}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Telefone
                </label>
                <input
                  type="text"
                  name="fornecedor_telefone"
                  value={formData.fornecedor_telefone}
                  onChange={handleChange}
                  className="input w-full"
                />
              </div>
            </div>
          </div>

          {/* Dados do Orçamento */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Dados do Orçamento
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Número do Orçamento
                </label>
                <input
                  type="text"
                  name="numero_orcamento"
                  value={formData.numero_orcamento}
                  onChange={handleChange}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Data do Orçamento
                </label>
                <input
                  type="date"
                  name="data_orcamento"
                  value={formData.data_orcamento}
                  onChange={handleChange}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Data de Validade
                </label>
                <input
                  type="date"
                  name="data_validade"
                  value={formData.data_validade}
                  onChange={handleChange}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Condições de Pagamento
                </label>
                <input
                  type="text"
                  name="condicoes_pagamento"
                  value={formData.condicoes_pagamento}
                  onChange={handleChange}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Prazo de Entrega
                </label>
                <input
                  type="text"
                  name="prazo_entrega"
                  value={formData.prazo_entrega}
                  onChange={handleChange}
                  className="input w-full"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Observações
              </label>
              <textarea
                name="observacoes"
                value={formData.observacoes}
                onChange={handleChange}
                rows={3}
                className="input w-full"
              />
            </div>
          </div>

          {/* Itens do Orçamento */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Itens do Orçamento
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Item
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Descrição
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Qtd
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Unidade
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Valor Unit.
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Valor Total
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {itens.map((item, index) => (
                    <tr key={index}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={item.descricao}
                          onChange={(e) => handleItemChange(index, 'descricao', e.target.value)}
                          className="input w-full text-sm"
                          placeholder="Descrição do item..."
                          required
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          value={item.quantidade}
                          onChange={(e) => handleItemChange(index, 'quantidade', parseFloat(e.target.value) || 0)}
                          className="input w-20 text-sm"
                          required
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <input
                          type="text"
                          value={item.unidade_medida}
                          onChange={(e) => handleItemChange(index, 'unidade_medida', e.target.value)}
                          className="input w-16 text-sm"
                          placeholder="UN"
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.valor_unitario}
                          onChange={(e) => handleItemChange(index, 'valor_unitario', parseFloat(e.target.value) || 0)}
                          className="input w-24 text-sm"
                          required
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        R$ {(item.valor_total || 0).toFixed(2).replace('.', ',')}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-white">
                      Total:
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white">
                      R$ {calcularValorTotal().toFixed(2).replace('.', ',')}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Upload de Arquivos */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Anexos do Orçamento
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Adicionar Arquivos (PDF, imagens, etc.)
                </label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-md hover:border-primary-500 transition-colors">
                  <div className="space-y-1 text-center">
                    <Upload className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="flex text-sm text-gray-600 dark:text-gray-400">
                      <label htmlFor="file-upload" className="relative cursor-pointer bg-white dark:bg-gray-800 rounded-md font-medium text-primary-600 hover:text-primary-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary-500">
                        <span>Selecionar arquivos</span>
                        <input
                          id="file-upload"
                          name="file-upload"
                          type="file"
                          multiple
                          className="sr-only"
                          onChange={handleFileSelect}
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif"
                        />
                      </label>
                      <p className="pl-1">ou arraste e solte</p>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      PDF, DOC, XLS, imagens até 10MB cada
                    </p>
                  </div>
                </div>
              </div>

              {selectedFiles.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Arquivos selecionados ({selectedFiles.length})
                  </h3>
                  <div className="space-y-2">
                    {selectedFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-md"
                      >
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <div className="flex-shrink-0">
                            <Upload className="w-5 h-5 text-gray-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {file.name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {formatFileSize(file.size)}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleFileRemove(index)}
                          className="ml-4 flex-shrink-0 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Botões */}
          <div className="flex justify-end space-x-4">
            <Link
              to={`/compras/solicitacoes/${solicitacaoId}`}
              className="btn btn-secondary"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
            >
              {loading ? (
                <>
                  <LoadingSpinner />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Salvar Orçamento
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NovoOrcamento;

