
-- Allow partners to delete expenses they created or from their stores
CREATE POLICY "Partners can delete their own expenses"
ON public.expenses FOR DELETE TO authenticated
USING (
  is_partner(auth.uid()) AND (
    user_id = auth.uid()
    OR store_id IN (SELECT get_partner_store_ids(auth.uid()))
  )
);

-- Allow financeiro to delete expenses
CREATE POLICY "Financeiro can delete expenses"
ON public.expenses FOR DELETE TO authenticated
USING (is_admin_or_financeiro(auth.uid()));
