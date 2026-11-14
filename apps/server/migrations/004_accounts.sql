CREATE TABLE accounts (
  id uuid PRIMARY KEY,
  login varchar(24) NOT NULL UNIQUE CHECK (login ~ '^[a-z][a-z0-9_]{2,23}$'),
  profile_id uuid NOT NULL UNIQUE REFERENCES profiles(id),
  password_hash text NOT NULL,
  recovery_hash char(64) NOT NULL,
  guest_hash char(64) UNIQUE
);
CREATE TABLE account_sessions (
  token_hash char(64) PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at bigint NOT NULL,
  expires_at bigint NOT NULL CHECK (expires_at > created_at)
);
CREATE INDEX account_sessions_expiry ON account_sessions(expires_at);
CREATE INDEX account_sessions_account ON account_sessions(account_id);
CREATE TABLE auth_buckets (
  bucket char(64) PRIMARY KEY,
  count integer NOT NULL CHECK (count > 0),
  expires_at bigint NOT NULL
);
CREATE INDEX auth_buckets_expiry ON auth_buckets(expires_at);
