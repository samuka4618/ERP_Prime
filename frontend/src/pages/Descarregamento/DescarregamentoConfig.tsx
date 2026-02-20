import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, MapPin, FileText, Save, X, QrCode, Copy, Check, MessageSquare, Send, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '../../components/LoadingSpinner';
import { usePermissions } from '../../contexts/PermissionsContext';
import { QRCodeSVG } from 'qrcode.react';

interface Doca {
  id: number;
  numero: string;
  nome?: string;
  is_active: boolean;
}

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
  default?: any;
}

interface Formulario {
  id: number;
  title: string;
  description?: string;
  fields: FormField[];
  is_published: boolean;
  is_default: boolean;
  public_url?: string;
}

interface SMSTemplate {
  id: number;
  name: string;
  message: string;
  template_type: 'arrival' | 'release';
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

const DescarregamentoConfig: React.FC = () => {
  const { hasPermission } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'docas' | 'formularios' | 'sms'>('docas');
  
  // Docas
  const [docas, setDocas] = useState<Doca[]>([]);
  const [showDocaModal, setShowDocaModal] = useState(false);
  const [editingDoca, setEditingDoca] = useState<Doca | null>(null);
  const [docaForm, setDocaForm] = useState({ numero: '', nome: '', is_active: true });

  // Formulários
  const [formularios, setFormularios] = useState<Formulario[]>([]);
  const [showFormularioModal, setShowFormularioModal] = useState(false);
  const [editingFormulario, setEditingFormulario] = useState<Formulario | null>(null);
  const [formularioForm, setFormularioForm] = useState({
    title: '',
    description: '',
    fields: [] as FormField[],
    is_published: false,
    is_default: false
  });
  const [qrCodeVisible, setQrCodeVisible] = useState<number | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<number | null>(null);

  // Templates SMS
  const [smsTemplates, setSmsTemplates] = useState<SMSTemplate[]>([]);
  const [showSmsTemplateModal, setShowSmsTemplateModal] = useState(false);
  const [editingSmsTemplate, setEditingSmsTemplate] = useState<SMSTemplate | null>(null);
  const [smsTemplateForm, setSmsTemplateForm] = useState({
    name: '',
    message: '',
    template_type: 'arrival' as 'arrival' | 'release',
    is_default: false
  });
  const [showTestSmsModal, setShowTestSmsModal] = useState(false);
  const [testingTemplate, setTestingTemplate] = useState<SMSTemplate | null>(null);
  const [testPhoneNumber, setTestPhoneNumber] = useState('');

  useEffect(() => {
    fetchDocas();
    fetchFormularios();
    fetchSmsTemplates();
  }, []);

  const fetchDocas = async () => {
    try {
      const response = await fetch('/api/descarregamento/docas', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setDocas(data.data?.docas || []);
      }
    } catch (error) {
      console.error('Erro ao carregar docas:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFormularios = async () => {
    try {
      const response = await fetch('/api/descarregamento/formularios', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setFormularios(data.data?.formularios || []);
      }
    } catch (error) {
      console.error('Erro ao carregar formulários:', error);
    }
  };

  const handleSaveDoca = async () => {
    try {
      const url = editingDoca 
        ? `/api/descarregamento/docas/${editingDoca.id}`
        : '/api/descarregamento/docas';
      
      const method = editingDoca ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(docaForm)
      });

      if (!response.ok) throw new Error('Erro ao salvar doca');

      toast.success(editingDoca ? 'Doca atualizada com sucesso!' : 'Doca criada com sucesso!');
      setShowDocaModal(false);
      setEditingDoca(null);
      setDocaForm({ numero: '', nome: '', is_active: true });
      fetchDocas();
    } catch (error) {
      toast.error('Erro ao salvar doca');
    }
  };

  const handleDeleteDoca = async (id: number) => {
    if (!window.confirm('Tem certeza que deseja excluir esta doca?')) return;

    try {
      const response = await fetch(`/api/descarregamento/docas/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Erro ao excluir doca');

      toast.success('Doca excluída com sucesso');
      fetchDocas();
    } catch (error) {
      toast.error('Erro ao excluir doca');
    }
  };

  const handleEditDoca = (doca: Doca) => {
    setEditingDoca(doca);
    setDocaForm({
      numero: doca.numero,
      nome: doca.nome || '',
      is_active: doca.is_active
    });
    setShowDocaModal(true);
  };

  const handleAddField = () => {
    const newField: FormField = {
      id: `field_${Date.now()}`,
      type: 'text',
      label: '',
      name: '',
      required: false
    };
    setFormularioForm({
      ...formularioForm,
      fields: [...formularioForm.fields, newField]
    });
  };

  const handleRemoveField = (fieldId: string) => {
    setFormularioForm({
      ...formularioForm,
      fields: formularioForm.fields.filter(f => f.id !== fieldId)
    });
  };

  const handleFieldChange = (fieldId: string, key: keyof FormField, value: any) => {
    setFormularioForm({
      ...formularioForm,
      fields: formularioForm.fields.map(f => 
        f.id === fieldId ? { ...f, [key]: value } : f
      )
    });
  };

  const handleSaveFormulario = async () => {
    try {
      if (!formularioForm.title.trim()) {
        toast.error('O título do formulário é obrigatório');
        return;
      }

      // Campos dinâmicos são opcionais - o formulário já tem os campos principais
      // (Nome do Motorista, Telefone, Fornecedor)

      const url = editingFormulario 
        ? `/api/descarregamento/formularios/${editingFormulario.id}`
        : '/api/descarregamento/formularios';
      
      const method = editingFormulario ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formularioForm)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao salvar formulário');
      }

      await response.json();
      toast.success(editingFormulario ? 'Formulário atualizado com sucesso!' : 'Formulário criado com sucesso!');
      
      // Recarregar a lista do servidor para exibir o novo/atualizado formulário
      await fetchFormularios();
      
      setShowFormularioModal(false);
      setEditingFormulario(null);
      setFormularioForm({
        title: '',
        description: '',
        fields: [],
        is_published: false,
        is_default: false
      });
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar formulário');
    }
  };

  const handleEditFormulario = (formulario: Formulario) => {
    setEditingFormulario(formulario);
    setFormularioForm({
      title: formulario.title,
      description: formulario.description || '',
      fields: formulario.fields,
      is_published: formulario.is_published,
      is_default: formulario.is_default
    });
    setShowFormularioModal(true);
  };

  const handleDeleteFormulario = async (id: number) => {
    if (!window.confirm('Tem certeza que deseja excluir este formulário?')) return;

    try {
      const response = await fetch(`/api/descarregamento/formularios/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Erro ao excluir formulário');

      toast.success('Formulário excluído com sucesso');
      fetchFormularios();
    } catch (error) {
      toast.error('Erro ao excluir formulário');
    }
  };

  const toggleQrCode = (formularioId: number) => {
    setQrCodeVisible(qrCodeVisible === formularioId ? null : formularioId);
  };

  const regenerateLink = async (formularioId: number) => {
    try {
      const response = await fetch(`/api/descarregamento/formularios/${formularioId}/regenerate-link`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Erro ao regenerar link');
      }
      const data = await response.json();
      const newUrl = data.data?.public_url;
      if (newUrl) {
        setFormularios(prev => prev.map(f =>
          f.id === formularioId ? { ...f, public_url: newUrl } : f
        ));
        toast.success('Link regenerado com sucesso! O QR code foi atualizado.');
      } else {
        await fetchFormularios();
        toast.success('Link atualizado. Se o ngrok estiver rodando, a nova URL já está em uso.');
      }
    } catch (err: any) {
      console.error('Erro ao regenerar link:', err);
      toast.error(err.message || 'Erro ao regenerar link');
    }
  };

  const copyUrl = async (url: string, formularioId: number) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(formularioId);
      toast.success('URL copiada para a área de transferência!');
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (error) {
      toast.error('Erro ao copiar URL');
    }
  };

  const getPublicUrl = (formulario: Formulario): string => {
    if (formulario.public_url) {
      return formulario.public_url;
    }
    // Gerar URL baseada no ID se não tiver public_url (fallback)
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    const port = window.location.port || '3000';
    return `${protocol}//${hostname}:${port}/descarregamento/formulario/${formulario.id}`;
  };

  // Templates SMS
  const fetchSmsTemplates = async () => {
    try {
      const response = await fetch('/api/descarregamento/sms-templates', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSmsTemplates(data.data?.templates || []);
      }
    } catch (error) {
      console.error('Erro ao carregar templates SMS:', error);
    }
  };

  const handleSaveSmsTemplate = async () => {
    if (!smsTemplateForm.name.trim() || !smsTemplateForm.message.trim()) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      const url = editingSmsTemplate
        ? `/api/descarregamento/sms-templates/${editingSmsTemplate.id}`
        : '/api/descarregamento/sms-templates';
      
      const method = editingSmsTemplate ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(smsTemplateForm)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao salvar template SMS');
      }

      toast.success(editingSmsTemplate ? 'Template SMS atualizado com sucesso!' : 'Template SMS criado com sucesso!');
      setShowSmsTemplateModal(false);
      setEditingSmsTemplate(null);
      setSmsTemplateForm({
        name: '',
        message: '',
        template_type: 'arrival',
        is_default: false
      });
      fetchSmsTemplates();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar template SMS');
    }
  };

  const handleEditSmsTemplate = (template: SMSTemplate) => {
    setEditingSmsTemplate(template);
    setSmsTemplateForm({
      name: template.name,
      message: template.message,
      template_type: template.template_type,
      is_default: template.is_default
    });
    setShowSmsTemplateModal(true);
  };

  const handleDeleteSmsTemplate = async (id: number) => {
    if (!window.confirm('Tem certeza que deseja excluir este template SMS?')) return;

    try {
      const response = await fetch(`/api/descarregamento/sms-templates/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Erro ao excluir template SMS');

      toast.success('Template SMS excluído com sucesso');
      fetchSmsTemplates();
    } catch (error) {
      toast.error('Erro ao excluir template SMS');
    }
  };

  const handleTestSmsClick = (template: SMSTemplate) => {
    setTestingTemplate(template);
    setTestPhoneNumber('');
    setShowTestSmsModal(true);
  };

  const handleTestSms = async () => {
    if (!testingTemplate) return;

    if (!testPhoneNumber || !testPhoneNumber.trim()) {
      toast.error('Digite o número de telefone');
      return;
    }

    // Validar formato básico do telefone
    const phoneRegex = /^\d{10,15}$/;
    if (!phoneRegex.test(testPhoneNumber.trim())) {
      toast.error('Número de telefone inválido. Use apenas números (10 a 15 dígitos)');
      return;
    }

    try {
      const response = await fetch('/api/descarregamento/sms-templates/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          template_id: testingTemplate.id,
          phone_number: testPhoneNumber.trim()
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao enviar SMS de teste');
      }

      await response.json();
      toast.success('SMS de teste enviado com sucesso!');
      setShowTestSmsModal(false);
      setTestingTemplate(null);
      setTestPhoneNumber('');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao enviar SMS de teste');
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Configurações de Descarregamento</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Configure docas e formulários de chegada</p>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('docas')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'docas'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <MapPin className="inline w-4 h-4 mr-2" />
              Docas
            </button>
            <button
              onClick={() => setActiveTab('formularios')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'formularios'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <FileText className="inline w-4 h-4 mr-2" />
              Formulários
            </button>
            <button
              onClick={() => setActiveTab('sms')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'sms'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <MessageSquare className="inline w-4 h-4 mr-2" />
              Templates SMS
            </button>
          </nav>
        </div>

        <div className="p-6">
          {/* Tab: Docas */}
          {activeTab === 'docas' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Gerenciar Docas</h2>
                {hasPermission('descarregamento.formularios.manage') && (
                  <button
                    onClick={() => {
                      setEditingDoca(null);
                      setDocaForm({ numero: '', nome: '', is_active: true });
                      setShowDocaModal(true);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    Nova Doca
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {docas.map(doca => (
                  <div
                    key={doca.id}
                    className={`p-4 rounded-lg border-2 ${
                      doca.is_active
                        ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                        : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-700/50'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {doca.nome || `Doca ${doca.numero}`}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Número: {doca.numero}</p>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded ${
                        doca.is_active
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {doca.is_active ? 'Ativa' : 'Inativa'}
                      </span>
                    </div>
                    {hasPermission('descarregamento.formularios.manage') && (
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => handleEditDoca(doca)}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 text-sm"
                        >
                          <Edit className="w-4 h-4 inline mr-1" />
                          Editar
                        </button>
                        <button
                          onClick={() => handleDeleteDoca(doca.id)}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 text-sm"
                        >
                          <Trash2 className="w-4 h-4 inline mr-1" />
                          Excluir
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab: Formulários */}
          {activeTab === 'formularios' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Gerenciar Formulários</h2>
                {hasPermission('descarregamento.formularios.manage') && (
                  <button
                    onClick={() => {
                      setEditingFormulario(null);
                      setFormularioForm({
                        title: '',
                        description: '',
                        fields: [],
                        is_published: false,
                        is_default: false
                      });
                      setShowFormularioModal(true);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    Novo Formulário
                  </button>
                )}
              </div>

              <div className="space-y-4">
                {formularios.map(formulario => (
                  <div
                    key={formulario.id}
                    className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-gray-900 dark:text-white">{formulario.title}</h3>
                          {formulario.is_default && (
                            <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded">
                              Padrão
                            </span>
                          )}
                          {formulario.is_published && (
                            <span className="px-2 py-1 text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded">
                              Publicado
                            </span>
                          )}
                        </div>
                        {formulario.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{formulario.description}</p>
                        )}
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                          {formulario.fields.length} campo(s)
                        </p>
                      </div>
                      {hasPermission('descarregamento.formularios.manage') && (
                        <div className="flex gap-2">
                          {formulario.is_published && (
                            <>
                              <button
                                onClick={() => regenerateLink(formulario.id)}
                                className="text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300"
                                title="Regenerar link (atualiza a URL quando o ngrok reinicia)"
                              >
                                <RefreshCw className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => toggleQrCode(formulario.id)}
                                className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                                title="Mostrar QR Code"
                              >
                                <QrCode className="w-5 h-5" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleEditFormulario(formulario)}
                            className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteFormulario(formulario.id)}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      )}
                    </div>
                    
                    {/* QR Code Section */}
                    {formulario.is_published && qrCodeVisible === formulario.id && (
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex flex-col items-center gap-4">
                          <div className="bg-white p-4 rounded-lg">
                            <QRCodeSVG
                              value={getPublicUrl(formulario)}
                              size={200}
                              level="M"
                              includeMargin={true}
                            />
                          </div>
                          <div className="w-full">
                            <div className="flex items-center gap-2 mb-2">
                              <input
                                type="text"
                                readOnly
                                value={getPublicUrl(formulario)}
                                className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                              />
                              <button
                                onClick={() => regenerateLink(formulario.id)}
                                className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg flex items-center gap-1.5 text-sm"
                                title="Atualizar link (ex.: após reiniciar o ngrok)"
                              >
                                <RefreshCw className="w-4 h-4" />
                                Regenerar
                              </button>
                              <button
                                onClick={() => copyUrl(getPublicUrl(formulario), formulario.id)}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 text-sm"
                              >
                                {copiedUrl === formulario.id ? (
                                  <>
                                    <Check className="w-4 h-4" />
                                    Copiado
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-4 h-4" />
                                    Copiar
                                  </>
                                )}
                              </button>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                              Escaneie o QR Code com o celular para acessar o formulário público. Se o ngrok reiniciar, use &quot;Regenerar&quot; para atualizar o link.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab: Templates SMS */}
          {activeTab === 'sms' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Templates de SMS</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Configure as mensagens enviadas aos motoristas quando são chamados ou liberados
                  </p>
                </div>
                {hasPermission('descarregamento.formularios.manage') && (
                  <button
                    onClick={() => {
                      setEditingSmsTemplate(null);
                      setSmsTemplateForm({
                        name: '',
                        message: '',
                        template_type: 'arrival',
                        is_default: false
                      });
                      setShowSmsTemplateModal(true);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    Novo Template
                  </button>
                )}
              </div>

              <div className="space-y-4">
                {/* Templates de Chegada (arrival) */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    Templates de Chamado (Chegada)
                  </h3>
                  <div className="grid grid-cols-1 gap-4">
                    {smsTemplates
                      .filter(t => t.template_type === 'arrival')
                      .map(template => (
                        <div
                          key={template.id}
                          className={`p-4 rounded-lg border-2 ${
                            template.is_default
                              ? 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20'
                              : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-700/50'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold text-gray-900 dark:text-white">
                                  {template.name}
                                </h4>
                                {template.is_default && (
                                  <span className="px-2 py-1 text-xs rounded bg-blue-600 text-white">
                                    Padrão
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                                {template.message}
                              </p>
                            </div>
                            {hasPermission('descarregamento.formularios.manage') && (
                              <div className="flex gap-2 ml-4">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleTestSmsClick(template);
                                  }}
                                  className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                                  title="Testar SMS"
                                >
                                  <Send className="w-5 h-5" />
                                </button>
                                <button
                                  onClick={() => handleEditSmsTemplate(template)}
                                  className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                                >
                                  <Edit className="w-5 h-5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteSmsTemplate(template.id)}
                                  className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    {smsTemplates.filter(t => t.template_type === 'arrival').length === 0 && (
                      <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-4">
                        Nenhum template de chamado cadastrado
                      </p>
                    )}
                  </div>
                </div>

                {/* Templates de Liberação (release) */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    Templates de Liberação
                  </h3>
                  <div className="grid grid-cols-1 gap-4">
                    {smsTemplates
                      .filter(t => t.template_type === 'release')
                      .map(template => (
                        <div
                          key={template.id}
                          className={`p-4 rounded-lg border-2 ${
                            template.is_default
                              ? 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20'
                              : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-700/50'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold text-gray-900 dark:text-white">
                                  {template.name}
                                </h4>
                                {template.is_default && (
                                  <span className="px-2 py-1 text-xs rounded bg-blue-600 text-white">
                                    Padrão
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                                {template.message}
                              </p>
                            </div>
                            {hasPermission('descarregamento.formularios.manage') && (
                              <div className="flex gap-2 ml-4">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleTestSmsClick(template);
                                  }}
                                  className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                                  title="Testar SMS"
                                >
                                  <Send className="w-5 h-5" />
                                </button>
                                <button
                                  onClick={() => handleEditSmsTemplate(template)}
                                  className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                                >
                                  <Edit className="w-5 h-5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteSmsTemplate(template.id)}
                                  className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    {smsTemplates.filter(t => t.template_type === 'release').length === 0 && (
                      <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-4">
                        Nenhum template de liberação cadastrado
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Doca */}
      {showDocaModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                {editingDoca ? 'Editar Doca' : 'Nova Doca'}
              </h3>
              <button
                onClick={() => {
                  setShowDocaModal(false);
                  setEditingDoca(null);
                  setDocaForm({ numero: '', nome: '', is_active: true });
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Número da Doca *
                </label>
                <input
                  type="text"
                  value={docaForm.numero}
                  onChange={(e) => setDocaForm({ ...docaForm, numero: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Ex: 1, 2, A, B..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nome (Opcional)
                </label>
                <input
                  type="text"
                  value={docaForm.nome}
                  onChange={(e) => setDocaForm({ ...docaForm, nome: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Ex: Doca Principal, Doca de Entrada..."
                />
              </div>

              <label className="flex items-center gap-3 cursor-pointer py-2 -mx-1 px-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 w-fit transition-colors">
                <input
                  type="checkbox"
                  checked={docaForm.is_active}
                  onChange={(e) => setDocaForm({ ...docaForm, is_active: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 flex-shrink-0"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300 select-none">Doca ativa</span>
              </label>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowDocaModal(false);
                    setEditingDoca(null);
                    setDocaForm({ numero: '', nome: '', is_active: true });
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveDoca}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Formulário */}
      {showFormularioModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full my-auto max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                {editingFormulario ? 'Editar Formulário' : 'Novo Formulário'}
              </h3>
              <button
                onClick={() => {
                  setShowFormularioModal(false);
                  setEditingFormulario(null);
                  setFormularioForm({
                    title: '',
                    description: '',
                    fields: [],
                    is_published: false,
                    is_default: false
                  });
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Título do Formulário *
                </label>
                <input
                  type="text"
                  value={formularioForm.title}
                  onChange={(e) => setFormularioForm({ ...formularioForm, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Ex: Formulário de Chegada"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Descrição
                </label>
                <textarea
                  value={formularioForm.description}
                  onChange={(e) => setFormularioForm({ ...formularioForm, description: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Descrição do formulário..."
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Campos do Formulário *
                  </label>
                  <button
                    type="button"
                    onClick={handleAddField}
                    className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 text-sm flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar Campo
                  </button>
                </div>

                <div className="space-y-4">
                  {formularioForm.fields.map((field, index) => (
                    <div key={field.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Campo {index + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveField(field.id)}
                          className="text-red-600 hover:text-red-900 dark:text-red-400"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Tipo *</label>
                          <select
                            value={field.type}
                            onChange={(e) => handleFieldChange(field.id, 'type', e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          >
                            <option value="text">Texto</option>
                            <option value="textarea">Área de Texto</option>
                            <option value="number">Número</option>
                            <option value="date">Data</option>
                            <option value="time">Hora</option>
                            <option value="select">Select (Dropdown)</option>
                            <option value="radio">Radio</option>
                            <option value="checkbox">Checkbox</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Label *</label>
                          <input
                            type="text"
                            value={field.label}
                            onChange={(e) => handleFieldChange(field.id, 'label', e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            placeholder="Nome do campo"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Nome (name) *</label>
                          <input
                            type="text"
                            value={field.name}
                            onChange={(e) => handleFieldChange(field.id, 'name', e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            placeholder="nome_campo"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Placeholder</label>
                          <input
                            type="text"
                            value={field.placeholder || ''}
                            onChange={(e) => handleFieldChange(field.id, 'placeholder', e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            placeholder="Placeholder..."
                          />
                        </div>

                        {(field.type === 'select' || field.type === 'radio') && (
                          <div className="md:col-span-2">
                            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                              Opções (separadas por vírgula) *
                            </label>
                            <input
                              type="text"
                              value={field.options?.join(', ') || ''}
                              onChange={(e) => handleFieldChange(field.id, 'options', e.target.value.split(',').map(o => o.trim()).filter(o => o))}
                              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              placeholder="Opção 1, Opção 2, Opção 3"
                            />
                          </div>
                        )}

                        <label className="md:col-span-2 flex items-center gap-3 cursor-pointer py-3 px-2 -mx-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-600">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) => handleFieldChange(field.id, 'required', e.target.checked)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 flex-shrink-0"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300 select-none">Campo obrigatório</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

                <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <label className="flex items-center gap-3 cursor-pointer py-2 -mx-1 px-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 w-fit transition-colors">
                    <input
                      type="checkbox"
                      checked={formularioForm.is_published}
                      onChange={(e) => setFormularioForm({ ...formularioForm, is_published: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 flex-shrink-0"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300 select-none">Publicado (acessível publicamente)</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer py-2 -mx-1 px-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 w-fit transition-colors">
                    <input
                      type="checkbox"
                      checked={formularioForm.is_default}
                      onChange={(e) => setFormularioForm({ ...formularioForm, is_default: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 flex-shrink-0"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300 select-none">Formulário padrão</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
              <button
                onClick={() => {
                  setShowFormularioModal(false);
                  setEditingFormulario(null);
                  setFormularioForm({
                    title: '',
                    description: '',
                    fields: [],
                    is_published: false,
                    is_default: false
                  });
                }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveFormulario}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Template SMS */}
      {showSmsTemplateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full my-auto max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                {editingSmsTemplate ? 'Editar Template SMS' : 'Novo Template SMS'}
              </h3>
              <button
                onClick={() => {
                  setShowSmsTemplateModal(false);
                  setEditingSmsTemplate(null);
                  setSmsTemplateForm({
                    name: '',
                    message: '',
                    template_type: 'arrival',
                    is_default: false
                  });
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nome do Template *
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Ex: Chamado Padrão"
                    value={smsTemplateForm.name}
                    onChange={(e) => setSmsTemplateForm({ ...smsTemplateForm, name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tipo de Template *
                  </label>
                  <select
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    value={smsTemplateForm.template_type}
                    onChange={(e) => setSmsTemplateForm({ ...smsTemplateForm, template_type: e.target.value as 'arrival' | 'release' })}
                  >
                    <option value="arrival">Chamado (Chegada)</option>
                    <option value="release">Liberação</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Mensagem *
                  </label>
                  <textarea
                    rows={6}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Digite a mensagem que será enviada por SMS. Use {{driver_name}}, {{fornecedor_name}}, {{scheduled_date}}, {{scheduled_time}}, {{dock}} para variáveis."
                    value={smsTemplateForm.message}
                    onChange={(e) => setSmsTemplateForm({ ...smsTemplateForm, message: e.target.value })}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Variáveis disponíveis: {smsTemplateForm.template_type === 'arrival' 
                      ? '{{driver_name}}, {{fornecedor_name}}, {{scheduled_date}}, {{scheduled_time}}, {{dock}}'
                      : '{{driver_name}}, {{fornecedor_name}}, {{tracking_code}}'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {smsTemplateForm.message.length} caracteres (máximo 1600)
                  </p>
                </div>

                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <label className="flex items-center gap-3 cursor-pointer py-2 -mx-1 px-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 w-fit transition-colors">
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 flex-shrink-0"
                      checked={smsTemplateForm.is_default}
                      onChange={(e) => setSmsTemplateForm({ ...smsTemplateForm, is_default: e.target.checked })}
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300 select-none">Template padrão (usado automaticamente)</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 pt-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
              <button
                onClick={() => {
                  setShowSmsTemplateModal(false);
                  setEditingSmsTemplate(null);
                  setSmsTemplateForm({
                    name: '',
                    message: '',
                    template_type: 'arrival',
                    is_default: false
                  });
                }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveSmsTemplate}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Testar SMS */}
      {showTestSmsModal && testingTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                Testar SMS - {testingTemplate.name}
              </h3>
              <button
                onClick={() => {
                  setShowTestSmsModal(false);
                  setTestingTemplate(null);
                  setTestPhoneNumber('');
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Número de Telefone *
                </label>
                <input
                  type="text"
                  value={testPhoneNumber}
                  onChange={(e) => setTestPhoneNumber(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="11999999999 (sem espaços ou caracteres especiais)"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleTestSms();
                    }
                  }}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Digite apenas números (10 a 15 dígitos)
                </p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Preview da mensagem:
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                  {testingTemplate.message.replace(/\{\{driver_name\}\}/g, 'Motorista Teste')
                    .replace(/\{\{fornecedor_name\}\}/g, 'Fornecedor Teste')
                    .replace(/\{\{scheduled_date\}\}/g, new Date().toLocaleDateString('pt-BR'))
                    .replace(/\{\{scheduled_time\}\}/g, new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
                    .replace(/\{\{dock\}\}/g, 'Doca 01')
                    .replace(/\{\{tracking_code\}\}/g, 'TEST-12345')}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  setShowTestSmsModal(false);
                  setTestingTemplate(null);
                  setTestPhoneNumber('');
                }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={handleTestSms}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                Enviar SMS de Teste
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DescarregamentoConfig;
