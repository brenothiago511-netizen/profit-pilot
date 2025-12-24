-- Add store_id column to managers table to link managers to specific stores
ALTER TABLE public.managers 
ADD COLUMN store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_managers_store_id ON public.managers(store_id);