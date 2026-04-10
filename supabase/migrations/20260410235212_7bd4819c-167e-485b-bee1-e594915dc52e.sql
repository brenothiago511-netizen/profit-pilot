CREATE OR REPLACE FUNCTION public.get_revenue_summary(
  p_date_from TEXT,
  p_date_to TEXT
)
RETURNS TABLE(source_name TEXT, total_amount NUMERIC, quantity BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(r.source, 'Outros') AS source_name,
    SUM(r.amount) AS total_amount,
    COUNT(*)::BIGINT AS quantity
  FROM public.revenues r
  WHERE r.date >= p_date_from::date
    AND r.date <= p_date_to::date
  GROUP BY r.source
  ORDER BY total_amount DESC;
END;
$$;