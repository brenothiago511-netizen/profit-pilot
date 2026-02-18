
-- Allow partners (socio) to insert shopify withdrawals
CREATE POLICY "Partners can insert shopify withdrawals"
ON public.shopify_withdrawals
FOR INSERT
TO authenticated
WITH CHECK (is_partner(auth.uid()));

-- Allow partners to update shopify withdrawals (e.g., mark as received)
CREATE POLICY "Partners can update shopify withdrawals"
ON public.shopify_withdrawals
FOR UPDATE
TO authenticated
USING (is_partner(auth.uid()));
