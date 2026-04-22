import React from 'react';
import { Building2 } from 'lucide-react';
import { ClientConfigManager } from '../components/ClientConfigManager';

const CadastrosConfig: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <Building2 className="w-8 h-8 text-primary-600" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Configurações de Cadastro de Clientes
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Gerencie as configurações e opções disponíveis no cadastro de clientes
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
            Opções de Cadastro
          </h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ClientConfigManager
              type="ramo_atividade"
              title="Ramos de Atividade"
              placeholder="Adicionar novo ramo de atividade..."
              onUpdate={() => {}}
            />

            <ClientConfigManager
              type="vendedor"
              title="Vendedores"
              placeholder="Adicionar novo vendedor..."
              onUpdate={() => {}}
            />

            <ClientConfigManager
              type="gestor"
              title="Gestores"
              placeholder="Adicionar novo gestor..."
              onUpdate={() => {}}
            />

            <ClientConfigManager
              type="codigo_carteira"
              title="Códigos de Carteira"
              placeholder="Adicionar novo código..."
              onUpdate={() => {}}
            />

            <ClientConfigManager
              type="lista_preco"
              title="Listas de Preço"
              placeholder="Adicionar nova lista..."
              onUpdate={() => {}}
            />

            <ClientConfigManager
              type="forma_pagamento_desejada"
              title="Formas de Pagamento"
              placeholder="Adicionar nova forma..."
              onUpdate={() => {}}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CadastrosConfig;

