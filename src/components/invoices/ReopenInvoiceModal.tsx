'use client';

import React, { useState, useTransition } from 'react';
import { RotateCcw, X, Loader2 } from 'lucide-react';
import { Invoice, Profile } from '@/lib/types';
import { extractErrorMessage } from '@/lib/utils';

interface ReopenInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  currentProfile: Profile;
  onSuccess: () => void;
  onError: (msg: string) => void;
}

export function ReopenInvoiceModal({
  isOpen,
  onClose,
  invoice,
  currentProfile,
  onSuccess,
  onError,
}: ReopenInvoiceModalProps) {
  const [isPending, startTransition] = useTransition();

  const [reason, setReason] = useState<string>('');

  if (!isOpen || !invoice) return null;

  const role = currentProfile?.role?.trim().toLowerCase();
  const isOwner = role === 'owner';

  const handleReopenInvoice = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isOwner) {
      onError('Only Owner users can reopen cancelled invoices.');
      return;
    }

    if (invoice.status !== 'Cancelled') {
      onError('Only cancelled invoices can be reopened.');
      return;
    }

    if (!reason.trim()) {
      onError('Reopen reason is required.');
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch('/api/invoices/reopen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invoice_id: invoice.id,
            reason: reason.trim(),
          }),
        });

        const json = await res.json().catch(() => ({}));

        if (!res.ok || json.error) {
          const errorMsg = extractErrorMessage(json);
          onError(errorMsg);
          return;
        }

        setReason('');
        onSuccess();
        onClose();
      } catch (err: unknown) {
        const errorMsg = extractErrorMessage(err);
        onError(errorMsg);
      }
    });
  };

  const handleClose = () => {
    setReason('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-zinc-900 border border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden text-zinc-100 space-y-0">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800 bg-amber-500/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Reopen Cancelled Invoice</h2>
              <p className="text-xs text-zinc-400">Restore invoice to Draft status for editing</p>
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
        <form onSubmit={handleReopenInvoice} className="p-5 space-y-4">
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
            {invoice.cancellation_reason && (
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400">Cancellation Reason:</span>
                <span className="text-red-300 font-mono text-[11px]">{invoice.cancellation_reason}</span>
              </div>
            )}
          </div>

          {/* Info Notice */}
          <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/40 text-amber-300 text-xs leading-relaxed">
            <span className="font-bold">Owner Access Only:</span> Reopening this invoice will reset its status to <b>Draft</b>, allowing modifications and re-issuance.
          </div>

          {/* Reason Input */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">
              Reopen Reason <span className="text-amber-400">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="State reason for reopening (e.g. Customer reconfirmed booking)"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-200 focus:outline-none focus:border-amber-500 resize-none"
            />
          </div>

          {/* Footer Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-2 border-t border-zinc-800">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-750 text-zinc-300 text-xs font-semibold min-h-[44px] transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isPending || !reason.trim()}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition-all disabled:opacity-50 min-h-[44px]"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              <span>Confirm Reopen</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
