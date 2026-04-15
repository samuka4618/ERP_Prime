import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Truck, User, Save, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';

interface FormField {
  id: string;
  type: 'text' | 'textarea' | 'number' | 'date' | 'time' | 'select' | 'radio' | 'checkbox';
  label: string;
  name: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
  min?: number;
  max?: number;
  default?: unknown;
}

interface Formulario {
  id: number;
  title: string;
  description?: string;
  fields: FormField[];
}

interface Fornecedor {
  id: number;
  name: string;
  category: string;
}

const PublicFormPage: React.FC = () => {
  const { publicSlug } = useParams<{ publicSlug: string }>();
  const slug = publicSlug || '';
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formulario, setFormulario] = useState<Formulario | null>(null);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [formData, setFormData] = useState<Record<string, unknown>>({
    driver_name: '',
    phone_number: '',
    fornecedor_id: ''
  });

  const loadForm = useCallback(async () => {
    if (!slug) return;
    const response = await fetch(`/api/public/form/${encodeURIComponent(slug)}`);
    if (!response.ok) {
      let detail = '';
      try {
        const j = (await response.json()) as { error?: string };
        if (j?.error) detail = j.error;
      } catch {
        /* ignore */
      }
      throw new Error(detail || `Erro ${response.status}`);
    }
    const data = (await response.json()) as {
      data?: { formulario?: Formulario; fornecedores?: Fornecedor[] };
    };
    setFormulario(data.data?.formulario || null);
    setFornecedores(data.data?.fornecedores || []);
  }, [slug]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadForm();
      } catch (e) {
        console.error(e);
        if (!cancelled) toast.error('Formulário não encontrado ou indisponível.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadForm]);

  useEffect(() => {
    if (!slug || loading) return;
    const id = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/public/form/${encodeURIComponent(slug)}`);
        if (!response.ok) return;
        const data = (await response.json()) as { data?: { fornecedores?: Fornecedor[] } };
        const list = data.data?.fornecedores || [];
        setFornecedores(list);
      } catch {
        /* silencioso */
      }
    }, 20000);
    return () => clearInterval(id);
  }, [slug, loading]);

  const handleFieldChange = (name: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.driver_name || !formData.fornecedor_id) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    if (formulario) {
      const requiredFields = formulario.fields.filter((f) => f.required);
      for (const field of requiredFields) {
        const v = formData[field.name];
        if (v === undefined || v === null || v === '') {
          toast.error(`O campo "${field.label}" é obrigatório`);
          return;
        }
      }
    }
    try {
      setSubmitting(true);
      const responses: Record<string, unknown> = {};
      if (formulario) {
        formulario.fields.forEach((field) => {
          responses[field.name] = formData[field.name] ?? '';
        });
      }
      const response = await fetch(`/api/public/form/${encodeURIComponent(slug)}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driver_name: formData.driver_name,
          phone_number: formData.phone_number || undefined,
          fornecedor_id: parseInt(String(formData.fornecedor_id), 10),
          responses
        })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((body as { error?: string }).error || 'Erro ao registrar chegada');
      }
      const data = body as { data?: { tracking_token?: string } };
      const trackingCode = data.data?.tracking_token;
      toast.success('Chegada registrada com sucesso!');
      if (trackingCode) {
        window.location.href = `/t/${encodeURIComponent(trackingCode)}`;
      } else {
        setFormData({ driver_name: '', phone_number: '', fornecedor_id: '' });
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erro ao registrar chegada';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field: FormField) => {
    const value = (formData[field.name] ?? field.default ?? '') as string | number | boolean;

    switch (field.type) {
      case 'text':
        return (
          <input
            type="text"
            name={field.name}
            value={String(value ?? '')}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            required={field.required}
            placeholder={field.placeholder}
            className="w-full px-4 py-3 bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 font-medium"
          />
        );
      case 'textarea':
        return (
          <textarea
            name={field.name}
            value={String(value ?? '')}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            required={field.required}
            placeholder={field.placeholder}
            rows={4}
            className="w-full px-4 py-3 bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none transition-all text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 font-medium"
          />
        );
      case 'number':
        return (
          <input
            type="number"
            name={field.name}
            value={value === '' ? '' : String(value)}
            onChange={(e) => handleFieldChange(field.name, parseFloat(e.target.value) || '')}
            required={field.required}
            placeholder={field.placeholder}
            min={field.min}
            max={field.max}
            className="w-full px-4 py-3 bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 font-medium"
          />
        );
      case 'date':
        return (
          <input
            type="date"
            name={field.name}
            value={String(value ?? '')}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            required={field.required}
            className="w-full px-4 py-3 bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-gray-900 dark:text-gray-100 font-medium"
          />
        );
      case 'time':
        return (
          <input
            type="time"
            name={field.name}
            value={String(value ?? '')}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            required={field.required}
            className="w-full px-4 py-3 bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-gray-900 dark:text-gray-100 font-medium"
          />
        );
      case 'select':
        return (
          <select
            name={field.name}
            value={String(value ?? '')}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            required={field.required}
            className="w-full px-4 py-3 bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-gray-900 dark:text-gray-100 font-medium"
          >
            <option value="">Selecione...</option>
            {field.options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );
      case 'radio':
        return (
          <div className="space-y-3">
            {field.options?.map((option) => (
              <label key={option} className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="radio"
                  name={field.name}
                  value={option}
                  checked={value === option}
                  onChange={(e) => handleFieldChange(field.name, e.target.value)}
                  required={field.required}
                  className="w-5 h-5 text-blue-600 border-2 border-gray-300 focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-gray-800 font-medium group-hover:text-blue-600 transition-colors">{option}</span>
              </label>
            ))}
          </div>
        );
      case 'checkbox':
        return (
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              name={field.name}
              checked={Boolean(value)}
              onChange={(e) => handleFieldChange(field.name, e.target.checked)}
              required={field.required}
              className="w-5 h-5 text-blue-600 border-2 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-800 font-medium group-hover:text-blue-600 transition-colors">{field.label}</span>
          </label>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!formulario) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Formulário não disponível</h2>
          <p className="text-gray-600">
            Nenhum formulário de chegada foi configurado ainda. Entre em contato com a administração.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6">
            <div className="flex items-center gap-4 mb-3">
              <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                <Truck className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-white mb-1">{formulario.title}</h1>
                {formulario.description && <p className="text-blue-100 text-sm">{formulario.description}</p>}
              </div>
            </div>
          </div>

          <div className="p-8 dark:bg-gray-800">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-6 space-y-5 border border-gray-200 dark:border-gray-600">
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 pb-2 border-b border-gray-300 dark:border-gray-600">
                  <User className="w-5 h-5 text-blue-600 shrink-0" />
                  Informações do Motorista
                </h2>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Nome do Motorista <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={String(formData.driver_name ?? '')}
                    onChange={(e) => handleFieldChange('driver_name', e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 font-medium"
                    placeholder="Digite seu nome completo"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Telefone</label>
                  <input
                    type="tel"
                    value={String(formData.phone_number ?? '')}
                    onChange={(e) => handleFieldChange('phone_number', e.target.value)}
                    className="w-full px-4 py-3 bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 font-medium"
                    placeholder="(00) 00000-0000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    <Truck className="inline w-4 h-4 mr-2 text-blue-600 shrink-0" />
                    Fornecedor/Transportadora <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={String(formData.fornecedor_id ?? '')}
                    onChange={(e) => handleFieldChange('fornecedor_id', e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-gray-900 dark:text-gray-100 font-medium"
                  >
                    <option value="">Selecione o fornecedor</option>
                    {fornecedores.map((fornecedor) => (
                      <option key={fornecedor.id} value={fornecedor.id}>
                        {fornecedor.name} - {fornecedor.category}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {formulario.fields.length > 0 && (
                <div className="space-y-5">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 pb-2 border-b border-gray-300 dark:border-gray-600">
                    Informações Adicionais
                  </h2>
                  {formulario.fields.map((field) => (
                    <div key={field.id}>
                      <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                        {field.label}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      {renderField(field)}
                    </div>
                  ))}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2 font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <Save className="w-5 h-5" />
                {submitting ? 'Registrando...' : 'Registrar Chegada'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicFormPage;
