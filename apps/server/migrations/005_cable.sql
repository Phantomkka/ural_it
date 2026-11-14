ALTER TABLE profiles ADD COLUMN cable jsonb;
ALTER TABLE profiles ADD CONSTRAINT profile_cable_object CHECK (
  cable IS NULL OR (jsonb_typeof(cable)='object' AND jsonb_typeof(cable->'points')='array' AND jsonb_array_length(cable->'points') BETWEEN 1 AND 12)
);
