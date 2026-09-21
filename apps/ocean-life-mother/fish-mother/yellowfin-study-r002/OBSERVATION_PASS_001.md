# Yellowfin Study — Observation Pass 001

Date: 2026-09-21

This pass records only what is supported by the locked FISH-REF-002 visual reference and non-Chinese species authorities. It does not generate a new fish.

## Source model observations

The locked source model visibly carries the following features that must be preserved before any attempt to improve it:

- elongated fusiform body with a strongly tapered caudal peduncle;
- metallic blue dorsal field and lighter silver/yellow lateral-to-ventral field;
- a distinct yellow lateral stripe;
- an elongated yellow second dorsal fin;
- an elongated yellow anal fin;
- repeated small finlets between the rear dorsal/anal fins and the caudal peduncle;
- pale vertical/dotted ventrolateral markings;
- a deeply forked/lunate caudal fin;
- long lateral pectoral fin;
- separate visible cornea/eye treatment;
- a pronounced cheek/opercular surface transition rather than a flat painted line.

These source features agree in broad identity with Yellowfin tuna diagnostics, but their exact dimensions still require direct measurement in the 3D viewer.

## Authority cross-check

NOAA identifies Yellowfin tuna as torpedo-shaped, metallic dark blue dorsally, yellow-to-silver ventrally, with bright-yellow dorsal/anal fins and finlets, plus a yellow lateral stripe.

IATTC identifies Thunnus albacares and distinguishes it from bigeye and Pacific bluefin using pectoral reach, ventral dot/line pattern and body compression.

Schaefer (IATTC, 1999) shows that diagnostic proportions change with fork length:
- 30–45 cm: lateral markings are especially diagnostic;
- 46–110 cm: pectoral-fin reach is especially useful;
- >110 cm: second dorsal and anal fin lengths become especially diagnostic.

Therefore Source Copy R001 must not hard-code adult elongated-fin proportions until the source model's apparent size class is estimated.

## Material facts already recovered from the exact source GLB audit

Source material inventory:
- Material: opaque, double-sided, base color + metallic/roughness + normal + occlusion textures;
- Material.003: opaque, double-sided, base color + metallic/roughness + normal;
- Material.004: transparent blend material, very low base alpha, consistent with the separate cornea layer.

The copy therefore must not collapse body, fin/eye regions and cornea into one generic plastic shader.

## Motion facts already recovered

The source contains one Swim clip:
- duration 2.166666746 s;
- 291 channels;
- 97 animated nodes;
- 68 significant rotation channels;
- 4 significant translation channels;
- no meaningful scale animation.

This is an authored reference to study, not yet natural-motion truth.

## Copy requirements frozen by this pass

YELLOWFIN-SOURCE-COPY-R001 may start only after the following are measured in the 3D study workbench:

1. source body silhouette in left/right/head/tail/top/3-quarter views;
2. source eye diameter and position relative to head length;
3. upper/lower jaw endpoints and mouth corner;
4. cheek/operculum free-edge relation;
5. every major fin root start/end;
6. second dorsal and anal free-edge lengths relative to source body length;
7. dorsal and ventral finlet counts, spacing and tilt;
8. caudal peduncle minimum height/width and keel positions;
9. pectoral tip reach relative to second dorsal base;
10. source color/material boundaries.

No creative modifications are allowed in Source Copy R001.
