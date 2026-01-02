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