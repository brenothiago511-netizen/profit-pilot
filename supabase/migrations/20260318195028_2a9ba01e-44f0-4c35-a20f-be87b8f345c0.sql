-- Clean up legacy store_id values from bank_accounts
-- The proper linking is done via store_bank_accounts junction table
UPDATE public.bank_accounts SET store_id = NULL WHERE store_id IS NOT NULL;