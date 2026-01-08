-- Remover função calculate_commission com CASCADE para eliminar triggers dependentes
DROP FUNCTION IF EXISTS public.calculate_commission() CASCADE;

-- Remover coluna commission_amount de daily_records
ALTER TABLE public.daily_records DROP COLUMN IF EXISTS commission_amount CASCADE;