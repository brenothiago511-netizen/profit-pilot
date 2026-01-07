-- Allow partners to insert daily records for their stores
CREATE POLICY "Partners can insert daily records for their stores"
ON public.daily_records
FOR INSERT
WITH CHECK (
  store_id IN (SELECT get_partner_store_ids(auth.uid()))
);

-- Allow partners to view daily records for their stores
CREATE POLICY "Partners can view daily records of their stores"
ON public.daily_records
FOR SELECT
USING (
  store_id IN (SELECT get_partner_store_ids(auth.uid()))
);

-- Allow partners to insert managers (for themselves)
CREATE POLICY "Partners can insert their own manager record"
ON public.managers
FOR INSERT
WITH CHECK (
  user_id = auth.uid() AND is_partner(auth.uid())
);

-- Allow partners to view managers of their stores
CREATE POLICY "Partners can view managers"
ON public.managers
FOR SELECT
USING (
  user_id = auth.uid() OR is_admin(auth.uid()) OR is_partner(auth.uid())
);