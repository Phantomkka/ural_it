# NETCITY 3.1 open beta

The beta adds a playable district campaign to the existing account, tablet and economy systems.

- Ten buildings have accessible ground floors. Nine new interiors include customers and four service stations each; the existing office and its original terminals remain available.
- Exterior doors and the server-room door are authoritative shared room state. Remote commands, rapid toggles and closing over players, carried objects or visible cable are rejected.
- The tablet offers 44 missions across 12 repair families. The original eight calls remain compatible with saved progress; 36 district missions add different sites, radio channels, backup files, voice VLANs and PBX addresses.
- DHCP pool repair, DNS record repair, safe UPS battery replacement and snapshot/offline/rebuild SSD repair have separate server-checked workflows. Storage rebuild checkpoints survive reconnects.
- Two new company laboratories and three additional contracts extend progression. Contract diversity counts repair families, not repeated variants. New battery/SSD inventory defaults are migration 008; original inventory keys, balances, accounts, sessions and active cases are retained.
- The GPS routes through actual entrances and the central crossing. Phones have the same mission catalog, filters, dialogues and controls.

## Playing

Open the tablet → **Работы района**. Filter by building or repair family and request a call. Accept it, follow GPS, open the door with E / touch interaction, and speak to the customer. Read at least two clues before diagnosis. Some jobs require company equipment bought at the supplier. Complete repair-specific tests, then return for customer signoff. A job cannot be replaced after its advance has been paid.

Ground floors are playable; upper floors are scenery. Cars are ambient traffic. The beta designation does not claim zero defects or certification on physical phones. New geometry, authority and lifecycle regressions accompany the release.

## Safe rollout

Use an isolated staging project and database. Before production, stop only the game server, create a fresh private custom-format dump and configuration archive, restore the dump into an isolated database, and compare every original row. Migration 008 adds two zero-count inventory defaults without replacing old fields. Compare all original fields again before starting the new server. Preserve the same PostgreSQL volume, secrets, project name and account-compatible maintenance images.

Do not roll back to the old pre-account application or restore an old database as an ordinary application rollback. The protected maintenance command retained on the server keeps the current database and blocks gameplay mutations while allowing account access. Database exports are not part of deployment authorization and are not performed without explicit approval.
