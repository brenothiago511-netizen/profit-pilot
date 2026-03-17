-- Drop the policy that requires is_partner (chicken-and-egg problem)
DROP POLICY IF EXISTS "Partners can insert own partner records" ON public.partners;

-- Allow socio users to insert their own partner records (checks role from profiles, not partners table)
CREATE POLICY "Socios can insert own partner records"
ON public.partners
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() 
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'socio'
  )
);