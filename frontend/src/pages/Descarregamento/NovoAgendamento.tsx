import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Save, Calendar, Clock, Truck, FileText } from 'lucide-react';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '../../components/LoadingSpinner';
import { apiUrl } from '../../utils/apiUrl';

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
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);

  const [formData, setFormData] = useState({
    fornecedor_id: '',
    scheduled_date: '',
    scheduled_time: '',
    notes: ''
  });
  const [fieldErrors, setFieldErrors] = useState<{ fornecedor_id?: string; scheduled_date?: string; scheduled_time?: string }>({});

  useEffect(() => {
    fetchFornecedores();
    if (isEditing && id) {
      fetchAgendamento(parseInt(id));
    }
  }, [id, isEditing]);

  const fetchFornecedores = async () => {
    try {
      setLoadingFornecedores(true);
      const response = await fetch(apiUrl('descarregamento/fornecedores?limit=1000'), {
        credentials: 'include',
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

  const fetchAgendamento = async (agendamentoId: number) => {
    try {
      setLoadingData(true);
      const response = await fetch(apiUrl(`descarregamento/agendamentos/${agendamentoId}`), {
        credentials: 'include',
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
        scheduled_time: agendamento.scheduled_time || '',
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
    const err: typeof fieldErrors = {};
    if (!formData.fornecedor_id) err.fornecedor_id = 'Selecione o fornecedor';
    if (!formData.scheduled_date) err.scheduled_date = 'Data é obrigatória';
    setFieldErrors(err);
    if (Object.keys(err).length > 0) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      setLoading(true);
      const url = isEditing
        ? apiUrl(`descarregamento/agendamentos/${id}`)
        : apiUrl('descarregamento/agendamentos');

      const method = isEditing ? 'PUT' : 'POST';

      const body: Record<string, unknown> = {
        fornecedor_id: parseInt(formData.fornecedor_id),
        scheduled_date: formData.scheduled_date,
        scheduled_time: formData.scheduled_time?.trim() || '',
        notes: formData.notes || undefined
      };
      if (!isEditing) {
        body.dock = '';
      }

      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(body)
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
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (fieldErrors[name as keyof typeof fieldErrors]) {
      setFieldErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  if (loadingData) {
    return <LoadingSpinner />;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
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

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          <div>
            <label htmlFor="agendamento-fornecedor_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                  id="agendamento-fornecedor_id"
                  name="fornecedor_id"
                  value={formData.fornecedor_id}
                  onChange={handleChange}
                  required
                  disabled={fornecedores.length === 0}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed ${
                    fieldErrors.fornecedor_id ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
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
                {fieldErrors.fornecedor_id && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors.fornecedor_id}</p>
                )}
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="agendamento-scheduled_date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Calendar className="inline w-4 h-4 mr-2" />
                Data do Agendamento *
              </label>
              <input
                id="agendamento-scheduled_date"
                type="date"
                name="scheduled_date"
                value={formData.scheduled_date}
                onChange={handleChange}
                required
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                  fieldErrors.scheduled_date ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
              />
              {fieldErrors.scheduled_date && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors.scheduled_date}</p>
              )}
            </div>
            <div>
              <label htmlFor="agendamento-scheduled_time" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Clock className="inline w-4 h-4 mr-2" />
                Hora do Agendamento <span className="font-normal text-gray-500 dark:text-gray-400">(opcional)</span>
              </label>
              <input
                id="agendamento-scheduled_time"
                type="time"
                name="scheduled_time"
                value={formData.scheduled_time}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                  fieldErrors.scheduled_time ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
              />
              {fieldErrors.scheduled_time && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors.scheduled_time}</p>
              )}
            </div>
          </div>

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
