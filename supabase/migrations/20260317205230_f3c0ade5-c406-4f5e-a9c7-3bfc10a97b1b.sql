
-- Update partner INSERT policy to allow creating banks without store
DROP POLICY IF EXISTS "Partners can insert bank accounts for their stores" ON public.bank_accounts;
CREATE POLICY "Partners can insert bank accounts"
ON public.bank_accounts FOR INSERT TO authenticated
WITH CHECK (public.is_partner(auth.uid()));

-- Update partner SELECT policy to include unlinked banks and banks linked via junction
DROP POLICY IF EXISTS "Partners can view their store bank accounts" ON public.bank_accounts;
CREATE POLICY "Partners can view accessible bank accounts"
ON public.bank_accounts FOR SELECT TO authenticated
USING (
  store_id IN (SELECT public.get_partner_store_ids(auth.uid()))
  OR id IN (
    SELECT bank_account_id FROM public.store_bank_accounts 
    WHERE store_id IN (SELECT public.get_partner_store_ids(auth.uid()))
  )
  OR store_id IS NULL
);

-- Update partner UPDATE policy
DROP POLICY IF EXISTS "Partners can update their store bank accounts" ON public.bank_accounts;
CREATE POLICY "Partners can update accessible bank accounts"
ON public.bank_accounts FOR UPDATE TO authenticated
USING (
  store_id IN (SELECT public.get_partner_store_ids(auth.uid()))
  OR id IN (
    SELECT bank_account_id FROM public.store_bank_accounts 
    WHERE store_id IN (SELECT public.get_partner_store_ids(auth.uid()))
  )
  OR store_id IS NULL
);

-- Update partner DELETE policy
DROP POLICY IF EXISTS "Partners can delete their store bank accounts" ON public.bank_accounts;
CREATE POLICY "Partners can delete accessible bank accounts"
ON public.bank_accounts FOR DELETE TO authenticated
USING (
  store_id IN (SELECT public.get_partner_store_ids(auth.uid()))
  OR id IN (
    SELECT bank_account_id FROM public.store_bank_accounts 
    WHERE store_id IN (SELECT public.get_partner_store_ids(auth.uid()))
  )
  OR store_id IS NULL
);
