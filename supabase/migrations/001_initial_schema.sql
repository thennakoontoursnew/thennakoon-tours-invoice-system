-- Supabase Database Migration for Thennakoon Tours Invoice Generator

-- 1. Create Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('Owner', 'Admin', 'Staff')) DEFAULT 'Staff',
    designation TEXT DEFAULT 'Executive',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Invoice Number Sequence Generator
CREATE TABLE IF NOT EXISTS public.invoice_number_sequences (
    year INT PRIMARY KEY,
    last_sequence INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Function to generate atomic invoice numbers: TT-IN-YYYY-0001
CREATE OR REPLACE FUNCTION public.generate_next_invoice_number(p_year INT DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INT)
RETURNS TABLE (new_invoice_number TEXT, new_sequence INT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_seq INT;
    v_num TEXT;
BEGIN
    INSERT INTO public.invoice_number_sequences (year, last_sequence, updated_at)
    VALUES (p_year, 1, NOW())
    ON CONFLICT (year) DO UPDATE
    SET last_sequence = public.invoice_number_sequences.last_sequence + 1,
        updated_at = NOW()
    RETURNING last_sequence INTO v_seq;

    v_num := 'TT-IN-' || p_year::TEXT || '-' || LPAD(v_seq::TEXT, 4, '0');
    
    RETURN QUERY SELECT v_num, v_seq;
END;
$$;

-- 3. Invoices Table
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT UNIQUE NOT NULL,
    invoice_year INT NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INT,
    invoice_sequence INT NOT NULL DEFAULT 1,
    status TEXT NOT NULL CHECK (status IN ('Draft', 'Issued', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled')) DEFAULT 'Draft',
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '7 days')::DATE,
    payment_terms TEXT DEFAULT '7 Days',
    quotation_reference TEXT,
    
    -- Customer Details
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    customer_email TEXT,
    customer_address TEXT,
    customer_company TEXT,
    customer_reference TEXT,

    -- Rental / Vehicle Details
    nature_of_invoice TEXT DEFAULT 'Vehicle Rental Service',
    vehicle_name TEXT,
    vehicle_registration_number TEXT,
    rental_start_date DATE,
    rental_end_date DATE,
    rental_days INT DEFAULT 1,
    destination TEXT,
    pickup_location TEXT,
    dropoff_location TEXT,

    -- Financial Summaries
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    discount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    deduction NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    advance_payment NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    net_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    balance_due NUMERIC(12, 2) NOT NULL DEFAULT 0.00,

    -- Notes
    special_notes TEXT,
    important_notes TEXT,
    internal_notes TEXT,

    -- Snapshots
    items_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
    company_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    bank_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    qr_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    prepared_by TEXT,
    prepared_by_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Metadata
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archived_at TIMESTAMPTZ
);

-- Index for searching and performance
CREATE INDEX IF NOT EXISTS idx_invoices_number ON public.invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_name ON public.invoices(customer_name);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_archived ON public.invoices(archived_at);

-- 4. Invoice Items Table
CREATE TABLE IF NOT EXISTS public.invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL DEFAULT 1.00,
    unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    line_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. System Settings Tables
CREATE TABLE IF NOT EXISTS public.company_settings (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    company_name TEXT NOT NULL DEFAULT 'Thennakoon Tours (Pvt) Ltd',
    address TEXT DEFAULT 'No. 123, Galle Road, Colombo 03, Sri Lanka',
    phone TEXT DEFAULT '+94 77 123 4567 / +94 11 234 5678',
    email TEXT DEFAULT 'info@thennakoontours.com',
    website TEXT DEFAULT 'www.thennakoontours.com',
    letterhead_enabled BOOLEAN NOT NULL DEFAULT true,
    letterhead_url TEXT DEFAULT '/documents/thennakoon-tours-letterhead.png',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bank_settings (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    account_name TEXT DEFAULT 'Thennakoon Tours (Pvt) Ltd',
    account_number TEXT DEFAULT '1234567890',
    bank_name TEXT DEFAULT 'Commercial Bank of Ceylon',
    branch TEXT DEFAULT 'Colombo Main Branch',
    swift_code TEXT DEFAULT 'CCBCEKLX',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.invoice_settings (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    prefix TEXT NOT NULL DEFAULT 'TT-IN',
    default_payment_terms TEXT NOT NULL DEFAULT '7 Days',
    default_due_days INT NOT NULL DEFAULT 7,
    default_tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    default_special_notes TEXT DEFAULT 'Thank you for choosing Thennakoon Tours for your travel needs.',
    default_important_notes TEXT DEFAULT 'Payment is due within the agreed payment terms. Please quote the invoice number when making payments. Refundable deposit will be returned upon vehicle inspection after completion of rental.',
    show_qr_code BOOLEAN NOT NULL DEFAULT true,
    show_prepared_by BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.qr_settings (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    qr_enabled BOOLEAN NOT NULL DEFAULT true,
    qr_image_url TEXT DEFAULT '',
    qr_label TEXT DEFAULT 'Scan to Pay via Bank App',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default settings
INSERT INTO public.company_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.bank_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.invoice_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.qr_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 6. Audit Logs Table
CREATE TABLE IF NOT EXISTS public.invoice_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    user_name TEXT,
    action TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Updated At Trigger Function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 8. Auto Create Profile on Auth Signup Trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_user_count INT;
    v_role TEXT := 'Staff';
BEGIN
    SELECT COUNT(*) INTO v_user_count FROM public.profiles;
    
    -- First user becomes Owner automatically
    IF v_user_count = 0 THEN
        v_role := 'Owner';
    END IF;

    INSERT INTO public.profiles (id, email, full_name, role, designation, is_active)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        v_role,
        COALESCE(NEW.raw_user_meta_data->>'designation', CASE WHEN v_role = 'Owner' THEN 'Managing Director' ELSE 'Executive' END),
        true
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 9. Row Level Security (RLS) Policies

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_activity_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to check role safely
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Profiles Policies:
CREATE POLICY "Read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Owner manage profiles" ON public.profiles FOR ALL TO authenticated
USING (public.get_user_role() = 'Owner')
WITH CHECK (public.get_user_role() = 'Owner');

CREATE POLICY "User update own profile" ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Invoices Policies:
CREATE POLICY "Authenticated view invoices" ON public.invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated create invoices" ON public.invoices FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Update invoices policy" ON public.invoices FOR UPDATE TO authenticated
USING (
    (public.get_user_role() IN ('Owner', 'Admin'))
    OR (public.get_user_role() = 'Staff' AND status = 'Draft')
)
WITH CHECK (
    (public.get_user_role() IN ('Owner', 'Admin'))
    OR (public.get_user_role() = 'Staff' AND status = 'Draft')
);

CREATE POLICY "Owner Admin delete invoices" ON public.invoices FOR DELETE TO authenticated
USING (public.get_user_role() IN ('Owner', 'Admin'));

-- Invoice Items Policies:
CREATE POLICY "View invoice items" ON public.invoice_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage invoice items" ON public.invoice_items FOR ALL TO authenticated USING (true);

-- Settings Policies:
CREATE POLICY "Read company_settings" ON public.company_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage company_settings" ON public.company_settings FOR ALL TO authenticated USING (public.get_user_role() IN ('Owner', 'Admin'));

CREATE POLICY "Read bank_settings" ON public.bank_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage bank_settings" ON public.bank_settings FOR ALL TO authenticated USING (public.get_user_role() IN ('Owner', 'Admin'));

CREATE POLICY "Read invoice_settings" ON public.invoice_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage invoice_settings" ON public.invoice_settings FOR ALL TO authenticated USING (public.get_user_role() IN ('Owner', 'Admin'));

CREATE POLICY "Read qr_settings" ON public.qr_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage qr_settings" ON public.qr_settings FOR ALL TO authenticated USING (public.get_user_role() IN ('Owner', 'Admin'));

-- Logs Policies:
CREATE POLICY "Read logs" ON public.invoice_activity_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert logs" ON public.invoice_activity_logs FOR INSERT TO authenticated WITH CHECK (true);
