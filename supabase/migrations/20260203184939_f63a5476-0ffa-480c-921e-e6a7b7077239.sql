-- Create table for Shopify withdrawals
CREATE TABLE public.shopify_withdrawals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  converted_amount NUMERIC,
  exchange_rate_used NUMERIC DEFAULT 1,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.shopify_withdrawals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage shopify withdrawals" 
ON public.shopify_withdrawals 
FOR ALL 
USING (is_admin(auth.uid()));

CREATE POLICY "Financeiro can view and insert shopify withdrawals" 
ON public.shopify_withdrawals 
FOR SELECT 
USING (is_admin_or_financeiro(auth.uid()));

CREATE POLICY "Financeiro can insert shopify withdrawals" 
ON public.shopify_withdrawals 
FOR INSERT 
WITH CHECK (is_admin_or_financeiro(auth.uid()));

CREATE POLICY "Partners can view shopify withdrawals" 
ON public.shopify_withdrawals 
FOR SELECT 
USING (is_partner(auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_shopify_withdrawals_updated_at
BEFORE UPDATE ON public.shopify_withdrawals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();