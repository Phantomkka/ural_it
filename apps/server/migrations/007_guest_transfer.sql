ALTER TABLE accounts ADD COLUMN preferences jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(preferences)='object');
CREATE TABLE guest_transfers (
 token_hash char(64) PRIMARY KEY,
 guest_hash char(64) NOT NULL,
 profile_id uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
 preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
 expires_at bigint NOT NULL
);
CREATE INDEX guest_transfers_expiry ON guest_transfers(expires_at);
