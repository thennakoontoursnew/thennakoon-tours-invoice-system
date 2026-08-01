-- Migration 002: Normalize role checks for RLS policies (case-insensitive owner/admin checks)

-- 1. Update public.get_user_role() to return lower-cased and trimmed role string
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
    SELECT LOWER(TRIM(role)) FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 2. Drop existing RLS policies that relied on exact case matching
DROP POLICY IF EXISTS "Owner manage profiles" ON public.profiles;
DROP POLICY IF EXISTS "Owner Admin edit invoices" ON public.invoices;
DROP POLICY IF EXISTS "Owner Admin delete invoices" ON public.invoices;
DROP POLICY IF EXISTS "Manage company_settings" ON public.company_settings;
DROP POLICY IF EXISTS "Manage bank_settings" ON public.bank_settings;
DROP POLICY IF EXISTS "Manage invoice_settings" ON public.invoice_settings;
DROP POLICY IF EXISTS "Manage qr_settings" ON public.qr_settings;

-- 3. Re-create policies with normalized case-insensitive role checks
CREATE POLICY "Owner manage profiles" ON public.profiles FOR ALL TO authenticated
USING (public.get_user_role() = 'owner')
WITH CHECK (public.get_user_role() = 'owner');

CREATE POLICY "Owner Admin edit invoices" ON public.invoices FOR ALL TO authenticated
USING (
    (public.get_user_role() IN ('owner', 'admin'))
    OR (public.get_user_role() = 'staff' AND status = 'Draft')
)
WITH CHECK (
    (public.get_user_role() IN ('owner', 'admin'))
    OR (public.get_user_role() = 'staff' AND status = 'Draft')
);

CREATE POLICY "Owner Admin delete invoices" ON public.invoices FOR DELETE TO authenticated
USING (public.get_user_role() IN ('owner', 'admin'));

CREATE POLICY "Manage company_settings" ON public.company_settings FOR ALL TO authenticated
USING (public.get_user_role() IN ('owner', 'admin'))
WITH CHECK (public.get_user_role() IN ('owner', 'admin'));

CREATE POLICY "Manage bank_settings" ON public.bank_settings FOR ALL TO authenticated
USING (public.get_user_role() IN ('owner', 'admin'))
WITH CHECK (public.get_user_role() IN ('owner', 'admin'));

CREATE POLICY "Manage invoice_settings" ON public.invoice_settings FOR ALL TO authenticated
USING (public.get_user_role() IN ('owner', 'admin'))
WITH CHECK (public.get_user_role() IN ('owner', 'admin'));

CREATE POLICY "Manage qr_settings" ON public.qr_settings FOR ALL TO authenticated
USING (public.get_user_role() IN ('owner', 'admin'))
WITH CHECK (public.get_user_role() IN ('owner', 'admin'));
