'use client';

import React, { useState, useEffect, useTransition, useCallback } from 'react';
import {
  CreditCard,
  RotateCcw,
  Plus,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Invoice, InvoicePayment, Profile } from '@/lib/types';
import { formatDate, formatLKR } from '@/lib/utils';
import { NotificationState } from '@/components/ui/Notification';
import { PaymentReceiptModal } from '@/components/payments/PaymentReceiptModal';

interface PaymentHistorySectionProps {
  invoice: Invoice;
  currentProfile: Profile;
  onOpenAddPayment: () => void;
  onRefreshInvoice: () => void;
  setNotification: (notif: NotificationState) => void;
}

export function PaymentHistorySection({
  invoice,
  currentProfile,
  onOpenAddPayment,
  onRefreshInvoice,
  setNotification,
}: PaymentHistorySectionProps) {
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();
  const [payments, setPayments] = useState<InvoicePayment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Reversal Modal State
  const [selectedPaymentForReversal, setSelectedPaymentForReversal] = useState<InvoicePayment | null>(null);
  const [selectedPaymentForReceipt, setSelectedPaymentForReceipt] = useState<InvoicePayment | null>(null);
  const [reversalReason, setReversalReason] = useState<string>('');

  const role = currentProfile?.role?.trim().toLowerCase();
  const isOwner = role === 'owner';

  const fetchPayments = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('invoice_payments')
        .select('*')
        .eq('invoice_id', invoice.id)
        .order('payment_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPayments((data as InvoicePayment[]) || []);
    } catch (err: unknown) {
      console.error('Error fetching invoice payments:', err);
    } finally {
      setLoading(false);
    }
  }, [invoice.id, supabase]);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        const { data, error } = await supabase
          .from('invoice_payments')
          .select('*')
          .eq('invoice_id', invoice.id)
          .order('payment_date', { ascending: false })
          .order('created_at', { ascending: false });

        if (error) throw error;
        if (isMounted) {
          setPayments((data as InvoicePayment[]) || []);
          setLoading(false);
        }
      } catch (err: unknown) {
        console.error('Error fetching invoice payments:', err);
        if (isMounted) setLoading(false);
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, [invoice.id, supabase]);

  const handleReversePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPaymentForReversal || !reversalReason.trim()) return;

    startTransition(async () => {
      try {
        const { error: rpcError } = await supabase.rpc('reverse_invoice_payment', {
          p_payment_id: selectedPaymentForReversal.id,
          p_reason: reversalReason.trim(),
          p_user_id: currentProfile.id,
          p_user_name: currentProfile.full_name,
        });

        if (rpcError) {
          // Fallback manual update
          await supabase
            .from('invoice_payments')
            .update({
              is_reversed: true,
              reversed_at: new Date().toISOString(),
              reversed_by: currentProfile.id,
              reversal_reason: reversalReason.trim(),
            })
            .eq('id', selectedPaymentForReversal.id);

          const { data: activePayments } = await supabase
            .from('invoice_payments')
            .select('amount')
            .eq('invoice_id', invoice.id)
            .eq('is_reversed', false);

          const totalPaid = (activePayments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
          const newBalance = Math.max(0, (invoice.net_amount || 0) - totalPaid);

          let newStatus = invoice.status;
          if (invoice.status !== 'Draft' && invoice.status !== 'Cancelled') {
            if (newBalance === 0) newStatus = 'Paid';
            else if (totalPaid > 0) newStatus = 'Partially Paid';
            else newStatus = 'Issued';
          }

          await supabase
            .from('invoices')
            .update({
              amount_paid: totalPaid,
              balance_due: newBalance,
              status: newStatus,
              updated_at: new Date().toISOString(),
            })
            .eq('id', invoice.id);

          await supabase.from('invoice_activity_logs').insert({
            invoice_id: invoice.id,
            user_id: currentProfile.id,
            user_name: currentProfile.full_name,
            action: 'payment_reversed',
            details: {
              payment_id: selectedPaymentForReversal.id,
              amount: selectedPaymentForReversal.amount,
              reason: reversalReason.trim(),
            },
          });
        }

        setNotification({
          type: 'success',
          message: `Payment of ${formatLKR(selectedPaymentForReversal.amount)} reversed successfully.`,
        });

        setSelectedPaymentForReversal(null);
        setReversalReason('');
        fetchPayments();
        onRefreshInvoice();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to reverse payment.';
        setNotification({ type: 'error', message: msg });
      }
    });
  };

  const activePayments = payments.filter((p) => !p.is_reversed);
  const totalPaidSum = activePayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const balanceDue = Math.max(0, (invoice.net_amount || 0) - totalPaidSum);

  return (
    <div className="p-6 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-5 shadow-xl">
      {/* Header & Add Payment Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-amber-400" />
          <div>
            <h2 className="text-sm font-bold text-zinc-100">Payment History & Collections</h2>
            <p className="text-[11px] text-zinc-400">
              Recorded customer payments and payment reversals for Invoice {invoice.invoice_number}
            </p>
          </div>
        </div>

        {invoice.status !== 'Draft' && invoice.status !== 'Cancelled' && balanceDue > 0 && (
          <button
            type="button"
            onClick={onOpenAddPayment}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs transition-all shadow-md active:scale-95 min-h-[44px]"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Add Payment</span>
          </button>
        )}
      </div>

      {/* Financial Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-lg bg-zinc-950 border border-zinc-850 text-xs">
        <div className="p-2.5 rounded bg-zinc-900 border border-zinc-850">
          <span className="text-[10px] text-zinc-400 uppercase font-semibold">Total Invoice Net Value</span>
          <p className="text-sm font-extrabold text-zinc-100 font-mono mt-0.5">{formatLKR(invoice.net_amount)}</p>
        </div>
        <div className="p-2.5 rounded bg-zinc-900 border border-zinc-850">
          <span className="text-[10px] text-emerald-400 uppercase font-semibold">Total Payments Collected</span>
          <p className="text-sm font-extrabold text-emerald-400 font-mono mt-0.5">{formatLKR(totalPaidSum)}</p>
        </div>
        <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/30">
          <span className="text-[10px] text-amber-400 uppercase font-semibold">Current Balance Due</span>
          <p className="text-sm font-extrabold text-amber-400 font-mono mt-0.5">{formatLKR(balanceDue)}</p>
        </div>
      </div>

      {/* Payment History List */}
      {loading ? (
        <div className="py-8 text-center text-zinc-500">
          <Loader2 className="w-5 h-5 animate-spin mx-auto text-amber-400 mb-1" />
          <p className="text-xs">Loading payment records...</p>
        </div>
      ) : payments.length === 0 ? (
        <div className="p-8 text-center rounded-lg bg-zinc-950/60 border border-zinc-850 text-zinc-500 text-xs">
          <CreditCard className="w-8 h-8 mx-auto text-zinc-600 mb-2" />
          <p className="font-semibold text-zinc-400">No payments have been recorded for this invoice.</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            Click &quot;Add Payment&quot; above to record a payment once issued.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto rounded-lg border border-zinc-850">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-zinc-950 text-zinc-400 uppercase text-[10px] font-bold border-b border-zinc-850">
                <tr>
                  <th className="py-3 px-4">Payment Date</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Reference No</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4">Notes</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Receipt & Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850/60 bg-zinc-950/40">
                {payments.map((pay) => (
                  <tr
                    key={pay.id}
                    className={`hover:bg-zinc-850/40 transition-colors ${
                      pay.is_reversed ? 'opacity-60 bg-red-950/10' : ''
                    }`}
                  >
                    <td className="py-3 px-4 font-mono">{formatDate(pay.payment_date)}</td>
                    <td className="py-3 px-4 font-semibold text-zinc-200">{pay.payment_method}</td>
                    <td className="py-3 px-4 font-mono text-zinc-400">{pay.reference_number || '-'}</td>
                    <td
                      className={`py-3 px-4 text-right font-mono font-bold ${
                        pay.is_reversed ? 'line-through text-zinc-500' : 'text-emerald-400'
                      }`}
                    >
                      {formatLKR(pay.amount)}
                    </td>
                    <td className="py-3 px-4 text-zinc-400 max-w-xs truncate">{pay.notes || '-'}</td>
                    <td className="py-3 px-4 text-center">
                      {pay.is_reversed ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-950 text-red-400 border border-red-800/60">
                          <XCircle className="w-3 h-3" />
                          <span>Reversed</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Completed</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedPaymentForReceipt(pay)}
                          className="px-2 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-amber-400 border border-zinc-700 text-[11px] font-semibold transition-colors flex items-center gap-1 min-h-[32px]"
                          title="View / Download Payment Receipt"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Receipt</span>
                        </button>

                        {isOwner && !pay.is_reversed && (
                          <button
                            type="button"
                            onClick={() => setSelectedPaymentForReversal(pay)}
                            className="p-1.5 rounded-md hover:bg-red-950/60 text-red-400 hover:text-red-300 border border-red-900/40 text-[11px] font-semibold transition-colors flex items-center gap-1 min-h-[32px]"
                            title="Reverse Payment (Owner Only)"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Reverse</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {payments.map((pay) => (
              <div
                key={pay.id}
                className={`p-4 rounded-xl bg-zinc-950 border border-zinc-850 space-y-2.5 shadow-md ${
                  pay.is_reversed ? 'opacity-60 bg-red-950/10' : ''
                }`}
              >
                <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
                  <div>
                    <span className="text-xs font-bold text-zinc-200">{pay.payment_method}</span>
                    <p className="text-[10px] text-zinc-400 font-mono">{formatDate(pay.payment_date)}</p>
                  </div>

                  {pay.is_reversed ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-950 text-red-400 border border-red-800">
                      Reversed
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                      Completed
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase font-bold">Ref No</span>
                    <p className="font-mono text-zinc-300">{pay.reference_number || '-'}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-zinc-500 uppercase font-bold">Amount</span>
                    <p className={`font-mono font-bold text-sm ${pay.is_reversed ? 'line-through text-zinc-500' : 'text-emerald-400'}`}>
                      {formatLKR(pay.amount)}
                    </p>
                  </div>
                </div>

                {pay.notes && (
                  <p className="text-[11px] text-zinc-400 bg-zinc-900 p-2 rounded border border-zinc-850">
                    {pay.notes}
                  </p>
                )}

                <div className="pt-2 border-t border-zinc-850 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentForReceipt(pay)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-400 border border-zinc-700 text-xs font-semibold min-h-[44px]"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Receipt PDF</span>
                  </button>

                  {isOwner && !pay.is_reversed && (
                    <button
                      type="button"
                      onClick={() => setSelectedPaymentForReversal(pay)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-red-950/60 hover:bg-red-900/60 text-red-400 border border-red-900/40 text-xs font-semibold min-h-[44px]"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Reverse</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Owner Reversal Modal */}
      {selectedPaymentForReversal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-sm font-bold text-white">Reverse Payment Confirmation</h3>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              Are you sure you want to reverse the payment of{' '}
              <strong className="text-emerald-400 font-mono">
                {formatLKR(selectedPaymentForReversal.amount)}
              </strong>{' '}
              ({selectedPaymentForReversal.payment_method}) recorded on{' '}
              {formatDate(selectedPaymentForReversal.payment_date)}?
            </p>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Reason for Reversal *
              </label>
              <textarea
                rows={2}
                required
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                placeholder="e.g. Bank transfer bounced or duplicate entry"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-200 focus:outline-none focus:border-red-500 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedPaymentForReversal(null);
                  setReversalReason('');
                }}
                className="px-4 py-2.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-semibold min-h-[44px]"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isPending || !reversalReason.trim()}
                onClick={handleReversePayment}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all min-h-[44px] disabled:opacity-50"
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                <span>Confirm Reversal</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <PaymentReceiptModal
        isOpen={!!selectedPaymentForReceipt}
        onClose={() => setSelectedPaymentForReceipt(null)}
        invoice={invoice}
        payment={selectedPaymentForReceipt}
        onError={(msg) => setNotification({ type: 'error', message: msg })}
      />
    </div>
  );
}
