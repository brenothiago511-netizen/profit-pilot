-- Create bank_accounts table with international banking standards
CREATE TABLE public.bank_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  account_holder TEXT NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'checking',
  routing_number TEXT,
  account_number TEXT NOT NULL,
  swift_code TEXT,
  iban TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  country TEXT NOT NULL DEFAULT 'US',
  notes TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

-- Only admins can manage bank accounts
CREATE POLICY "Admins can manage bank accounts"
ON public.bank_accounts
FOR ALL
USING (is_admin(auth.uid()));

-- Financeiro can view bank accounts
CREATE POLICY "Financeiro can view bank accounts"
ON public.bank_accounts
FOR SELECT
USING (is_admin_or_financeiro(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_bank_accounts_updated_at
BEFORE UPDATE ON public.bank_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for store lookup
CREATE INDEX idx_bank_accounts_store_id ON public.bank_accounts(store_id);