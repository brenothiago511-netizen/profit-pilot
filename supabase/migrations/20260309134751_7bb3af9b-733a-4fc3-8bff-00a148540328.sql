
-- Delete duplicate stores (keep the first one created: cd35d9ec)
DELETE FROM stores WHERE id IN ('2a617460-e344-4fc5-9be9-dc8b93e52008', 'b6d2fcbb-4a10-4818-9b43-fdecdc3f4d4e', '3cca7eba-4b65-4ad7-a49e-8623f5fc0db0');

-- Delete orphan partner records (no store_id) for Warley
DELETE FROM partners WHERE user_id = '34a12f6d-ea43-4415-bb02-7eb3cee84d7d' AND store_id IS NULL;

-- Link the remaining SHOPIFY #582 store to Warley
INSERT INTO partners (user_id, store_id, capital_percentage, capital_amount, status)
VALUES ('34a12f6d-ea43-4415-bb02-7eb3cee84d7d', 'cd35d9ec-018d-4619-9d70-2ecb6164d15a', 100, 0, 'active');
