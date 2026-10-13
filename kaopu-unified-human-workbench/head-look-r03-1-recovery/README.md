# HUMAN-LOCAL-FEATURES-R03.1

Recovery of interrupted PR258, from 7dc53a7812d1edca0473fa12b848a919448c8ad4. User baseline is head-look-r02-native at e468c26bd2baddd8cd7b35b066e44f4e5c92dc9b.

Keep the original overall skin, character, body, rig, eyes, lip geometry and native idle. Continue lip colour/vermilion blending and inner wetness, landmark-bound orbital local texture/tint, ear regional pigment and bounded transmission, neutral illumination/soft-edge shadows/leak guards. Restoring skin never canceled these tasks. No rejected R01 whole-face material, reference model or reference texture is imported.

Camera-only views now avoid no-op model/geometry resets. QA retains actual trusted pointer clicks, all four comparisons, protected albedo pixels, expression/idle and versioned archive checks. Existing source and frozen pages are not changed.

Exact public browser verification passed; see DELIVERY.json, PUBLIC_QA.json and qa/public. Visual acceptance remains with the user. Keep Draft. This is not user visual acceptance or photorealistic equivalence. Ear transmission is thickness-estimated; PCF is not contact-hardening or area-light path tracing. Original shape limitations remain. Native person load and idle calibration remain costs. Physical phone, Safari, Vision Pro and consumer GPU FPS are not certified.

## Lip support correction

Run38393379283 passed all 7 smoke checks and real public controls but stopped at strict lip ownership: 2 old-border pixels differed by 2/255 just outside the new mask. The diagnostic now uses the exact union of original and revised feather support, because removing old lip pigment is itself a lip edit. Colour/roughness/normal behaviour is unchanged by this fix, and the protected-skin test remains zero changed pixels outside that explicit anatomical union (one-byte quantization tolerance only).

## Fixed verified entry

https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/91b1dd7cf402294a26051abe051696b2848207af/kaopu-unified-human-workbench/head-look-r03-1-recovery/preview.html

Source 11c8016f4478afc1480bf5a45e935aa34dd41996

Build 91b1dd7cf402294a26051abe051696b2848207af
