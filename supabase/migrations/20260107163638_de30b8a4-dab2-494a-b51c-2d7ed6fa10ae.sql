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