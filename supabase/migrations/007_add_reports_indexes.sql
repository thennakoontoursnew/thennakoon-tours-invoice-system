-- Migration 007: Add database indexes for reports module performance

CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date
ON public.invoices(invoice_date);

CREATE INDEX IF NOT EXISTS idx_invoices_status_date
ON public.invoices(status, invoice_date);
