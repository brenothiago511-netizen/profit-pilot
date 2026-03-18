
-- Fix 1: Remove "store_id IS NULL" from partner policies on bank_accounts
DROP POLICY IF EXISTS "Partners can view accessible bank accounts" ON public.bank_accounts;
CREATE POLICY "Partners can view accessible bank accounts"
ON public.bank_accounts FOR SELECT TO authenticated
USING (
  (store_id IN (SELECT get_partner_store_ids(auth.uid())))
  OR
  (id IN (SELECT bank_account_id FROM store_bank_accounts WHERE store_id IN (SELECT get_partner_store_ids(auth.uid()))))
);

DROP POLICY IF EXISTS "Partners can update accessible bank accounts" ON public.bank_accounts;
CREATE POLICY "Partners can update accessible bank accounts"
ON public.bank_accounts FOR UPDATE TO authenticated
USING (
  (store_id IN (SELECT get_partner_store_ids(auth.uid())))
  OR
  (id IN (SELECT bank_account_id FROM store_bank_accounts WHERE store_id IN (SELECT get_partner_store_ids(auth.uid()))))
);

DROP POLICY IF EXISTS "Partners can delete accessible bank accounts" ON public.bank_accounts;
CREATE POLICY "Partners can delete accessible bank accounts"
ON public.bank_accounts FOR DELETE TO authenticated
USING (
  (store_id IN (SELECT get_partner_store_ids(auth.uid())))
  OR
  (id IN (SELECT bank_account_id FROM store_bank_accounts WHERE store_id IN (SELECT get_partner_store_ids(auth.uid()))))
);

-- Fix 2: Restrict partner manager self-assignment to their own stores only
DROP POLICY IF EXISTS "Partners can insert their own manager record" ON public.managers;
CREATE POLICY "Partners can insert their own manager record"
ON public.managers FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND is_partner(auth.uid())
  AND (store_id IS NULL OR store_id IN (SELECT get_partner_store_ids(auth.uid())))
);
