-- Add status column to track if withdrawal has been received
ALTER TABLE public.shopify_withdrawals
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';

-- Add received_at timestamp for when the withdrawal was marked as received
ALTER TABLE public.shopify_withdrawals
ADD COLUMN IF NOT EXISTS received_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;