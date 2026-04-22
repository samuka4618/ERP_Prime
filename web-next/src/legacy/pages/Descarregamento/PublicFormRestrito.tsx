import React from 'react';
import { AlertCircle } from 'lucide-react';

/**
 * Página exibida quando o usuário está em "modo só formulário"
 * e tenta acessar uma rota não permitida (ex.: /login).
 */
const PublicFormRestrito: React.FC = () => {
  const returnUrl = (() => {
    try {
      return sessionStorage.getItem('erp_public_form_return_url');
    } catch {
      return null;
    }
  })();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-8 text-center border border-gray-200 dark:border-gray-700">
        <div className="flex justify-center mb-4">
          <div className="p-4 rounded-full bg-amber-100 dark:bg-amber-900/30">
            <AlertCircle className="w-12 h-12 text-amber-600 dark:text-amber-400" />
          </div>
        </div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Acesso restrito
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Neste link você só pode acessar o formulário de chegada. Use o QR code ou o link que recebeu para preencher o formulário.
        </p>
        {returnUrl && (
          <a
            href={returnUrl}
            className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            Voltar ao formulário
          </a>
        )}
      </div>
    </div>
  );
};

export default PublicFormRestrito;
