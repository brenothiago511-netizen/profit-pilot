-- Make store_id optional in expenses table
ALTER TABLE public.expenses ALTER COLUMN store_id DROP NOT NULL;