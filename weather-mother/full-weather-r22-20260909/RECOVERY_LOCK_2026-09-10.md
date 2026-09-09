# Weather Mother R22 recovery lock — 2026-09-10

This is the correct continuation line for the user's Sep 8–9 Weather Mother state.

## Frozen visual/interaction core

The user-tested R21 core remains authoritative for these four views:
- 银边积云 — preferred cloud appearance.
- 层叠云海 — accepted usable secondary cloud view.
- 原自由飞行 — preserved.
- 云中飞行 / 云间驾驶 — preserved through the R21 aircraft module.

R21 authoritative visual/flight commit:
`d6796df38a2cb872f58ff1f8ce72b5f36d8d2322`

## Latest full Weather Mother wrapper before recovery work

R22 authoritative commit:
`8aeb8dac519f8bda851cfc998e07266870d3eaef`

Page:
`weather-mother/full-weather-r22-20260909/index.html`

R22 was published on 2026-09-09 and restores the complete Weather Mother module entry while preserving R21 flight/cloud views. Its own CHANGES.md states that the R21 aircraft, silver/cloud-sea viewing and original free-flight module sources are kept byte-for-byte unchanged.

Restored Weather modules in R22:
- World
- Rain · Liquid
- Fog
- Snow
- Cloud
- Storm

Therefore R22 is the correct current continuation wrapper; R21 remains the frozen accepted visual/interaction core nested inside it.

## Do not confuse with later recovery experiments

Do not use the newly-created `feature/weather-mother-cloud-flight-r03` / `recovery/weather-mother-silver-cloud-flight-r03-20260910` experiment as the historical accepted baseline. It was created after the user correction and is not the Sep 8–9 accepted version.

## Technical constraint for next work

The accepted R21 cloud-flight view is still a hybrid representation: far cloudscape and nearby metric volume are not one continuous cloud-truth field. Preserving the accepted silver appearance does not prove that the entire visible cloudscape has continuous, georeferenced 3D density or full flight physics. Future changes must derive from R22 without overwriting R21/R22 and should reduce that far/near representation discontinuity before adding decorative features.

Public fixed R22 URL:
https://raw.githack.com/haihao0307/guilin-dem-pipeline/8aeb8dac519f8bda851cfc998e07266870d3eaef/weather-mother/full-weather-r22-20260909/index.html

Status: recovery baseline locked; productionReady remains false unless separately verified.
