'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { X, DollarSign, Loader2, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Invoice, PaymentMethod, Profile } from '@/lib/types';
import { formatLKR } from '@/lib/utils';
import { NotificationState } from '@/components/ui/Notification';

interface AddPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  currentProfile: Profile;
  onPaymentAdded: () => void;
  setNotification: (notif: NotificationState) => void;
}

export function AddPaymentModal({
  isOpen,
  onClose,
  invoice,
  currentProfile,
  onPaymentAdded,
  setNotification,
}: AddPaymentModalProps) {
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();

  const todayStr = new Date().toISOString().split('T')[0];
  const [amount, setAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(todayStr);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Bank Transfer');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Sync state when modal is opened or invoice changes
  useEffect(() => {
    if (isOpen && invoice) {
      const timer = setTimeout(() => {
        setAmount(invoice.balance_due > 0 ? String(invoice.balance_due) : '0');
        setPaymentDate(new Date().toISOString().split('T')[0]);
        setPaymentMethod('Bank Transfer');
        setReferenceNumber('');
        setNotes('');
        setValidationError(null);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen, invoice]);

  if (!isOpen || !invoice) return null;

  const currentBalance = invoice.balance_due || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setValidationError('Payment amount must be greater than zero.');
      return;
    }

    if (numAmount > invoice.balance_due + 0.01) {
      setValidationError(
        `Payment amount cannot exceed the balance due (${formatLKR(invoice.balance_due)}).`
      );
      return;
    }

    if (!paymentDate) {
      setValidationError('Payment date is required.');
      return;
    }

    startTransition(async () => {
      try {
        // Call RPC function add_invoice_payment
        const { error: rpcError } = await supabase.rpc('add_invoice_payment', {
          p_invoice_id: invoice.id,
          p_amount: numAmount,
          p_payment_date: paymentDate,
          p_payment_method: paymentMethod,
          p_reference_number: referenceNumber.trim() || null,
          p_notes: notes.trim() || null,
          p_user_id: currentProfile.id,
          p_user_name: currentProfile.full_name,
        });

        if (rpcError) {
          // Fallback if RPC is not available in local DB session
          const { data: paymentData, error: payError } = await supabase
            .from('invoice_payments')
            .insert({
              invoice_id: invoice.id,
              payment_date: paymentDate,
              amount: numAmount,
              payment_method: paymentMethod,
              reference_number: referenceNumber.trim() || null,
              notes: notes.trim() || null,
              created_by: currentProfile.id,
            })
            .select('id')
            .single();

          if (payError) throw payError;

          // Manual recalculation fallback
          const { data: allPayments } = await supabase
            .from('invoice_payments')
            .select('amount')
            .eq('invoice_id', invoice.id)
            .eq('is_reversed', false);

          const totalPaid = (allPayments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
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
            action: 'payment_added',
            details: {
              payment_id: paymentData?.id,
              amount: numAmount,
              method: paymentMethod,
              reference: referenceNumber,
            },
          });
        }

        setNotification({
          type: 'success',
          message: `Payment of ${formatLKR(numAmount)} recorded successfully for Invoice ${invoice.invoice_number}!`,
        });

        onPaymentAdded();
        onClose();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to record payment.';
        setValidationError(msg);
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Record Payment</h2>
              <p className="text-xs text-amber-400 font-mono">{invoice.invoice_number}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Read-Only Summary Box */}
        <div className="p-4 bg-zinc-950/60 border-b border-zinc-850 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-850">
            <span className="text-[10px] text-zinc-400 uppercase font-semibold">Net Amount</span>
            <p className="font-bold text-zinc-200 font-mono mt-0.5">{formatLKR(invoice.net_amount)}</p>
          </div>
          <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-850">
            <span className="text-[10px] text-emerald-400 uppercase font-semibold">Already Paid</span>
            <p className="font-bold text-emerald-400 font-mono mt-0.5">{formatLKR(invoice.amount_paid)}</p>
          </div>
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <span className="text-[10px] text-amber-400 uppercase font-semibold">Current Balance</span>
            <p className="font-extrabold text-amber-400 font-mono mt-0.5">{formatLKR(currentBalance)}</p>
          </div>
        </div>

        {/* Payment Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {validationError && (
            <div className="p-3 rounded-lg bg-red-950/50 border border-red-800 text-red-300 text-xs">
              {validationError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">
              Payment Amount (LKR) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs text-amber-400 font-bold font-mono">
                LKR
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={currentBalance}
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-12 pr-3 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-amber-500 font-mono min-h-[44px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Payment Date *
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  onClick={(e) => e.currentTarget.showPicker?.()}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-500 min-h-[44px] cursor-pointer"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Payment Method *
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-500 min-h-[44px]"
              >
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cash">Cash</option>
                <option value="Online Transfer">Online Transfer</option>
                <option value="Card">Card</option>
                <option value="Cheque">Cheque</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">
              Reference / Transaction No. (Optional)
            </label>
            <input
              type="text"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="e.g. TRX-987654 or Cheque #0012"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-500 min-h-[44px]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">
              Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Received via Commercial Bank deposit"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-200 focus:outline-none focus:border-amber-500 resize-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 min-h-[44px]"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>Record Payment</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
