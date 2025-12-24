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