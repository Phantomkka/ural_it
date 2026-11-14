-- Additive migration: older releases ignore this column and do not overwrite it.
ALTER TABLE profiles ADD COLUMN diagnostics jsonb NOT NULL DEFAULT '[]'::jsonb
  CHECK (jsonb_typeof(diagnostics) = 'array');
