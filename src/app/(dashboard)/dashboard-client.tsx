'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Eye, Download, Edit, ArrowRight } from 'lucide-react';
import { Invoice } from '@/lib/types';
import { formatDate, formatLKR, getStatusBadgeStyle } from '@/lib/utils';
import { downloadInvoicePdf } from '@/lib/pdf/generateInvoicePdf';
import { PdfPreviewModal } from '@/components/pdf/PdfPreviewModal';
import { Notification, NotificationState } from '@/components/ui/Notification';

interface DashboardClientProps {
  initialInvoices: Invoice[];
}

export function DashboardClient({ initialInvoices }: DashboardClientProps) {
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [notification, setNotification] = useState<NotificationState | null>(null);

  const handlePreview = (inv: Invoice) => {
    setSelectedInvoice(inv);
    setIsPreviewOpen(true);
  };

  const handleDownload = (inv: Invoice) => {
    try {
      downloadInvoicePdf(inv);
    } catch {
      setNotification({ type: 'error', message: 'Unable to download PDF invoice.' });
    }
  };

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl overflow-hidden shadow-xl">
      <Notification notification={notification} onClose={() => setNotification(null)} />
      <div className="p-5 border-b border-zinc-850 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-white">Recent Invoices</h2>
          <p className="text-xs text-zinc-400">Latest 10 invoices generated in the system</p>
        </div>

        <Link
          href="/invoices"
          className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-semibold transition-colors"
        >
          <span>View All Invoices</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* DESKTOP TABLE VIEW (Hidden on mobile) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-xs text-zinc-300">
          <thead className="bg-zinc-950/80 text-zinc-400 font-semibold border-b border-zinc-850">
            <tr>
              <th className="py-3 px-4">Invoice #</th>
              <th className="py-3 px-4">Customer Name</th>
              <th className="py-3 px-4">Vehicle / Details</th>
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4 text-right">Net Amount</th>
              <th className="py-3 px-4 text-right">Balance Due</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-850/60">
            {initialInvoices.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-zinc-500">
                  No invoices created yet. Click &quot;Create New Invoice&quot; to begin.
                </td>
              </tr>
            ) : (
              initialInvoices.map((inv) => (
                <tr
                  key={inv.id}
                  className="hover:bg-zinc-850/40 transition-colors group"
                >
                  <td className="py-3 px-4 font-bold text-amber-400">
                    {inv.invoice_number}
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-semibold text-zinc-100">{inv.customer_name}</p>
                    {inv.customer_phone && (
                      <p className="text-[11px] text-zinc-500">{inv.customer_phone}</p>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <p className="text-zinc-300">
                      {inv.vehicle_name || inv.nature_of_invoice || 'Rental'}
                    </p>
                    {inv.vehicle_registration_number && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                        {inv.vehicle_registration_number}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-zinc-400">
                    {formatDate(inv.invoice_date)}
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-zinc-200">
                    {formatLKR(inv.net_amount)}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-amber-400">
                    {formatLKR(inv.balance_due)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-semibold border ${getStatusBadgeStyle(
                        inv.status
                      )}`}
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => handlePreview(inv)}
                        title="Preview PDF"
                        className="p-2 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDownload(inv)}
                        title="Download PDF"
                        className="p-2 rounded-md hover:bg-zinc-800 text-amber-400 hover:text-amber-300 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <Link
                        href={`/invoices/${inv.id}`}
                        title="Edit Invoice"
                        className="p-2 rounded-md hover:bg-zinc-800 text-blue-400 hover:text-blue-300 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                      >
                        <Edit className="w-4 h-4" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MOBILE INVOICE CARD VIEW (Shown only on mobile) */}
      <div className="md:hidden p-3 space-y-3">
        {initialInvoices.length === 0 ? (
          <div className="p-6 text-center text-zinc-500 text-xs">
            No invoices created yet.
          </div>
        ) : (
          initialInvoices.map((inv) => (
            <div
              key={inv.id}
              className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-850 space-y-3 shadow-md"
            >
              <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
                <div>
                  <span className="font-bold text-amber-400 font-mono text-xs">
                    {inv.invoice_number}
                  </span>
                  <p className="text-[10px] text-zinc-400">{formatDate(inv.invoice_date)}</p>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${getStatusBadgeStyle(
                    inv.status
                  )}`}
                >
                  {inv.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-[10px] uppercase font-bold text-zinc-500">Customer</p>
                  <p className="font-semibold text-zinc-100 truncate">{inv.customer_name}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-zinc-500">Balance Due</p>
                  <p className="font-bold text-amber-400 font-mono">{formatLKR(inv.balance_due)}</p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1 border-t border-zinc-850">
                <button
                  onClick={() => handlePreview(inv)}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg bg-zinc-800 text-zinc-200 text-xs font-semibold hover:bg-zinc-700 min-h-[44px]"
                >
                  <Eye className="w-4 h-4 text-amber-400" />
                  <span>Preview</span>
                </button>
                <button
                  onClick={() => handleDownload(inv)}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg bg-zinc-800 text-amber-400 text-xs font-semibold hover:bg-zinc-700 min-h-[44px]"
                >
                  <Download className="w-4 h-4" />
                  <span>Download</span>
                </button>
                <Link
                  href={`/invoices/${inv.id}`}
                  className="p-2.5 rounded-lg bg-zinc-800 text-blue-400 hover:bg-zinc-700 min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <Edit className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ))
        )}
      </div>

      <PdfPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        invoice={selectedInvoice}
        onError={(msg) => setNotification({ type: 'error', message: msg })}
      />
    </div>
  );
}
