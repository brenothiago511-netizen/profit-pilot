-- Allow partners to delete their store bank accounts
CREATE POLICY "Partners can delete their store bank accounts"
ON public.bank_accounts
FOR DELETE
TO authenticated
USING (store_id IN (SELECT get_partner_store_ids(auth.uid())));

-- Allow partners to update their store bank transactions
CREATE POLICY "Partners can update their store transactions"
ON public.bank_transactions
FOR UPDATE
TO authenticated
USING (bank_account_id IN (
  SELECT ba.id FROM bank_accounts ba
  WHERE ba.store_id IN (SELECT get_partner_store_ids(auth.uid()))
));

-- Allow partners to delete their store bank transactions
CREATE POLICY "Partners can delete their store transactions"
ON public.bank_transactions
FOR DELETE
TO authenticated
USING (bank_account_id IN (
  SELECT ba.id FROM bank_accounts ba
  WHERE ba.store_id IN (SELECT get_partner_store_ids(auth.uid()))
));