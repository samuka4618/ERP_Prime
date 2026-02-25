import React, { useRef, useCallback, useMemo } from 'react';
import { X, Bold, Italic, AlignCenter, Type, Eye } from 'lucide-react';
import type { NotificationTemplateItem } from '../services/api';
import { HtmlSyntaxHighlight } from './HtmlSyntaxHighlight';

/** Valores de exemplo para substituir placeholders na pré-visualização */
const PREVIEW_PLACEHOLDERS: Record<string, string> = {
  '{{ticket.subject}}': 'Exemplo: Solicitação de suporte ao sistema',
  '{{ticket.category}}': 'Suporte Técnico',
  '{{ticket.priority}}': 'Alta',
  '{{ticket.user_name}}': 'João Silva',
  '{{old_status}}': 'Aberto',
  '{{new_status}}': 'Em Atendimento',
  '{{approval_action}}': 'aprovado',
  '{{approval_status}}': 'confirmado como resolvido',
  '{{registration_message}}': 'Seu cadastro foi enviado e está aguardando análise.',
};

interface NotificationTemplateModalProps {
  template: NotificationTemplateItem | null;
  onClose: () => void;
  onSave: (key: string, subject: string, bodyHtml: string) => Promise<void>;
}

const insertAtCursor = (
  textarea: HTMLTextAreaElement | null,
  before: string,
  after: string,
  onUpdate: (newValue: string) => void
) => {
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  const selected = value.slice(start, end);
  const newValue = value.slice(0, start) + before + selected + after + value.slice(end);
  textarea.value = newValue;
  onUpdate(newValue);
  textarea.focus();
  textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
};

