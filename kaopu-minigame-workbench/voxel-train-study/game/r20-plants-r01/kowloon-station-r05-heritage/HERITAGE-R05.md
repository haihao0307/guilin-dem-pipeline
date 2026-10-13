# Kowloon heritage R05, independent architectural candidate

The retained R04 and driving entries remain unchanged. This candidate is not a historical facsimile and has not yet passed whole-game visual or interactive-performance acceptance.

## Evidence and decisions

Reference: [Antiquities and Monuments Office, Clock Tower pamphlet, © 2024](https://www.amo.gov.hk/filemanager/amo/common/download-area/pamphlet/clock_tower.pdf). Page 3 reproduces 1977 tower elevation/section and terminal west elevation. Page 5 describes and photographs the tower fabric. Page 7 credits measured drawings to HKU Architecture. Reference images/scans are not included in this repository.

Observed architectural facts used: red brick and granite, square main shaft, octagonal upper stages, concrete dome, timber rectangular windows and pediment surrounds. R05 replaces the old four-corner open belfry and copper-labelled shell accordingly. The hall's giant-order reading is strengthened using actual layered pilaster returns and retained source construction.

Authored interpretation: all new member dimensions, exact window levels, octagonal profiles, the hall's added 54 profile members, conservation colour/maintenance parameters and exposure response. Existing hall 60 × 16 m plan remains a design assumption. The four-column entrance and old cream dial are preserved authored choices, not claims of a specific period reconstruction. Current clock glazing is not used as evidence of 1970 appearance.

Unresolved: official 44 m tower height versus 7 m rod datum. R05 keeps the existing approximate vertical envelope and marks its short visible support provisional; it does not claim a 51 m total or a recovered 7 m mast. Detailed survey dimensions, hall depth, glass transport and period clock construction remain unverified. The granite-coloured conservation binding still uses the inherited generic stone surface mother; its mineralogy has not been calibrated as granite.

## Function/material construction

The six source mother modules remain byte-identical to SOURCE_LOCK.json. Conservation is confined to tower and above-ground hall members. The shared station age, ground, platform, site, road and quay recipes stay unchanged. Brick relief, stone relief, timber grain and metal weathering still come from their respective original mothers. Rain paths and sheltered cornice bands modulate small amounts of retained patina; no uniform black-grunge overlay is added.

The dome is a finite 160 mm authored concrete shell, with new material ID 19. It cannot trigger the ID 17 ground/floor acceleration path. Window apertures are actual voids in the brick solid; timber frame members have local grain coordinates. No opaque window decal substitutes for missing glass transport.

## Review scope

qa/inspection-scope.mjs provides tower-only and hall-only diagnostic views by copying their complete construction blocks without changing their geometry or material functions. These views omit the other station buildings and their shadows, and cannot establish whole-station integration or frame rate. Without a scope parameter the entry retains the complete station field. Unresolved rays stay explicit failures.

Checks: source/mother locks, geometry and floor bounds, original component retention, WGSL lexical/signed-number checks, new heritage contracts, actual WebGPU compilation and rendered view readback. CPU checks alone are not visual approval. See CI artifacts and the current review receipt for performed versus pending checks.
