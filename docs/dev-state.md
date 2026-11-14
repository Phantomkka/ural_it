# NETCITY 3.0 — checkpoint

- Base: PR #21, 8ae1f57; preceding dependency chain remains open. No merge or production changes.
- Branch: codex/netcity-3-cable. Schema: 005 (accounts/session tables and optional private cable JSONB; original guest progress preserved).
- Done: tablet apps/minimal HUD; inbound ring and accept/decline; client interview and diagnostic clues; counter purchase/backpack; session-owned carry/drop/install; link verification and client signoff; NET/XP/company count; shared hinged door with occupied-doorway protection.
- Retained: guest identity, old training, service board, rack/switch jobs, virtual computers, district contacts, settings and touch controls. Large panels now live inside the tablet.
- PR #20 baseline validation: typecheck/build; 39/39 server and 13/13 real PostgreSQL checks. All 22 browser scenarios passed across the grouped run (20) and two corrected reruns (2); final case desktop/touch rerun 2/2 after room-boundary hardening. Built-client Caddy/PostgreSQL smoke 2/2. Windows/Edge with software rendering; no real-device, Docker or production-deployment claim.
- Persistence: one case instance per profile, operation fingerprints/reward ledger prevent duplicate payments. Recent 20 cases retained in the private snapshot; cumulative completion count and reward ledger persist. Disconnect drops at authoritative position; crash recovery uses recorded pickup position.
- Boundary: first paid case template plus the constrained cable exercise; no claim of 8–12 archetypes, unrestricted physics, traffic or completed NETCITY 3.0.

## Six milestones

1. Tablet + first full client case (PR #20): five feature increments above, then grouped regression/staging smoke and a reviewable PR above #16.
2. Accounts (PR #21): username/password, no mail service; vetted password hashing, HttpOnly sessions/CSRF/rate limits, transactional guest binding, multidevice login/logout/recovery strategy. Separate security checks and PR.
3. Interactions (current): constrained cable spool increment implemented. Further carryable props, reusable affordances and drop surfaces remain. Preserve range and ownership authority.
4. Living district: seated/working NPC routines, bounded waypoint traffic/light phases, recognizable zones and closed map edges, measured budgets.
5. Cases: template engine and 8–12 materially different archetypes, branching clues/solutions, indoor wayfinding and repeatable contracts.
6. Company and performance: meaningful upgrades/unlocks/finances, shared mission contention, LOD/instancing, real measured device baselines and final regression.

Accounts implemented: username/password, transaction-safe guest ownership binding, hashed server sessions, login/logout across devices, CSRF/Origin checks, persistent throttling and one-use recovery key. No fake email UI. Account migration is additive 004; guest progress is not copied.

Account checks: typecheck/build passed; targeted server authority/HTTP/WebSocket 5/5; real PostgreSQL account + progress contracts 14/14; account/identity/reconnect browser selection 7/7. The same account flow passed against the built client with local self-signed HTTPS, production cookie settings and isolated PostgreSQL (1/1). No external HTTPS, real-device or container deployment claim. Full prior 22-scenario suite was not rerun for this block.

Cable increment: authoritative route/length/wall constraints, anchors, slowed carry/drop/resume, connector/test, sparse public line rendering, per-session ownership and checkpoint recovery. Migration 005 adds optional private cable state. No NET/XP award or live-port mutation. Typecheck/build passed; final cable/movement/ownership selection 9/9; auth selection 3/3 and real PostgreSQL account/progress/cable contracts 15/15. Selected browser regression 11/11 (account, multiplayer, cable, full client case, computers, reconnect, desktop/touch ticket). Built-client portrait tools/range smoke passed on local self-signed HTTPS with isolated PostgreSQL (1/1). Full 25-scenario browser suite and unrelated server files were not rerun.

Next: more carryable affordances, then NPC routines/traffic. Local operational instructions remain private; rollout requires separate approval, verified backup and isolated staging. Migration 003 is forward-only; do not remove its column to roll back an application build.

Cadence: immediate focused checks for auth/economy/persistence/authority; full server, DB, browser and local reverse-proxy smoke after 5–6 ordinary increments or before a milestone release. Real-device and production-container validation remain distinct from Windows/Edge localhost tests.
