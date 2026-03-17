
-- Allow bank accounts without a store (general/unlinked accounts)
ALTER TABLE public.bank_accounts ALTER COLUMN store_id DROP NOT NULL;
