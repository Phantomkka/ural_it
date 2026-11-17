-- Existing legacy lines are retained; only newly assigned switch ports are unique.
CREATE UNIQUE INDEX profiles_physical_cable_port
ON profiles ((cable->>'switchId'), ((cable->>'port')::integer))
WHERE cable->>'routing'='free' AND cable->>'stage' IN ('TERMINATED','TESTED');
