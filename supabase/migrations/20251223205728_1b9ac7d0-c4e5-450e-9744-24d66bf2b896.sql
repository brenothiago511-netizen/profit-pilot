-- Create revenue_goals table for store targets
CREATE TABLE public.revenue_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  goal_amount_original NUMERIC NOT NULL,
  goal_currency TEXT NOT NULL DEFAULT 'BRL',
  goal_amount_converted NUMERIC,
  exchange_rate_used NUMERIC DEFAULT 1,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_store_period UNIQUE (store_id, period_start, period_end)
);

-- Enable RLS
ALTER TABLE public.revenue_goals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage revenue goals"
ON public.revenue_goals
FOR ALL
USING (is_admin(auth.uid()));

CREATE POLICY "Admin and financeiro can view goals"
ON public.revenue_goals
FOR SELECT
USING (is_admin_or_financeiro(auth.uid()));

CREATE POLICY "Partners can view goals of their stores"
ON public.revenue_goals
FOR SELECT
USING (store_id IN (
  SELECT partners.store_id FROM partners
  WHERE partners.user_id = auth.uid() AND partners.status = 'active'
));

-- Trigger for updated_at
CREATE TRIGGER update_revenue_goals_updated_at
BEFORE UPDATE ON public.revenue_goals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for performance
CREATE INDEX idx_revenue_goals_store_period ON public.revenue_goals(store_id, period_start, period_end);