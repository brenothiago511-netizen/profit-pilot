-- Add partner_id column to revenue_goals table
ALTER TABLE public.revenue_goals 
ADD COLUMN partner_id uuid REFERENCES public.partners(id) ON DELETE CASCADE;

-- Make store_id nullable since goals will be per partner now
ALTER TABLE public.revenue_goals 
ALTER COLUMN store_id DROP NOT NULL;

-- Update RLS policy for partners to view their own goals
DROP POLICY IF EXISTS "Partners can view goals of their stores" ON public.revenue_goals;

CREATE POLICY "Partners can view their own goals" 
ON public.revenue_goals 
FOR SELECT 
USING (
  partner_id IN (
    SELECT id FROM partners WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- Allow partners to insert their own goals
CREATE POLICY "Partners can insert their own goals" 
ON public.revenue_goals 
FOR INSERT 
WITH CHECK (
  partner_id IN (
    SELECT id FROM partners WHERE user_id = auth.uid() AND status = 'active'
  ) OR is_admin(auth.uid())
);

-- Allow partners to update their own goals
CREATE POLICY "Partners can update their own goals" 
ON public.revenue_goals 
FOR UPDATE 
USING (
  partner_id IN (
    SELECT id FROM partners WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- Allow partners to delete their own goals
CREATE POLICY "Partners can delete their own goals" 
ON public.revenue_goals 
FOR DELETE 
USING (
  partner_id IN (
    SELECT id FROM partners WHERE user_id = auth.uid() AND status = 'active'
  ) OR is_admin(auth.uid())
);