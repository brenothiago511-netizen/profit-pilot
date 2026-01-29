-- Adicionar colunas para registrar valores de depósito Shopify
ALTER TABLE public.daily_records
ADD COLUMN shopify_deposit_1 numeric DEFAULT NULL,
ADD COLUMN shopify_deposit_2 numeric DEFAULT NULL;