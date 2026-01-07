-- Allow partners to view commissions of their stores
CREATE POLICY "Partners can view commissions of their stores"
ON public.commissions
FOR SELECT
USING (
  store_id IN (SELECT get_partner_store_ids(auth.uid()))
);