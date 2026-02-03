-- Add sale_date column to track when the sale happened (separate from payout date)
ALTER TABLE public.shopify_withdrawals 
ADD COLUMN sale_date date;

-- Add comment for clarity
COMMENT ON COLUMN public.shopify_withdrawals.sale_date IS 'Date when the sale occurred on Shopify';
COMMENT ON COLUMN public.shopify_withdrawals.date IS 'Date when the payout was received';