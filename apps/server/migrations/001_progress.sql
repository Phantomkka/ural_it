CREATE TABLE profiles (
  id uuid PRIMARY KEY,
  token_hash char(64) NOT NULL UNIQUE,
  nickname varchar(64) NOT NULL,
  credits integer NOT NULL DEFAULT 0 CHECK (credits >= 0),
  xp integer NOT NULL DEFAULT 0 CHECK (xp >= 0),
  inventory jsonb NOT NULL CHECK (
    jsonb_typeof(inventory) = 'object' AND inventory ?& ARRAY['patch_cord','cleaner','toolkit'] AND
    (inventory->>'patch_cord')::integer >= 0 AND
    (inventory->>'cleaner')::integer >= 0 AND
    (inventory->>'toolkit')::integer >= 0
  ),
  jobs jsonb NOT NULL CHECK (jsonb_typeof(jobs) = 'array' AND
    jsonb_array_length(jsonb_path_query_array(jobs, '$[*] ? (@.status == "ACTIVE")')) <= 1),
  tutorial_completed boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0)
);
CREATE TABLE reward_events (
  job_id uuid PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES profiles(id),
  credits integer NOT NULL CHECK (credits > 0),
  xp integer NOT NULL CHECK (xp > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reward_events_profile ON reward_events(profile_id);
CREATE TABLE profile_operations (
  profile_id uuid NOT NULL REFERENCES profiles(id),
  idempotency_key varchar(100) NOT NULL,
  fingerprint char(64) NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, idempotency_key)
);
