
CREATE OR REPLACE FUNCTION public.get_profile_by_id(p_user_id uuid)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_to_json(t) FROM (
    SELECT id, name, email, role::text, status
    FROM public.profiles
    WHERE id = p_user_id
  ) t;
$$;
