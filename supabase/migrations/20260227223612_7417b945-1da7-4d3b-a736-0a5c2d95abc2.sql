
-- First check if any expenses reference these categories before deleting
-- We'll update the categories to a cleaner, more relevant set

-- Delete categories that are too generic or irrelevant (only if not referenced)
DELETE FROM expense_categories WHERE name IN ('Água', 'Energia', 'Telefone', 'Material de Escritório', 'Transporte', 'Alimentação', 'Manutenção', 'Aluguel', 'Internet')
AND id NOT IN (SELECT DISTINCT category_id FROM expenses WHERE category_id IS NOT NULL);

-- Insert new optimized categories (ignore if already exists)
INSERT INTO expense_categories (name) VALUES
  ('Ads / Tráfego Pago'),
  ('Plataformas e Ferramentas'),
  ('Fornecedores / Produtos'),
  ('Logística / Frete'),
  ('Taxas e Comissões'),
  ('Infraestrutura'),
  ('Serviços Terceirizados'),
  ('Folha de Pagamento')
ON CONFLICT DO NOTHING;
