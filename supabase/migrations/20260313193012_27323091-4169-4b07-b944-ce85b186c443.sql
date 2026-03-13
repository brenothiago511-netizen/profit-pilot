
CREATE OR REPLACE FUNCTION public.sum_amounts(
  p_table text,
  p_date_start date,
  p_date_end date,
  p_store_ids uuid[] DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_include_null_store boolean DEFAULT false
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total numeric := 0;
BEGIN
  IF p_table = 'revenues' THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_total
    FROM revenues
    WHERE date >= p_date_start
      AND date <= p_date_end
      AND (p_store_ids IS NULL OR store_id = ANY(p_store_ids) OR (p_include_null_store AND store_id IS NULL AND user_id = p_user_id))
      AND (p_user_id IS NULL OR NOT p_include_null_store OR user_id = p_user_id OR store_id = ANY(COALESCE(p_store_ids, ARRAY[]::uuid[])));
  ELSIF p_table = 'expenses' THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_total
    FROM expenses
    WHERE date >= p_date_start
      AND date <= p_date_end
      AND (p_store_ids IS NULL OR store_id = ANY(p_store_ids) OR (p_include_null_store AND store_id IS NULL AND user_id = p_user_id))
      AND (p_user_id IS NULL OR NOT p_include_null_store OR user_id = p_user_id OR store_id = ANY(COALESCE(p_store_ids, ARRAY[]::uuid[])));
  END IF;

  RETURN v_total;
END;
$$;
