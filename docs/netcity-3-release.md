# NETCITY 3.0 release

Final integration for Issue #23 builds on PRs #10–16, #20–22. Existing tutorial,
PC terminals, economy, companies, guests and account ownership are retained.

## Gameplay

The tablet contains calls, client interviews, contextual diagnosis, supplier purchases,
carry/drop/install, post-repair tests and customer signoff. Eight repair families use
different rules: network cable, radio channels, isolated PC power, printer paper/toner,
server shutdown/cooling, selective backup restore, camera cable installation, voice VLAN/SIP.
Three ordered company upgrades unlock equipment and harder work. Three company contracts
reward breadth and repeated work; eighteen XP levels keep progression visible.

Ten authored NPCs include seated office workers, walking citizens, a dispatcher and supplier.
Six server-controlled cars obey phased traffic lights and yield to players. The district
has continued terrain, distant buildings, road portals and optional procedural ambience.
Three small objects can be reserved, carried slowly and safely placed; cars and racks are
heavy. The office door cannot close over a player, object or installed cable. Training
and camera cable missions validate route, length, anchors and connectors on the server.

## Data and deployment

Migrations 006/007 add company state, consumable defaults, account preferences and
one-use guest transfers. No profile or account is replaced. A transfer stores only a hash
of its random code, expires after five minutes and binds the original profile transactionally.
It transfers whitelisted controls/quality/tutorial preferences without putting a bearer in a URL.
Old origins are explicitly allowed only for transfer issuance; passwords require the HTTPS origin.

Set `NETCITY_ORIGIN` to the canonical HTTPS origin and `NETCITY_LEGACY_ORIGINS` privately
to the existing origins during the transition. Keep project name, DB volume, user, secret
and other services unchanged. Use a separate Compose project and database for staging.

Before production: build both images, stop only this game's server, create a fresh custom
dump and config archive, restore the dump into an isolated database and compare every
pre-existing row. Keep an off-host protected copy. Verify additive migration preserves old
profile columns, then start the new images and test HTTPS, WSS, two clients and persistence.

## Compatible rollback

The old pre-account production image is unsafe after guest binding: do not start it.
Archive commit `8301557494af8bbf22f2599cf078b5b058a0c4d5` into an isolated build directory,
run `node deploy/prepare-auth-rollback.mjs <directory>` from this release, and build/tag
both maintenance images. Validate them against a restored schema-7 database, with an
account, a bound guest, new inventory keys and an advanced case. The guard blocks game
mutations while account login, logout and recovery remain available. Keep migration 007
and all DB volumes. Switch only server/client image tags to these verified maintenance
images; a database restore is a separate recovery operation because it discards newer play.

Windows/Edge automation and software-rendered FPS are not physical phone benchmarks.
Cars are ambient traffic, not player-drivable vehicles. Carried objects use authoritative
kinematic constraints rather than a general rigid-body simulation.
