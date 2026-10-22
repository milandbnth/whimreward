BEGIN;

CREATE SEQUENCE IF NOT EXISTS customers_whim_id_seq;

ALTER TABLE customers
  ALTER COLUMN whim_id DROP DEFAULT;

ALTER TABLE customers
  ALTER COLUMN whim_id TYPE BIGINT
  USING NULLIF(whim_id, '')::BIGINT;

ALTER TABLE customers
  ALTER COLUMN whim_id SET DEFAULT nextval('customers_whim_id_seq');

UPDATE customers
SET whim_id = nextval('customers_whim_id_seq')
WHERE whim_id IS NULL;

SELECT setval(
  'customers_whim_id_seq',
  COALESCE((SELECT MAX(whim_id) FROM customers), 0) + 1,
  false
);

ALTER SEQUENCE customers_whim_id_seq
  OWNED BY customers.whim_id;

ALTER TABLE customers
  ALTER COLUMN whim_id SET NOT NULL;

COMMIT;
