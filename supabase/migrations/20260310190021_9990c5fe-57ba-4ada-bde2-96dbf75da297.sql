
-- Allow all authenticated users to insert stores (not just admin/partner)
DROP POLICY IF EXISTS "Admin and partners can insert stores" ON public.stores;
CREATE POLICY "Authenticated users can insert stores"
ON public.stores
FOR INSERT
TO authenticated
WITH CHECK (true);
