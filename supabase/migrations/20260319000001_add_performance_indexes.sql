-- Índices de performance para queries mais rápidas

-- expenses: queries por loja + período (Dashboard, Reports)
CREATE INDEX IF NOT EXISTS idx_expenses_store_date
  ON expenses(store_id, date DESC);

-- expenses: queries por usuário + período
CREATE INDEX IF NOT EXISTS idx_expenses_user_date
  ON expenses(user_id, date DESC);

-- expenses: queries por categoria
CREATE INDEX IF NOT EXISTS idx_expenses_category
  ON expenses(category_id);

-- revenues: queries por loja + período
CREATE INDEX IF NOT EXISTS idx_revenues_store_date
  ON revenues(store_id, date DESC);

-- revenues: queries por usuário + período
CREATE INDEX IF NOT EXISTS idx_revenues_user_date
  ON revenues(user_id, date DESC);

-- daily_records: queries por loja + data (PartnerDashboard, Dashboard)
CREATE INDEX IF NOT EXISTS idx_daily_records_store_date
  ON daily_records(store_id, date DESC);

-- daily_records: queries por status
CREATE INDEX IF NOT EXISTS idx_daily_records_status
  ON daily_records(shopify_status, date DESC);

-- bank_transactions: queries por conta + data
CREATE INDEX IF NOT EXISTS idx_bank_transactions_account_date
  ON bank_transactions(bank_account_id, date DESC);

-- profiles: queries por status
CREATE INDEX IF NOT EXISTS idx_profiles_status
  ON profiles(status);

-- exchange_rates: queries por moeda + data (useCurrency)
CREATE INDEX IF NOT EXISTS idx_exchange_rates_currencies_date
  ON exchange_rates(base_currency, target_currency, date DESC);

-- partners: queries por usuário
CREATE INDEX IF NOT EXISTS idx_partners_user_id
  ON partners(user_id);

-- store_bank_accounts: queries por loja
CREATE INDEX IF NOT EXISTS idx_store_bank_accounts_store
  ON store_bank_accounts(store_id);

-- notifications: queries por usuário + lido
CREATE INDEX IF NOT EXISTS idx_notifications_user_read
  ON notifications(user_id, read, created_at DESC);

-- audit_logs: queries por usuário + tabela
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_table
  ON audit_logs(user_id, table_name, created_at DESC);
