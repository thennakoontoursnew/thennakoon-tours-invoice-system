'use client';

import React, { useEffect, useState } from 'react';
import { X, Download, Loader2, FileText, ExternalLink } from 'lucide-react';
import { Invoice } from '@/lib/types';
import {
  getInvoicePdfBlobUrl,
  downloadInvoicePdf,
  formatInvoicePdfFilename,
} from '@/lib/pdf/generateInvoicePdf';

interface PdfPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  onError?: (message: string) => void;
}

export function PdfPreviewModal({
  isOpen,
  onClose,
  invoice,
  onError,
}: PdfPreviewModalProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [renderError, setRenderError] = useState<boolean>(false);

  useEffect(() => {
    let activeUrl: string | null = null;
    let isMounted = true;

    if (isOpen && invoice) {
      getInvoicePdfBlobUrl(invoice)
        .then(({ url }) => {
          if (isMounted) {
            activeUrl = url;
            setBlobUrl(url);
            setRenderError(false);
            setLoading(false);
          }
        })
        .catch((err) => {
          if (isMounted) {
            console.error('Error generating PDF Blob URL:', err);
            setLoading(false);
            setRenderError(true);
            if (onError) {
              onError('Unable to generate PDF preview.');
            }
          }
        });
    }

    return () => {
      isMounted = false;
      if (activeUrl) {
        URL.revokeObjectURL(activeUrl);
      }
    };
  }, [isOpen, invoice, onError]);

  if (!isOpen || !invoice) return null;

  const handleDownload = () => {
    try {
      downloadInvoicePdf(invoice);
    } catch (err) {
      console.error('PDF download error:', err);
      if (onError) onError('Unable to download PDF invoice.');
    }
  };

  const handleOpenInNewTab = () => {
    if (blobUrl) {
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
    }
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

          <div className="flex items-center gap-2">
            {blobUrl && (
              <button
                onClick={handleOpenInNewTab}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 transition-colors"
                title="Open PDF in new tab"
              >
                <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                <span>Open in Tab</span>
              </button>
            )}

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

          {renderError && (
            <div className="flex flex-col items-center gap-3 text-red-400 p-6 text-center">
              <p className="text-sm font-semibold">Unable to generate PDF preview.</p>
              <p className="text-xs text-zinc-400 max-w-md">
                Please check invoice details or click Download PDF directly.
              </p>
            </div>
          )}

          {!loading && !renderError && blobUrl && (
            <iframe
              src={blobUrl}
              className="w-full h-full rounded-lg border border-zinc-800 bg-white"
              title="Invoice PDF Preview"
            />
          )}
        </div>
      </div>
    </div>
  );
}
