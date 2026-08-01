-- Migration 005: Normalize public.profiles role constraint & trigger to support lowercase roles

-- 1. Update check constraint on public.profiles
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_role_check
CHECK (LOWER(TRIM(role)) IN ('owner', 'admin', 'staff'));

-- 2. Update handle_new_user() trigger function to insert lowercase roles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_user_count INT;
    v_role TEXT := 'staff';
BEGIN
    SELECT COUNT(*) INTO v_user_count FROM public.profiles;
    
    -- First user becomes owner automatically
    IF v_user_count = 0 THEN
        v_role := 'owner';
    END IF;

    INSERT INTO public.profiles (id, email, full_name, role, designation, is_active)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        COALESCE(LOWER(TRIM(NEW.raw_user_meta_data->>'role')), v_role),
        COALESCE(NEW.raw_user_meta_data->>'designation', CASE WHEN v_role = 'owner' THEN 'Managing Director' ELSE 'Executive' END),
        true
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        designation = EXCLUDED.designation;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
