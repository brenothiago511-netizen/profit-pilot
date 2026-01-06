-- Add shopify_status column to daily_records for tracking Shopify payment
ALTER TABLE public.daily_records 
ADD COLUMN IF NOT EXISTS shopify_status text DEFAULT 'pending';

-- Add comment for clarity
COMMENT ON COLUMN public.daily_records.shopify_status IS 'Status do pagamento da Shopify: pending, paid';