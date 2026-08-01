-- Migration 004: Add deduction_items JSONB column for multi-item deductions

ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS deduction_items JSONB NOT NULL DEFAULT '[]'::jsonb;
