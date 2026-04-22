import React, { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { apiService } from '../services/api';
import { toast } from 'react-hot-toast';

interface ConfigItem {
  id: number;
  nome: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ClientConfigManagerProps {
  type: 'ramo_atividade' | 'vendedor' | 'gestor' | 'codigo_carteira' | 'lista_preco' | 'forma_pagamento_desejada';
  title: string;
  placeholder: string;
  onUpdate: () => void;
}

export const ClientConfigManager: React.FC<ClientConfigManagerProps> = ({
  type,
  title,
  placeholder,
  onUpdate
}) => {
  const [items, setItems] = useState<ConfigItem[]>([]);
  const [newItem, setNewItem] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadItems();
  }, [type]);

  const loadItems = async () => {
    try {
      setLoading(true);
      const response = await apiService.getClientConfigs(type);
      setItems(response);
    } catch (error) {
      console.error(`Erro ao carregar ${title}:`, error);
      toast.error(`Erro ao carregar ${title}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async () => {
    if (!newItem.trim()) {
      toast.error('Digite um nome válido');
      return;
    }

    try {
      setSaving(true);
      await apiService.createClientConfig(type, { nome: newItem.trim() });
      setNewItem('');
      await loadItems();
      onUpdate();
      toast.success(`${title} adicionado com sucesso`);
    } catch (error) {
      console.error(`Erro ao adicionar ${title}:`, error);
      toast.error(`Erro ao adicionar ${title}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (id: number) => {
    if (!confirm(`Tem certeza que deseja excluir este item?`)) {
      return;
    }

    try {
      setSaving(true);
      await apiService.deleteClientConfig(type, id);
      await loadItems();
      onUpdate();
      toast.success(`${title} excluído com sucesso`);
    } catch (error) {
      console.error(`Erro ao excluir ${title}:`, error);
      toast.error(`Erro ao excluir ${title}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="space-y-2">
          <div className="h-8 bg-gray-200 rounded"></div>
          <div className="h-6 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
        {title}
      </h3>
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder={placeholder}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
            disabled={saving}
          />
          <button
            onClick={handleAddItem}
            disabled={saving || !newItem.trim()}
            className="px-3 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Plus className="w-4 h-4" />
            )}
          </button>
        </div>
        <div className="space-y-2">
          {items.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic">
              Nenhum item cadastrado
            </p>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded"
              >
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {item.nome}
                </span>
                <button
                  onClick={() => handleDeleteItem(item.id)}
                  disabled={saving}
                  className="text-red-600 hover:text-red-800 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
