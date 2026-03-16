
-- 1. Fix exchange_rates: restrict to authenticated users only
DROP POLICY IF EXISTS "Anyone can view exchange rates" ON public.exchange_rates;
CREATE POLICY "Authenticated users can view exchange rates"
ON public.exchange_rates
FOR SELECT
TO authenticated
USING (true);

-- 2. Fix permissions: restrict to authenticated users (already correct role, but ensure TO clause)
DROP POLICY IF EXISTS "Authenticated users can view permissions" ON public.permissions;
CREATE POLICY "Authenticated users can view permissions"
ON public.permissions
FOR SELECT
TO authenticated
USING (true);

-- 3. Fix stores INSERT: restrict to admin, financeiro, and partners only
DROP POLICY IF EXISTS "Authenticated users can insert stores" ON public.stores;
CREATE POLICY "Admin and financeiro can insert stores"
ON public.stores
FOR INSERT
TO authenticated
WITH CHECK (is_admin_or_financeiro(auth.uid()) OR is_partner(auth.uid()));
