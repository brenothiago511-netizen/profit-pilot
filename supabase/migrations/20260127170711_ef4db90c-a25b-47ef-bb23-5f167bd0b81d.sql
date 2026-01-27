-- Make store_id nullable in revenues table
ALTER TABLE public.revenues ALTER COLUMN store_id DROP NOT NULL;