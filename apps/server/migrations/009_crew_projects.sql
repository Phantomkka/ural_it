ALTER TABLE profiles ADD COLUMN projects jsonb NOT NULL DEFAULT '[]'::jsonb;
CREATE TABLE crew_projects(code text PRIMARY KEY CHECK(code ~ '^[A-F0-9]{12}$'), data jsonb NOT NULL);
