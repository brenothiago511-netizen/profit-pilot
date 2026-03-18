
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
