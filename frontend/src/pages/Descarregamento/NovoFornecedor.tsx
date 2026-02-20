import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Save, Truck, Tag, Hash } from 'lucide-react';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '../../components/LoadingSpinner';

const NovoFornecedor: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(isEditing);
  
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    plate: ''
  });

  useEffect(() => {
    if (isEditing && id) {
      fetchFornecedor(parseInt(id));
    }
  }, [id, isEditing]);

  const fetchFornecedor = async (fornecedorId: number) => {
    try {
      setLoadingData(true);
      const response = await fetch(`/api/descarregamento/fornecedores/${fornecedorId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Erro ao carregar fornecedor');

      const data = await response.json();
      const fornecedor = data.data.fornecedor;
      
      setFormData({
        name: fornecedor.name || '',
        category: fornecedor.category || '',
        plate: fornecedor.plate || ''
      });
    } catch (error) {
      toast.error('Erro ao carregar fornecedor');
      navigate('/descarregamento/fornecedores');
    } finally {
      setLoadingData(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.category) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      setLoading(true);
      const url = isEditing 
        ? `/api/descarregamento/fornecedores/${id}`
        : '/api/descarregamento/fornecedores';
      
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          name: formData.name,
          category: formData.category,
          plate: formData.plate || undefined
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao salvar fornecedor');
      }

      toast.success(isEditing ? 'Fornecedor atualizado com sucesso!' : 'Fornecedor criado com sucesso!');
      navigate('/descarregamento/fornecedores');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar fornecedor');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  if (loadingData) {
    return <LoadingSpinner />;
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          to="/descarregamento/fornecedores"
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {isEditing ? 'Editar Fornecedor' : 'Novo Fornecedor'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {isEditing ? 'Atualize as informações do fornecedor' : 'Preencha os dados para criar um novo fornecedor'}
          </p>
        </div>
      </div>

      {/* Formulário */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Nome */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Truck className="inline w-4 h-4 mr-2" />
              Nome do Fornecedor *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="Digite o nome do fornecedor"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* Categoria */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Tag className="inline w-4 h-4 mr-2" />
              Categoria *
            </label>
            <input
              type="text"
              name="category"
              value={formData.category}
              onChange={handleChange}
              required
              placeholder="Ex: Transportadora, Fornecedor, etc."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Exemplos: Transportadora, Fornecedor de Matéria Prima, Distribuidor, etc.
            </p>
          </div>

          {/* Placa */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Hash className="inline w-4 h-4 mr-2" />
              Placa do Veículo (Opcional)
            </label>
            <input
              type="text"
              name="plate"
              value={formData.plate}
              onChange={handleChange}
              placeholder="ABC-1234"
              maxLength={10}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white uppercase"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Formato: ABC-1234 ou ABC1234
            </p>
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Link
              to="/descarregamento/fornecedores"
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
              {loading ? 'Salvando...' : isEditing ? 'Atualizar' : 'Criar Fornecedor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NovoFornecedor;
