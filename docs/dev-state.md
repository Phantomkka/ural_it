# NETCITY 3.0 — checkpoint

- Base: PR #20, 739c61f; preceding dependency chain remains open. No merge or production changes.
- Branch: codex/netcity-3-accounts. Schema: 004 (additive private service JSONB; original guest profiles, inventory, jobs and diagnostic history preserved).
- Done: tablet apps/minimal HUD; inbound ring and accept/decline; client interview and diagnostic clues; counter purchase/backpack; session-owned carry/drop/install; link verification and client signoff; NET/XP/company count; shared hinged door with occupied-doorway protection.
- Retained: guest identity, old training, service board, rack/switch jobs, virtual computers, district contacts, settings and touch controls. Large panels now live inside the tablet.
- Validation: typecheck/build; 39/39 server and 13/13 real PostgreSQL checks. All 22 browser scenarios passed across the grouped run (20) and two corrected reruns (2); final case desktop/touch rerun 2/2 after room-boundary hardening. Built-client Caddy/PostgreSQL smoke 2/2. Windows/Edge with software rendering; no real-device, Docker or production-deployment claim.
- Persistence: one case instance per profile, operation fingerprints/reward ledger prevent duplicate payments. Recent 20 cases retained in the private snapshot; cumulative completion count and reward ledger persist. Disconnect drops at authoritative position; crash recovery uses recorded pickup position.
- Boundary: first template only; no claim of 8–12 archetypes, unrestricted physics, cable spool, traffic or completed NETCITY 3.0.

## Six milestones

1. Tablet + first full client case (PR #20): five feature increments above, then grouped regression/staging smoke and a reviewable PR above #16.
2. Accounts (current): username/password, no mail service; vetted password hashing, HttpOnly sessions/CSRF/rate limits, transactional guest binding, multidevice login/logout/recovery strategy. Separate security checks and PR.
3. Interactions: reusable affordances, more carryable props, valid drop surfaces, constrained spool/anchors/length budget. Preserve range and ownership authority.
4. Living district: seated/working NPC routines, bounded waypoint traffic/light phases, recognizable zones and closed map edges, measured budgets.
5. Cases: template engine and 8–12 materially different archetypes, branching clues/solutions, indoor wayfinding and repeatable contracts.
6. Company and performance: meaningful upgrades/unlocks/finances, shared mission contention, LOD/instancing, real measured device baselines and final regression.

Accounts implemented: username/password, transaction-safe guest ownership binding, hashed server sessions, login/logout across devices, CSRF/Origin checks, persistent throttling and one-use recovery key. No fake email UI. Account migration is additive 004; guest progress is not copied.

Account checks: typecheck/build passed; targeted server authority/HTTP/WebSocket 5/5; real PostgreSQL account + progress contracts 14/14; account/identity/reconnect browser selection 7/7. The same account flow passed against the built client with local self-signed HTTPS, production cookie settings and isolated PostgreSQL (1/1). No external HTTPS, real-device or container deployment claim. Full prior 22-scenario suite was not rerun for this block.

Next: physical affordances and constrained cable spool, then NPC routines/traffic. Local operational instructions remain private; rollout requires separate approval, verified backup and isolated staging. Migration 003 is forward-only; do not remove its column to roll back an application build.

Cadence: immediate focused checks for auth/economy/persistence/authority; full server, DB, browser and local reverse-proxy smoke after 5–6 ordinary increments or before a milestone release. Real-device and production-container validation remain distinct from Windows/Edge localhost tests.
