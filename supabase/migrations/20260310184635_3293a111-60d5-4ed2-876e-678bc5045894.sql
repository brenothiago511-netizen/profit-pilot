
-- 1. Restrict commission_tiers: remove public SELECT, add admin/financeiro only
DROP POLICY IF EXISTS "Anyone can view active commission tiers" ON public.commission_tiers;
CREATE POLICY "Admin and financeiro can view commission tiers"
ON public.commission_tiers
FOR SELECT
TO authenticated
USING (is_admin_or_financeiro(auth.uid()));

-- 2. Restrict system_settings: remove public SELECT, add admin only
DROP POLICY IF EXISTS "Anyone can view system settings" ON public.system_settings;
CREATE POLICY "Authenticated users can view system settings"
ON public.system_settings
FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

-- 3. Restrict permissions: remove public SELECT, add authenticated only
DROP POLICY IF EXISTS "Anyone can view permissions" ON public.permissions;
CREATE POLICY "Authenticated users can view permissions"
ON public.permissions
FOR SELECT
TO authenticated
USING (true);
