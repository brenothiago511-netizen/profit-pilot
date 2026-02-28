
-- Drop and recreate the partner INSERT policy to also allow null store_id
DROP POLICY IF EXISTS "Partners can insert expenses for their stores" ON public.expenses;

CREATE POLICY "Partners can insert expenses for their stores"
ON public.expenses
FOR INSERT
TO authenticated
WITH CHECK (
  is_partner(auth.uid()) AND (
    store_id IS NULL 
    OR store_id IN (SELECT get_partner_store_ids(auth.uid()))
  )
);
