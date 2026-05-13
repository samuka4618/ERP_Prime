import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiService } from '../services/api';
import { PaginatedResponse, Ticket } from '../types';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import { approvalValueFromTicket, parseApprovalAmountInput } from '../utils/approvalAmount';
import Modal from '../components/Modal';

type BillingCycleOpt = 'monthly' | 'annual' | 'one_time';

const FinanceApprovals: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PaginatedResponse<Ticket> | null>(null);
  const [approveCardFor, setApproveCardFor] = useState<Ticket | null>(null);
  const [cardBillingCycle, setCardBillingCycle] = useState<BillingCycleOpt>('monthly');
  const [cardAmount, setCardAmount] = useState('');
  const [cardNotes, setCardNotes] = useState('');
  const [submittingCardApprove, setSubmittingCardApprove] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const data = await apiService.getPendingFinanceApprovals(page, 20);
      setResult(data);
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Erro ao carregar pendentes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const openApproveCardModal = (t: Ticket) => {
    setApproveCardFor(t);
    const cycleRaw =
      typeof t.custom_data?.ciclo_faturamento === 'string'
        ? t.custom_data.ciclo_faturamento
        : 'monthly';
    setCardBillingCycle(
      cycleRaw === 'annual' || cycleRaw === 'one_time' ? cycleRaw : 'monthly'
    );
    const ref = approvalValueFromTicket(t);
    setCardAmount(ref != null ? String(ref) : '');
    setCardNotes('');
  };

  const approve = async (t: Ticket) => {
    try {
      if (t.category?.approval_type === 'finance_card') {
        openApproveCardModal(t);
        return;
      }
      await apiService.financeApproveTicket(t.id);
      toast.success('Chamado aprovado');
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Erro ao aprovar');
    }
  };

  const submitApproveCard = async () => {
    if (!approveCardFor) return;
    const amount = parseApprovalAmountInput(cardAmount);
    if (amount === null || amount <= 0) {
      toast.error('Informe o valor efetivo contratado (número maior que zero).');
      return;
    }
    try {
      setSubmittingCardApprove(true);
      await apiService.financeApproveTicket(approveCardFor.id, {
        billing_cycle: cardBillingCycle,
        amount,
        notes: cardNotes.trim() || undefined
      });
      toast.success('Assinatura registrada e chamado resolvido');
      setApproveCardFor(null);
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Erro ao aprovar');
    } finally {
      setSubmittingCardApprove(false);
    }
  };

  const reject = async (t: Ticket) => {
    const reason = window.prompt('Motivo da rejeição?');
    if (!reason || reason.length < 3) {
      toast.error('Informe um motivo (mín. 3 caracteres)');
      return;
    }

    try {
      await apiService.financeRejectTicket(t.id, reason);
      toast.success('Chamado rejeitado');
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Erro ao rejeitar');
    }
  };

  if (loading && !result) return <LoadingSpinner />;

  const tickets = result?.data || [];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Aprovações financeiras</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
        Chamados em <strong>aprovação financeira</strong> atribuídos à sua faixa de valor (ou todos, se administrador).
        Nas categorias de <strong>cartão / assinatura digital</strong>, a aprovação registra a assinatura e resolve o
        chamado — preencha apenas ciclo de faturamento, valor efetivo contratado e observações; os demais dados vêm da
        abertura do chamado.
      </p>
      <div className="space-y-4">
        {tickets.length === 0 && <p className="text-gray-500">Nenhum chamado pendente.</p>}
        {tickets.map((t) => {
          const valorRefParsed = approvalValueFromTicket(t);
          const isCard = t.category?.approval_type === 'finance_card';
          return (
            <div
              key={t.id}
              className="card p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border border-gray-200 dark:border-gray-700"
            >
              <div>
                <Link to={`/tickets/${t.id}`} className="font-semibold text-primary-600 hover:underline">
                  #{t.id}
                </Link>
                <span className="ml-2 text-gray-900 dark:text-white">{t.subject}</span>
                {isCard ? (
                  <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-900 dark:text-emerald-100">
                    Assinatura digital
                  </span>
                ) : null}
                <p className="text-sm text-gray-500 mt-1">
                  {t.custom_data?.plataforma && <>Plataforma: {String(t.custom_data.plataforma)} · </>}
                  Valor ref.:{' '}
                  {valorRefParsed != null ? valorRefParsed.toLocaleString('pt-BR') : '— (valor em falta na abertura)'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => approve(t)}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                >
                  {isCard ? 'Aprovar e registrar assinatura' : 'Aprovar'}
                </button>
                <button
                  type="button"
                  onClick={() => reject(t)}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
                >
                  Rejeitar
                </button>
                <Link
                  to={`/tickets/${t.id}`}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-700 dark:text-gray-200"
                >
                  Abrir
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {approveCardFor && (
        <Modal
          title="Aprovar assinatura digital"
          size="md"
          onClose={() => !submittingCardApprove && setApproveCardFor(null)}
          closeOnOverlayClick={!submittingCardApprove}
        >
          <div className="space-y-4 text-sm">
            <p className="text-gray-600 dark:text-gray-400">
              Chamado #{approveCardFor.id}. Os dados da plataforma e credenciais já foram informados pelo solicitante ao
              abrir o chamado. Defina abaixo o ciclo de faturamento efetivo, o valor contratado e observações opcionais.
            </p>
            <div>
              <label className="block font-medium text-gray-700 dark:text-gray-200 mb-1">Ciclo de faturamento</label>
              <select
                className="input w-full dark:bg-gray-900"
                value={cardBillingCycle}
                onChange={(e) => setCardBillingCycle(e.target.value as BillingCycleOpt)}
              >
                <option value="monthly">Mensal</option>
                <option value="annual">Anual</option>
                <option value="one_time">Pagamento único</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-gray-700 dark:text-gray-200 mb-1">
                Valor efetivo contratado <span className="text-red-500">*</span>
              </label>
              <input
                className="input w-full dark:bg-gray-900"
                inputMode="decimal"
                value={cardAmount}
                onChange={(e) => setCardAmount(e.target.value)}
                placeholder="Ex.: 199,90"
              />
            </div>
            <div>
              <label className="block font-medium text-gray-700 dark:text-gray-200 mb-1">Observações</label>
              <textarea
                className="input w-full dark:bg-gray-900"
                rows={3}
                value={cardNotes}
                onChange={(e) => setCardNotes(e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                disabled={submittingCardApprove}
                className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600"
                onClick={() => setApproveCardFor(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={submittingCardApprove}
                className="px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
                onClick={submitApproveCard}
              >
                {submittingCardApprove ? 'Processando…' : 'Confirmar aprovação'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {result && result.total_pages > 1 && (
        <div className="mt-6 flex items-center gap-4">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1 rounded border disabled:opacity-50"
          >
            Anterior
          </button>
          <span className="text-sm text-gray-600">
            Página {page} / {result.total_pages}
          </span>
          <button
            type="button"
            disabled={page >= result.total_pages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 rounded border disabled:opacity-50"
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  );
};

export default FinanceApprovals;
