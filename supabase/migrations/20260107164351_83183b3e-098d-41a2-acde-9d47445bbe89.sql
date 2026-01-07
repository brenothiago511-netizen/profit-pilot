-- Allow partners to insert their own transactions
CREATE POLICY "Partners can insert their own transactions"
ON public.partner_transactions
FOR INSERT
WITH CHECK (
  partner_id IN (
    SELECT id FROM public.partners WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- Allow partners to update their own transactions
CREATE POLICY "Partners can update their own transactions"
ON public.partner_transactions
FOR UPDATE
USING (
  partner_id IN (
    SELECT id FROM public.partners WHERE user_id = auth.uid() AND status = 'active'
  )
);