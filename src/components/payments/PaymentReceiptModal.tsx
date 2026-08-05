'use client';

import React, { useEffect, useState, useRef } from 'react';
import { X, Download, Printer, Loader2 } from 'lucide-react';
import { Invoice, InvoicePayment } from '@/lib/types';
import {
  downloadPaymentReceiptPdf,
  getPaymentReceiptPdfBlobUrl,
} from '@/lib/pdf/generatePaymentReceiptPdf';

interface PaymentReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  payment: InvoicePayment | null;
  onError?: (msg: string) => void;
}

export function PaymentReceiptModal({
  isOpen,
  onClose,
  invoice,
  payment,
  onError,
}: PaymentReceiptModalProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let url: string | null = null;
    if (isOpen && invoice && payment) {
      const timer = setTimeout(() => {
        try {
          url = getPaymentReceiptPdfBlobUrl(invoice, payment);
          setBlobUrl(url);
        } catch (err: unknown) {
          console.error('Error generating Payment Receipt PDF blob:', err);
          if (onError) onError('Failed to generate payment receipt preview.');
        } finally {
          setLoading(false);
        }
      }, 0);

      return () => {
        clearTimeout(timer);
        if (url) {
          URL.revokeObjectURL(url);
        }
      };
    }
  }, [isOpen, invoice, payment, onError]);

  if (!isOpen || !invoice || !payment) return null;

  const handleDownload = () => {
    try {
      downloadPaymentReceiptPdf(invoice, payment);
    } catch (err: unknown) {
      console.error('Error downloading receipt PDF:', err);
      if (onError) onError('Failed to download payment receipt PDF.');
    }
  };

  const handlePrint = () => {
    if (iframeRef.current?.contentWindow) {
      try {
        iframeRef.current.contentWindow.focus();
        iframeRef.current.contentWindow.print();
      } catch (err) {
        console.error('Failed to trigger receipt print:', err);
        handleDownload();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl h-[92vh] sm:h-[90vh] bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 px-6 bg-zinc-950 border-b border-zinc-850 gap-3 shrink-0">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-amber-400 font-mono">
              Payment Receipt Preview
            </h2>
            <p className="text-xs text-zinc-400">
              Invoice #{invoice.invoice_number} | Payment Date: {payment.payment_date}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={loading || !blobUrl}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs transition-all border border-zinc-700 min-h-[44px] sm:min-h-[36px]"
              title="Print Receipt"
            >
              <Printer className="w-4 h-4 text-zinc-300" />
              <span>Print</span>
            </button>

            <button
              onClick={handleDownload}
              disabled={loading || !blobUrl}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs transition-all shadow-md active:scale-95 min-h-[44px] sm:min-h-[36px]"
              title="Download Receipt PDF"
            >
              <Download className="w-4 h-4 text-zinc-950" />
              <span>Download</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Close Preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: PDF Viewer */}
        <div className="flex-1 bg-zinc-950 relative overflow-hidden flex items-center justify-center">
          {loading && (
            <div className="flex flex-col items-center gap-3 text-zinc-400">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
              <span className="text-xs font-semibold">Generating Payment Receipt PDF...</span>
            </div>
          )}

          {!loading && blobUrl && (
            <iframe
              ref={iframeRef}
              src={blobUrl}
              title="Payment Receipt PDF Preview"
              className="w-full h-full border-none"
            />
          )}

          {!loading && !blobUrl && (
            <div className="text-center p-6 text-red-400 text-xs font-semibold">
              Failed to load PDF preview. Use the download button instead.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
