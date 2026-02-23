
-- Allow all authenticated users to insert stores
CREATE POLICY "Authenticated users can insert stores"
ON public.stores
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow all authenticated users to update stores
CREATE POLICY "Authenticated users can update stores"
ON public.stores
FOR UPDATE
TO authenticated
USING (true);
