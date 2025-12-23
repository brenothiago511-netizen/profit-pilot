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