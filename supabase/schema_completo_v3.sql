-- ========================================
-- 20251223144104_225495ac-0496-49ec-b303-632c3301c99f.sql
-- ========================================
-- Create app role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'financeiro', 'gestor');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'financeiro',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table for security definer function
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Create stores table
CREATE TABLE public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'Brasil',
  currency TEXT NOT NULL DEFAULT 'BRL',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_stores junction table
CREATE TABLE public.user_stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, store_id)
);

-- Create expense categories table
CREATE TABLE public.expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default expense categories
INSERT INTO public.expense_categories (name) VALUES
  ('Aluguel'),
  ('Energia'),
  ('Água'),
  ('Internet'),
  ('Telefone'),
  ('Salários'),
  ('Impostos'),
  ('Material de Escritório'),
  ('Marketing'),
  ('Transporte'),
  ('Alimentação'),
  ('Manutenção'),
  ('Outros');

-- Create managers table
CREATE TABLE public.managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  commission_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  commission_type TEXT NOT NULL DEFAULT 'lucro' CHECK (commission_type IN ('lucro', 'faturamento')),
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Create revenues table
CREATE TABLE public.revenues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  manager_id UUID REFERENCES public.managers(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount DECIMAL(15,2) NOT NULL,
  source TEXT,
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create expenses table
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount DECIMAL(15,2) NOT NULL,
  description TEXT NOT NULL,
  category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'variavel' CHECK (type IN ('fixa', 'variavel')),
  payment_method TEXT,
  image_url TEXT,
  ai_extracted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create commissions table
CREATE TABLE public.commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID NOT NULL REFERENCES public.managers(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  base_amount DECIMAL(15,2) NOT NULL,
  percent DECIMAL(5,2) NOT NULL,
  commission_amount DECIMAL(15,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'paga')),
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create audit logs table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Get user role from profiles
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = _user_id
$$;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = _user_id AND role = 'admin'
  )
$$;

-- Function to check if user is admin or financeiro
CREATE OR REPLACE FUNCTION public.is_admin_or_financeiro(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = _user_id AND role IN ('admin', 'financeiro')
  )
$$;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()) OR auth.uid() = id);

CREATE POLICY "Admins can delete profiles"
  ON public.profiles FOR DELETE
  USING (public.is_admin(auth.uid()));

-- User roles policies
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all user roles"
  ON public.user_roles FOR ALL
  USING (public.is_admin(auth.uid()));

-- Stores policies
CREATE POLICY "All authenticated users can view stores"
  ON public.stores FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage stores"
  ON public.stores FOR ALL
  USING (public.is_admin(auth.uid()));

-- User stores policies
CREATE POLICY "Users can view their store assignments"
  ON public.user_stores FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage store assignments"
  ON public.user_stores FOR ALL
  USING (public.is_admin(auth.uid()));

-- Expense categories policies (viewable by all authenticated)
CREATE POLICY "All authenticated users can view categories"
  ON public.expense_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage categories"
  ON public.expense_categories FOR ALL
  USING (public.is_admin(auth.uid()));

-- Managers policies
CREATE POLICY "Gestors can view their own manager record"
  ON public.managers FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage managers"
  ON public.managers FOR ALL
  USING (public.is_admin(auth.uid()));

-- Revenues policies
CREATE POLICY "Admin and financeiro can view all revenues"
  ON public.revenues FOR SELECT
  USING (public.is_admin_or_financeiro(auth.uid()));

CREATE POLICY "Gestors can view revenues where they are manager"
  ON public.revenues FOR SELECT
  USING (
    manager_id IN (SELECT id FROM public.managers WHERE user_id = auth.uid())
  );

CREATE POLICY "Admin and financeiro can insert revenues"
  ON public.revenues FOR INSERT
  WITH CHECK (public.is_admin_or_financeiro(auth.uid()));

CREATE POLICY "Admin and financeiro can update revenues"
  ON public.revenues FOR UPDATE
  USING (public.is_admin_or_financeiro(auth.uid()));

CREATE POLICY "Admin can delete revenues"
  ON public.revenues FOR DELETE
  USING (public.is_admin(auth.uid()));

-- Expenses policies
CREATE POLICY "Admin and financeiro can view all expenses"
  ON public.expenses FOR SELECT
  USING (public.is_admin_or_financeiro(auth.uid()));

CREATE POLICY "Admin and financeiro can insert expenses"
  ON public.expenses FOR INSERT
  WITH CHECK (public.is_admin_or_financeiro(auth.uid()));

CREATE POLICY "Admin and financeiro can update expenses"
  ON public.expenses FOR UPDATE
  USING (public.is_admin_or_financeiro(auth.uid()));

CREATE POLICY "Admin can delete expenses"
  ON public.expenses FOR DELETE
  USING (public.is_admin(auth.uid()));

-- Commissions policies
CREATE POLICY "Admin can view all commissions"
  ON public.commissions FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Gestors can view their own commissions"
  ON public.commissions FOR SELECT
  USING (
    manager_id IN (SELECT id FROM public.managers WHERE user_id = auth.uid())
  );

CREATE POLICY "Admin can manage commissions"
  ON public.commissions FOR ALL
  USING (public.is_admin(auth.uid()));

-- Audit logs policies
CREATE POLICY "Admin can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "System can insert audit logs"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data ->> 'role')::app_role, 'financeiro')
  );
  
  -- Also add to user_roles table
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data ->> 'role')::app_role, 'financeiro')
  );
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stores_updated_at
  BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_managers_updated_at
  BEFORE UPDATE ON public.managers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_revenues_updated_at
  BEFORE UPDATE ON public.revenues
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_commissions_updated_at
  BEFORE UPDATE ON public.commissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
