-- Add RLS policy for partners to view revenues of their stores
CREATE POLICY "Partners can view revenues of their stores"
  ON public.revenues
  FOR SELECT
  USING (
    store_id IN (
      SELECT store_id FROM public.partners 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Add RLS policy for partners to view expenses of their stores
CREATE POLICY "Partners can view expenses of their stores"
  ON public.expenses
  FOR SELECT
  USING (
    store_id IN (
      SELECT store_id FROM public.partners 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );