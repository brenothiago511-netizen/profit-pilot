-- Add columns to store Shopify numbers/IDs
ALTER TABLE public.daily_records
ADD COLUMN IF NOT EXISTS shopify_deposit_1_number text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS shopify_deposit_2_number text DEFAULT NULL;