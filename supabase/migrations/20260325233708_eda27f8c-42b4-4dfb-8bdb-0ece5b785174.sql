CREATE TABLE public.captador_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  commission_rate numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.captador_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage captador commissions"
  ON public.captador_commissions FOR ALL
  TO public
  USING (is_admin(auth.uid()));

CREATE POLICY "Captadores can view their own commission"
  ON public.captador_commissions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());