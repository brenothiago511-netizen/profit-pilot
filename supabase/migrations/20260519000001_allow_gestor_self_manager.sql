-- ============================================================
-- Allow users with role 'gestor' to read and self-register
-- their own row in public.managers.
--
-- Context: a previous migration (20260318175409) removed the
-- "Partners can insert their own manager record" policy to prevent
-- partners from escalating to manager. Gestor users (a distinct role)
-- legitimately need a managers row to be referenced as manager_id
-- when inserting daily_records, so we restore self-insert/select
-- scoped to the gestor role only.
-- ============================================================

-- Ensure 'gestor' exists in the app_role enum and is_gestor() is defined.
-- Both are idempotent in case migration 20260325000001 was not applied.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'gestor';

CREATE OR REPLACE FUNCTION public.is_gestor()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'gestor'
      AND status = 'active'
  );
$$;

-- SELECT: gestor can read their own managers row
DROP POLICY IF EXISTS "Gestors can view own manager record" ON public.managers;
CREATE POLICY "Gestors can view own manager record"
ON public.managers FOR SELECT
USING (
  public.is_gestor()
  AND user_id = auth.uid()
);

-- INSERT: gestor can create their own managers row (user_id must be themselves)
DROP POLICY IF EXISTS "Gestors can self-register manager record" ON public.managers;
CREATE POLICY "Gestors can self-register manager record"
ON public.managers FOR INSERT
WITH CHECK (
  public.is_gestor()
  AND user_id = auth.uid()
);
