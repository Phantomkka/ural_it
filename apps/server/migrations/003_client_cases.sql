ALTER TABLE profiles ADD COLUMN service jsonb NOT NULL DEFAULT '{"cases":[],"completed":0}'::jsonb
  CHECK (jsonb_typeof(service)='object' AND jsonb_typeof(service->'cases')='array' AND (service->>'completed')::integer>=0);
