
-- Fix: Allow partners to see bank accounts they created (created_by = auth.uid())
DROP POLICY IF EXISTS "Partners can view accessible bank accounts" ON public.bank_accounts;

CREATE POLICY "Partners can view accessible bank accounts"
ON public.bank_accounts FOR SELECT TO authenticated
USING (
  (created_by = auth.uid()) OR
  (store_id IN (SELECT get_partner_store_ids(auth.uid()))) OR
  (id IN (SELECT bank_account_id FROM store_bank_accounts WHERE store_id IN (SELECT get_partner_store_ids(auth.uid()))))
);

-- Also fix UPDATE and DELETE to include created_by ownership
DROP POLICY IF EXISTS "Partners can update accessible bank accounts" ON public.bank_accounts;

CREATE POLICY "Partners can update accessible bank accounts"
ON public.bank_accounts FOR UPDATE TO authenticated
USING (
  (created_by = auth.uid()) OR
  (store_id IN (SELECT get_partner_store_ids(auth.uid()))) OR
  (id IN (SELECT bank_account_id FROM store_bank_accounts WHERE store_id IN (SELECT get_partner_store_ids(auth.uid()))))
);

DROP POLICY IF EXISTS "Partners can delete accessible bank accounts" ON public.bank_accounts;

CREATE POLICY "Partners can delete accessible bank accounts"
ON public.bank_accounts FOR DELETE TO authenticated
USING (
  (created_by = auth.uid()) OR
  (store_id IN (SELECT get_partner_store_ids(auth.uid()))) OR
  (id IN (SELECT bank_account_id FROM store_bank_accounts WHERE store_id IN (SELECT get_partner_store_ids(auth.uid()))))
);
