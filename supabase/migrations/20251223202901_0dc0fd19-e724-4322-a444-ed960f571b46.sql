-- Create partners table for store partners
CREATE TABLE public.partners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  capital_amount NUMERIC NOT NULL DEFAULT 0,
  capital_percentage NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, store_id)
);

-- Enable RLS on partners table
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

-- RLS policies for partners
CREATE POLICY "Admins can manage partners"
  ON public.partners
  FOR ALL
  USING (is_admin(auth.uid()));

CREATE POLICY "Partners can view their own records"
  ON public.partners
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create partner_transactions table for capital movements
CREATE TABLE public.partner_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('aporte', 'retirada', 'distribuicao')),
  amount NUMERIC NOT NULL,
  description TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS on partner_transactions table
ALTER TABLE public.partner_transactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for partner_transactions
CREATE POLICY "Admins can manage partner transactions"
  ON public.partner_transactions
  FOR ALL
  USING (is_admin(auth.uid()));

CREATE POLICY "Partners can view their own transactions"
  ON public.partner_transactions
  FOR SELECT
  USING (partner_id IN (
    SELECT id FROM public.partners WHERE user_id = auth.uid()
  ));

-- Add trigger to update updated_at on partners
CREATE TRIGGER update_partners_updated_at
  BEFORE UPDATE ON public.partners
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();