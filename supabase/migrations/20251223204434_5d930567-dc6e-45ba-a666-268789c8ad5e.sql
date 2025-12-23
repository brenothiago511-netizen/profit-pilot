-- Create exchange_rates table for currency conversion
CREATE TABLE public.exchange_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  base_currency TEXT NOT NULL DEFAULT 'USD',
  target_currency TEXT NOT NULL,
  rate NUMERIC NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(base_currency, target_currency, date)
);

-- Enable RLS on exchange_rates
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

-- RLS policies for exchange_rates
CREATE POLICY "Anyone can view exchange rates"
  ON public.exchange_rates
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage exchange rates"
  ON public.exchange_rates
  FOR ALL
  USING (is_admin(auth.uid()));

-- Add currency fields to revenues
ALTER TABLE public.revenues
ADD COLUMN original_amount NUMERIC,
ADD COLUMN original_currency TEXT DEFAULT 'BRL',
ADD COLUMN converted_amount NUMERIC,
ADD COLUMN exchange_rate_used NUMERIC DEFAULT 1;

-- Add currency fields to expenses
ALTER TABLE public.expenses
ADD COLUMN original_amount NUMERIC,
ADD COLUMN original_currency TEXT DEFAULT 'BRL',
ADD COLUMN converted_amount NUMERIC,
ADD COLUMN exchange_rate_used NUMERIC DEFAULT 1;

-- Add preferred_currency to profiles
ALTER TABLE public.profiles
ADD COLUMN preferred_currency TEXT DEFAULT 'BRL';

-- Create system_settings table for global configurations
CREATE TABLE public.system_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on system_settings
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for system_settings
CREATE POLICY "Anyone can view system settings"
  ON public.system_settings
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage system settings"
  ON public.system_settings
  FOR ALL
  USING (is_admin(auth.uid()));

-- Insert default base currency setting
INSERT INTO public.system_settings (key, value)
VALUES ('base_currency', '"USD"');

-- Update existing revenues to set original values
UPDATE public.revenues
SET original_amount = amount,
    original_currency = (SELECT currency FROM stores WHERE stores.id = revenues.store_id),
    converted_amount = amount,
    exchange_rate_used = 1
WHERE original_amount IS NULL;

-- Update existing expenses to set original values
UPDATE public.expenses
SET original_amount = amount,
    original_currency = (SELECT currency FROM stores WHERE stores.id = expenses.store_id),
    converted_amount = amount,
    exchange_rate_used = 1
WHERE original_amount IS NULL;

-- Add trigger to update system_settings updated_at
CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to get exchange rate for a specific date
CREATE OR REPLACE FUNCTION public.get_exchange_rate(
  p_base_currency TEXT,
  p_target_currency TEXT,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rate NUMERIC;
BEGIN
  -- If same currency, return 1
  IF p_base_currency = p_target_currency THEN
    RETURN 1;
  END IF;

  -- Try to find exact date rate
  SELECT rate INTO v_rate
  FROM exchange_rates
  WHERE base_currency = p_base_currency
    AND target_currency = p_target_currency
    AND date = p_date;

  -- If not found, get the most recent rate
  IF v_rate IS NULL THEN
    SELECT rate INTO v_rate
    FROM exchange_rates
    WHERE base_currency = p_base_currency
      AND target_currency = p_target_currency
      AND date <= p_date
    ORDER BY date DESC
    LIMIT 1;
  END IF;

  -- If still not found, try reverse rate
  IF v_rate IS NULL THEN
    SELECT 1 / rate INTO v_rate
    FROM exchange_rates
    WHERE base_currency = p_target_currency
      AND target_currency = p_base_currency
      AND date <= p_date
    ORDER BY date DESC
    LIMIT 1;
  END IF;

  RETURN COALESCE(v_rate, 1);
END;
$$;