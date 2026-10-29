CREATE TABLE transaction_idempotency (
  idempotency_key VARCHAR2(255) PRIMARY KEY,
  request_hash VARCHAR2(64) NOT NULL,
  transaction_id VARCHAR2(36) NOT NULL,
  response_json CLOB NOT NULL CHECK (response_json IS JSON),
  created_at TIMESTAMP WITH TIME ZONE
    DEFAULT SYSTIMESTAMP NOT NULL
);

CREATE INDEX transaction_idempotency_tx_idx
  ON transaction_idempotency(transaction_id);