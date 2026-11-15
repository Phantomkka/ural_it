-- Additive: never replace existing inventory keys or player progress.
UPDATE profiles SET inventory='{"ups_battery":0,"ssd":0}'::jsonb || inventory;
