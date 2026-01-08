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