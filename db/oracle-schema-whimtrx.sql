
CREATE TABLE reward_transactions (
  id VARCHAR2(36) PRIMARY KEY,
  customer_id VARCHAR2(36) NOT NULL,
  amount NUMBER(10) NOT NULL CHECK (amount <> 0),
  type VARCHAR2(20) NOT NULL
    CHECK (type IN ('reward', 'redemption', 'correction')),
  reason VARCHAR2(2000) NOT NULL,
  reference VARCHAR2(1000),
  posted_by VARCHAR2(36) NOT NULL,
  posted_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  related_transaction_id VARCHAR2(36),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT reward_related_tx_fk
    FOREIGN KEY (related_transaction_id)
    REFERENCES reward_transactions(id)
);

CREATE INDEX reward_transactions_customer_idx
  ON reward_transactions(customer_id);

CREATE INDEX reward_transactions_posted_idx
  ON reward_transactions(customer_id, posted_at, created_at);

CREATE OR REPLACE TRIGGER reward_transactions_immutable
BEFORE UPDATE OR DELETE ON reward_transactions
BEGIN
  RAISE_APPLICATION_ERROR(-20002, 'Reward transactions are immutable');
END;
