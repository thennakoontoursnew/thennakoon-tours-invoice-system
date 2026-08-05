-- Migration 008: Create invoice_payments table, recalculation triggers, and RLS policies

-- 1. Create invoice_payments table
CREATE TABLE IF NOT EXISTS public.invoice_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('Cash', 'Bank Transfer', 'Online Transfer', 'Card', 'Cheque', 'Other')),
    reference_number TEXT,
    notes TEXT,
    is_reversed BOOLEAN NOT NULL DEFAULT FALSE,
    reversed_at TIMESTAMPTZ,
    reversed_by UUID REFERENCES public.profiles(id),
    reversal_reason TEXT,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice_id ON public.invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_date ON public.invoice_payments(payment_date);

-- Enable RLS
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "View invoice payments" ON public.invoice_payments;
CREATE POLICY "View invoice payments" ON public.invoice_payments
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Insert invoice payments" ON public.invoice_payments;
CREATE POLICY "Insert invoice payments" ON public.invoice_payments
    FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Manage invoice payments" ON public.invoice_payments;
CREATE POLICY "Manage invoice payments" ON public.invoice_payments
    FOR UPDATE TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND LOWER(TRIM(role)) IN ('owner', 'admin')
        )
    );

DROP POLICY IF EXISTS "Delete invoice payments" ON public.invoice_payments;
CREATE POLICY "Delete invoice payments" ON public.invoice_payments
    FOR DELETE TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND LOWER(TRIM(role)) = 'owner'
        )
    );

-- 2. Recalculate invoice financials and auto status procedure
CREATE OR REPLACE FUNCTION public.recalculate_invoice_financials_and_status(p_invoice_id UUID)
RETURNS VOID AS $$
DECLARE
    v_net_amount NUMERIC(12,2);
    v_total_paid NUMERIC(12,2);
    v_new_balance NUMERIC(12,2);
    v_current_status TEXT;
    v_due_date DATE;
    v_new_status TEXT;
BEGIN
    -- Fetch invoice net_amount, status, due_date
    SELECT net_amount, status, due_date
    INTO v_net_amount, v_current_status, v_due_date
    FROM public.invoices
    WHERE id = p_invoice_id;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- Calculate total active (non-reversed) payments
    SELECT COALESCE(SUM(amount), 0)
    INTO v_total_paid
    FROM public.invoice_payments
    WHERE invoice_id = p_invoice_id AND is_reversed = FALSE;

    -- Calculate new balance due
    v_new_balance := GREATEST(0, v_net_amount - v_total_paid);

    -- Auto Status Logic
    -- Keep Draft and Cancelled unchanged
    IF v_current_status = 'Draft' OR v_current_status = 'Cancelled' THEN
        v_new_status := v_current_status;
    ELSE
        IF v_new_balance = 0 THEN
            v_new_status := 'Paid';
        ELSIF v_total_paid > 0 AND v_new_balance > 0 THEN
            v_new_status := 'Partially Paid';
        ELSIF v_due_date IS NOT NULL AND v_due_date < CURRENT_DATE AND v_total_paid = 0 THEN
            v_new_status := 'Overdue';
        ELSE
            v_new_status := 'Issued';
        END IF;
    END IF;

    -- Update the invoice record
    UPDATE public.invoices
    SET amount_paid = v_total_paid,
        balance_due = v_new_balance,
        status = v_new_status,
        updated_at = NOW()
    WHERE id = p_invoice_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Stored procedure: add_invoice_payment
CREATE OR REPLACE FUNCTION public.add_invoice_payment(
    p_invoice_id UUID,
    p_amount NUMERIC(12,2),
    p_payment_date DATE,
    p_payment_method TEXT,
    p_reference_number TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_user_id UUID DEFAULT NULL,
    p_user_name TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_net_amount NUMERIC(12,2);
    v_current_balance NUMERIC(12,2);
    v_payment_id UUID;
BEGIN
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Payment amount must be greater than zero.';
    END IF;

    SELECT net_amount, balance_due INTO v_net_amount, v_current_balance
    FROM public.invoices
    WHERE id = p_invoice_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invoice not found.';
    END IF;

    IF p_amount > v_current_balance THEN
        RAISE EXCEPTION 'Payment amount (LKR %) exceeds current balance due of LKR %', p_amount, v_current_balance;
    END IF;

    INSERT INTO public.invoice_payments (
        invoice_id,
        payment_date,
        amount,
        payment_method,
        reference_number,
        notes,
        created_by
    ) VALUES (
        p_invoice_id,
        p_payment_date,
        p_amount,
        p_payment_method,
        p_reference_number,
        p_notes,
        p_user_id
    ) RETURNING id INTO v_payment_id;

    -- Recalculate financials and auto status
    PERFORM public.recalculate_invoice_financials_and_status(p_invoice_id);

    -- Log activity if logger exists
    IF p_user_id IS NOT NULL THEN
        INSERT INTO public.invoice_activity_logs (
            invoice_id,
            user_id,
            user_name,
            action,
            details
        ) VALUES (
            p_invoice_id,
            p_user_id,
            COALESCE(p_user_name, 'System User'),
            'payment_added',
            jsonb_build_object(
                'payment_id', v_payment_id,
                'amount', p_amount,
                'payment_method', p_payment_method,
                'reference_number', p_reference_number,
                'payment_date', p_payment_date
            )
        );
    END IF;

    RETURN jsonb_build_object('success', true, 'payment_id', v_payment_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Stored procedure: reverse_invoice_payment
CREATE OR REPLACE FUNCTION public.reverse_invoice_payment(
    p_payment_id UUID,
    p_reason TEXT,
    p_user_id UUID,
    p_user_name TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_invoice_id UUID;
    v_amount NUMERIC(12,2);
    v_user_role TEXT;
BEGIN
    SELECT LOWER(TRIM(role)) INTO v_user_role
    FROM public.profiles
    WHERE id = p_user_id;

    IF v_user_role != 'owner' THEN
        RAISE EXCEPTION 'Only Owner accounts can reverse payments.';
    END IF;

    SELECT invoice_id, amount INTO v_invoice_id, v_amount
    FROM public.invoice_payments
    WHERE id = p_payment_id AND is_reversed = FALSE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active payment record not found or already reversed.';
    END IF;

    UPDATE public.invoice_payments
    SET is_reversed = TRUE,
        reversed_at = NOW(),
        reversed_by = p_user_id,
        reversal_reason = p_reason
    WHERE id = p_payment_id;

    PERFORM public.recalculate_invoice_financials_and_status(v_invoice_id);

    INSERT INTO public.invoice_activity_logs (
        invoice_id,
        user_id,
        user_name,
        action,
        details
    ) VALUES (
        v_invoice_id,
        p_user_id,
        p_user_name,
        'payment_reversed',
        jsonb_build_object(
            'payment_id', p_payment_id,
            'amount', v_amount,
            'reason', p_reason
        )
    );

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Backward Compatibility (Option A): Create payment records for existing invoices with amount_paid > 0
INSERT INTO public.invoice_payments (
    invoice_id,
    payment_date,
    amount,
    payment_method,
    reference_number,
    notes,
    created_at
)
SELECT
    id,
    invoice_date,
    amount_paid,
    'Bank Transfer',
    'LEGACY-OPENING-BAL',
    'Opening Balance Payment (Migrated)',
    created_at
FROM public.invoices
WHERE amount_paid > 0
  AND NOT EXISTS (
      SELECT 1 FROM public.invoice_payments WHERE invoice_payments.invoice_id = invoices.id
  );
