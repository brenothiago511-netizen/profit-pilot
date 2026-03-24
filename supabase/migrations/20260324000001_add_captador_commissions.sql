CREATE TABLE IF NOT EXISTS public.captador_commissions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  commission_rate numeric(5,4) NOT NULL DEFAULT 0.05,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.captador_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access captador_commissions"
  ON public.captador_commissions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Captador read own"
  ON public.captador_commissions FOR SELECT
  USING (user_id = auth.uid());
