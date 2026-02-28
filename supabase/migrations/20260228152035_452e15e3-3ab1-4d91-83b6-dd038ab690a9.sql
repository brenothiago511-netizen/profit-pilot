
-- Fix partner SELECT policy to also show expenses with null store_id that they created
DROP POLICY IF EXISTS "Partners can view expenses of their stores" ON public.expenses;

CREATE POLICY "Partners can view expenses of their stores"
ON public.expenses
FOR SELECT
TO authenticated
USING (
  store_id IN (
    SELECT store_id FROM partners
    WHERE user_id = auth.uid() AND status = 'active'
  )
  OR (store_id IS NULL AND user_id = auth.uid())
);
