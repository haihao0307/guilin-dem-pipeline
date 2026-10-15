# Hong Kong main map R03: source-supported Kowloon ground increment

Independent next case, preserving the accepted R01 and tested R02. R03 reuses the exact R02 shared exterior terrain/ocean/projection, historical building recipes, datum chain and constrained railway. Only the local CEDD terrain overlay and its conservative visible-object gate are new. No texture claim: this batch is still grey/untextured.

## Scene scope

- 713 date+datum-qualified recipe parts remain in the R02 shared archive.
- 642 current default candidates: original219 + new423. The new423 are within492 full-bbox CEDD coverage candidates, after withholding69 raised Tower parts whose supporting complex has not been established.
- Two further shoreline components are withheld: B379011982502063C0 touches the protected old shore; B351721767201063C0 (Pacific Club) is not supported by valid old2m land nodes. No filling the sea or moving the buildings.
- The69 Tower flags are centre/bbox diagnostics, not proof of absent foundations. Two same-GeoRef podium candidates have unknown individual dates and are not borrowed into the historical scene. The other67 have no accepted support relation in this set. Full per-foundation contact and historical appearance remain unverified.
- Unknown/1997-boundary/late objects retain the strict earlier-than1997 gate, independent of support coverage. Original authored stations/route remain a separate game-design layer.

## CEDD terrain

Four legal2m-node rectangles,114,384 nodes;4 Float64 hierarchical coefficient gzip blocks434,373B, with shared runtime reconstructing exact Float32 display nodes. CEDD LiDAR DTM2020, acquisition2019-12-20 to2020-02-02, native0.5m. The source HKPD→EGM2008_model conversion uses the existing verified control domain only.

Old2m details/story areas and old shoreline take priority. Old source arrays remain unchanged. The new rectangles do not overlap old detail rectangles. They are appended after old details; far views explicitly fall back to the same2m level rather than inventing a5m field.

The old30m background triangles are precisely clipped from the new rectangles. Outside fragments retain their old triangle planes and interpolated attributes. The new source floor is not feathered upward toward the old DSM. New/old boundary difference reaches28.644m: the source height discontinuity remains. An explicitly synthetic vertical display seam now connects the two unchanged edge heights to prevent a hole exposing the sky. It is a rendering closure, not measured ground, a retaining wall or a foundation, and it does not change floor queries. Edge segments are split at both source grids and triangle diagonals. No inward feathering or source-height adjustment is applied.

## Interfaces and testing

- HKMainCityNext.focusKowloonCombined(): old and new Kowloon context
- HKMainCityNext.focusNewKowloon(): all new rectangles
- HKMainCityNext.focusNewGroundClose(): close source-ground/building inspection
- HKCEDDTerrain.sampleHeight(E,N), boundsCovered(bbox), stats()
- HKCityBuildings.stats().agePolicy.submittedObjects: actual submitted IDs/date/source
- HKCityBuildings.stats().groundPolicy:642 default IDs and71 offscene IDs/reasons
- node terrain/install.test.mjs: source decode, conservative gate, old-detail protection and actual patched-host syntax
- node --test terrain/clip-background-rects.test.cjs:20 tests including600 randomized clips
- node terrain/validate-clip-host.cjs: actual old1458866-triangle background, area and unchanged-source/floor verification

CPU checks passed. Actual two-view browser inspection is required before public acceptance, especially raw terrain boundaries and remaining partial-building shapes. R02's final label correction is a required fixed dependency; geographic labels stay at the same-frame projected point and collisions hide lower-priority labels.
