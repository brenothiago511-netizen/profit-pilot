-- ============================================================
-- AUDITORIA AUTOMÁTICA — Triggers para todas as tabelas críticas
-- ============================================================

-- Função principal que registra qualquer alteração
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
  v_old_data jsonb;
  v_new_data jsonb;
  v_action text;
  v_changed_fields jsonb;
BEGIN
  -- Determinar ação
  v_action := TG_OP; -- INSERT, UPDATE, DELETE

  -- Capturar dados antigos e novos
  IF TG_OP = 'DELETE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := NULL;
    v_changed_fields := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    v_old_data := NULL;
    v_new_data := to_jsonb(NEW);
    v_changed_fields := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
    -- Capturar apenas campos alterados
    SELECT jsonb_object_agg(key, value)
    INTO v_changed_fields
    FROM jsonb_each(v_new_data)
    WHERE to_jsonb(OLD)->key IS DISTINCT FROM value;
  END IF;

  -- Inserir no audit_log
  INSERT INTO audit_logs (
    user_id,
    action,
    table_name,
    record_id,
    details,
    created_at
  ) VALUES (
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
    v_action,
    TG_TABLE_NAME,
    COALESCE(
      (v_new_data->>'id')::uuid,
      (v_old_data->>'id')::uuid
    ),
    jsonb_build_object(
      'old', v_old_data,
      'new', v_new_data,
      'changed_fields', v_changed_fields
    ),
    now()
  );

  -- Retornar linha correta
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- TRIGGERS NAS TABELAS CRÍTICAS
-- ============================================================

-- Expenses
DROP TRIGGER IF EXISTS audit_expenses ON expenses;
CREATE TRIGGER audit_expenses
  AFTER INSERT OR UPDATE OR DELETE ON expenses
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Revenues
DROP TRIGGER IF EXISTS audit_revenues ON revenues;
CREATE TRIGGER audit_revenues
  AFTER INSERT OR UPDATE OR DELETE ON revenues
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Daily Records
DROP TRIGGER IF EXISTS audit_daily_records ON daily_records;
CREATE TRIGGER audit_daily_records
  AFTER INSERT OR UPDATE OR DELETE ON daily_records
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Profiles (alterações de role/status)
DROP TRIGGER IF EXISTS audit_profiles ON profiles;
CREATE TRIGGER audit_profiles
  AFTER UPDATE ON profiles
  FOR EACH ROW
  WHEN (
    OLD.role IS DISTINCT FROM NEW.role OR
    OLD.status IS DISTINCT FROM NEW.status OR
    OLD.name IS DISTINCT FROM NEW.name
  )
  EXECUTE FUNCTION audit_trigger_function();

-- Stores
DROP TRIGGER IF EXISTS audit_stores ON stores;
CREATE TRIGGER audit_stores
  AFTER INSERT OR UPDATE OR DELETE ON stores
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Bank Accounts
DROP TRIGGER IF EXISTS audit_bank_accounts ON bank_accounts;
CREATE TRIGGER audit_bank_accounts
  AFTER INSERT OR UPDATE OR DELETE ON bank_accounts
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Payroll
DROP TRIGGER IF EXISTS audit_payroll ON payroll;
CREATE TRIGGER audit_payroll
  AFTER INSERT OR UPDATE OR DELETE ON payroll
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- ============================================================
-- FUNÇÃO PARA LIMPAR LOGS ANTIGOS (manter apenas 90 dias)
-- ============================================================
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM audit_logs
  WHERE created_at < now() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- VIEW PARA VISUALIZAR AUDITORIA DE FORMA AMIGÁVEL
-- ============================================================
CREATE OR REPLACE VIEW audit_logs_view AS
SELECT
  al.id,
  al.action,
  al.table_name,
  al.record_id,
  p.name AS user_name,
  p.email AS user_email,
  p.role AS user_role,
  al.details->'changed_fields' AS changed_fields,
  al.created_at
FROM audit_logs al
LEFT JOIN profiles p ON p.id = al.user_id
ORDER BY al.created_at DESC;

-- Permissão para admin ver a view
GRANT SELECT ON audit_logs_view TO authenticated;
