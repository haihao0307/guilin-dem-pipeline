# KAOPU Mammal Instrument R06

R06 combines knowledge from two existing project lines without copying their finished objects into the runtime:

- **Cat Procedural Body V1 P1.5** contributes measured DNA, segmented torso proportions, fixed-length two-bone stance solving, elliptic limb carriers, paw/toe layout, pinna and muzzle parameters.
- **Bruce neutral-dog teacher intake** contributes a pinned teacher source, evidence/provenance discipline, and the rule that the teacher may be measured but may not survive as runtime geometry.

The resulting K5 instrument is constrained to **digitigrade mammals**. It is not a universal animal instrument and it does not include tortoise or bird logic.

## Correct score/instrument boundary

The instrument contains shared calculations only:

- fixed-length limb IK;
- continuous torso/head field;
- elliptic limb carriers;
- paw/toe fan;
- pinna sheet;
- coat pattern field;
- deterministic relief and vibrissae.

The score owns all object-specific values: dimensions, torso segmentation, head and muzzle proportions, joint angles, paw shape, tail, ears, materials and coat parameters.

The pure instrument contains zero identity presets and no example score. The empty player creates no animal until an external K5 score is imported.

## Files

- `KAOPU_MAMMAL_K5.js` — pure one-file browser instrument.
- `KAOPU_MAMMAL_PLAYER.html` — empty offline player.
- `KAOPU_GREY_TABBY_K5.score` — cat-project DNA translated into K5.
- `KAOPU_NEUTRAL_DOG_K5.score` — teacher-guided neutral dog score.
- `KAOPU_GRAY_WOLF_K5.score` — R05 wolf re-expressed through K5 shared operators.
- `KAOPU_UNSEEN_MAMMAL_K5.score` — boundary test composed after the instrument.

## Gates

- [x] No generated image substitutes for real interactive 3D.
- [x] Production source changed.
- [x] Runtime contains no external model or texture.
- [x] Pure instrument contains zero object identity preset.
- [x] Empty player starts with no animal.
- [ ] Visual acceptance remains pending until user inspection.
- [ ] Physical iPhone/Safari test remains pending.
