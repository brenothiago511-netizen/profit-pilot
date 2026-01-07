-- Make store_id nullable in partners table
ALTER TABLE public.partners ALTER COLUMN store_id DROP NOT NULL;

-- Update partner_transactions to also allow null store_id
ALTER TABLE public.partner_transactions ALTER COLUMN store_id DROP NOT NULL;

-- Update RLS policies for partners to not require store_id
DROP POLICY IF EXISTS "Partners can view their own records" ON public.partners;
CREATE POLICY "Partners can view their own records" 
ON public.partners 
FOR SELECT 
USING (auth.uid() = user_id);

-- Update RLS for partner_transactions
DROP POLICY IF EXISTS "Partners can view their own transactions" ON public.partner_transactions;
CREATE POLICY "Partners can view their own transactions" 
ON public.partner_transactions 
FOR SELECT 
USING (partner_id IN (
  SELECT id FROM partners WHERE user_id = auth.uid()
));

DROP POLICY IF EXISTS "Partners can insert their own transactions" ON public.partner_transactions;
CREATE POLICY "Partners can insert their own transactions" 
ON public.partner_transactions 
FOR INSERT 
WITH CHECK (partner_id IN (
  SELECT id FROM partners WHERE user_id = auth.uid() AND status = 'active'
));

DROP POLICY IF EXISTS "Partners can update their own transactions" ON public.partner_transactions;
CREATE POLICY "Partners can update their own transactions" 
ON public.partner_transactions 
FOR UPDATE 
USING (partner_id IN (
  SELECT id FROM partners WHERE user_id = auth.uid() AND status = 'active'
));