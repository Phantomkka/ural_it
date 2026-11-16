CREATE TABLE companies (
  code text PRIMARY KEY CHECK (code ~ '^[A-F0-9]{12}$'),
  owner_profile_id uuid NOT NULL UNIQUE REFERENCES profiles(id),
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object')
);
CREATE UNIQUE INDEX company_private_office ON companies ((data->>'officeId'))
  WHERE data->>'officeId' IS NOT NULL AND data->>'officeId' <> 'coworking';
CREATE TABLE company_case_receipts (
  case_id uuid PRIMARY KEY,
  company_code text NOT NULL REFERENCES companies(code),
  claimed_at timestamptz NOT NULL DEFAULT now()
);
