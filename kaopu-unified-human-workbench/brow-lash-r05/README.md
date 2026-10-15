# BROW-LASH-R05 — dense procedural follicle eyebrows

This increment continues from the fixed BROW-LASH-R04 public build and does not modify or replace R04. It adds an isolated eyebrow-fiber layer on the same complete R06 character.

## What changed

- Generates dense individual eyebrow fibers from the retained R04 root-bearing skin range.
- Binds every root and full curve to exact skin-triangle barycentrics and local frames.
- Adds ten independently authored eyebrow families.
- Adds primary and advanced controls for density, silhouette selection, regional fullness, flow, strand dimensions, grouping, vellus hairs, material and asymmetry.
- Keeps the original 65% native blink endpoint and R04 center-long eyelashes.
- Keeps the prior complete person, eyes, skin, lips, ears and lighting.

## What did not enter the repository

No MakeHuman eyebrow mesh or image, no Perm model/checkpoint/root file/strand data, no Digital Salon code/data/head mesh, and no external eyebrow texture or coordinates. GitHub references are documented in `RESEARCH.md` only as method and category study.

## Runtime contract

The R04 preview is the immutable host. `build.cjs` verifies its SHA-256 and appends one new plain JavaScript module. All pre-existing executable script hashes must remain unchanged. R05 exposes `window.browLashR05` and replaces the convenience alias `window.browLash` only after R04 is ready; the original API remains at `window.browLashR04`.

## Acceptance gate

The candidate must prove in a real browser that:

- the default has more than 1,750 roots and more than 850 on each side;
- all ten presets create bilateral eyebrows and visibly distinct parameter recipes;
- root points remain within 0.04 mm of their bound triangle center;
- blinking reaches no more than native 0.65 and does not regenerate follicles;
- no external eyebrow asset flags are present;
- the original character and center-long eyelashes remain;
- no page, shader, console or request errors occur.

This remains a visual-review candidate. `userVisualAccepted` and `filmQualityAccepted` stay false until the user approves the rendered eyebrows.
