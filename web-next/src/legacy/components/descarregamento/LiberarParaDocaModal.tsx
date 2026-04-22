import React, { useEffect, useState } from 'react';
import { MapPin, X } from 'lucide-react';

export interface DocaOption {
  id: number;
  numero: string;
  nome?: string;
}

interface LiberarParaDocaModalProps {
  open: boolean;
  driverName: string;
  defaultDockNumero?: string;
  docas: DocaOption[];
  loadingDocas: boolean;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: (dockNumero: string) => void;
}

const LiberarParaDocaModal: React.FC<LiberarParaDocaModalProps> = ({
  open,
  driverName,
  defaultDockNumero,
  docas,
  loadingDocas,
  submitting,
  onCancel,
  onConfirm
}) => {
  const [dock, setDock] = useState('');

  useEffect(() => {
    if (open) {
      const d = (defaultDockNumero || '').trim();
      setDock(d && docas.some((x) => x.numero === d) ? d : '');
    }
  }, [open, defaultDockNumero, docas]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dock.trim()) return;
    onConfirm(dock.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="liberar-doca-titulo">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 id="liberar-doca-titulo" className="text-lg font-semibold text-gray-900 dark:text-white">
            Liberar para doca
          </h2>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Motorista: <span className="font-medium text-gray-900 dark:text-white">{driverName}</span>
          </p>
          <div>
            <label htmlFor="liberar-doca-select" className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <MapPin className="w-4 h-4" />
              Doca *
            </label>
            {loadingDocas ? (
              <div className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-sm text-gray-500">
                Carregando docas...
              </div>
            ) : docas.length === 0 ? (
              <p className="text-sm text-amber-600 dark:text-amber-400">Nenhuma doca ativa cadastrada. Configure em Descarregamento → Docas.</p>
            ) : (
              <select
                id="liberar-doca-select"
                value={dock}
                onChange={(e) => setDock(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione a doca</option>
                {docas.map((d) => (
                  <option key={d.id} value={d.numero}>
                    {d.nome || `Doca ${d.numero}`}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || !dock.trim() || docas.length === 0}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Liberando...' : 'Confirmar liberação'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LiberarParaDocaModal;
