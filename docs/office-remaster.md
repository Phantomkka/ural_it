# Office remaster

Every playable building has a 20 × 12 metre ground-floor envelope. The original service origins, client positions, entrance doors and saved project task coordinates are retained; the extra space extends behind the old rooms. The IT office has two accessible floors and the other nine buildings have three. Upper floors have real server collision boundaries and shared authoritative floor state, not camera-only scenery.

Use **Офис / этажи** in the tablet or interact with a lift panel. Lifts are in the rear wing, near X ±24 and Z = building centre + 1.8. Approach the panel and put down freight before travelling. Other players see the correct floor/elevation. Rejoining starts at the normal street spawn; account, mission and economy progress are unchanged.

The new interiors include furnished work areas, glass meeting rooms, storage/copy areas, lamps and plants. Workstations use the reviewed Kenney CC0 furniture/computer models; rounded printers, telephones, computer towers and small surface/display textures are authored in project code. Only same-origin resources are loaded. The eleven new model files add approximately 126 KB and preserve the existing model budget. Model provenance is in ASSETS_LICENSES.md and the asset manifest.

Street-level personal and crew jobs remain on the first floor. The server rejects upper-floor access to their equipment and validates lift range, target building, floor number, freight state, session authorization and rate limits. Floor state is transient; no database migration or account replacement is introduced.

Furniture layers are enabled for nearby/current floors, models and hardware reuse geometry/materials, and textures are shared per scene. Missing models retain usable authored fallback hardware and the normal degraded-graphics notice. Real-device performance remains separate from desktop viewport emulation.
