-- Adicionar colunas de moeda e conversão para os depósitos Shopify
ALTER TABLE public.daily_records
ADD COLUMN shopify_deposit_1_currency text DEFAULT 'BRL',
ADD COLUMN shopify_deposit_1_converted numeric DEFAULT NULL,
ADD COLUMN shopify_deposit_1_rate numeric DEFAULT 1,
ADD COLUMN shopify_deposit_2_currency text DEFAULT 'BRL',
ADD COLUMN shopify_deposit_2_converted numeric DEFAULT NULL,
ADD COLUMN shopify_deposit_2_rate numeric DEFAULT 1;