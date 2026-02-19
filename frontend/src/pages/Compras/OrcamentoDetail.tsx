import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Truck,
  CheckCircle,
  Upload
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import FormattedDate from '../../components/FormattedDate';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

interface OrcamentoItem {
  id: number;
  descricao: string;
  quantidade: number;
  unidade_medida: string;
  valor_unitario: number;
  valor_total: number;
  observacoes?: string;
}

interface Orcamento {
  id: number;
  solicitacao_id: number;
  fornecedor_nome: string;
  fornecedor_cnpj?: string;
  fornecedor_contato?: string;
  fornecedor_email?: string;
  numero_orcamento?: string;
  data_orcamento?: string;
  data_validade?: string;
  condicoes_pagamento?: string;
  prazo_entrega?: string;
  valor_total: number;
  status: string;
  motivo_rejeicao?: string;
  observacoes?: string;
  created_at: string;
  aprovado_em?: string;
  rejeitado_em?: string;
  itens?: OrcamentoItem[];
  solicitacao?: { id: number; numero_solicitacao: string; solicitante_id?: number };
  criado_por_usuario?: { id: number; name: string; email: string };
  entrega_prevista?: string;
  entrega_efetiva?: string;
  status_entrega?: string;
  confirmado_entrega_solicitante?: boolean;
  confirmado_entrega_comprador?: boolean;
  data_confirmacao_solicitante?: string;
  data_confirmacao_comprador?: string;
}

interface Anexo {
  id: number;
  tipo: string;
  nome_original: string;
  created_at: string;
}

const OrcamentoDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [orcamento, setOrcamento] = useState<Orcamento | null>(null);
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingEntrega, setSavingEntrega] = useState(false);
  const [entregaPrevista, setEntregaPrevista] = useState('');
  const [entregaEfetiva, setEntregaEfetiva] = useState('');
  const [statusEntrega, setStatusEntrega] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputNF = useRef<HTMLInputElement>(null);
  const fileInputBoleto = useRef<HTMLInputElement>(null);

  const isSolicitante = orcamento?.solicitacao?.solicitante_id === user?.id;
  const isAprovado = orcamento?.status === 'aprovado';

  useEffect(() => {
    if (id) {
      fetchOrcamento();
      fetchAnexos();
    }
  }, [id]);

  useEffect(() => {
    if (orcamento) {
      setEntregaPrevista(orcamento.entrega_prevista || '');
      setEntregaEfetiva(orcamento.entrega_efetiva || '');
      setStatusEntrega(orcamento.status_entrega || 'pendente');
    }
  }, [orcamento]);

  const fetchOrcamento = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/orcamentos/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) throw new Error('Orçamento não encontrado');
      const data = await res.json();
      setOrcamento(data.data.orcamento);
    } catch {
      toast.error('Erro ao carregar orçamento');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnexos = async () => {
    try {
      const res = await fetch(`/api/compras-anexos/orcamento/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAnexos(data.data.anexos || []);
      }
    } catch {
      // ignore
    }
  };

  const handleSalvarEntrega = async () => {
    if (!id || !orcamento) return;
    setSavingEntrega(true);
    try {
      const body: any = {
        status_entrega: statusEntrega || undefined
      };
      if (entregaPrevista) body.entrega_prevista = entregaPrevista;
      else body.entrega_prevista = null;
      if (entregaEfetiva) body.entrega_efetiva = entregaEfetiva;
      else body.entrega_efetiva = null;

      const res = await fetch(`/api/orcamentos/${id}/entrega`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao atualizar entrega');
      }
      toast.success('Entrega atualizada');
      fetchOrcamento();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSavingEntrega(false);
    }
  };

  const handleConfirmarSolicitante = async () => {
    try {
      const res = await fetch(`/api/orcamentos/${id}/confirmar-entrega-solicitante`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) throw new Error('Não autorizado');
      toast.success('Entrega confirmada pelo solicitante');
      fetchOrcamento();
    } catch {
      toast.error('Apenas o solicitante pode confirmar');
    }
  };

  const handleConfirmarComprador = async () => {
    try {
      const res = await fetch(`/api/orcamentos/${id}/confirmar-entrega-comprador`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) throw new Error('Não autorizado');
      toast.success('Entrega confirmada pelo comprador');
      fetchOrcamento();
    } catch {
      toast.error('Apenas o comprador pode confirmar');
    }
  };

  const handleUpload = async (tipo: 'nota_fiscal' | 'boleto', fileList: FileList | null) => {
    if (!fileList?.length || !id) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('orcamentoId', id);
      form.append('tipo', tipo);
      for (let i = 0; i < fileList.length; i++) {
        form.append('attachments', fileList[i]);
      }
      const res = await fetch('/api/compras-anexos/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: form
      });
      if (!res.ok) throw new Error('Falha no upload');
      toast.success('Arquivo(s) anexado(s)');
      fetchAnexos();
    } catch {
      toast.error('Erro ao anexar arquivo');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (anexoId: number, nomeOriginal: string) => {
    try {
      const res = await fetch(`/api/compras-anexos/${anexoId}/download`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) throw new Error('Falha no download');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nomeOriginal || 'anexo';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Erro ao baixar arquivo');
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      pendente: 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300',
      aprovado: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300',
      rejeitado: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300',
      devolvido: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300',
      cancelado: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    };
    return map[status] || map.pendente;
  };

  if (loading || !orcamento) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Link
          to="/compras/orcamentos"
          className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Voltar para Orçamentos Recebidos
        </Link>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <div className="flex flex-wrap justify-between items-start gap-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Orçamento #{orcamento.id} – {orcamento.fornecedor_nome}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Solicitação {orcamento.solicitacao?.numero_solicitacao || orcamento.solicitacao_id}
              </p>
            </div>
            <span className={`px-3 py-1 text-sm font-semibold rounded-full ${getStatusBadge(orcamento.status)}`}>
              {orcamento.status === 'aprovado' ? 'Aprovado' : orcamento.status === 'rejeitado' ? 'Rejeitado' : orcamento.status === 'devolvido' ? 'Devolvido' : orcamento.status === 'cancelado' ? 'Cancelado' : 'Pendente'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Fornecedor</h2>
            <div className="space-y-2 text-sm">
              <p className="text-gray-900 dark:text-white">{orcamento.fornecedor_nome}</p>
              {orcamento.fornecedor_cnpj && <p className="text-gray-600 dark:text-gray-400">CNPJ: {orcamento.fornecedor_cnpj}</p>}
              {orcamento.fornecedor_contato && <p className="text-gray-600 dark:text-gray-400">Contato: {orcamento.fornecedor_contato}</p>}
              {orcamento.fornecedor_email && <p className="text-gray-600 dark:text-gray-400">{orcamento.fornecedor_email}</p>}
              {orcamento.numero_orcamento && <p className="text-gray-600 dark:text-gray-400">Nº orçamento: {orcamento.numero_orcamento}</p>}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Valores e prazos</h2>
            <div className="space-y-2 text-sm">
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                Total: R$ {Number(orcamento.valor_total).toFixed(2).replace('.', ',')}
              </p>
              {orcamento.data_validade && <p>Validade: <FormattedDate date={orcamento.data_validade} /></p>}
              {orcamento.condicoes_pagamento && <p className="text-gray-600 dark:text-gray-400">{orcamento.condicoes_pagamento}</p>}
              {orcamento.prazo_entrega && <p className="text-gray-600 dark:text-gray-400">Prazo entrega: {orcamento.prazo_entrega}</p>}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Itens</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Descrição</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Qtd</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Valor unit.</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {(orcamento.itens || []).map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">{item.descricao}</td>
                    <td className="px-4 py-2 text-sm">{item.quantidade} {item.unidade_medida}</td>
                    <td className="px-4 py-2 text-sm">R$ {Number(item.valor_unitario).toFixed(2).replace('.', ',')}</td>
                    <td className="px-4 py-2 text-sm text-right">R$ {Number(item.valor_total).toFixed(2).replace('.', ',')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {isAprovado && (
          <>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <Truck className="w-5 h-5 mr-2" />
                Rastreio de entrega
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data prevista</label>
                  <input
                    type="date"
                    value={entregaPrevista}
                    onChange={(e) => setEntregaPrevista(e.target.value)}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data efetiva</label>
                  <input
                    type="date"
                    value={entregaEfetiva}
                    onChange={(e) => setEntregaEfetiva(e.target.value)}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                  <select
                    value={statusEntrega}
                    onChange={(e) => setStatusEntrega(e.target.value)}
                    className="input w-full"
                  >
                    <option value="pendente">Pendente</option>
                    <option value="em_transito">Em trânsito</option>
                    <option value="entregue">Entregue</option>
                  </select>
                </div>
              </div>
              <button
                onClick={handleSalvarEntrega}
                disabled={savingEntrega}
                className="btn btn-primary"
              >
                {savingEntrega ? 'Salvando...' : 'Salvar dados de entrega'}
              </button>

              <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Confirmação de entrega</p>
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    {orcamento.confirmado_entrega_solicitante ? (
                      <span className="text-green-600 dark:text-green-400 flex items-center">
                        <CheckCircle className="w-5 h-5 mr-1" /> Solicitante confirmou
                        {orcamento.data_confirmacao_solicitante && (
                          <span className="text-xs ml-1">(<FormattedDate date={orcamento.data_confirmacao_solicitante} />)</span>
                        )}
                      </span>
                    ) : isSolicitante && (
                      <button onClick={handleConfirmarSolicitante} className="btn btn-secondary text-sm">
                        Confirmar entrega (solicitante)
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {orcamento.confirmado_entrega_comprador ? (
                      <span className="text-green-600 dark:text-green-400 flex items-center">
                        <CheckCircle className="w-5 h-5 mr-1" /> Comprador confirmou
                        {orcamento.data_confirmacao_comprador && (
                          <span className="text-xs ml-1">(<FormattedDate date={orcamento.data_confirmacao_comprador} />)</span>
                        )}
                      </span>
                    ) : !isSolicitante && (
                      <button onClick={handleConfirmarComprador} className="btn btn-secondary text-sm">
                        Confirmar entrega (comprador)
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <Upload className="w-5 h-5 mr-2" />
                NF e Boleto
              </h2>
              <div className="flex flex-wrap gap-4 mb-4">
                <input
                  ref={fileInputNF}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  className="hidden"
                  multiple
                  onChange={(e) => { handleUpload('nota_fiscal', e.target.files); e.target.value = ''; }}
                />
                <input
                  ref={fileInputBoleto}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  className="hidden"
                  multiple
                  onChange={(e) => { handleUpload('boleto', e.target.files); e.target.value = ''; }}
                />
                <button
                  onClick={() => fileInputNF.current?.click()}
                  disabled={uploading}
                  className="btn btn-secondary"
                >
                  Anexar Nota Fiscal
                </button>
                <button
                  onClick={() => fileInputBoleto.current?.click()}
                  disabled={uploading}
                  className="btn btn-secondary"
                >
                  Anexar Boleto
                </button>
              </div>
              {anexos.filter((a) => a.tipo === 'nota_fiscal' || a.tipo === 'boleto').length > 0 && (
                <ul className="space-y-2">
                  {anexos
                    .filter((a) => a.tipo === 'nota_fiscal' || a.tipo === 'boleto')
                    .map((a) => (
                      <li key={a.id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700 dark:text-gray-300">
                          {a.tipo === 'nota_fiscal' ? 'NF' : 'Boleto'}: {a.nome_original}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDownload(a.id, a.nome_original)}
                          className="text-primary-600 hover:underline"
                        >
                          Baixar
                        </button>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </>
        )}

        {orcamento.motivo_rejeicao && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Motivo da rejeição</h2>
            <p className="text-gray-700 dark:text-gray-300">{orcamento.motivo_rejeicao}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrcamentoDetail;
