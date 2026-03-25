-- ============================================================
-- Add captador role to enum + fix RLS for gestor/captador
-- ============================================================

-- 1. Add missing roles to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'captador';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'gestor';

-- ============================================================
-- 2. Helper functions for new roles
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_gestor()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'gestor'
    AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_captador()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'captador'
    AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- 3. daily_records — allow gestor to INSERT (register profits)
-- ============================================================

DROP POLICY IF EXISTS "Gestors can insert daily records" ON public.daily_records;
CREATE POLICY "Gestors can insert daily records"
ON public.daily_records FOR INSERT
WITH CHECK (
  is_gestor()
  AND created_by = auth.uid()
);

-- Gestors can update their own pending records
DROP POLICY IF EXISTS "Gestors can update own daily records" ON public.daily_records;
CREATE POLICY "Gestors can update own daily records"
ON public.daily_records FOR UPDATE
USING (
  is_gestor()
  AND created_by = auth.uid()
);

-- Gestors SELECT (via created_by) — already covered by 20260319000002
-- but make sure the policy exists for the gestor role specifically
DROP POLICY IF EXISTS "Gestors can view own daily records" ON public.daily_records;
CREATE POLICY "Gestors can view own daily records"
ON public.daily_records FOR SELECT
USING (
  is_gestor()
  AND created_by = auth.uid()
);

-- ============================================================
-- 4. shopify_withdrawals — gestor can view (for Lucros page)
-- ============================================================

DROP POLICY IF EXISTS "Gestors can view shopify withdrawals" ON public.shopify_withdrawals;
CREATE POLICY "Gestors can view shopify withdrawals"
ON public.shopify_withdrawals FOR SELECT
USING (is_gestor());

-- ============================================================
-- 5. stores — gestor can view stores (needed for Lucros page)
-- ============================================================

DROP POLICY IF EXISTS "Gestors can view stores" ON public.stores;
CREATE POLICY "Gestors can view stores"
ON public.stores FOR SELECT
USING (is_gestor());

-- ============================================================
-- 6. captador_commissions — ensure policies exist with new enum
-- ============================================================

-- Already created in 20260324000001 but using inline subquery;
-- re-create with helper function for consistency
DROP POLICY IF EXISTS "Admin full access captador_commissions" ON public.captador_commissions;
CREATE POLICY "Admin full access captador_commissions"
ON public.captador_commissions FOR ALL
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "Captador read own" ON public.captador_commissions;
CREATE POLICY "Captador read own"
ON public.captador_commissions FOR SELECT
USING (user_id = auth.uid());

-- ============================================================
-- 7. profiles — admin can INSERT new profiles (needed for
--    user management page when creating gestor/captador users)
-- ============================================================

DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
CREATE POLICY "Admins can insert profiles"
ON public.profiles FOR INSERT
WITH CHECK (is_admin() OR auth.uid() = id);

-- ============================================================
-- 8. Re-enable RLS on all core tables (idempotent safeguard)
-- This resolves the Supabase "rls_desativado_em_público" alert
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopify_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.captador_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenue_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;
