
-- Create bank_transactions table for tracking all bank account movements
CREATE TABLE public.bank_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'entrada', -- entrada, saida, transferencia_entrada, transferencia_saida
  amount NUMERIC NOT NULL,
  balance_after NUMERIC, -- snapshot of balance after this transaction
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  reference_type TEXT, -- revenue, expense, manual, transfer, shopify_withdrawal
  reference_id UUID, -- ID from revenues/expenses/etc table
  category TEXT, -- optional categorization
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add balance column to bank_accounts for quick access
ALTER TABLE public.bank_accounts ADD COLUMN IF NOT EXISTS balance NUMERIC NOT NULL DEFAULT 0;

-- Enable RLS
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bank_transactions
-- Admins can do everything
CREATE POLICY "Admins can manage bank transactions"
ON public.bank_transactions
FOR ALL
TO public
USING (is_admin(auth.uid()));

-- Financeiro can view and insert
CREATE POLICY "Financeiro can view bank transactions"
ON public.bank_transactions
FOR SELECT
TO authenticated
USING (is_admin_or_financeiro(auth.uid()));

CREATE POLICY "Financeiro can insert bank transactions"
ON public.bank_transactions
FOR INSERT
TO authenticated
WITH CHECK (is_admin_or_financeiro(auth.uid()));

-- Partners can view/insert transactions for their store accounts
CREATE POLICY "Partners can view their store transactions"
ON public.bank_transactions
FOR SELECT
TO authenticated
USING (
  bank_account_id IN (
    SELECT ba.id FROM public.bank_accounts ba
    WHERE ba.store_id IN (SELECT get_partner_store_ids(auth.uid()))
  )
);

CREATE POLICY "Partners can insert their store transactions"
ON public.bank_transactions
FOR INSERT
TO authenticated
WITH CHECK (
  bank_account_id IN (
    SELECT ba.id FROM public.bank_accounts ba
    WHERE ba.store_id IN (SELECT get_partner_store_ids(auth.uid()))
  )
);

-- Partners can also manage bank_accounts for their stores
CREATE POLICY "Partners can view their store bank accounts"
ON public.bank_accounts
FOR SELECT
TO authenticated
USING (
  store_id IN (SELECT get_partner_store_ids(auth.uid()))
);

CREATE POLICY "Partners can insert bank accounts for their stores"
ON public.bank_accounts
FOR INSERT
TO authenticated
WITH CHECK (
  store_id IN (SELECT get_partner_store_ids(auth.uid()))
);

CREATE POLICY "Partners can update their store bank accounts"
ON public.bank_accounts
FOR UPDATE
TO authenticated
USING (
  store_id IN (SELECT get_partner_store_ids(auth.uid()))
);

-- Financeiro can also manage bank accounts
CREATE POLICY "Financeiro can manage bank accounts"
ON public.bank_accounts
FOR ALL
TO authenticated
USING (is_admin_or_financeiro(auth.uid()));

-- Updated_at trigger
CREATE TRIGGER update_bank_transactions_updated_at
  BEFORE UPDATE ON public.bank_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable realtime for bank_transactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.bank_transactions;
