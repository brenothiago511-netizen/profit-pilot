ALTER TABLE public.bank_accounts
ADD COLUMN IF NOT EXISTS created_by uuid;

CREATE INDEX IF NOT EXISTS idx_bank_accounts_created_by
ON public.bank_accounts (created_by);

-- Backfill 1: tenta inferir criador a partir do vínculo ativo de parceiro da loja
UPDATE public.bank_accounts ba
SET created_by = p.user_id
FROM public.partners p
WHERE ba.created_by IS NULL
  AND ba.store_id IS NOT NULL
  AND p.store_id = ba.store_id
  AND p.status = 'active';

-- Backfill 2: se existir apenas 1 admin no sistema, usa esse admin para legados sem criador
UPDATE public.bank_accounts ba
SET created_by = admin_profile.id
FROM (
  SELECT id
  FROM public.profiles
  WHERE role = 'admin'
  ORDER BY created_at ASC
  LIMIT 1
) AS admin_profile
WHERE ba.created_by IS NULL
  AND (
    SELECT COUNT(*)
    FROM public.profiles
    WHERE role = 'admin'
  ) = 1;