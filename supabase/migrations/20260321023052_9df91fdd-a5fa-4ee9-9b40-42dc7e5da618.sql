
CREATE OR REPLACE FUNCTION public.get_expense_summary(
  p_date_from text,
  p_date_to text,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE(category_name text, total_amount numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(ec.name, 'Sem categoria') AS category_name,
    SUM(e.amount) AS total_amount
  FROM expenses e
  LEFT JOIN expense_categories ec ON ec.id = e.category_id
  WHERE e.date >= p_date_from::date
    AND e.date <= p_date_to::date
    AND (p_user_id IS NULL OR e.user_id = p_user_id)
  GROUP BY ec.name
  ORDER BY total_amount DESC;
$$;
