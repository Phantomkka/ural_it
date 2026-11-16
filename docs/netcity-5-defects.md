# NETCITY 5.0 world defects

| Reproduction | Symptom and cause | Change | Regression |
| --- | --- | --- | --- |
| Main 6e344a1; building-2 first floor; X -22 facing west towards X -23, Z 0 | Two black rails and a fence post cross the room. Asset district retained an 80 m perimeter at X ±23 after offices expanded to ±28. | Shared clipped perimeter at ±31, service gate gaps, same physical footprints; no collision disabling. | worldGeometry: original defect, all 29 floor envelopes, gate clearance, clip edge cases; rendered vertex check. |
| Every lift landing, rear wing X ±24 / Z centre+1.8 | Only two incomplete sheets and a floor; no doors, ceiling or travel feedback. | Three shared walls, full cabin finish, framed opening, moving split doors, lit indicator and mobile controls. Timed authoritative travel with explicit transition. | All landing approach probes; two SDK clients verify timing, replication, frozen movement, freight/range/floor guards and correlated busy errors; actual office walk/travel E2E. |
| Side-facing exterior windows on every floor | The pane's long Z dimension was multiplied by .25 instead of reducing its X thickness. Large visible glazing gaps. | Preserve long dimension, reduce only wall thickness, ground and upper levels. | Built scene inspection and office visual walkthrough. |

Before/after evidence is local QA output, not player data. No production write or data migration belongs to this block. Larger transport, business and diagnostic features remain separate dependent PRs under Issue #30.
