CREATE OR REPLACE FUNCTION prevent_reward_transaction_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Reward transactions are immutable';
END;
$$;

CREATE TRIGGER reward_transactions_immutable
BEFORE UPDATE OR DELETE ON reward_transactions
FOR EACH ROW
EXECUTE FUNCTION prevent_reward_transaction_changes();
