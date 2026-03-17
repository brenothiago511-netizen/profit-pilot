
-- Create junction table for store-bank relationships
CREATE TABLE public.store_bank_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  bank_account_id uuid NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(store_id, bank_account_id)
);

-- Enable RLS
ALTER TABLE public.store_bank_accounts ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage store bank links"
ON public.store_bank_accounts FOR ALL
USING (public.is_admin(auth.uid()));

CREATE POLICY "Financeiro can manage store bank links"
ON public.store_bank_accounts FOR ALL TO authenticated
USING (public.is_admin_or_financeiro(auth.uid()));

CREATE POLICY "Partners can view their store bank links"
ON public.store_bank_accounts FOR SELECT TO authenticated
USING (store_id IN (SELECT public.get_partner_store_ids(auth.uid())));

CREATE POLICY "Partners can insert links for their stores"
ON public.store_bank_accounts FOR INSERT TO authenticated
WITH CHECK (store_id IN (SELECT public.get_partner_store_ids(auth.uid())));

CREATE POLICY "Partners can delete links for their stores"
ON public.store_bank_accounts FOR DELETE TO authenticated
USING (store_id IN (SELECT public.get_partner_store_ids(auth.uid())));

-- Migrate existing store_id associations to junction table
INSERT INTO public.store_bank_accounts (store_id, bank_account_id, is_primary)
SELECT store_id, id, is_primary
FROM public.bank_accounts
WHERE store_id IS NOT NULL
ON CONFLICT DO NOTHING;
