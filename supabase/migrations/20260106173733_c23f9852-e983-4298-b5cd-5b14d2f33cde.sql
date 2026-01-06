
-- 1. Commission Tiers Table (Faixas de Comissão)
CREATE TABLE public.commission_tiers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  min_profit numeric NOT NULL,
  max_profit numeric, -- null means "and above"
  commission_percentage numeric NOT NULL, -- e.g., 0.20 for 20%
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 2. Daily Records Table (Registros Diários)
CREATE TABLE public.daily_records (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  manager_id uuid REFERENCES public.managers(id) NOT NULL,
  store_id uuid REFERENCES public.stores(id) NOT NULL,
  date date NOT NULL,
  daily_profit numeric NOT NULL,
  commission_amount numeric, -- Auto-calculated via trigger
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid')),
  notes text,
  created_by uuid REFERENCES auth.users(id),
  approved_by uuid,
  approved_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 3. FUNCTION: Auto-Calculate Commission
CREATE OR REPLACE FUNCTION calculate_commission()
RETURNS TRIGGER AS $$
DECLARE
  tier_percent DECIMAL;
BEGIN
  -- Find the matching tier based on daily_profit
  SELECT commission_percentage INTO tier_percent
  FROM public.commission_tiers
  WHERE NEW.daily_profit >= min_profit
  AND (max_profit IS NULL OR NEW.daily_profit <= max_profit)
  AND active = true
  ORDER BY min_profit DESC
  LIMIT 1;

  -- Calculate amount if tier found, else 0
  IF tier_percent IS NOT NULL THEN
    NEW.commission_amount := NEW.daily_profit * tier_percent;
  ELSE
    NEW.commission_amount := 0;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. TRIGGER: Connect Function to Table
CREATE TRIGGER trigger_calculate_commission
BEFORE INSERT OR UPDATE ON public.daily_records
FOR EACH ROW
EXECUTE FUNCTION calculate_commission();

-- 5. Trigger for updated_at
CREATE TRIGGER update_commission_tiers_updated_at
BEFORE UPDATE ON public.commission_tiers
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_records_updated_at
BEFORE UPDATE ON public.daily_records
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 6. Enable RLS
ALTER TABLE public.commission_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_records ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for commission_tiers
CREATE POLICY "Anyone can view active commission tiers"
ON public.commission_tiers FOR SELECT
USING (true);

CREATE POLICY "Admins can manage commission tiers"
ON public.commission_tiers FOR ALL
USING (is_admin(auth.uid()));

-- 8. RLS Policies for daily_records
CREATE POLICY "Admins and financeiro can view all daily records"
ON public.daily_records FOR SELECT
USING (is_admin_or_financeiro(auth.uid()));

CREATE POLICY "Managers can view their own daily records"
ON public.daily_records FOR SELECT
USING (manager_id IN (SELECT id FROM public.managers WHERE user_id = auth.uid()));

CREATE POLICY "Admins and financeiro can insert daily records"
ON public.daily_records FOR INSERT
WITH CHECK (is_admin_or_financeiro(auth.uid()) OR manager_id IN (SELECT id FROM public.managers WHERE user_id = auth.uid()));

CREATE POLICY "Admins can update daily records"
ON public.daily_records FOR UPDATE
USING (is_admin_or_financeiro(auth.uid()));

CREATE POLICY "Admins can delete daily records"
ON public.daily_records FOR DELETE
USING (is_admin(auth.uid()));

-- 9. Insert default commission tiers (example)
INSERT INTO public.commission_tiers (min_profit, max_profit, commission_percentage) VALUES
(0, 500, 0.10),        -- 10% for 0-500
(500.01, 1000, 0.15),  -- 15% for 500-1000
(1000.01, 2000, 0.20), -- 20% for 1000-2000
(2000.01, NULL, 0.25); -- 25% for 2000+
