-- Change sale_date from date to text to store multiple dates as comma-separated values
ALTER TABLE public.shopify_withdrawals 
ALTER COLUMN sale_date TYPE text USING sale_date::text;

-- Update comment
COMMENT ON COLUMN public.shopify_withdrawals.sale_date IS 'Sale dates (comma-separated YYYY-MM-DD format, e.g., 2026-01-30,2026-01-31)';