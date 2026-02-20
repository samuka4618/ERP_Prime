import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Save, Calendar, Clock, Truck, MapPin, FileText } from 'lucide-react';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '../../components/LoadingSpinner';

interface Fornecedor {
  id: number;
  name: string;
  category: string;
}

const NovoAgendamento: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(isEditing);
  const [loadingFornecedores, setLoadingFornecedores] = useState(true);
  const [loadingDocas, setLoadingDocas] = useState(true);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [docas, setDocas] = useState<{ id: number; numero: string; nome?: string }[]>([]);
  
  const [formData, setFormData] = useState({
    fornecedor_id: '',
    scheduled_date: '',
    scheduled_time: '',
    dock: '',
    notes: ''
  });

  useEffect(() => {
    fetchFornecedores();
    fetchDocas();
    if (isEditing && id) {
      fetchAgendamento(parseInt(id));
    }
  }, [id, isEditing]);

  const fetchFornecedores = async () => {
    try {
      setLoadingFornecedores(true);
      const response = await fetch('/api/descarregamento/fornecedores?limit=1000', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro ao carregar fornecedores: ${response.status}`);
      }

      const data = await response.json();
      console.log('Resposta da API de fornecedores:', data);
      
      // A API retorna { message: "...", data: { data: [...], total: ... } }
      const fornecedoresList = data.data?.data || data.data || [];
      setFornecedores(fornecedoresList);
      
      if (fornecedoresList.length === 0) {
        toast.error('Nenhum fornecedor cadastrado. Crie um fornecedor primeiro.', {
          duration: 5000
        });
      }
    } catch (error: any) {
      console.error('Erro ao carregar fornecedores:', error);
      toast.error(error.message || 'Erro ao carregar fornecedores. Verifique se há fornecedores cadastrados.');
    } finally {
      setLoadingFornecedores(false);
    }
  };

  const fetchDocas = async () => {
    try {
      setLoadingDocas(true);
      const response = await fetch('/api/descarregamento/docas?activeOnly=true', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Erro ao carregar docas');
      }

      const data = await response.json();
      setDocas(data.data?.docas || []);
      
      if (data.data?.docas?.length === 0) {
        toast.error('Nenhuma doca configurada. Configure as docas primeiro.', {
          duration: 5000
        });
      }
    } catch (error: any) {
      console.error('Erro ao carregar docas:', error);
      toast.error('Erro ao carregar docas. Verifique as configurações.');
    } finally {
      setLoadingDocas(false);
    }
  };

  const fetchAgendamento = async (agendamentoId: number) => {
    try {
      setLoadingData(true);
      const response = await fetch(`/api/descarregamento/agendamentos/${agendamentoId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Erro ao carregar agendamento');

      const data = await response.json();
      const agendamento = data.data.agendamento;
      
      setFormData({
        fornecedor_id: agendamento.fornecedor_id.toString(),
        scheduled_date: agendamento.scheduled_date,
        scheduled_time: agendamento.scheduled_time,
        dock: agendamento.dock,
        notes: agendamento.notes || ''
      });
    } catch (error) {
      toast.error('Erro ao carregar agendamento');
      navigate('/descarregamento/agendamentos');
    } finally {
      setLoadingData(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.fornecedor_id || !formData.scheduled_date || !formData.scheduled_time || !formData.dock) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      setLoading(true);
      const url = isEditing 
        ? `/api/descarregamento/agendamentos/${id}`
        : '/api/descarregamento/agendamentos';
      
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          fornecedor_id: parseInt(formData.fornecedor_id),
          scheduled_date: formData.scheduled_date,
          scheduled_time: formData.scheduled_time,
          dock: formData.dock,
          notes: formData.notes || undefined
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao salvar agendamento');
      }

      toast.success(isEditing ? 'Agendamento atualizado com sucesso!' : 'Agendamento criado com sucesso!');
      navigate('/descarregamento/agendamentos');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar agendamento');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  if (loadingData) {
    return <LoadingSpinner />;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          to="/descarregamento/agendamentos"
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {isEditing ? 'Editar Agendamento' : 'Novo Agendamento'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {isEditing ? 'Atualize as informações do agendamento' : 'Preencha os dados para criar um novo agendamento'}
          </p>
        </div>
      </div>

      {/* Formulário */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Fornecedor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Truck className="inline w-4 h-4 mr-2" />
              Fornecedor *
            </label>
            {loadingFornecedores ? (
              <div className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                Carregando fornecedores...
              </div>
            ) : (
              <>
                <select
                  name="fornecedor_id"
                  value={formData.fornecedor_id}
                  onChange={handleChange}
                  required
                  disabled={fornecedores.length === 0}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {fornecedores.length === 0 
                      ? 'Nenhum fornecedor cadastrado - Cadastre um fornecedor primeiro'
                      : 'Selecione um fornecedor'}
                  </option>
                  {fornecedores.map(fornecedor => (
                    <option key={fornecedor.id} value={fornecedor.id}>
                      {fornecedor.name} - {fornecedor.category}
                    </option>
                  ))}
                </select>
                {fornecedores.length === 0 && (
                  <p className="mt-2 text-sm text-yellow-600 dark:text-yellow-400">
                    ⚠️ Nenhum fornecedor cadastrado. Por favor,{' '}
                    <Link to="/descarregamento/fornecedores/novo" className="underline font-medium">
                      crie um fornecedor primeiro
                    </Link>
                    .
                  </p>
                )}
              </>
            )}
          </div>

          {/* Data e Hora */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Calendar className="inline w-4 h-4 mr-2" />
                Data do Agendamento *
              </label>
              <input
                type="date"
                name="scheduled_date"
                value={formData.scheduled_date}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Clock className="inline w-4 h-4 mr-2" />
                Hora do Agendamento *
              </label>
              <input
                type="time"
                name="scheduled_time"
                value={formData.scheduled_time}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {/* Doca */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <MapPin className="inline w-4 h-4 mr-2" />
              Doca *
            </label>
            {loadingDocas ? (
              <div className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                Carregando docas...
              </div>
            ) : (
              <>
                <select
                  name="dock"
                  value={formData.dock}
                  onChange={handleChange}
                  required
                  disabled={docas.length === 0}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {docas.length === 0 
                      ? 'Nenhuma doca configurada - Configure as docas primeiro'
                      : 'Selecione a doca'}
                  </option>
                  {docas.map(doca => (
                    <option key={doca.id} value={doca.numero}>
                      {doca.nome || `Doca ${doca.numero}`}
                    </option>
                  ))}
                </select>
                {docas.length === 0 && (
                  <p className="mt-2 text-sm text-yellow-600 dark:text-yellow-400">
                    ⚠️ Nenhuma doca configurada. Por favor,{' '}
                    <Link to="/descarregamento/config" className="underline font-medium">
                      configure as docas primeiro
                    </Link>
                    .
                  </p>
                )}
              </>
            )}
          </div>

          {/* Observações */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <FileText className="inline w-4 h-4 mr-2" />
              Observações
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
              placeholder="Adicione observações sobre o agendamento (opcional)"
            />
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Link
              to="/descarregamento/agendamentos"
              className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300 font-medium"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-5 h-5" />
              {loading ? 'Salvando...' : isEditing ? 'Atualizar' : 'Criar Agendamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NovoAgendamento;
