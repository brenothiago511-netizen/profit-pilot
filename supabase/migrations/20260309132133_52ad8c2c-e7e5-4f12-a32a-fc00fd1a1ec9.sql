
CREATE POLICY "Users can insert their own partner record"
ON public.partners
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());
