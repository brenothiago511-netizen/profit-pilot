-- Drop existing insert policy for managers if exists
DROP POLICY IF EXISTS "Admins can manage managers" ON public.managers;

-- Create a new comprehensive policy for admin and financeiro to manage managers
CREATE POLICY "Admins and financeiro can manage managers" 
ON public.managers 
FOR ALL 
USING (is_admin_or_financeiro(auth.uid()))
WITH CHECK (is_admin_or_financeiro(auth.uid()));