-- ========================================
-- 20251223144119_e2fa7f61-4fbe-4769-b489-9702139c6d0f.sql
-- ========================================
-- Fix search_path for update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
-- ========================================
-- 20251223202901_0dc0fd19-e724-4322-a444-ed960f571b46.sql
-- ========================================
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
-- ========================================
-- 20251223203503_5448e6c6-14df-42f1-9e81-31397cfed290.sql
-- ========================================
-- Add RLS policy for partners to view revenues of their stores
CREATE POLICY "Partners can view revenues of their stores"
  ON public.revenues
  FOR SELECT
  USING (
    store_id IN (
      SELECT store_id FROM public.partners 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Add RLS policy for partners to view expenses of their stores
CREATE POLICY "Partners can view expenses of their stores"
  ON public.expenses
  FOR SELECT
  USING (
    store_id IN (
      SELECT store_id FROM public.partners 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );
-- ========================================
-- 20251223204434_5d930567-dc6e-45ba-a666-268789c8ad5e.sql
-- ========================================
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
-- ========================================
-- 20251223205728_1b9ac7d0-c4e5-450e-9744-24d66bf2b896.sql
-- ========================================
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
-- ========================================
-- 20251223210129_b125b77d-2d46-4f80-b93b-050f479d17bf.sql
-- ========================================
-- Create bank_accounts table with international banking standards
CREATE TABLE public.bank_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  account_holder TEXT NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'checking',
  routing_number TEXT,
  account_number TEXT NOT NULL,
  swift_code TEXT,
  iban TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  country TEXT NOT NULL DEFAULT 'US',
  notes TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

-- Only admins can manage bank accounts
CREATE POLICY "Admins can manage bank accounts"
ON public.bank_accounts
FOR ALL
USING (is_admin(auth.uid()));

-- Financeiro can view bank accounts
CREATE POLICY "Financeiro can view bank accounts"
ON public.bank_accounts
FOR SELECT
USING (is_admin_or_financeiro(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_bank_accounts_updated_at
BEFORE UPDATE ON public.bank_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for store lookup
CREATE INDEX idx_bank_accounts_store_id ON public.bank_accounts(store_id);
-- ========================================
-- 20251223210724_5dc1941d-ca4f-4b07-af01-8c402b0639c7.sql
-- ========================================
-- Create permissions table with all available permissions
CREATE TABLE public.permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'geral',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_permissions table for custom permissions per user
CREATE TABLE public.user_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
  allowed BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, permission_key)
);

-- Add is_custom_permissions to profiles
ALTER TABLE public.profiles ADD COLUMN is_custom_permissions BOOLEAN NOT NULL DEFAULT false;

-- Enable RLS
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for permissions (everyone can view)
CREATE POLICY "Anyone can view permissions"
ON public.permissions FOR SELECT
USING (true);

CREATE POLICY "Admins can manage permissions"
ON public.permissions FOR ALL
USING (is_admin(auth.uid()));

-- RLS Policies for user_permissions
CREATE POLICY "Admins can manage user permissions"
ON public.user_permissions FOR ALL
USING (is_admin(auth.uid()));

CREATE POLICY "Users can view their own permissions"
ON public.user_permissions FOR SELECT
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_permissions_updated_at
BEFORE UPDATE ON public.user_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default permissions
INSERT INTO public.permissions (key, description, category) VALUES
  ('view_dashboard', 'Visualizar dashboard principal', 'dashboard'),
  ('view_dashboard_socios', 'Visualizar dashboard de sócios', 'dashboard'),
  ('create_revenue', 'Criar entradas de receita', 'receitas'),
  ('edit_revenue', 'Editar entradas de receita', 'receitas'),
  ('delete_revenue', 'Excluir entradas de receita', 'receitas'),
  ('create_expense', 'Criar despesas', 'despesas'),
  ('edit_expense', 'Editar despesas', 'despesas'),
  ('delete_expense', 'Excluir despesas', 'despesas'),
  ('view_reports', 'Visualizar relatórios', 'relatorios'),
  ('export_reports', 'Exportar relatórios', 'relatorios'),
  ('manage_users', 'Gerenciar usuários', 'administracao'),
  ('manage_permissions', 'Gerenciar permissões', 'administracao'),
  ('manage_stores', 'Gerenciar lojas', 'administracao'),
  ('manage_goals', 'Gerenciar metas', 'metas'),
  ('manage_bank_accounts', 'Gerenciar contas bancárias', 'financeiro'),
  ('manage_commissions', 'Gerenciar comissões', 'comissoes'),
  ('view_commissions', 'Visualizar comissões', 'comissoes'),
  ('view_partner_results', 'Visualizar resultados de sócios', 'socios'),
  ('manage_currency_rates', 'Gerenciar taxas de câmbio', 'financeiro');

-- Create function to check user permission
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission_key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role app_role;
  _is_custom boolean;
  _custom_allowed boolean;
BEGIN
  -- Get user role and custom permissions flag
  SELECT role, is_custom_permissions INTO _role, _is_custom
  FROM public.profiles WHERE id = _user_id;

  -- If using custom permissions, check user_permissions table
  IF _is_custom THEN
    SELECT allowed INTO _custom_allowed
    FROM public.user_permissions
    WHERE user_id = _user_id AND permission_key = _permission_key;
    
    -- If permission is explicitly set, return it
    IF _custom_allowed IS NOT NULL THEN
      RETURN _custom_allowed;
    END IF;
  END IF;

  -- Default permissions by role
  IF _role = 'admin' THEN
    RETURN true; -- Admin has all permissions
  ELSIF _role = 'financeiro' THEN
    RETURN _permission_key IN (
      'view_dashboard', 'create_revenue', 'edit_revenue', 'create_expense', 
      'edit_expense', 'view_reports', 'export_reports', 'view_commissions',
      'manage_goals', 'manage_bank_accounts'
    );
  ELSIF _role = 'gestor' THEN
    RETURN _permission_key IN (
      'view_dashboard', 'view_commissions'
    );
  END IF;

  RETURN false;
END;
$$;
-- ========================================
-- 20251224180439_b6ef375c-c80f-4787-bdf9-c664e6ab54e1.sql
-- ========================================
-- Create table for store ROI alert thresholds
CREATE TABLE public.store_roi_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  roi_threshold NUMERIC NOT NULL DEFAULT 5,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(store_id)
);

-- Enable RLS
ALTER TABLE public.store_roi_alerts ENABLE ROW LEVEL SECURITY;

-- Admins can manage all alerts
CREATE POLICY "Admins can manage store ROI alerts"
ON public.store_roi_alerts
FOR ALL
USING (is_admin(auth.uid()));

-- Partners can view alerts for their stores
CREATE POLICY "Partners can view alerts for their stores"
ON public.store_roi_alerts
FOR SELECT
USING (store_id IN (
  SELECT store_id FROM partners WHERE user_id = auth.uid() AND status = 'active'
));

-- Create trigger for updated_at
CREATE TRIGGER update_store_roi_alerts_updated_at
BEFORE UPDATE ON public.store_roi_alerts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
-- ========================================
-- 20251224181948_1c39ac67-d386-4ceb-911c-4aa4a193c6a3.sql
-- ========================================
-- Drop existing insert policy for managers if exists
DROP POLICY IF EXISTS "Admins can manage managers" ON public.managers;

-- Create a new comprehensive policy for admin and financeiro to manage managers
CREATE POLICY "Admins and financeiro can manage managers" 
ON public.managers 
FOR ALL 
USING (is_admin_or_financeiro(auth.uid()))
WITH CHECK (is_admin_or_financeiro(auth.uid()));
-- ========================================
-- 20251224182723_351890df-0b69-4500-a1aa-8e99a44ebf51.sql
-- ========================================
-- Add store_id column to managers table to link managers to specific stores
ALTER TABLE public.managers 
ADD COLUMN store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_managers_store_id ON public.managers(store_id);
-- ========================================
-- 20251224184153_eb6a313b-83f0-487a-842b-98ffae1c9734.sql
-- ========================================
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
-- ========================================
-- 20251224190304_beb3ff43-e032-4630-ada5-84969db760e1.sql
-- ========================================
-- Update has_permission function to include register_profits for gestores
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission_key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role app_role;
  _is_custom boolean;
  _custom_allowed boolean;
BEGIN
  -- Get user role and custom permissions flag
  SELECT role, is_custom_permissions INTO _role, _is_custom
  FROM public.profiles WHERE id = _user_id;

  -- If using custom permissions, check user_permissions table
  IF _is_custom THEN
    SELECT allowed INTO _custom_allowed
    FROM public.user_permissions
    WHERE user_id = _user_id AND permission_key = _permission_key;
    
    -- If permission is explicitly set, return it
    IF _custom_allowed IS NOT NULL THEN
      RETURN _custom_allowed;
    END IF;
  END IF;

  -- Default permissions by role
  IF _role = 'admin' THEN
    RETURN true; -- Admin has all permissions
  ELSIF _role = 'financeiro' THEN
    RETURN _permission_key IN (
      'view_dashboard', 'create_revenue', 'edit_revenue', 'create_expense', 
      'edit_expense', 'view_reports', 'export_reports', 'view_commissions',
      'manage_goals', 'manage_bank_accounts', 'manage_commissions', 'register_profits'
    );
  ELSIF _role = 'gestor' THEN
    RETURN _permission_key IN (
      'view_dashboard', 'view_commissions', 'register_profits'
    );
  END IF;

  RETURN false;
END;
$$;
-- ========================================
-- 20260102210110_ef9be577-70e6-4960-b099-d0f8d98a5b98.sql
-- ========================================
-- Add 'socio' to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'socio';

-- Update the has_permission function to include socio role
CREATE OR REPLACE FUNCTION public.has_permission(_permission_key text, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role public.app_role;
  has_custom boolean;
  permission_allowed boolean;
BEGIN
  -- Get user role and custom permission status
  SELECT role, is_custom_permissions INTO user_role, has_custom
  FROM public.profiles
  WHERE id = _user_id;

  -- If user has custom permissions, check user_permissions table
  IF has_custom THEN
    SELECT allowed INTO permission_allowed
    FROM public.user_permissions
    WHERE user_id = _user_id AND permission_key = _permission_key;
    
    IF permission_allowed IS NOT NULL THEN
      RETURN permission_allowed;
    END IF;
  END IF;

  -- Default role-based permissions
  CASE user_role
    WHEN 'admin' THEN
      RETURN true; -- Admin has all permissions
    WHEN 'financeiro' THEN
      RETURN _permission_key IN (
        'view_dashboard',
        'view_revenues',
        'view_expenses',
        'manage_revenues',
        'manage_expenses',
        'view_profits',
        'view_reports',
        'view_commissions',
        'view_goals',
        'manage_goals',
        'view_managers',
        'manage_managers',
        'view_partners',
        'manage_partners',
        'register_profits'
      );
    WHEN 'gestor' THEN
      RETURN _permission_key IN (
        'view_dashboard',
        'view_commissions',
        'register_profits',
        'view_profits'
      );
    WHEN 'socio' THEN
      RETURN _permission_key IN (
        'view_dashboard_socios',
        'view_partner_results',
        'view_reports',
        'view_revenues',
        'view_expenses',
        'view_goals'
      );
    ELSE
      RETURN false;
  END CASE;
END;
$$;
-- ========================================
-- 20260106173733_c23f9852-e983-4298-b5cd-5b14d2f33cde.sql
-- ========================================

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

-- ========================================
-- 20260106232214_48187cc7-cc35-4336-afef-fcd7489882e4.sql
-- ========================================
-- Add shopify_status column to daily_records for tracking Shopify payment
ALTER TABLE public.daily_records 
ADD COLUMN IF NOT EXISTS shopify_status text DEFAULT 'pending';

-- Add comment for clarity
COMMENT ON COLUMN public.daily_records.shopify_status IS 'Status do pagamento da Shopify: pending, paid';
-- ========================================
-- 20260107163638_de30b8a4-dab2-494a-b51c-2d7ed6fa10ae.sql
-- ========================================
-- Create helper function to check if user is a partner (socio)
CREATE OR REPLACE FUNCTION public.is_partner(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.partners
    WHERE user_id = _user_id
      AND status = 'active'
  )
$$;

-- Create helper function to get partner store ids
CREATE OR REPLACE FUNCTION public.get_partner_store_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT store_id
  FROM public.partners
  WHERE user_id = _user_id
    AND status = 'active'
$$;

-- Allow partners to insert revenues for their stores
CREATE POLICY "Partners can insert revenues for their stores"
ON public.revenues
FOR INSERT
WITH CHECK (
  store_id IN (SELECT get_partner_store_ids(auth.uid()))
);

-- Allow partners to update revenues for their stores
CREATE POLICY "Partners can update revenues for their stores"
ON public.revenues
FOR UPDATE
USING (
  store_id IN (SELECT get_partner_store_ids(auth.uid()))
);

-- Allow partners to insert expenses for their stores
CREATE POLICY "Partners can insert expenses for their stores"
ON public.expenses
FOR INSERT
WITH CHECK (
  store_id IN (SELECT get_partner_store_ids(auth.uid()))
);

-- Allow partners to update expenses for their stores
CREATE POLICY "Partners can update expenses for their stores"
ON public.expenses
FOR UPDATE
USING (
  store_id IN (SELECT get_partner_store_ids(auth.uid()))
);

-- Allow partners to view profits of their stores
CREATE POLICY "Partners can view profits of their stores"
ON public.profits
FOR SELECT
USING (
  store_id IN (SELECT get_partner_store_ids(auth.uid()))
);

-- Allow partners to insert profits for their stores
CREATE POLICY "Partners can insert profits for their stores"
ON public.profits
FOR INSERT
WITH CHECK (
  store_id IN (SELECT get_partner_store_ids(auth.uid()))
);

-- Allow partners to update profits for their stores
CREATE POLICY "Partners can update profits for their stores"
ON public.profits
FOR UPDATE
USING (
  store_id IN (SELECT get_partner_store_ids(auth.uid()))
);
-- ========================================
-- 20260107163936_c825c25b-ba3b-47a9-a398-87d9dce47a78.sql
-- ========================================
-- Allow partners to view commissions of their stores
CREATE POLICY "Partners can view commissions of their stores"
ON public.commissions
FOR SELECT
USING (
  store_id IN (SELECT get_partner_store_ids(auth.uid()))
);
-- ========================================
-- 20260107164351_83183b3e-098d-41a2-acde-9d47445bbe89.sql
-- ========================================
-- Allow partners to insert their own transactions
CREATE POLICY "Partners can insert their own transactions"
ON public.partner_transactions
FOR INSERT
WITH CHECK (
  partner_id IN (
    SELECT id FROM public.partners WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- Allow partners to update their own transactions
CREATE POLICY "Partners can update their own transactions"
ON public.partner_transactions
FOR UPDATE
USING (
  partner_id IN (
    SELECT id FROM public.partners WHERE user_id = auth.uid() AND status = 'active'
  )
);
-- ========================================
-- 20260107164444_1bf6aebb-c08a-4a72-b839-8c422f922918.sql
-- ========================================
-- Update has_permission function to limit financeiro access
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission_key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _role app_role;
  _is_custom boolean;
  _custom_allowed boolean;
BEGIN
  -- Get user role and custom permissions flag
  SELECT role, is_custom_permissions INTO _role, _is_custom
  FROM public.profiles WHERE id = _user_id;

  -- If using custom permissions, check user_permissions table
  IF _is_custom THEN
    SELECT allowed INTO _custom_allowed
    FROM public.user_permissions
    WHERE user_id = _user_id AND permission_key = _permission_key;
    
    -- If permission is explicitly set, return it
    IF _custom_allowed IS NOT NULL THEN
      RETURN _custom_allowed;
    END IF;
  END IF;

  -- Default permissions by role
  IF _role = 'admin' THEN
    RETURN true; -- Admin has all permissions
  ELSIF _role = 'financeiro' THEN
    -- Financeiro only has access to revenues and expenses
    RETURN _permission_key IN (
      'view_dashboard',
      'create_revenue',
      'edit_revenue',
      'view_revenues',
      'create_expense',
      'edit_expense',
      'view_expenses'
    );
  ELSIF _role = 'gestor' THEN
    RETURN _permission_key IN (
      'view_dashboard',
      'view_commissions',
      'register_profits'
    );
  ELSIF _role = 'socio' THEN
    RETURN _permission_key IN (
      'view_dashboard',
      'view_dashboard_socios',
      'view_partner_results',
      'view_reports',
      'view_revenues',
      'view_expenses',
      'view_goals',
      'view_commissions',
      'view_profits',
      'create_revenue',
      'edit_revenue',
      'create_expense',
      'edit_expense',
      'register_profits',
      'manage_partners'
    );
  END IF;

  RETURN false;
END;
$function$;

-- Also update the other has_permission function signature
CREATE OR REPLACE FUNCTION public.has_permission(_permission_key text, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_role public.app_role;
  has_custom boolean;
  permission_allowed boolean;
BEGIN
  -- Get user role and custom permission status
  SELECT role, is_custom_permissions INTO user_role, has_custom
  FROM public.profiles
  WHERE id = _user_id;

  -- If user has custom permissions, check user_permissions table
  IF has_custom THEN
    SELECT allowed INTO permission_allowed
    FROM public.user_permissions
    WHERE user_id = _user_id AND permission_key = _permission_key;
    
    IF permission_allowed IS NOT NULL THEN
      RETURN permission_allowed;
    END IF;
  END IF;

  -- Default role-based permissions
  CASE user_role
    WHEN 'admin' THEN
      RETURN true; -- Admin has all permissions
    WHEN 'financeiro' THEN
      -- Financeiro only has access to revenues and expenses
      RETURN _permission_key IN (
        'view_dashboard',
        'create_revenue',
        'edit_revenue',
        'view_revenues',
        'create_expense',
        'edit_expense',
        'view_expenses'
      );
    WHEN 'gestor' THEN
      RETURN _permission_key IN (
        'view_dashboard',
        'view_commissions',
        'register_profits',
        'view_profits'
      );
    WHEN 'socio' THEN
      RETURN _permission_key IN (
        'view_dashboard',
        'view_dashboard_socios',
        'view_partner_results',
        'view_reports',
        'view_revenues',
        'view_expenses',
        'view_goals',
        'view_commissions',
        'view_profits',
        'create_revenue',
        'edit_revenue',
        'create_expense',
        'edit_expense',
        'register_profits',
        'manage_partners'
      );
    ELSE
      RETURN false;
  END CASE;
END;
$function$;
-- ========================================
-- 20260107200623_1d939816-c03d-4ee7-8751-cbc1d2d46c57.sql
-- ========================================
-- Make store_id nullable in partners table
ALTER TABLE public.partners ALTER COLUMN store_id DROP NOT NULL;

-- Update partner_transactions to also allow null store_id
ALTER TABLE public.partner_transactions ALTER COLUMN store_id DROP NOT NULL;

-- Update RLS policies for partners to not require store_id
DROP POLICY IF EXISTS "Partners can view their own records" ON public.partners;
CREATE POLICY "Partners can view their own records" 
ON public.partners 
FOR SELECT 
USING (auth.uid() = user_id);

-- Update RLS for partner_transactions
DROP POLICY IF EXISTS "Partners can view their own transactions" ON public.partner_transactions;
CREATE POLICY "Partners can view their own transactions" 
ON public.partner_transactions 
FOR SELECT 
USING (partner_id IN (
  SELECT id FROM partners WHERE user_id = auth.uid()
));

DROP POLICY IF EXISTS "Partners can insert their own transactions" ON public.partner_transactions;
CREATE POLICY "Partners can insert their own transactions" 
ON public.partner_transactions 
FOR INSERT 
WITH CHECK (partner_id IN (
  SELECT id FROM partners WHERE user_id = auth.uid() AND status = 'active'
));

DROP POLICY IF EXISTS "Partners can update their own transactions" ON public.partner_transactions;
CREATE POLICY "Partners can update their own transactions" 
ON public.partner_transactions 
FOR UPDATE 
USING (partner_id IN (
  SELECT id FROM partners WHERE user_id = auth.uid() AND status = 'active'
));
-- ========================================
-- 20260107211044_8af76b27-0b8b-4fa8-a200-43dbac47ffd0.sql
-- ========================================
-- Allow partners to insert stores
CREATE POLICY "Partners can insert stores" 
ON public.stores 
FOR INSERT 
WITH CHECK (is_partner(auth.uid()));

-- Allow partners to update stores they are associated with
CREATE POLICY "Partners can update their stores" 
ON public.stores 
FOR UPDATE 
USING (id IN (
  SELECT store_id FROM partners 
  WHERE user_id = auth.uid() AND status = 'active' AND store_id IS NOT NULL
));
-- ========================================
-- 20260107220844_3ba43867-98c9-4cfa-80d9-efbbdfc07fe7.sql
-- ========================================
-- Allow partners to insert daily records for their stores
CREATE POLICY "Partners can insert daily records for their stores"
ON public.daily_records
FOR INSERT
WITH CHECK (
  store_id IN (SELECT get_partner_store_ids(auth.uid()))
);

-- Allow partners to view daily records for their stores
CREATE POLICY "Partners can view daily records of their stores"
ON public.daily_records
FOR SELECT
USING (
  store_id IN (SELECT get_partner_store_ids(auth.uid()))
);

-- Allow partners to insert managers (for themselves)
CREATE POLICY "Partners can insert their own manager record"
ON public.managers
FOR INSERT
WITH CHECK (
  user_id = auth.uid() AND is_partner(auth.uid())
);

-- Allow partners to view managers of their stores
CREATE POLICY "Partners can view managers"
ON public.managers
FOR SELECT
USING (
  user_id = auth.uid() OR is_admin(auth.uid()) OR is_partner(auth.uid())
);
-- ========================================
-- 20260107235010_bac8fa5b-ae59-4cea-8f17-efb57683bbfc.sql
-- ========================================
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
-- ========================================
-- 20260108135529_4aecb583-762f-4287-93c3-08800755cfd4.sql
-- ========================================
-- Make store_id optional in expenses table
ALTER TABLE public.expenses ALTER COLUMN store_id DROP NOT NULL;
-- ========================================
-- 20260108202448_de0616c5-a7d5-44ed-87ea-b7911dafb16b.sql
-- ========================================
-- Remover função calculate_commission com CASCADE para eliminar triggers dependentes
DROP FUNCTION IF EXISTS public.calculate_commission() CASCADE;

-- Remover coluna commission_amount de daily_records
ALTER TABLE public.daily_records DROP COLUMN IF EXISTS commission_amount CASCADE;
-- ========================================
-- 20260108204930_6c80d3b7-6d92-4c2f-a035-4f833e65c3ad.sql
-- ========================================
-- Add UPDATE policy for partners (socios) to update daily records of their stores
CREATE POLICY "Partners can update daily records of their stores" 
ON public.daily_records 
FOR UPDATE 
USING (store_id IN (SELECT get_partner_store_ids(auth.uid())));

-- Add DELETE policy for partners to delete their own records
CREATE POLICY "Partners can delete daily records of their stores" 
ON public.daily_records 
FOR DELETE 
USING (store_id IN (SELECT get_partner_store_ids(auth.uid())));
-- ========================================
-- 20260123144123_8d7e33d3-1754-4cc2-b943-dad16173d060.sql
-- ========================================
-- Create payroll table for managing employee payments
CREATE TABLE public.payroll (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_name TEXT NOT NULL,
  payment_day INTEGER NOT NULL CHECK (payment_day >= 1 AND payment_day <= 31),
  amount NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payroll ENABLE ROW LEVEL SECURITY;

-- Only admins can manage payroll
CREATE POLICY "Admins can manage payroll"
ON public.payroll
FOR ALL
USING (is_admin(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_payroll_updated_at
BEFORE UPDATE ON public.payroll
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
-- ========================================
-- 20260127170711_ef4db90c-a25b-47ef-bb23-5f167bd0b81d.sql
-- ========================================
-- Make store_id nullable in revenues table
ALTER TABLE public.revenues ALTER COLUMN store_id DROP NOT NULL;
-- ========================================
-- 20260127171625_ed5d324d-7057-4e4b-8d8e-5f4aeff55bf4.sql
-- ========================================
-- Add image_url column to revenues table
ALTER TABLE public.revenues ADD COLUMN IF NOT EXISTS image_url text;

-- Create storage bucket for revenue images
INSERT INTO storage.buckets (id, name, public)
VALUES ('revenue-images', 'revenue-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to revenue-images bucket
CREATE POLICY "Authenticated users can upload revenue images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'revenue-images');

-- Allow anyone to view revenue images (public bucket)
CREATE POLICY "Anyone can view revenue images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'revenue-images');

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete their own revenue images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'revenue-images' AND auth.uid()::text = (storage.foldername(name))[1]);
-- ========================================
-- 20260129222507_a35fafaf-f444-4677-924b-c0a111a073bd.sql
-- ========================================
-- Adicionar colunas para registrar valores de depósito Shopify
ALTER TABLE public.daily_records
ADD COLUMN shopify_deposit_1 numeric DEFAULT NULL,
ADD COLUMN shopify_deposit_2 numeric DEFAULT NULL;
-- ========================================
-- 20260129222624_5f21d6c5-89bc-4dbb-b003-aa76ee794e79.sql
-- ========================================
-- Adicionar colunas de moeda e conversão para os depósitos Shopify
ALTER TABLE public.daily_records
ADD COLUMN shopify_deposit_1_currency text DEFAULT 'BRL',
ADD COLUMN shopify_deposit_1_converted numeric DEFAULT NULL,
ADD COLUMN shopify_deposit_1_rate numeric DEFAULT 1,
ADD COLUMN shopify_deposit_2_currency text DEFAULT 'BRL',
ADD COLUMN shopify_deposit_2_converted numeric DEFAULT NULL,
ADD COLUMN shopify_deposit_2_rate numeric DEFAULT 1;
-- ========================================
-- 20260129223752_389abe43-5f64-4bc1-b61e-4c05bae183d5.sql
-- ========================================
-- Add columns to store Shopify numbers/IDs
ALTER TABLE public.daily_records
ADD COLUMN IF NOT EXISTS shopify_deposit_1_number text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS shopify_deposit_2_number text DEFAULT NULL;
-- ========================================
-- 20260203184939_f63a5476-0ffa-480c-921e-e6a7b7077239.sql
-- ========================================
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
-- ========================================
-- 20260203185447_9b93ec07-6dd6-4d84-b3b2-358cf35c2780.sql
-- ========================================
-- Add status column to track if withdrawal has been received
ALTER TABLE public.shopify_withdrawals
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';

-- Add received_at timestamp for when the withdrawal was marked as received
ALTER TABLE public.shopify_withdrawals
ADD COLUMN IF NOT EXISTS received_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
-- ========================================
-- 20260203220328_4d59cabd-0c7a-4c48-b7e0-2e78233e61a2.sql
-- ========================================
-- Add sale_date column to track when the sale happened (separate from payout date)
ALTER TABLE public.shopify_withdrawals 
ADD COLUMN sale_date date;

-- Add comment for clarity
COMMENT ON COLUMN public.shopify_withdrawals.sale_date IS 'Date when the sale occurred on Shopify';
COMMENT ON COLUMN public.shopify_withdrawals.date IS 'Date when the payout was received';
-- ========================================
-- 20260203220654_36178cbe-ced8-4311-8396-4c29c4d2d5c6.sql
-- ========================================
-- Change sale_date from date to text to store multiple dates as comma-separated values
ALTER TABLE public.shopify_withdrawals 
ALTER COLUMN sale_date TYPE text USING sale_date::text;

-- Update comment
COMMENT ON COLUMN public.shopify_withdrawals.sale_date IS 'Sale dates (comma-separated YYYY-MM-DD format, e.g., 2026-01-30,2026-01-31)';
-- ========================================
-- 20260218135509_a83a544d-a120-4b22-9e79-74d98205e43e.sql
-- ========================================

-- Allow partners (socio) to insert shopify withdrawals
CREATE POLICY "Partners can insert shopify withdrawals"
ON public.shopify_withdrawals
FOR INSERT
TO authenticated
WITH CHECK (is_partner(auth.uid()));

-- Allow partners to update shopify withdrawals (e.g., mark as received)
CREATE POLICY "Partners can update shopify withdrawals"
ON public.shopify_withdrawals
FOR UPDATE
TO authenticated
USING (is_partner(auth.uid()));

-- ========================================
-- 20260223231601_66a3c812-65c2-47a3-a88b-09aebd64666f.sql
-- ========================================

-- Drop the existing permissive partner SELECT policy
DROP POLICY IF EXISTS "Partners can view shopify withdrawals" ON public.shopify_withdrawals;

-- Create a new policy: partners can only see their own withdrawals
CREATE POLICY "Partners can view their own shopify withdrawals"
ON public.shopify_withdrawals
FOR SELECT
TO authenticated
USING (created_by = auth.uid());

-- ========================================
-- 20260223232316_7de7471e-b085-452a-b4bb-c23b067bb910.sql
-- ========================================

-- Allow all authenticated users to insert stores
CREATE POLICY "Authenticated users can insert stores"
ON public.stores
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow all authenticated users to update stores
CREATE POLICY "Authenticated users can update stores"
ON public.stores
FOR UPDATE
TO authenticated
USING (true);

-- ========================================
-- 20260227223612_7417b945-1da7-4d3b-a736-0a5c2d95abc2.sql
-- ========================================

-- First check if any expenses reference these categories before deleting
-- We'll update the categories to a cleaner, more relevant set

-- Delete categories that are too generic or irrelevant (only if not referenced)
DELETE FROM expense_categories WHERE name IN ('Água', 'Energia', 'Telefone', 'Material de Escritório', 'Transporte', 'Alimentação', 'Manutenção', 'Aluguel', 'Internet')
AND id NOT IN (SELECT DISTINCT category_id FROM expenses WHERE category_id IS NOT NULL);

-- Insert new optimized categories (ignore if already exists)
INSERT INTO expense_categories (name) VALUES
  ('Ads / Tráfego Pago'),
  ('Plataformas e Ferramentas'),
  ('Fornecedores / Produtos'),
  ('Logística / Frete'),
  ('Taxas e Comissões'),
  ('Infraestrutura'),
  ('Serviços Terceirizados'),
  ('Folha de Pagamento')
ON CONFLICT DO NOTHING;

-- ========================================
-- 20260228150847_ec0d8522-5c81-4b86-91cf-1baf30335756.sql
-- ========================================

-- Drop the restrictive INSERT policies on expenses
DROP POLICY IF EXISTS "Admin and financeiro can insert expenses" ON public.expenses;
DROP POLICY IF EXISTS "Partners can insert expenses for their stores" ON public.expenses;

-- Recreate as PERMISSIVE policies (OR logic)
CREATE POLICY "Admin and financeiro can insert expenses"
ON public.expenses
FOR INSERT
TO authenticated
WITH CHECK (is_admin_or_financeiro(auth.uid()));

CREATE POLICY "Partners can insert expenses for their stores"
ON public.expenses
FOR INSERT
TO authenticated
WITH CHECK (store_id IN (SELECT get_partner_store_ids(auth.uid())));

-- ========================================
-- 20260228151701_1f406d11-e66e-4dbe-997e-4cedb9a6e97f.sql
-- ========================================

-- Drop and recreate the partner INSERT policy to also allow null store_id
DROP POLICY IF EXISTS "Partners can insert expenses for their stores" ON public.expenses;

CREATE POLICY "Partners can insert expenses for their stores"
ON public.expenses
FOR INSERT
TO authenticated
WITH CHECK (
  is_partner(auth.uid()) AND (
    store_id IS NULL 
    OR store_id IN (SELECT get_partner_store_ids(auth.uid()))
  )
);

-- ========================================
-- 20260228152035_452e15e3-3ab1-4d91-83b6-dd038ab690a9.sql
-- ========================================

-- Fix partner SELECT policy to also show expenses with null store_id that they created
DROP POLICY IF EXISTS "Partners can view expenses of their stores" ON public.expenses;

CREATE POLICY "Partners can view expenses of their stores"
ON public.expenses
FOR SELECT
TO authenticated
USING (
  store_id IN (
    SELECT store_id FROM partners
    WHERE user_id = auth.uid() AND status = 'active'
  )
  OR (store_id IS NULL AND user_id = auth.uid())
);

-- ========================================
-- 20260228155012_a8fef843-5b51-4e2e-b5b0-4cf1806113f5.sql
-- ========================================

-- Allow financeiro and partners to view payroll
CREATE POLICY "Financeiro can view payroll"
ON public.payroll FOR SELECT TO authenticated
USING (is_admin_or_financeiro(auth.uid()));

CREATE POLICY "Partners can view payroll"
ON public.payroll FOR SELECT TO authenticated
USING (is_partner(auth.uid()));

-- Allow financeiro and partners to insert payroll
CREATE POLICY "Financeiro can insert payroll"
ON public.payroll FOR INSERT TO authenticated
WITH CHECK (is_admin_or_financeiro(auth.uid()));

CREATE POLICY "Partners can insert payroll"
ON public.payroll FOR INSERT TO authenticated
WITH CHECK (is_partner(auth.uid()));

-- Allow financeiro and partners to update payroll
CREATE POLICY "Financeiro can update payroll"
ON public.payroll FOR UPDATE TO authenticated
USING (is_admin_or_financeiro(auth.uid()));

CREATE POLICY "Partners can update payroll"
ON public.payroll FOR UPDATE TO authenticated
USING (is_partner(auth.uid()));

-- Allow financeiro and partners to delete payroll
CREATE POLICY "Financeiro can delete payroll"
ON public.payroll FOR DELETE TO authenticated
USING (is_admin_or_financeiro(auth.uid()));

CREATE POLICY "Partners can delete payroll"
ON public.payroll FOR DELETE TO authenticated
USING (is_partner(auth.uid()));

-- ========================================
-- 20260228161759_dea8b93c-3015-488f-a58d-9281ce8bb9ed.sql
-- ========================================

-- Allow partners to delete expenses they created or from their stores
CREATE POLICY "Partners can delete their own expenses"
ON public.expenses FOR DELETE TO authenticated
USING (
  is_partner(auth.uid()) AND (
    user_id = auth.uid()
    OR store_id IN (SELECT get_partner_store_ids(auth.uid()))
  )
);

-- Allow financeiro to delete expenses
CREATE POLICY "Financeiro can delete expenses"
ON public.expenses FOR DELETE TO authenticated
USING (is_admin_or_financeiro(auth.uid()));

-- ========================================
-- 20260306172921_8bc355a3-8b0c-4924-8782-308ef01fa788.sql
-- ========================================
DROP POLICY "Partners can insert stores" ON public.stores;
-- ========================================
-- 20260306174707_1abaa424-a278-41b1-b92d-39fb66142a4a.sql
-- ========================================

-- REVENUES: financeiro only sees their own records
DROP POLICY IF EXISTS "Admin and financeiro can view all revenues" ON public.revenues;
CREATE POLICY "Admin can view all revenues"
  ON public.revenues FOR SELECT
  USING (is_admin(auth.uid()));
CREATE POLICY "Financeiro can view own revenues"
  ON public.revenues FOR SELECT
  USING ((auth.uid() = user_id) AND is_admin_or_financeiro(auth.uid()));

-- EXPENSES: financeiro only sees their own records
DROP POLICY IF EXISTS "Admin and financeiro can view all expenses" ON public.expenses;
CREATE POLICY "Admin can view all expenses"
  ON public.expenses FOR SELECT
  USING (is_admin(auth.uid()));
CREATE POLICY "Financeiro can view own expenses"
  ON public.expenses FOR SELECT
  USING ((auth.uid() = user_id) AND is_admin_or_financeiro(auth.uid()));

-- SHOPIFY_WITHDRAWALS: financeiro only sees their own records
DROP POLICY IF EXISTS "Financeiro can view and insert shopify withdrawals" ON public.shopify_withdrawals;
CREATE POLICY "Financeiro can view own shopify withdrawals"
  ON public.shopify_withdrawals FOR SELECT
  USING ((auth.uid() = created_by) AND is_admin_or_financeiro(auth.uid()));

-- DAILY_RECORDS: financeiro only sees their own records
DROP POLICY IF EXISTS "Admins and financeiro can view all daily records" ON public.daily_records;
CREATE POLICY "Admin can view all daily records"
  ON public.daily_records FOR SELECT
  USING (is_admin(auth.uid()));
CREATE POLICY "Financeiro can view own daily records"
  ON public.daily_records FOR SELECT
  USING ((auth.uid() = created_by) AND is_admin_or_financeiro(auth.uid()));

-- PAYROLL: financeiro only sees their own records
DROP POLICY IF EXISTS "Financeiro can view payroll" ON public.payroll;
CREATE POLICY "Financeiro can view own payroll"
  ON public.payroll FOR SELECT
  USING ((auth.uid() = created_by) AND is_admin_or_financeiro(auth.uid()));

-- ========================================
-- 20260309132133_52ad8c2c-e7e5-4f12-a32a-fc00fd1a1ec9.sql
-- ========================================

CREATE POLICY "Users can insert their own partner record"
ON public.partners
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- ========================================
-- 20260309134300_6c613b57-26ed-453f-8f32-7cd2a5656742.sql
-- ========================================

CREATE POLICY "Users can update their own partner record"
ON public.partners
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ========================================
-- 20260309134751_7bb3af9b-733a-4fc3-8bff-00a148540328.sql
-- ========================================




-- ========================================
-- 20260310184635_3293a111-60d5-4ed2-876e-678bc5045894.sql
-- ========================================

-- 1. Restrict commission_tiers: remove public SELECT, add admin/financeiro only
DROP POLICY IF EXISTS "Anyone can view active commission tiers" ON public.commission_tiers;
CREATE POLICY "Admin and financeiro can view commission tiers"
ON public.commission_tiers
FOR SELECT
TO authenticated
USING (is_admin_or_financeiro(auth.uid()));

-- 2. Restrict system_settings: remove public SELECT, add admin only
DROP POLICY IF EXISTS "Anyone can view system settings" ON public.system_settings;
CREATE POLICY "Authenticated users can view system settings"
ON public.system_settings
FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

-- 3. Restrict permissions: remove public SELECT, add authenticated only
DROP POLICY IF EXISTS "Anyone can view permissions" ON public.permissions;
CREATE POLICY "Authenticated users can view permissions"
ON public.permissions
FOR SELECT
TO authenticated
USING (true);

-- ========================================
-- 20260310185212_ac2a36e8-5ddb-45d0-8de2-9909c564c190.sql
-- ========================================

-- 1. CRITICAL: Fix privilege escalation - prevent users from changing their own role
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()));

-- 2. Fix stores: replace overly permissive INSERT/UPDATE policies
DROP POLICY IF EXISTS "Authenticated users can insert stores" ON public.stores;
DROP POLICY IF EXISTS "Authenticated users can update stores" ON public.stores;

-- Only admin and partners can insert stores
CREATE POLICY "Admin and partners can insert stores"
ON public.stores
FOR INSERT
TO authenticated
WITH CHECK (is_admin(auth.uid()) OR is_partner(auth.uid()));

-- Only admin can update any store; partners restricted by existing policy
-- (remove the generic one, keep the partner-scoped and admin ALL policies)

-- 3. Fix payroll: restrict partner access to created_by ownership
DROP POLICY IF EXISTS "Partners can view payroll" ON public.payroll;
DROP POLICY IF EXISTS "Partners can insert payroll" ON public.payroll;
DROP POLICY IF EXISTS "Partners can update payroll" ON public.payroll;
DROP POLICY IF EXISTS "Partners can delete payroll" ON public.payroll;

CREATE POLICY "Partners can view own payroll"
ON public.payroll
FOR SELECT
TO authenticated
USING (is_partner(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Partners can insert own payroll"
ON public.payroll
FOR INSERT
TO authenticated
WITH CHECK (is_partner(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Partners can update own payroll"
ON public.payroll
FOR UPDATE
TO authenticated
USING (is_partner(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Partners can delete own payroll"
ON public.payroll
FOR DELETE
TO authenticated
USING (is_partner(auth.uid()) AND created_by = auth.uid());

-- 4. Fix shopify_withdrawals: restrict partner UPDATE to own records
DROP POLICY IF EXISTS "Partners can update shopify withdrawals" ON public.shopify_withdrawals;
CREATE POLICY "Partners can update own shopify withdrawals"
ON public.shopify_withdrawals
FOR UPDATE
TO authenticated
USING (is_partner(auth.uid()) AND created_by = auth.uid());

-- 5. Fix managers: restrict partner view to their store managers only
DROP POLICY IF EXISTS "Partners can view managers" ON public.managers;
CREATE POLICY "Partners can view managers of their stores"
ON public.managers
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR is_admin(auth.uid()) OR store_id IN (SELECT get_partner_store_ids(auth.uid())));

-- ========================================
-- 20260310190021_9990c5fe-57ba-4ada-bde2-96dbf75da297.sql
-- ========================================

-- Allow all authenticated users to insert stores (not just admin/partner)
DROP POLICY IF EXISTS "Admin and partners can insert stores" ON public.stores;
CREATE POLICY "Authenticated users can insert stores"
ON public.stores
FOR INSERT
TO authenticated
WITH CHECK (true);

-- ========================================
-- 20260311150914_50c893b6-5214-4704-9934-91e08bc330a6.sql
-- ========================================

-- Create bank_transactions table for tracking all bank account movements
CREATE TABLE public.bank_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'entrada', -- entrada, saida, transferencia_entrada, transferencia_saida
  amount NUMERIC NOT NULL,
  balance_after NUMERIC, -- snapshot of balance after this transaction
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  reference_type TEXT, -- revenue, expense, manual, transfer, shopify_withdrawal
  reference_id UUID, -- ID from revenues/expenses/etc table
  category TEXT, -- optional categorization
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add balance column to bank_accounts for quick access
ALTER TABLE public.bank_accounts ADD COLUMN IF NOT EXISTS balance NUMERIC NOT NULL DEFAULT 0;

-- Enable RLS
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bank_transactions
-- Admins can do everything
CREATE POLICY "Admins can manage bank transactions"
ON public.bank_transactions
FOR ALL
TO public
USING (is_admin(auth.uid()));

-- Financeiro can view and insert
CREATE POLICY "Financeiro can view bank transactions"
ON public.bank_transactions
FOR SELECT
TO authenticated
USING (is_admin_or_financeiro(auth.uid()));

CREATE POLICY "Financeiro can insert bank transactions"
ON public.bank_transactions
FOR INSERT
TO authenticated
WITH CHECK (is_admin_or_financeiro(auth.uid()));

-- Partners can view/insert transactions for their store accounts
CREATE POLICY "Partners can view their store transactions"
ON public.bank_transactions
FOR SELECT
TO authenticated
USING (
  bank_account_id IN (
    SELECT ba.id FROM public.bank_accounts ba
    WHERE ba.store_id IN (SELECT get_partner_store_ids(auth.uid()))
  )
);

CREATE POLICY "Partners can insert their store transactions"
ON public.bank_transactions
FOR INSERT
TO authenticated
WITH CHECK (
  bank_account_id IN (
    SELECT ba.id FROM public.bank_accounts ba
    WHERE ba.store_id IN (SELECT get_partner_store_ids(auth.uid()))
  )
);

-- Partners can also manage bank_accounts for their stores
CREATE POLICY "Partners can view their store bank accounts"
ON public.bank_accounts
FOR SELECT
TO authenticated
USING (
  store_id IN (SELECT get_partner_store_ids(auth.uid()))
);

CREATE POLICY "Partners can insert bank accounts for their stores"
ON public.bank_accounts
FOR INSERT
TO authenticated
WITH CHECK (
  store_id IN (SELECT get_partner_store_ids(auth.uid()))
);

CREATE POLICY "Partners can update their store bank accounts"
ON public.bank_accounts
FOR UPDATE
TO authenticated
USING (
  store_id IN (SELECT get_partner_store_ids(auth.uid()))
);

-- Financeiro can also manage bank accounts
CREATE POLICY "Financeiro can manage bank accounts"
ON public.bank_accounts
FOR ALL
TO authenticated
USING (is_admin_or_financeiro(auth.uid()));

-- Updated_at trigger
CREATE TRIGGER update_bank_transactions_updated_at
  BEFORE UPDATE ON public.bank_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable realtime for bank_transactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.bank_transactions;

-- ========================================
-- 20260311191946_6359005b-a205-412e-80dd-c1794f9dbfe9.sql
-- ========================================

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

-- ========================================
-- 20260312130122_8a093d3a-6296-4eed-867b-a78ca8fb6ef7.sql
-- ========================================
-- Allow partners to delete their own shopify withdrawals
CREATE POLICY "Partners can delete own shopify withdrawals"
ON public.shopify_withdrawals
FOR DELETE
TO authenticated
USING (is_partner(auth.uid()) AND created_by = auth.uid());

-- Allow financeiro to delete shopify withdrawals
CREATE POLICY "Financeiro can delete shopify withdrawals"
ON public.shopify_withdrawals
FOR DELETE
TO authenticated
USING (is_admin_or_financeiro(auth.uid()));

-- Allow financeiro to update shopify withdrawals
CREATE POLICY "Financeiro can update shopify withdrawals"
ON public.shopify_withdrawals
FOR UPDATE
TO authenticated
USING (is_admin_or_financeiro(auth.uid()));
-- ========================================
-- 20260313193012_27323091-4169-4b07-b944-ce85b186c443.sql
-- ========================================

CREATE OR REPLACE FUNCTION public.sum_amounts(
  p_table text,
  p_date_start date,
  p_date_end date,
  p_store_ids uuid[] DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_include_null_store boolean DEFAULT false
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total numeric := 0;
BEGIN
  IF p_table = 'revenues' THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_total
    FROM revenues
    WHERE date >= p_date_start
      AND date <= p_date_end
      AND (p_store_ids IS NULL OR store_id = ANY(p_store_ids) OR (p_include_null_store AND store_id IS NULL AND user_id = p_user_id))
      AND (p_user_id IS NULL OR NOT p_include_null_store OR user_id = p_user_id OR store_id = ANY(COALESCE(p_store_ids, ARRAY[]::uuid[])));
  ELSIF p_table = 'expenses' THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_total
    FROM expenses
    WHERE date >= p_date_start
      AND date <= p_date_end
      AND (p_store_ids IS NULL OR store_id = ANY(p_store_ids) OR (p_include_null_store AND store_id IS NULL AND user_id = p_user_id))
      AND (p_user_id IS NULL OR NOT p_include_null_store OR user_id = p_user_id OR store_id = ANY(COALESCE(p_store_ids, ARRAY[]::uuid[])));
  END IF;

  RETURN v_total;
END;
$$;

-- ========================================
-- 20260316195031_a4284897-ffa4-4373-9077-858b71fa111c.sql
-- ========================================

-- 1. Fix exchange_rates: restrict to authenticated users only
DROP POLICY IF EXISTS "Anyone can view exchange rates" ON public.exchange_rates;
CREATE POLICY "Authenticated users can view exchange rates"
ON public.exchange_rates
FOR SELECT
TO authenticated
USING (true);

-- 2. Fix permissions: restrict to authenticated users (already correct role, but ensure TO clause)
DROP POLICY IF EXISTS "Authenticated users can view permissions" ON public.permissions;
CREATE POLICY "Authenticated users can view permissions"
ON public.permissions
FOR SELECT
TO authenticated
USING (true);

-- 3. Fix stores INSERT: restrict to admin, financeiro, and partners only
DROP POLICY IF EXISTS "Authenticated users can insert stores" ON public.stores;
CREATE POLICY "Admin and financeiro can insert stores"
ON public.stores
FOR INSERT
TO authenticated
WITH CHECK (is_admin_or_financeiro(auth.uid()) OR is_partner(auth.uid()));

-- ========================================
-- 20260316202311_a532a7c1-504e-4eb6-98cd-b9509d98aa6e.sql
-- ========================================

-- 1. FIX CRITICAL: Remove self-insert from profiles (trigger handles this)
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
CREATE POLICY "Only admins can insert profiles"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (is_admin(auth.uid()));

-- 2. FIX CRITICAL: Restrict partner self-insertion to admin only
DROP POLICY IF EXISTS "Users can insert their own partner record" ON public.partners;
CREATE POLICY "Only admins can create partner records"
ON public.partners
FOR INSERT
TO authenticated
WITH CHECK (is_admin(auth.uid()));

-- Also restrict self-update on partners to prevent store_id manipulation
DROP POLICY IF EXISTS "Users can update their own partner record" ON public.partners;
CREATE POLICY "Partners can update own non-critical fields"
ON public.partners
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND store_id = (SELECT p.store_id FROM public.partners p WHERE p.id = partners.id)
);

-- 3. FIX WARNING: Restrict notification inserts to own user_id only
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "Users can insert own notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- 4. FIX WARNING: Restrict audit_logs insert to own user_id
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated users can insert own audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- ========================================
-- 20260317200636_6390792b-a693-413d-aa55-4c13520f54f9.sql
-- ========================================
-- Allow partners (socio) to insert their own partner records when creating stores
CREATE POLICY "Partners can insert own partner records"
ON public.partners
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() AND is_partner(auth.uid())
);
-- ========================================
-- 20260317200759_049ef402-af66-48ca-8d75-cbb4cdb1a795.sql
-- ========================================
-- Drop the policy that requires is_partner (chicken-and-egg problem)
DROP POLICY IF EXISTS "Partners can insert own partner records" ON public.partners;

-- Allow socio users to insert their own partner records (checks role from profiles, not partners table)
CREATE POLICY "Socios can insert own partner records"
ON public.partners
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() 
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'socio'
  )
);
-- ========================================
-- 20260317201507_33d3cb31-bccb-4932-ab59-d57aca6fb0a0.sql
-- ========================================
-- Allow partners to delete their store bank accounts
CREATE POLICY "Partners can delete their store bank accounts"
ON public.bank_accounts
FOR DELETE
TO authenticated
USING (store_id IN (SELECT get_partner_store_ids(auth.uid())));

-- Allow partners to update their store bank transactions
CREATE POLICY "Partners can update their store transactions"
ON public.bank_transactions
FOR UPDATE
TO authenticated
USING (bank_account_id IN (
  SELECT ba.id FROM bank_accounts ba
  WHERE ba.store_id IN (SELECT get_partner_store_ids(auth.uid()))
));

-- Allow partners to delete their store bank transactions
CREATE POLICY "Partners can delete their store transactions"
ON public.bank_transactions
FOR DELETE
TO authenticated
USING (bank_account_id IN (
  SELECT ba.id FROM bank_accounts ba
  WHERE ba.store_id IN (SELECT get_partner_store_ids(auth.uid()))
));
-- ========================================
-- 20260317203811_7f15191a-efe0-4778-93b0-b5481abb563e.sql
-- ========================================

-- Allow bank accounts without a store (general/unlinked accounts)
ALTER TABLE public.bank_accounts ALTER COLUMN store_id DROP NOT NULL;

-- ========================================
-- 20260317205100_fe3234be-3f3a-453d-a954-f74b8bc897d0.sql
-- ========================================

-- Create junction table for store-bank relationships
CREATE TABLE public.store_bank_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  bank_account_id uuid NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(store_id, bank_account_id)
);

-- Enable RLS
ALTER TABLE public.store_bank_accounts ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage store bank links"
ON public.store_bank_accounts FOR ALL
USING (public.is_admin(auth.uid()));

CREATE POLICY "Financeiro can manage store bank links"
ON public.store_bank_accounts FOR ALL TO authenticated
USING (public.is_admin_or_financeiro(auth.uid()));

CREATE POLICY "Partners can view their store bank links"
ON public.store_bank_accounts FOR SELECT TO authenticated
USING (store_id IN (SELECT public.get_partner_store_ids(auth.uid())));

CREATE POLICY "Partners can insert links for their stores"
ON public.store_bank_accounts FOR INSERT TO authenticated
WITH CHECK (store_id IN (SELECT public.get_partner_store_ids(auth.uid())));

CREATE POLICY "Partners can delete links for their stores"
ON public.store_bank_accounts FOR DELETE TO authenticated
USING (store_id IN (SELECT public.get_partner_store_ids(auth.uid())));

-- Migrate existing store_id associations to junction table
INSERT INTO public.store_bank_accounts (store_id, bank_account_id, is_primary)
SELECT store_id, id, is_primary
FROM public.bank_accounts
WHERE store_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ========================================
-- 20260317205230_f3c0ade5-c406-4f5e-a9c7-3bfc10a97b1b.sql
-- ========================================

-- Update partner INSERT policy to allow creating banks without store
DROP POLICY IF EXISTS "Partners can insert bank accounts for their stores" ON public.bank_accounts;
CREATE POLICY "Partners can insert bank accounts"
ON public.bank_accounts FOR INSERT TO authenticated
WITH CHECK (public.is_partner(auth.uid()));

-- Update partner SELECT policy to include unlinked banks and banks linked via junction
DROP POLICY IF EXISTS "Partners can view their store bank accounts" ON public.bank_accounts;
CREATE POLICY "Partners can view accessible bank accounts"
ON public.bank_accounts FOR SELECT TO authenticated
USING (
  store_id IN (SELECT public.get_partner_store_ids(auth.uid()))
  OR id IN (
    SELECT bank_account_id FROM public.store_bank_accounts 
    WHERE store_id IN (SELECT public.get_partner_store_ids(auth.uid()))
  )
  OR store_id IS NULL
);

-- Update partner UPDATE policy
DROP POLICY IF EXISTS "Partners can update their store bank accounts" ON public.bank_accounts;
CREATE POLICY "Partners can update accessible bank accounts"
ON public.bank_accounts FOR UPDATE TO authenticated
USING (
  store_id IN (SELECT public.get_partner_store_ids(auth.uid()))
  OR id IN (
    SELECT bank_account_id FROM public.store_bank_accounts 
    WHERE store_id IN (SELECT public.get_partner_store_ids(auth.uid()))
  )
  OR store_id IS NULL
);

-- Update partner DELETE policy
DROP POLICY IF EXISTS "Partners can delete their store bank accounts" ON public.bank_accounts;
CREATE POLICY "Partners can delete accessible bank accounts"
ON public.bank_accounts FOR DELETE TO authenticated
USING (
  store_id IN (SELECT public.get_partner_store_ids(auth.uid()))
  OR id IN (
    SELECT bank_account_id FROM public.store_bank_accounts 
    WHERE store_id IN (SELECT public.get_partner_store_ids(auth.uid()))
  )
  OR store_id IS NULL
);

-- ========================================
-- 20260317213936_e51b5828-abc0-44b7-a4f3-fff3b16b5a3d.sql
-- ========================================
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission_key text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _role app_role;
  _is_custom boolean;
  _custom_allowed boolean;
BEGIN
  SELECT role, is_custom_permissions INTO _role, _is_custom
  FROM public.profiles WHERE id = _user_id;

  IF _is_custom THEN
    SELECT allowed INTO _custom_allowed
    FROM public.user_permissions
    WHERE user_id = _user_id AND permission_key = _permission_key;
    
    IF _custom_allowed IS NOT NULL THEN
      RETURN _custom_allowed;
    END IF;
  END IF;

  IF _role = 'admin' THEN
    RETURN true;
  ELSIF _role = 'financeiro' THEN
    RETURN _permission_key IN (
      'view_dashboard',
      'create_revenue',
      'edit_revenue',
      'view_revenues',
      'create_expense',
      'edit_expense',
      'view_expenses'
    );
  ELSIF _role = 'gestor' THEN
    RETURN _permission_key IN (
      'view_dashboard',
      'view_commissions',
      'register_profits',
      'view_profits'
    );
  ELSIF _role = 'socio' THEN
    RETURN _permission_key IN (
      'view_dashboard',
      'view_dashboard_socios',
      'view_partner_results',
      'view_reports',
      'view_revenues',
      'view_expenses',
      'view_goals',
      'view_commissions',
      'view_profits',
      'view_shopify_withdrawals',
      'create_revenue',
      'edit_revenue',
      'create_expense',
      'edit_expense',
      'register_profits',
      'manage_partners'
    );
  END IF;

  RETURN false;
END;
$function$;

-- Also update the other overload
CREATE OR REPLACE FUNCTION public.has_permission(_permission_key text, _user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_role public.app_role;
  has_custom boolean;
  permission_allowed boolean;
BEGIN
  SELECT role, is_custom_permissions INTO user_role, has_custom
  FROM public.profiles
  WHERE id = _user_id;

  IF has_custom THEN
    SELECT allowed INTO permission_allowed
    FROM public.user_permissions
    WHERE user_id = _user_id AND permission_key = _permission_key;
    
    IF permission_allowed IS NOT NULL THEN
      RETURN permission_allowed;
    END IF;
  END IF;

  CASE user_role
    WHEN 'admin' THEN
      RETURN true;
    WHEN 'financeiro' THEN
      RETURN _permission_key IN (
        'view_dashboard',
        'create_revenue',
        'edit_revenue',
        'view_revenues',
        'create_expense',
        'edit_expense',
        'view_expenses'
      );
    WHEN 'gestor' THEN
      RETURN _permission_key IN (
        'view_dashboard',
        'view_commissions',
        'register_profits',
        'view_profits'
      );
    WHEN 'socio' THEN
      RETURN _permission_key IN (
        'view_dashboard',
        'view_dashboard_socios',
        'view_partner_results',
        'view_reports',
        'view_revenues',
        'view_expenses',
        'view_goals',
        'view_commissions',
        'view_profits',
        'view_shopify_withdrawals',
        'create_revenue',
        'edit_revenue',
        'create_expense',
        'edit_expense',
        'register_profits',
        'manage_partners'
      );
    ELSE
      RETURN false;
  END CASE;
END;
$function$;
-- ========================================
-- 20260318134216_f50aaa0a-f6ea-4a9c-b944-1948590d4f2d.sql
-- ========================================
ALTER TABLE public.bank_accounts
ADD COLUMN IF NOT EXISTS created_by uuid;

CREATE INDEX IF NOT EXISTS idx_bank_accounts_created_by
ON public.bank_accounts (created_by);

-- Backfill 1: tenta inferir criador a partir do vínculo ativo de parceiro da loja
UPDATE public.bank_accounts ba
SET created_by = p.user_id
FROM public.partners p
WHERE ba.created_by IS NULL
  AND ba.store_id IS NOT NULL
  AND p.store_id = ba.store_id
  AND p.status = 'active';

-- Backfill 2: se existir apenas 1 admin no sistema, usa esse admin para legados sem criador
UPDATE public.bank_accounts ba
SET created_by = admin_profile.id
FROM (
  SELECT id
  FROM public.profiles
  WHERE role = 'admin'
  ORDER BY created_at ASC
  LIMIT 1
) AS admin_profile
WHERE ba.created_by IS NULL
  AND (
    SELECT COUNT(*)
    FROM public.profiles
    WHERE role = 'admin'
  ) = 1;
-- ========================================
-- 20260318165309_41f4bf85-befe-402b-a93a-8430cbc81ebb.sql
-- ========================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.bank_accounts;
-- ========================================
-- 20260318172745_35ea054b-1f1a-4cdd-97d5-7cb0c9d90880.sql
-- ========================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'financeiro'::app_role
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    'financeiro'::app_role
  );
  
  RETURN NEW;
END;
$function$;

-- ========================================
-- 20260318174919_8d4183e4-badf-4752-99a8-11cc2390add6.sql
-- ========================================

-- Fix 1: Remove "store_id IS NULL" from partner policies on bank_accounts
DROP POLICY IF EXISTS "Partners can view accessible bank accounts" ON public.bank_accounts;
CREATE POLICY "Partners can view accessible bank accounts"
ON public.bank_accounts FOR SELECT TO authenticated
USING (
  (store_id IN (SELECT get_partner_store_ids(auth.uid())))
  OR
  (id IN (SELECT bank_account_id FROM store_bank_accounts WHERE store_id IN (SELECT get_partner_store_ids(auth.uid()))))
);

DROP POLICY IF EXISTS "Partners can update accessible bank accounts" ON public.bank_accounts;
CREATE POLICY "Partners can update accessible bank accounts"
ON public.bank_accounts FOR UPDATE TO authenticated
USING (
  (store_id IN (SELECT get_partner_store_ids(auth.uid())))
  OR
  (id IN (SELECT bank_account_id FROM store_bank_accounts WHERE store_id IN (SELECT get_partner_store_ids(auth.uid()))))
);

DROP POLICY IF EXISTS "Partners can delete accessible bank accounts" ON public.bank_accounts;
CREATE POLICY "Partners can delete accessible bank accounts"
ON public.bank_accounts FOR DELETE TO authenticated
USING (
  (store_id IN (SELECT get_partner_store_ids(auth.uid())))
  OR
  (id IN (SELECT bank_account_id FROM store_bank_accounts WHERE store_id IN (SELECT get_partner_store_ids(auth.uid()))))
);

-- Fix 2: Restrict partner manager self-assignment to their own stores only
DROP POLICY IF EXISTS "Partners can insert their own manager record" ON public.managers;
CREATE POLICY "Partners can insert their own manager record"
ON public.managers FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND is_partner(auth.uid())
  AND (store_id IS NULL OR store_id IN (SELECT get_partner_store_ids(auth.uid())))
);

-- ========================================
-- 20260318175409_92221cbd-6f69-42cc-87aa-7c84357831b3.sql
-- ========================================

-- Fix 1: Partners cannot modify capital_amount, capital_percentage, or status
-- Replace the broad UPDATE policy with a restricted one using a trigger
DROP POLICY IF EXISTS "Partners can update own non-critical fields" ON public.partners;

-- Create a trigger to prevent partners from modifying sensitive fields
CREATE OR REPLACE FUNCTION public.prevent_partner_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- If the user is not an admin, prevent changes to sensitive fields
  IF NOT is_admin(auth.uid()) THEN
    -- Prevent changing capital_amount, capital_percentage, status
    IF NEW.capital_amount IS DISTINCT FROM OLD.capital_amount THEN
      RAISE EXCEPTION 'Não autorizado a alterar capital_amount';
    END IF;
    IF NEW.capital_percentage IS DISTINCT FROM OLD.capital_percentage THEN
      RAISE EXCEPTION 'Não autorizado a alterar capital_percentage';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Não autorizado a alterar status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_partner_self_escalation ON public.partners;
CREATE TRIGGER trg_prevent_partner_self_escalation
  BEFORE UPDATE ON public.partners
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_partner_self_escalation();

-- Fix 2: Remove the ability for partners to self-assign as managers
DROP POLICY IF EXISTS "Partners can insert their own manager record" ON public.managers;
-- Only admins and financeiro can create manager records (already covered by existing policy)

-- ========================================
-- 20260318191500_b470997c-5e43-428c-8105-0178243b7a1b.sql
-- ========================================

-- Fix: Allow partners to see bank accounts they created (created_by = auth.uid())
DROP POLICY IF EXISTS "Partners can view accessible bank accounts" ON public.bank_accounts;

CREATE POLICY "Partners can view accessible bank accounts"
ON public.bank_accounts FOR SELECT TO authenticated
USING (
  (created_by = auth.uid()) OR
  (store_id IN (SELECT get_partner_store_ids(auth.uid()))) OR
  (id IN (SELECT bank_account_id FROM store_bank_accounts WHERE store_id IN (SELECT get_partner_store_ids(auth.uid()))))
);

-- Also fix UPDATE and DELETE to include created_by ownership
DROP POLICY IF EXISTS "Partners can update accessible bank accounts" ON public.bank_accounts;

CREATE POLICY "Partners can update accessible bank accounts"
ON public.bank_accounts FOR UPDATE TO authenticated
USING (
  (created_by = auth.uid()) OR
  (store_id IN (SELECT get_partner_store_ids(auth.uid()))) OR
  (id IN (SELECT bank_account_id FROM store_bank_accounts WHERE store_id IN (SELECT get_partner_store_ids(auth.uid()))))
);

DROP POLICY IF EXISTS "Partners can delete accessible bank accounts" ON public.bank_accounts;

CREATE POLICY "Partners can delete accessible bank accounts"
ON public.bank_accounts FOR DELETE TO authenticated
USING (
  (created_by = auth.uid()) OR
  (store_id IN (SELECT get_partner_store_ids(auth.uid()))) OR
  (id IN (SELECT bank_account_id FROM store_bank_accounts WHERE store_id IN (SELECT get_partner_store_ids(auth.uid()))))
);

-- ========================================
-- 20260318195028_2a9ba01e-44f0-4c35-a20f-be87b8f345c0.sql
-- ========================================
-- Clean up legacy store_id values from bank_accounts
-- The proper linking is done via store_bank_accounts junction table
UPDATE public.bank_accounts SET store_id = NULL WHERE store_id IS NOT NULL;
-- ========================================
-- 20260319000001_add_performance_indexes.sql
-- ========================================
-- Índices de performance para queries mais rápidas

-- expenses: queries por loja + período (Dashboard, Reports)
CREATE INDEX IF NOT EXISTS idx_expenses_store_date
  ON expenses(store_id, date DESC);

-- expenses: queries por usuário + período
CREATE INDEX IF NOT EXISTS idx_expenses_user_date
  ON expenses(user_id, date DESC);

-- expenses: queries por categoria
CREATE INDEX IF NOT EXISTS idx_expenses_category
  ON expenses(category_id);

-- revenues: queries por loja + período
CREATE INDEX IF NOT EXISTS idx_revenues_store_date
  ON revenues(store_id, date DESC);

-- revenues: queries por usuário + período
CREATE INDEX IF NOT EXISTS idx_revenues_user_date
  ON revenues(user_id, date DESC);

-- daily_records: queries por loja + data (PartnerDashboard, Dashboard)
CREATE INDEX IF NOT EXISTS idx_daily_records_store_date
  ON daily_records(store_id, date DESC);

-- daily_records: queries por status
CREATE INDEX IF NOT EXISTS idx_daily_records_status
  ON daily_records(shopify_status, date DESC);

-- bank_transactions: queries por conta + data
CREATE INDEX IF NOT EXISTS idx_bank_transactions_account_date
  ON bank_transactions(bank_account_id, date DESC);

-- profiles: queries por status
CREATE INDEX IF NOT EXISTS idx_profiles_status
  ON profiles(status);

-- exchange_rates: queries por moeda + data (useCurrency)
CREATE INDEX IF NOT EXISTS idx_exchange_rates_currencies_date
  ON exchange_rates(base_currency, target_currency, date DESC);

-- partners: queries por usuário
CREATE INDEX IF NOT EXISTS idx_partners_user_id
  ON partners(user_id);

-- store_bank_accounts: queries por loja
CREATE INDEX IF NOT EXISTS idx_store_bank_accounts_store
  ON store_bank_accounts(store_id);

-- notifications: queries por usuário + lido
CREATE INDEX IF NOT EXISTS idx_notifications_user_read
  ON notifications(user_id, read, created_at DESC);

-- audit_logs: queries por usuário + tabela
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_table
  ON audit_logs(user_id, table_name, created_at DESC);

-- ========================================
-- 20260319000002_add_rls_policies.sql
-- ========================================
-- ============================================================
-- RLS POLICIES — Segurança por linha para todas as tabelas
-- ============================================================

-- Função auxiliar para verificar se usuário é admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
    AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Função auxiliar para verificar se usuário é financeiro ou admin
CREATE OR REPLACE FUNCTION is_financeiro_or_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'financeiro')
    AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Função auxiliar para obter stores do sócio
CREATE OR REPLACE FUNCTION get_partner_store_ids()
RETURNS uuid[] AS $$
  SELECT ARRAY(
    SELECT store_id FROM partners
    WHERE user_id = auth.uid()
    AND status = 'active'
    AND store_id IS NOT NULL
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- EXPENSES
-- ============================================================
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expenses_select" ON expenses;
CREATE POLICY "expenses_select" ON expenses
  FOR SELECT USING (
    is_financeiro_or_admin()
    OR store_id = ANY(get_partner_store_ids())
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "expenses_insert" ON expenses;
CREATE POLICY "expenses_insert" ON expenses
  FOR INSERT WITH CHECK (
    is_financeiro_or_admin()
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "expenses_update" ON expenses;
CREATE POLICY "expenses_update" ON expenses
  FOR UPDATE USING (
    is_financeiro_or_admin()
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "expenses_delete" ON expenses;
CREATE POLICY "expenses_delete" ON expenses
  FOR DELETE USING (
    is_financeiro_or_admin()
  );

-- ============================================================
-- REVENUES
-- ============================================================
ALTER TABLE revenues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "revenues_select" ON revenues;
CREATE POLICY "revenues_select" ON revenues
  FOR SELECT USING (
    is_financeiro_or_admin()
    OR store_id = ANY(get_partner_store_ids())
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "revenues_insert" ON revenues;
CREATE POLICY "revenues_insert" ON revenues
  FOR INSERT WITH CHECK (
    is_financeiro_or_admin()
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "revenues_update" ON revenues;
CREATE POLICY "revenues_update" ON revenues
  FOR UPDATE USING (
    is_financeiro_or_admin()
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "revenues_delete" ON revenues;
CREATE POLICY "revenues_delete" ON revenues
  FOR DELETE USING (
    is_financeiro_or_admin()
  );

-- ============================================================
-- DAILY_RECORDS
-- ============================================================
ALTER TABLE daily_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_records_select" ON daily_records;
CREATE POLICY "daily_records_select" ON daily_records
  FOR SELECT USING (
    is_financeiro_or_admin()
    OR store_id = ANY(get_partner_store_ids())
    OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS "daily_records_insert" ON daily_records;
CREATE POLICY "daily_records_insert" ON daily_records
  FOR INSERT WITH CHECK (
    is_financeiro_or_admin()
    OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS "daily_records_update" ON daily_records;
CREATE POLICY "daily_records_update" ON daily_records
  FOR UPDATE USING (
    is_financeiro_or_admin()
    OR created_by = auth.uid()
  );

-- ============================================================
-- PROFILES — usuário vê apenas o próprio perfil, admin vê todos
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (
    id = auth.uid()
    OR is_admin()
  );

DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE USING (
    id = auth.uid()
    OR is_admin()
  );

-- ============================================================
-- STORES — financeiro/admin vê todas, sócio vê apenas as suas
-- ============================================================
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stores_select" ON stores;
CREATE POLICY "stores_select" ON stores
  FOR SELECT USING (
    is_financeiro_or_admin()
    OR id = ANY(get_partner_store_ids())
  );

DROP POLICY IF EXISTS "stores_insert" ON stores;
CREATE POLICY "stores_insert" ON stores
  FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS "stores_update" ON stores;
CREATE POLICY "stores_update" ON stores
  FOR UPDATE USING (is_admin());

DROP POLICY IF EXISTS "stores_delete" ON stores;
CREATE POLICY "stores_delete" ON stores
  FOR DELETE USING (is_admin());

-- ============================================================
-- PARTNERS
-- ============================================================
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "partners_select" ON partners;
CREATE POLICY "partners_select" ON partners
  FOR SELECT USING (
    is_admin()
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "partners_insert" ON partners;
CREATE POLICY "partners_insert" ON partners
  FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS "partners_update" ON partners;
CREATE POLICY "partners_update" ON partners
  FOR UPDATE USING (is_admin());

-- ============================================================
-- NOTIFICATIONS — usuário vê apenas as próprias
-- ============================================================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select" ON notifications;
CREATE POLICY "notifications_select" ON notifications
  FOR SELECT USING (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "notifications_update" ON notifications;
CREATE POLICY "notifications_update" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

-- ============================================================
-- EXCHANGE_RATES — leitura pública para usuários autenticados
-- ============================================================
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "exchange_rates_select" ON exchange_rates;
CREATE POLICY "exchange_rates_select" ON exchange_rates
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "exchange_rates_insert" ON exchange_rates;
CREATE POLICY "exchange_rates_insert" ON exchange_rates
  FOR INSERT WITH CHECK (is_admin());

-- ============================================================
-- EXPENSE_CATEGORIES — leitura para todos autenticados
-- ============================================================
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expense_categories_select" ON expense_categories;
CREATE POLICY "expense_categories_select" ON expense_categories
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "expense_categories_insert" ON expense_categories;
CREATE POLICY "expense_categories_insert" ON expense_categories
  FOR INSERT WITH CHECK (is_admin());

-- ============================================================
-- BANK_ACCOUNTS
-- ============================================================
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bank_accounts_select" ON bank_accounts;
CREATE POLICY "bank_accounts_select" ON bank_accounts
  FOR SELECT USING (is_financeiro_or_admin());

DROP POLICY IF EXISTS "bank_accounts_insert" ON bank_accounts;
CREATE POLICY "bank_accounts_insert" ON bank_accounts
  FOR INSERT WITH CHECK (is_financeiro_or_admin());

DROP POLICY IF EXISTS "bank_accounts_update" ON bank_accounts;
CREATE POLICY "bank_accounts_update" ON bank_accounts
  FOR UPDATE USING (is_financeiro_or_admin());

-- ============================================================
-- AUDIT_LOGS — apenas admins leem, sistema insere
-- ============================================================
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_select" ON audit_logs;
CREATE POLICY "audit_logs_select" ON audit_logs
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "audit_logs_insert" ON audit_logs;
CREATE POLICY "audit_logs_insert" ON audit_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- PAYROLL — financeiro e admin
-- ============================================================
ALTER TABLE payroll ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payroll_select" ON payroll;
CREATE POLICY "payroll_select" ON payroll
  FOR SELECT USING (is_financeiro_or_admin());

DROP POLICY IF EXISTS "payroll_insert" ON payroll;
CREATE POLICY "payroll_insert" ON payroll
  FOR INSERT WITH CHECK (is_financeiro_or_admin());

DROP POLICY IF EXISTS "payroll_update" ON payroll;
CREATE POLICY "payroll_update" ON payroll
  FOR UPDATE USING (is_financeiro_or_admin());

DROP POLICY IF EXISTS "payroll_delete" ON payroll;
CREATE POLICY "payroll_delete" ON payroll
  FOR DELETE USING (is_admin());

-- ========================================
-- 20260319000003_audit_triggers.sql
-- ========================================
-- ============================================================
-- AUDITORIA AUTOMÁTICA — Triggers para todas as tabelas críticas
-- ============================================================

-- Função principal que registra qualquer alteração
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
  v_old_data jsonb;
  v_new_data jsonb;
  v_action text;
  v_changed_fields jsonb;
BEGIN
  -- Determinar ação
  v_action := TG_OP; -- INSERT, UPDATE, DELETE

  -- Capturar dados antigos e novos
  IF TG_OP = 'DELETE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := NULL;
    v_changed_fields := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    v_old_data := NULL;
    v_new_data := to_jsonb(NEW);
    v_changed_fields := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
    -- Capturar apenas campos alterados
    SELECT jsonb_object_agg(key, value)
    INTO v_changed_fields
    FROM jsonb_each(v_new_data)
    WHERE to_jsonb(OLD)->key IS DISTINCT FROM value;
  END IF;

  -- Inserir no audit_log
  INSERT INTO audit_logs (
    user_id,
    action,
    table_name,
    record_id,
    details,
    created_at
  ) VALUES (
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
    v_action,
    TG_TABLE_NAME,
    COALESCE(
      (v_new_data->>'id')::uuid,
      (v_old_data->>'id')::uuid
    ),
    jsonb_build_object(
      'old', v_old_data,
      'new', v_new_data,
      'changed_fields', v_changed_fields
    ),
    now()
  );

  -- Retornar linha correta
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- TRIGGERS NAS TABELAS CRÍTICAS
-- ============================================================

-- Expenses
DROP TRIGGER IF EXISTS audit_expenses ON expenses;
CREATE TRIGGER audit_expenses
  AFTER INSERT OR UPDATE OR DELETE ON expenses
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Revenues
DROP TRIGGER IF EXISTS audit_revenues ON revenues;
CREATE TRIGGER audit_revenues
  AFTER INSERT OR UPDATE OR DELETE ON revenues
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Daily Records
DROP TRIGGER IF EXISTS audit_daily_records ON daily_records;
CREATE TRIGGER audit_daily_records
  AFTER INSERT OR UPDATE OR DELETE ON daily_records
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Profiles (alterações de role/status)
DROP TRIGGER IF EXISTS audit_profiles ON profiles;
CREATE TRIGGER audit_profiles
  AFTER UPDATE ON profiles
  FOR EACH ROW
  WHEN (
    OLD.role IS DISTINCT FROM NEW.role OR
    OLD.status IS DISTINCT FROM NEW.status OR
    OLD.name IS DISTINCT FROM NEW.name
  )
  EXECUTE FUNCTION audit_trigger_function();

-- Stores
DROP TRIGGER IF EXISTS audit_stores ON stores;
CREATE TRIGGER audit_stores
  AFTER INSERT OR UPDATE OR DELETE ON stores
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Bank Accounts
DROP TRIGGER IF EXISTS audit_bank_accounts ON bank_accounts;
CREATE TRIGGER audit_bank_accounts
  AFTER INSERT OR UPDATE OR DELETE ON bank_accounts
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Payroll
DROP TRIGGER IF EXISTS audit_payroll ON payroll;
CREATE TRIGGER audit_payroll
  AFTER INSERT OR UPDATE OR DELETE ON payroll
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- ============================================================
-- FUNÇÃO PARA LIMPAR LOGS ANTIGOS (manter apenas 90 dias)
-- ============================================================
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM audit_logs
  WHERE created_at < now() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- VIEW PARA VISUALIZAR AUDITORIA DE FORMA AMIGÁVEL
-- ============================================================
CREATE OR REPLACE VIEW audit_logs_view AS
SELECT
  al.id,
  al.action,
  al.table_name,
  al.record_id,
  p.name AS user_name,
  p.email AS user_email,
  p.role AS user_role,
  al.details->'changed_fields' AS changed_fields,
  al.created_at
FROM audit_logs al
LEFT JOIN profiles p ON p.id = al.user_id
ORDER BY al.created_at DESC;

-- Permissão para admin ver a view
GRANT SELECT ON audit_logs_view TO authenticated;

