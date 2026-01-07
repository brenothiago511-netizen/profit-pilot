-- Allow partners to insert stores
CREATE POLICY "Partners can insert stores" 
ON public.stores 
FOR INSERT 
WITH CHECK (is_partner(auth.uid()));

-- Allow partners to update stores they are associated with
CREATE POLICY "Partners can update their stores" 
ON public.stores 
FOR UPDATE 
USING (id IN (
  SELECT store_id FROM partners 
  WHERE user_id = auth.uid() AND status = 'active' AND store_id IS NOT NULL
));