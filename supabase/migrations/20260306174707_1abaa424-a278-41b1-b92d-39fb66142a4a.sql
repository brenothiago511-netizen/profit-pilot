
-- REVENUES: financeiro only sees their own records
DROP POLICY IF EXISTS "Admin and financeiro can view all revenues" ON public.revenues;
CREATE POLICY "Admin can view all revenues"
  ON public.revenues FOR SELECT
  USING (is_admin(auth.uid()));
CREATE POLICY "Financeiro can view own revenues"
  ON public.revenues FOR SELECT
  USING ((auth.uid() = user_id) AND is_admin_or_financeiro(auth.uid()));

-- EXPENSES: financeiro only sees their own records
DROP POLICY IF EXISTS "Admin and financeiro can view all expenses" ON public.expenses;
CREATE POLICY "Admin can view all expenses"
  ON public.expenses FOR SELECT
  USING (is_admin(auth.uid()));
CREATE POLICY "Financeiro can view own expenses"
  ON public.expenses FOR SELECT
  USING ((auth.uid() = user_id) AND is_admin_or_financeiro(auth.uid()));

-- SHOPIFY_WITHDRAWALS: financeiro only sees their own records
DROP POLICY IF EXISTS "Financeiro can view and insert shopify withdrawals" ON public.shopify_withdrawals;
CREATE POLICY "Financeiro can view own shopify withdrawals"
  ON public.shopify_withdrawals FOR SELECT
  USING ((auth.uid() = created_by) AND is_admin_or_financeiro(auth.uid()));

-- DAILY_RECORDS: financeiro only sees their own records
DROP POLICY IF EXISTS "Admins and financeiro can view all daily records" ON public.daily_records;
CREATE POLICY "Admin can view all daily records"
  ON public.daily_records FOR SELECT
  USING (is_admin(auth.uid()));
CREATE POLICY "Financeiro can view own daily records"
  ON public.daily_records FOR SELECT
  USING ((auth.uid() = created_by) AND is_admin_or_financeiro(auth.uid()));

-- PAYROLL: financeiro only sees their own records
DROP POLICY IF EXISTS "Financeiro can view payroll" ON public.payroll;
CREATE POLICY "Financeiro can view own payroll"
  ON public.payroll FOR SELECT
  USING ((auth.uid() = created_by) AND is_admin_or_financeiro(auth.uid()));
