-- Allow partners to delete their own shopify withdrawals
CREATE POLICY "Partners can delete own shopify withdrawals"
ON public.shopify_withdrawals
FOR DELETE
TO authenticated
USING (is_partner(auth.uid()) AND created_by = auth.uid());

-- Allow financeiro to delete shopify withdrawals
CREATE POLICY "Financeiro can delete shopify withdrawals"
ON public.shopify_withdrawals
FOR DELETE
TO authenticated
USING (is_admin_or_financeiro(auth.uid()));

-- Allow financeiro to update shopify withdrawals
CREATE POLICY "Financeiro can update shopify withdrawals"
ON public.shopify_withdrawals
FOR UPDATE
TO authenticated
USING (is_admin_or_financeiro(auth.uid()));