'use client';

import React, { useEffect, useState } from 'react';
import { X, Download, Loader2, FileText } from 'lucide-react';
import { Invoice } from '@/lib/types';
import {
  getInvoicePdfDataUrl,
  downloadInvoicePdf,
  formatInvoicePdfFilename,
} from '@/lib/pdf/generateInvoicePdf';

interface PdfPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
}

export function PdfPreviewModal({ isOpen, onClose, invoice }: PdfPreviewModalProps) {
  const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (isOpen && invoice) {
      getInvoicePdfDataUrl(invoice)
        .then((url) => {
          if (isMounted) {
            setPdfDataUrl(url);
          }
        })
        .catch((err) => {
          console.error('Error generating PDF data url:', err);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen, invoice]);

  if (!isOpen || !invoice) return null;

  const loading = pdfDataUrl === null;

  const handleDownload = () => {
    downloadInvoicePdf(invoice);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/80">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-sm font-bold text-white">
                PDF Preview — {invoice.invoice_number}
              </h2>
              <p className="text-xs text-zinc-400">
                {formatInvoicePdfFilename(invoice)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition-all shadow-md active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>Download PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 bg-zinc-950 p-2 overflow-hidden relative flex items-center justify-center">
          {loading && (
            <div className="flex flex-col items-center gap-3 text-zinc-400">
              <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
              <p className="text-xs font-medium">Rendering PDF Letterhead Document...</p>
            </div>
          )}

          {!loading && pdfDataUrl && (
            <iframe
              src={pdfDataUrl}
              className="w-full h-full rounded-lg border border-zinc-800 bg-white"
              title="Invoice PDF Preview"
            />
          )}
        </div>
      </div>
    </div>
  );
}
