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

      <div className="overflow-x-auto">
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
                        className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDownload(inv)}
                        title="Download PDF"
                        className="p-1.5 rounded-md hover:bg-zinc-800 text-amber-400 hover:text-amber-300 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <Link
                        href={`/invoices/${inv.id}`}
                        title="Edit Invoice"
                        className="p-1.5 rounded-md hover:bg-zinc-800 text-blue-400 hover:text-blue-300 transition-colors"
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

      <PdfPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        invoice={selectedInvoice}
        onError={(msg) => setNotification({ type: 'error', message: msg })}
      />
    </div>
  );
}
