CREATE TABLE audit_log (
  id UUID PRIMARY KEY,
  action TEXT NOT NULL,
  user_id UUID REFERENCES users(id),
  customer_id UUID REFERENCES customers(id),
  transaction_id UUID REFERENCES reward_transactions(id),
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);