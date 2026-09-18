CREATE TABLE users (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE customers (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE reward_transactions (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id),
  amount INTEGER NOT NULL CHECK (amount <> 0),
  type TEXT NOT NULL CHECK (type IN ('reward', 'redemption', 'correction')),
  reason TEXT NOT NULL,
  reference TEXT,
  posted_by UUID NOT NULL REFERENCES users(id),
  posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  related_transaction_id UUID REFERENCES reward_transactions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
