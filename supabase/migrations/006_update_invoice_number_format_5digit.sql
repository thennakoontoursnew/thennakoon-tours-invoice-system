-- Migration 006: Update Invoice Number Format to 5-digit sequence (TT-IN-10001)

CREATE OR REPLACE FUNCTION public.generate_next_invoice_number(p_year INT DEFAULT NULL)
RETURNS TABLE (
    new_sequence INT,
    new_invoice_number TEXT
) AS $$
DECLARE
    v_seq INT;
    v_num TEXT;
BEGIN
    -- Select next sequence starting from 10001
    SELECT GREATEST(10001, COALESCE(MAX(invoice_sequence), 0) + 1)
    INTO v_seq
    FROM public.invoices;

    -- Left pad sequence to at least 5 digits: TT-IN-10001
    v_num := 'TT-IN-' || LPAD(v_seq::TEXT, 5, '0');

    RETURN QUERY SELECT v_seq, v_num;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
