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