'use client';

import React, { useState, useTransition } from 'react';
import { AlertTriangle, X, Loader2, Ban } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Invoice, Profile } from '@/lib/types';
import { getStatusBadgeStyle } from '@/lib/utils';

interface CancelInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  currentProfile: Profile;
  onSuccess: () => void;
  onError: (msg: string) => void;
}

export function CancelInvoiceModal({
  isOpen,
  onClose,
  invoice,
  currentProfile,
  onSuccess,
  onError,
}: CancelInvoiceModalProps) {
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();

  const [reason, setReason] = useState<string>('');
  const [confirmed, setConfirmed] = useState<boolean>(false);

  if (!isOpen || !invoice) return null;

  const role = currentProfile?.role?.trim().toLowerCase();
  const isOwnerOrAdmin = role === 'owner' || role === 'admin';

  const handleCancelInvoice = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isOwnerOrAdmin) {
      onError('Only Owner or Admin can cancel invoices.');
      return;
    }

    if (invoice.status === 'Paid') {
      onError('Paid invoices cannot be cancelled.');
      return;
    }

    if (invoice.status === 'Cancelled') {
      onError('This invoice is already cancelled.');
      return;
    }

    if (!reason.trim() || reason.trim().length < 5) {
      onError('Cancellation reason is required (minimum 5 characters).');
      return;
    }

    if (!confirmed) {
      onError('Please check the confirmation box to proceed.');
      return;
    }

    startTransition(async () => {
      try {
        // Try RPC first
        const { data, error: rpcErr } = await supabase.rpc('cancel_invoice', {
          p_invoice_id: invoice.id,
          p_reason: reason.trim(),
          p_user_id: currentProfile.id,
          p_user_name: currentProfile.full_name,
        });

        if (rpcErr) {
          // Check for active payments error
          if (rpcErr.message?.includes('active payments')) {
            throw new Error('Reverse all active payments before cancelling this invoice.');
          }

          // Fallback direct handling if RPC is not available in local environment
          const { count: activePayCount, error: payErr } = await supabase
            .from('invoice_payments')
            .select('*', { count: 'exact', head: true })
            .eq('invoice_id', invoice.id)
            .eq('is_reversed', false);

          if (payErr) throw payErr;

          if (activePayCount && activePayCount > 0) {
            throw new Error('Reverse all active payments before cancelling this invoice.');
          }

          const { error: updateErr } = await supabase
            .from('invoices')
            .update({
              status: 'Cancelled',
              cancelled_at: new Date().toISOString(),
              cancelled_by: currentProfile.id,
              cancellation_reason: reason.trim(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', invoice.id);

          if (updateErr) throw updateErr;

          // Log activity
          await supabase.from('invoice_activity_logs').insert({
            invoice_id: invoice.id,
            user_id: currentProfile.id,
            user_name: currentProfile.full_name,
            action: 'invoice_cancelled',
            details: { reason: reason.trim() },
          });
        } else if (data && !data.success) {
          throw new Error(data.message || 'Failed to cancel invoice.');
        }

        setReason('');
        setConfirmed(false);
        onSuccess();
        onClose();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to cancel invoice.';
        onError(msg);
      }
    });
  };

  const handleClose = () => {
    setReason('');
    setConfirmed(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-zinc-900 border border-red-900/40 rounded-2xl shadow-2xl overflow-hidden text-zinc-100 space-y-0">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800 bg-red-950/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Cancel Invoice Confirmation</h2>
              <p className="text-xs text-zinc-400">Permanently mark invoice as cancelled</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleCancelInvoice} className="p-5 space-y-4">
          {/* Summary Box */}
          <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-400">Invoice Number:</span>
              <span className="font-mono font-bold text-amber-400">{invoice.invoice_number}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-400">Customer Name:</span>
              <span className="font-semibold text-zinc-200">{invoice.customer_name}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-400">Current Status:</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusBadgeStyle(invoice.status)}`}>
                {invoice.status}
              </span>
            </div>
          </div>

          {/* Warning Notice */}
          <div className="p-3 rounded-xl bg-red-950/30 border border-red-900/40 text-red-300 text-xs leading-relaxed">
            <span className="font-bold">Important Rule:</span> Invoice status will change to <b>Cancelled</b> and become strictly read-only. Paid invoices or invoices with active payments cannot be cancelled until all payments are reversed.
          </div>

          {/* Reason Input */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">
              Cancellation Reason <span className="text-red-400">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide explicit reason (e.g. Customer cancelled booking due to schedule change)"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-200 focus:outline-none focus:border-red-500 resize-none"
            />
            <p className="text-[10px] text-zinc-500 mt-1">Minimum 5 characters required.</p>
          </div>

          {/* Confirmation Checkbox */}
          <label className="flex items-start gap-3 p-3 rounded-xl bg-zinc-950 border border-zinc-800 cursor-pointer group">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 rounded border-zinc-700 bg-zinc-900 text-red-500 focus:ring-red-500 w-4 h-4"
            />
            <span className="text-xs text-zinc-300 group-hover:text-white transition-colors">
              I understand that this invoice will be marked as <b>Cancelled</b> and cannot be edited.
            </span>
          </label>

          {/* Footer Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-2 border-t border-zinc-800">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-750 text-zinc-300 text-xs font-semibold min-h-[44px] transition-colors"
            >
              Keep Invoice
            </button>

            <button
              type="submit"
              disabled={isPending || !confirmed || reason.trim().length < 5}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all disabled:opacity-50 min-h-[44px]"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
              <span>Confirm Cancellation</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