export const NotificationTemplateModal: React.FC<NotificationTemplateModalProps> = ({
  template,
  onClose,
  onSave,
}) => {
  const [subject, setSubject] = React.useState('');
  const [bodyHtml, setBodyHtml] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [showPreview, setShowPreview] = React.useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const syncScrollRef = useRef<HTMLDivElement>(null);

  /** HTML do corpo com placeholders trocados por valores de exemplo para a pré-visualização */
  const previewHtml = useMemo(() => {
    let html = bodyHtml || '';
    Object.entries(PREVIEW_PLACEHOLDERS).forEach(([ph, value]) => {
      html = html.split(ph).join(value);
    });
    html = html.replace(/\{\{[\w.]+\}\}/g, '[valor de exemplo]');
    return html;
  }, [bodyHtml]);

  /** Documento completo em data URI para o iframe (evita que </body> no conteúdo quebre o iframe) */
  const previewSrc = useMemo(() => {
    const fullDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:16px;font-family:Segoe UI,Tahoma,Geneva,Verdana,sans-serif;font-size:14px;line-height:1.6;color:#333;">${previewHtml}</body></html>`;
    try {
      return 'data:text/html;charset=utf-8,' + encodeURIComponent(fullDoc);
    } catch {
      return 'about:blank';
    }
  }, [previewHtml]);

  // Sincronizar rolagem do textarea com o painel de destaque de sintaxe
  const handleScroll = useCallback(() => {
    const ta = bodyRef.current;
    const sync = syncScrollRef.current;
    if (ta && sync) sync.scrollTop = ta.scrollTop;
  }, []);

  React.useEffect(() => {
    if (template) {
      setSubject(template.subject_template);
      setBodyHtml(template.body_html);
    }
  }, [template]);

  const handleSave = useCallback(async () => {
    if (!template) return;
    setSaving(true);
    try {
      await onSave(template.key, subject, bodyHtml);
      onClose();
    } finally {
      setSaving(false);
    }
  }, [template, subject, bodyHtml, onSave, onClose]);

  if (!template) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Personalizar e-mail: {template.label}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <p className="text-sm text-gray-600 dark:text-gray-400">{template.description}</p>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Assunto do e-mail
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Ex: Novo Chamado Criado"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Corpo do e-mail (HTML) — com cores para facilitar a leitura
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPreview(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-700"
                  title="Ver como o e-mail será exibido"
                >
                  <Eye className="w-4 h-4" />
                  Visualizar e-mail
                </button>
                <button
                  type="button"
                  onClick={() => insertAtCursor(bodyRef.current, '<strong>', '</strong>', setBodyHtml)}
                  className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300"
                  title="Negrito"
                >
                  <Bold className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => insertAtCursor(bodyRef.current, '<em>', '</em>', setBodyHtml)}
                  className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300"
                  title="Itálico"
                >
                  <Italic className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => insertAtCursor(bodyRef.current, '<p style="text-align: center">', '</p>', setBodyHtml)}
                  className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300"
                  title="Parágrafo centralizado"
                >
                  <AlignCenter className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => insertAtCursor(bodyRef.current, '<span style="color: #2563eb">', '</span>', setBodyHtml)}
                  className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300"
                  title="Cor (azul)"
                >
                  <Type className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="relative rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden bg-gray-50 dark:bg-gray-900/50" style={{ minHeight: 280 }}>
              {/* Painel de destaque de sintaxe (atrás) — rolagem sincronizada */}
              <div
                ref={syncScrollRef}
                className="absolute inset-0 overflow-auto py-3 px-3 notification-modal-sync"
                aria-hidden
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                <div ref={highlightRef} className="min-h-full font-mono text-sm leading-relaxed">
                  <HtmlSyntaxHighlight code={bodyHtml || ' '} className="block min-h-[260px]" />
                </div>
              </div>
              <style>{`
                .notification-modal-sync::-webkit-scrollbar { display: none; }
                .notification-modal-sync { scrollbar-width: none; -ms-overflow-style: none; }
              `}</style>
              {/* Textarea por cima: texto transparente para ver as cores; cursor e seleção visíveis */}
              <textarea
                ref={bodyRef}
                value={bodyHtml}
                onChange={(e) => setBodyHtml(e.target.value)}
                onScroll={handleScroll}
                className="notification-modal-sync absolute inset-0 w-full h-full py-3 px-3 font-mono text-sm leading-relaxed resize-none border-0 outline-none bg-transparent text-transparent caret-gray-900 dark:caret-gray-100 overflow-auto placeholder:text-gray-400 dark:placeholder:text-gray-500"
                style={{ caretColor: 'var(--caret, #111)' }}
                placeholder="Use HTML para formatação. Ex: <p>Texto</p>, <strong>negrito</strong>"
                spellCheck={false}
              />
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              <strong>Cores:</strong> tags em azul, variáveis <code className="text-orange-600 dark:text-orange-400">{'{{ }}'}</code> em laranja, textos entre aspas em verde — como em editores de código.
            </p>
          </div>

          <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-3">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Variáveis disponíveis (clique para copiar):</p>
            <div className="flex flex-wrap gap-2">
              {template.placeholders.map((ph) => (
                <button
                  key={ph}
                  type="button"
                  onClick={() => {
                    const ta = bodyRef.current;
                    if (ta) {
                      const start = ta.selectionStart;
                      const value = ta.value;
                      const newValue = value.slice(0, start) + ph + value.slice(start);
                      ta.value = newValue;
                      ta.focus();
                      ta.setSelectionRange(start + ph.length, start + ph.length);
                      setBodyHtml(newValue);
                    }
                  }}
                  className="px-2 py-1 text-xs font-mono bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-500"
                >
                  {ph}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>

      {/* Modal de pré-visualização do e-mail (HTML renderizado) */}
      {showPreview && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60"
          onClick={() => setShowPreview(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="preview-title"
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 id="preview-title" className="text-lg font-semibold text-gray-900 dark:text-white">
                Pré-visualização do e-mail
              </h3>
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
                aria-label="Fechar pré-visualização"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 rounded-t-lg">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Assunto</p>
              <p className="text-sm text-gray-900 dark:text-white font-medium">{subject || '(vazio)'}</p>
            </div>
            <div className="flex-1 overflow-auto p-4 min-h-0">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Corpo do e-mail (como o destinatário verá)</p>
              <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-900">
                <iframe
                  title="Pré-visualização do corpo do e-mail"
                  src={previewSrc}
                  className="w-full min-h-[320px] border-0"
                  sandbox="allow-same-origin"
                  style={{ minHeight: 320 }}
                />
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                As variáveis (ex.: {template.placeholders?.[0] ?? '{{ticket.subject}}'}) foram substituídas por valores de exemplo para você visualizar o layout.
              </p>
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 font-medium"
              >
                Fechar pré-visualização
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
