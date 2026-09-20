# Original Fish R05 — first measured size-slider segment

Date: 2026-09-20

This increment implements the first scientifically measured game-visible size segment for Amphiprion ocellaris.

Primary source:
P. K. Raheem et al., Indian Journal of Fisheries, hatchery-reared black Amphiprion ocellaris. Table 2 reports TL, SL, head length, head width, body width and eye diameter across development.

Following the current game-production boundary, all anchors below 20 mm TL are ignored here.

Retained measured anchors:
- 50 dph: 20.82 mm TL
- 60 dph: 23.69 mm TL
- 70 dph: 26.22 mm TL
- 80 dph: 28.32 mm TL
- 90 dph: 31.84 mm TL
- 100 dph: 34.50 mm TL

For each anchor the profile stores:
- standard length
- head length
- source-labelled head width
- source-labelled body width
- eye diameter

The size slider is evidence-bounded:
- exact measured anchor -> FIXED_MEASURED
- between two retained measured anchors -> MEASURED_INTERPOLATION
- outside 20.82–34.50 mm -> UNSUPPORTED_OUTSIDE_MEASURED_RANGE

Important result:
the proportions are not treated as uniform scale. Head width / TL, body width / TL and eye diameter / TL change through the measured series, so the Original Fish core now has a real example of size-dependent proportional change.

Measurement-semantics boundary:
the accessible paper text clearly labels two scalar columns as Head width and Body width, but the exact axis and anatomical station are not defined clearly enough in the currently accessible methods text. Therefore R05 preserves those numbers under their source labels and may interpolate them within this one source series, but it does NOT reinterpret them as a top-view width curve or a complete cross-section. full3D remains false.

Cross-source boundary:
this black-morph hatchery series is NOT directly blended into the separate 71 mm FishBase A. ocellaris card. That bridge remains CANDIDATE_NEEDS_CALIBRATION_NOT_INTERPOLATABLE_YET.

Still missing:
- full dorsal/ventral side outline by size
- validated width distribution along body u
- cross-section shape along body u
- exact fin origins/bases
- skeleton landmarks
- explicit measurement definition for the source head-width/body-width labels

QA:
- local Node regression: 12 assertions passed
- verifies exact anchors, bounded interpolation, changing proportions and refusal of cross-source extrapolation
