
-- Allow financeiro and partners to view payroll
CREATE POLICY "Financeiro can view payroll"
ON public.payroll FOR SELECT TO authenticated
USING (is_admin_or_financeiro(auth.uid()));

CREATE POLICY "Partners can view payroll"
ON public.payroll FOR SELECT TO authenticated
USING (is_partner(auth.uid()));

-- Allow financeiro and partners to insert payroll
CREATE POLICY "Financeiro can insert payroll"
ON public.payroll FOR INSERT TO authenticated
WITH CHECK (is_admin_or_financeiro(auth.uid()));

CREATE POLICY "Partners can insert payroll"
ON public.payroll FOR INSERT TO authenticated
WITH CHECK (is_partner(auth.uid()));

-- Allow financeiro and partners to update payroll
CREATE POLICY "Financeiro can update payroll"
ON public.payroll FOR UPDATE TO authenticated
USING (is_admin_or_financeiro(auth.uid()));

CREATE POLICY "Partners can update payroll"
ON public.payroll FOR UPDATE TO authenticated
USING (is_partner(auth.uid()));

-- Allow financeiro and partners to delete payroll
CREATE POLICY "Financeiro can delete payroll"
ON public.payroll FOR DELETE TO authenticated
USING (is_admin_or_financeiro(auth.uid()));

CREATE POLICY "Partners can delete payroll"
ON public.payroll FOR DELETE TO authenticated
USING (is_partner(auth.uid()));
