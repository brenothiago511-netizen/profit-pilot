
-- 1. Payroll Payments table (payment history with receipts)
CREATE TABLE public.payroll_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_id uuid NOT NULL REFERENCES public.payroll(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  receipt_url text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payroll_payments ENABLE ROW LEVEL SECURITY;

-- RLS: same pattern as payroll
CREATE POLICY "Admins can manage payroll payments" ON public.payroll_payments FOR ALL USING (is_admin(auth.uid()));

CREATE POLICY "Financeiro can manage payroll payments" ON public.payroll_payments FOR ALL TO authenticated USING (is_admin_or_financeiro(auth.uid()));

CREATE POLICY "Partners can view own payroll payments" ON public.payroll_payments FOR SELECT TO authenticated
USING (payroll_id IN (SELECT id FROM public.payroll WHERE created_by = auth.uid()) AND is_partner(auth.uid()));

CREATE POLICY "Partners can insert own payroll payments" ON public.payroll_payments FOR INSERT TO authenticated
WITH CHECK (payroll_id IN (SELECT id FROM public.payroll WHERE created_by = auth.uid()) AND is_partner(auth.uid()));

CREATE POLICY "Partners can delete own payroll payments" ON public.payroll_payments FOR DELETE TO authenticated
USING (payroll_id IN (SELECT id FROM public.payroll WHERE created_by = auth.uid()) AND is_partner(auth.uid()));

-- 2. Notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  read boolean NOT NULL DEFAULT false,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "System can insert notifications" ON public.notifications FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Users can delete own notifications" ON public.notifications FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- 3. Alert rules table (configurable thresholds)
CREATE TABLE public.alert_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL, -- 'expense_limit', 'goal_deadline', 'payroll_due'
  threshold numeric,
  store_id uuid REFERENCES public.stores(id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own alert rules" ON public.alert_rules FOR ALL TO authenticated
USING (user_id = auth.uid());

-- 4. Storage bucket for payroll receipts
INSERT INTO storage.buckets (id, name, public) VALUES ('payroll-receipts', 'payroll-receipts', true);

-- Storage policies
CREATE POLICY "Authenticated users can upload receipts" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'payroll-receipts');

CREATE POLICY "Anyone can view receipts" ON storage.objects FOR SELECT USING (bucket_id = 'payroll-receipts');

CREATE POLICY "Users can delete own receipts" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'payroll-receipts' AND (auth.uid()::text = (storage.foldername(name))[1]));
