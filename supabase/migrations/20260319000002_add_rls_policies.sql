-- ============================================================
-- RLS POLICIES — Segurança por linha para todas as tabelas
-- ============================================================

-- Função auxiliar para verificar se usuário é admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
    AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Função auxiliar para verificar se usuário é financeiro ou admin
CREATE OR REPLACE FUNCTION is_financeiro_or_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'financeiro')
    AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Função auxiliar para obter stores do sócio
CREATE OR REPLACE FUNCTION get_partner_store_ids()
RETURNS uuid[] AS $$
  SELECT ARRAY(
    SELECT store_id FROM partners
    WHERE user_id = auth.uid()
    AND status = 'active'
    AND store_id IS NOT NULL
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- EXPENSES
-- ============================================================
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expenses_select" ON expenses;
CREATE POLICY "expenses_select" ON expenses
  FOR SELECT USING (
    is_financeiro_or_admin()
    OR store_id = ANY(get_partner_store_ids())
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "expenses_insert" ON expenses;
CREATE POLICY "expenses_insert" ON expenses
  FOR INSERT WITH CHECK (
    is_financeiro_or_admin()
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "expenses_update" ON expenses;
CREATE POLICY "expenses_update" ON expenses
  FOR UPDATE USING (
    is_financeiro_or_admin()
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "expenses_delete" ON expenses;
CREATE POLICY "expenses_delete" ON expenses
  FOR DELETE USING (
    is_financeiro_or_admin()
  );

-- ============================================================
-- REVENUES
-- ============================================================
ALTER TABLE revenues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "revenues_select" ON revenues;
CREATE POLICY "revenues_select" ON revenues
  FOR SELECT USING (
    is_financeiro_or_admin()
    OR store_id = ANY(get_partner_store_ids())
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "revenues_insert" ON revenues;
CREATE POLICY "revenues_insert" ON revenues
  FOR INSERT WITH CHECK (
    is_financeiro_or_admin()
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "revenues_update" ON revenues;
CREATE POLICY "revenues_update" ON revenues
  FOR UPDATE USING (
    is_financeiro_or_admin()
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "revenues_delete" ON revenues;
CREATE POLICY "revenues_delete" ON revenues
  FOR DELETE USING (
    is_financeiro_or_admin()
  );

-- ============================================================
-- DAILY_RECORDS
-- ============================================================
ALTER TABLE daily_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_records_select" ON daily_records;
CREATE POLICY "daily_records_select" ON daily_records
  FOR SELECT USING (
    is_financeiro_or_admin()
    OR store_id = ANY(get_partner_store_ids())
    OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS "daily_records_insert" ON daily_records;
CREATE POLICY "daily_records_insert" ON daily_records
  FOR INSERT WITH CHECK (
    is_financeiro_or_admin()
    OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS "daily_records_update" ON daily_records;
CREATE POLICY "daily_records_update" ON daily_records
  FOR UPDATE USING (
    is_financeiro_or_admin()
    OR created_by = auth.uid()
  );

-- ============================================================
-- PROFILES — usuário vê apenas o próprio perfil, admin vê todos
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (
    id = auth.uid()
    OR is_admin()
  );

DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE USING (
    id = auth.uid()
    OR is_admin()
  );

-- ============================================================
-- STORES — financeiro/admin vê todas, sócio vê apenas as suas
-- ============================================================
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stores_select" ON stores;
CREATE POLICY "stores_select" ON stores
  FOR SELECT USING (
    is_financeiro_or_admin()
    OR id = ANY(get_partner_store_ids())
  );

DROP POLICY IF EXISTS "stores_insert" ON stores;
CREATE POLICY "stores_insert" ON stores
  FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS "stores_update" ON stores;
CREATE POLICY "stores_update" ON stores
  FOR UPDATE USING (is_admin());

DROP POLICY IF EXISTS "stores_delete" ON stores;
CREATE POLICY "stores_delete" ON stores
  FOR DELETE USING (is_admin());

-- ============================================================
-- PARTNERS
-- ============================================================
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "partners_select" ON partners;
CREATE POLICY "partners_select" ON partners
  FOR SELECT USING (
    is_admin()
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "partners_insert" ON partners;
CREATE POLICY "partners_insert" ON partners
  FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS "partners_update" ON partners;
CREATE POLICY "partners_update" ON partners
  FOR UPDATE USING (is_admin());

-- ============================================================
-- NOTIFICATIONS — usuário vê apenas as próprias
-- ============================================================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select" ON notifications;
CREATE POLICY "notifications_select" ON notifications
  FOR SELECT USING (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "notifications_update" ON notifications;
CREATE POLICY "notifications_update" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

-- ============================================================
-- EXCHANGE_RATES — leitura pública para usuários autenticados
-- ============================================================
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "exchange_rates_select" ON exchange_rates;
CREATE POLICY "exchange_rates_select" ON exchange_rates
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "exchange_rates_insert" ON exchange_rates;
CREATE POLICY "exchange_rates_insert" ON exchange_rates
  FOR INSERT WITH CHECK (is_admin());

-- ============================================================
-- EXPENSE_CATEGORIES — leitura para todos autenticados
-- ============================================================
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expense_categories_select" ON expense_categories;
CREATE POLICY "expense_categories_select" ON expense_categories
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "expense_categories_insert" ON expense_categories;
CREATE POLICY "expense_categories_insert" ON expense_categories
  FOR INSERT WITH CHECK (is_admin());

-- ============================================================
-- BANK_ACCOUNTS
-- ============================================================
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bank_accounts_select" ON bank_accounts;
CREATE POLICY "bank_accounts_select" ON bank_accounts
  FOR SELECT USING (is_financeiro_or_admin());

DROP POLICY IF EXISTS "bank_accounts_insert" ON bank_accounts;
CREATE POLICY "bank_accounts_insert" ON bank_accounts
  FOR INSERT WITH CHECK (is_financeiro_or_admin());

DROP POLICY IF EXISTS "bank_accounts_update" ON bank_accounts;
CREATE POLICY "bank_accounts_update" ON bank_accounts
  FOR UPDATE USING (is_financeiro_or_admin());

-- ============================================================
-- AUDIT_LOGS — apenas admins leem, sistema insere
-- ============================================================
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_select" ON audit_logs;
CREATE POLICY "audit_logs_select" ON audit_logs
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "audit_logs_insert" ON audit_logs;
CREATE POLICY "audit_logs_insert" ON audit_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- PAYROLL — financeiro e admin
-- ============================================================
ALTER TABLE payroll ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payroll_select" ON payroll;
CREATE POLICY "payroll_select" ON payroll
  FOR SELECT USING (is_financeiro_or_admin());

DROP POLICY IF EXISTS "payroll_insert" ON payroll;
CREATE POLICY "payroll_insert" ON payroll
  FOR INSERT WITH CHECK (is_financeiro_or_admin());

DROP POLICY IF EXISTS "payroll_update" ON payroll;
CREATE POLICY "payroll_update" ON payroll
  FOR UPDATE USING (is_financeiro_or_admin());

DROP POLICY IF EXISTS "payroll_delete" ON payroll;
CREATE POLICY "payroll_delete" ON payroll
  FOR DELETE USING (is_admin());
