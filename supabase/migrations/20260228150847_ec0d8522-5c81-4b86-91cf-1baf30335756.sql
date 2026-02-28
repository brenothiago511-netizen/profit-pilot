
-- Drop the restrictive INSERT policies on expenses
DROP POLICY IF EXISTS "Admin and financeiro can insert expenses" ON public.expenses;
DROP POLICY IF EXISTS "Partners can insert expenses for their stores" ON public.expenses;

-- Recreate as PERMISSIVE policies (OR logic)
CREATE POLICY "Admin and financeiro can insert expenses"
ON public.expenses
FOR INSERT
TO authenticated
WITH CHECK (is_admin_or_financeiro(auth.uid()));

CREATE POLICY "Partners can insert expenses for their stores"
ON public.expenses
FOR INSERT
TO authenticated
WITH CHECK (store_id IN (SELECT get_partner_store_ids(auth.uid())));
