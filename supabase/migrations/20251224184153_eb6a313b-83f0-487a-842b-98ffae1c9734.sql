-- Create profits table for managers to register profits for commission calculation
CREATE TABLE public.profits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  manager_id UUID NOT NULL REFERENCES public.managers(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  profit_amount NUMERIC NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profits ENABLE ROW LEVEL SECURITY;

-- Managers can insert profits for their stores
CREATE POLICY "Managers can insert profits for their stores"
ON public.profits
FOR INSERT
WITH CHECK (
  manager_id IN (
    SELECT id FROM public.managers WHERE user_id = auth.uid() AND status = 'active'
  )
  OR is_admin_or_financeiro(auth.uid())
);

-- Managers can view profits they created
CREATE POLICY "Managers can view their profits"
ON public.profits
FOR SELECT
USING (
  created_by = auth.uid()
  OR manager_id IN (
    SELECT id FROM public.managers WHERE user_id = auth.uid()
  )
  OR is_admin_or_financeiro(auth.uid())
);

-- Admin and financeiro can update profits (approve/reject)
CREATE POLICY "Admin and financeiro can update profits"
ON public.profits
FOR UPDATE
USING (is_admin_or_financeiro(auth.uid()));

-- Admin can delete profits
CREATE POLICY "Admin can delete profits"
ON public.profits
FOR DELETE
USING (is_admin(auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_profits_updated_at
BEFORE UPDATE ON public.profits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add permission for registering profits
INSERT INTO public.permissions (key, description, category)
VALUES ('register_profits', 'Registrar lucros para cálculo de comissões', 'comissoes')
ON CONFLICT (key) DO NOTHING;