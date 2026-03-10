
-- 1. CRITICAL: Fix privilege escalation - prevent users from changing their own role
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()));

-- 2. Fix stores: replace overly permissive INSERT/UPDATE policies
DROP POLICY IF EXISTS "Authenticated users can insert stores" ON public.stores;
DROP POLICY IF EXISTS "Authenticated users can update stores" ON public.stores;

-- Only admin and partners can insert stores
CREATE POLICY "Admin and partners can insert stores"
ON public.stores
FOR INSERT
TO authenticated
WITH CHECK (is_admin(auth.uid()) OR is_partner(auth.uid()));

-- Only admin can update any store; partners restricted by existing policy
-- (remove the generic one, keep the partner-scoped and admin ALL policies)

-- 3. Fix payroll: restrict partner access to created_by ownership
DROP POLICY IF EXISTS "Partners can view payroll" ON public.payroll;
DROP POLICY IF EXISTS "Partners can insert payroll" ON public.payroll;
DROP POLICY IF EXISTS "Partners can update payroll" ON public.payroll;
DROP POLICY IF EXISTS "Partners can delete payroll" ON public.payroll;

CREATE POLICY "Partners can view own payroll"
ON public.payroll
FOR SELECT
TO authenticated
USING (is_partner(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Partners can insert own payroll"
ON public.payroll
FOR INSERT
TO authenticated
WITH CHECK (is_partner(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Partners can update own payroll"
ON public.payroll
FOR UPDATE
TO authenticated
USING (is_partner(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Partners can delete own payroll"
ON public.payroll
FOR DELETE
TO authenticated
USING (is_partner(auth.uid()) AND created_by = auth.uid());

-- 4. Fix shopify_withdrawals: restrict partner UPDATE to own records
DROP POLICY IF EXISTS "Partners can update shopify withdrawals" ON public.shopify_withdrawals;
CREATE POLICY "Partners can update own shopify withdrawals"
ON public.shopify_withdrawals
FOR UPDATE
TO authenticated
USING (is_partner(auth.uid()) AND created_by = auth.uid());

-- 5. Fix managers: restrict partner view to their store managers only
DROP POLICY IF EXISTS "Partners can view managers" ON public.managers;
CREATE POLICY "Partners can view managers of their stores"
ON public.managers
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR is_admin(auth.uid()) OR store_id IN (SELECT get_partner_store_ids(auth.uid())));
