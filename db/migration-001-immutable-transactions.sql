CREATE OR REPLACE FUNCTION prevent_reward_transaction_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Reward transactions are immutable';
END;
$$;

DROP TRIGGER IF EXISTS reward_transactions_immutable
ON reward_transactions;

CREATE TRIGGER reward_transactions_immutable
BEFORE UPDATE OR DELETE ON reward_transactions
FOR EACH ROW
EXECUTE FUNCTION prevent_reward_transaction_changes();

CREATE OR REPLACE FUNCTION prevent_reward_transaction_truncate()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Reward transactions cannot be truncated';
END;
$$;

DROP TRIGGER IF EXISTS reward_transactions_no_truncate
ON reward_transactions;

CREATE TRIGGER reward_transactions_no_truncate
BEFORE TRUNCATE ON reward_transactions
FOR EACH STATEMENT
EXECUTE FUNCTION prevent_reward_transaction_truncate();
