-- Allow partners (socio) to insert their own partner records when creating stores
CREATE POLICY "Partners can insert own partner records"
ON public.partners
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() AND is_partner(auth.uid())
);