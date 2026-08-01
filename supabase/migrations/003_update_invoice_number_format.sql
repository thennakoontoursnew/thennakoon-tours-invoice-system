-- Migration 003: Update Invoice Number Format to TT-IN-1001 (Starting from 1001, removing year dependency)

CREATE OR REPLACE FUNCTION public.generate_next_invoice_number(p_year INT DEFAULT NULL)
RETURNS TABLE (
    new_sequence INT,
    new_invoice_number TEXT
) AS $$
DECLARE
    v_seq INT;
    v_num TEXT;
BEGIN
    -- Fetch current maximum sequence from invoices table, fallback to 1000
    SELECT COALESCE(MAX(invoice_sequence), 1000) INTO v_seq FROM public.invoices;

    IF v_seq < 1000 THEN
        v_seq := 1000;
    END IF;

    v_seq := v_seq + 1;
    v_num := 'TT-IN-' || v_seq::TEXT;

    RETURN QUERY SELECT v_seq, v_num;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
