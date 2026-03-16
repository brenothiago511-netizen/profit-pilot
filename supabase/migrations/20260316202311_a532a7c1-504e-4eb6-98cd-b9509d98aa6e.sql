
-- 1. FIX CRITICAL: Remove self-insert from profiles (trigger handles this)
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
CREATE POLICY "Only admins can insert profiles"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (is_admin(auth.uid()));

-- 2. FIX CRITICAL: Restrict partner self-insertion to admin only
DROP POLICY IF EXISTS "Users can insert their own partner record" ON public.partners;
CREATE POLICY "Only admins can create partner records"
ON public.partners
FOR INSERT
TO authenticated
WITH CHECK (is_admin(auth.uid()));

-- Also restrict self-update on partners to prevent store_id manipulation
DROP POLICY IF EXISTS "Users can update their own partner record" ON public.partners;
CREATE POLICY "Partners can update own non-critical fields"
ON public.partners
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND store_id = (SELECT p.store_id FROM public.partners p WHERE p.id = partners.id)
);

-- 3. FIX WARNING: Restrict notification inserts to own user_id only
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "Users can insert own notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- 4. FIX WARNING: Restrict audit_logs insert to own user_id
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated users can insert own audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());
