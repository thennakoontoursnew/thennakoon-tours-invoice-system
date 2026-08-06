-- Migration 009: Add cancellation columns and RPC functions for Invoice Cancellation & Reopen Workflow

ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- Create index on cancellation columns
CREATE INDEX IF NOT EXISTS idx_invoices_cancelled_at ON public.invoices(cancelled_at);

-- RPC Function: Cancel Invoice safely
CREATE OR REPLACE FUNCTION public.cancel_invoice(
  p_invoice_id UUID,
  p_reason TEXT,
  p_user_id UUID,
  p_user_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT;
  v_invoice RECORD;
  v_active_payments_count INT;
BEGIN
  -- 1. Check user role
  SELECT LOWER(TRIM(role)) INTO v_role
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_role IS NULL OR (v_role != 'owner' AND v_role != 'admin') THEN
    RAISE EXCEPTION 'Only Owner or Admin can cancel invoices.';
  END IF;

  -- 2. Fetch target invoice
  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id;

  IF v_invoice.id IS NULL THEN
    RAISE EXCEPTION 'Invoice not found.';
  END IF;

  -- 3. Check status rules
  IF v_invoice.status = 'Cancelled' THEN
    RAISE EXCEPTION 'This invoice is already cancelled.';
  END IF;

  IF v_invoice.status = 'Paid' THEN
    RAISE EXCEPTION 'Paid invoices cannot be cancelled.';
  END IF;

  -- 4. Check for active payments
  SELECT COUNT(*) INTO v_active_payments_count
  FROM public.invoice_payments
  WHERE invoice_id = p_invoice_id AND is_reversed = FALSE;

  IF v_active_payments_count > 0 THEN
    RAISE EXCEPTION 'Reverse all active payments before cancelling this invoice.';
  END IF;

  -- 5. Validate reason length
  IF p_reason IS NULL OR LENGTH(TRIM(p_reason)) < 5 THEN
    RAISE EXCEPTION 'Cancellation reason is required (minimum 5 characters).';
  END IF;

  -- 6. Perform cancellation
  UPDATE public.invoices
  SET status = 'Cancelled',
      cancelled_at = NOW(),
      cancelled_by = p_user_id,
      cancellation_reason = TRIM(p_reason),
      updated_at = NOW()
  WHERE id = p_invoice_id;

  -- 7. Insert audit activity log
  INSERT INTO public.invoice_activity_logs (invoice_id, user_id, user_name, action, details)
  VALUES (
    p_invoice_id,
    p_user_id,
    p_user_name,
    'invoice_cancelled',
    jsonb_build_object('reason', TRIM(p_reason), 'cancelled_at', NOW())
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Invoice cancelled successfully.',
    'invoice_id', p_invoice_id
  );
END;
$$;

-- RPC Function: Reopen Cancelled Invoice (Owner Only)
CREATE OR REPLACE FUNCTION public.reopen_invoice(
  p_invoice_id UUID,
  p_reason TEXT,
  p_user_id UUID,
  p_user_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT;
  v_invoice RECORD;
BEGIN
  -- 1. Check user role (Owner ONLY)
  SELECT LOWER(TRIM(role)) INTO v_role
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_role IS NULL OR v_role != 'owner' THEN
    RAISE EXCEPTION 'Only Owner users can reopen cancelled invoices.';
  END IF;

  -- 2. Fetch target invoice
  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id;

  IF v_invoice.id IS NULL THEN
    RAISE EXCEPTION 'Invoice not found.';
  END IF;

  IF v_invoice.status != 'Cancelled' THEN
    RAISE EXCEPTION 'Only cancelled invoices can be reopened.';
  END IF;

  -- 3. Validate reason
  IF p_reason IS NULL OR LENGTH(TRIM(p_reason)) < 3 THEN
    RAISE EXCEPTION 'Reopen reason is required.';
  END IF;

  -- 4. Perform reopening to Draft
  UPDATE public.invoices
  SET status = 'Draft',
      cancelled_at = NULL,
      cancelled_by = NULL,
      cancellation_reason = NULL,
      updated_at = NOW()
  WHERE id = p_invoice_id;

  -- 5. Insert audit activity log
  INSERT INTO public.invoice_activity_logs (invoice_id, user_id, user_name, action, details)
  VALUES (
    p_invoice_id,
    p_user_id,
    p_user_name,
    'invoice_reopened',
    jsonb_build_object('reason', TRIM(p_reason), 'reopened_at', NOW())
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Invoice reopened to Draft successfully.',
    'invoice_id', p_invoice_id
  );
END;
$$;
