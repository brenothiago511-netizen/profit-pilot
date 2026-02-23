
-- Drop the existing permissive partner SELECT policy
DROP POLICY IF EXISTS "Partners can view shopify withdrawals" ON public.shopify_withdrawals;

-- Create a new policy: partners can only see their own withdrawals
CREATE POLICY "Partners can view their own shopify withdrawals"
ON public.shopify_withdrawals
FOR SELECT
TO authenticated
USING (created_by = auth.uid());
