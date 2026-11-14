ALTER TABLE profiles ADD COLUMN business jsonb;
ALTER TABLE profiles ADD CONSTRAINT business_object CHECK (business IS NULL OR jsonb_typeof(business)='object');
UPDATE profiles SET inventory='{"power_supply":0,"toner":0}'::jsonb || inventory;
