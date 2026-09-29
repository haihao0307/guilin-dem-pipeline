# KAOPU Quadruped R05 — Frozen Instrument / New Wolf Score

R05 performs the next falsifiable test after R04:

> Keep the K4 quadruped instrument byte-for-byte unchanged, add one previously unseen real-animal score, and verify that the new result is produced only from score data.

## Frozen boundary

- `../kaopu-quadruped-r04/src/instrument.js` is imported directly as the frozen verified R04 source; R05 has no private instrument copy.
- The built `KAOPU_QUADRUPED_K4.js` must retain the R04 SHA-256:
  `e0f6c35710561dad66e8ffbc748fc28d2bac61a6771549eb89611db165669435`.
- The new animal name and its control data may occur in `src/scores.js`, documentation, tests and the workbench, but must not occur in the instrument.
- The empty player must still start with no animal and no score presets.

## New external score

R05 adds a gray-wolf score. The score owns:

- material colors and roughness;
- torso, shoulder, haunch, neck, skull and muzzle control volumes;
- one front-limb chain and one hind-limb chain, mirrored by the instrument;
- tail chain;
- paired ears, eyes and pupils;
- central nose detail;
- deterministic fibre-cover parameters.

The score is an approximate reference-constrained test, not a visually approved zoological reconstruction.

## Evidence limits

Public measurements were used only to keep overall scale plausible. A single generic score cannot prove exact sex, subspecies, age, pose, hidden anatomy or pelage pattern. R05 tests the score/instrument boundary and the current expressive range of K4; it does not claim production-ready animal quality.

## Gates

- [x] Instrument identity presets remain zero.
- [x] K4 instrument source is unchanged from R04.
- [x] R04 built instrument SHA-256 is frozen as a CI gate.
- [x] New gray-wolf information is outside the instrument.
- [x] Same frozen instrument replays R04 baseline scores and the R05 wolf score.
- [ ] Public fixed URL and browser evidence are valid only after CI writes an exact-head proof.
- [ ] Visual acceptance remains pending the user's review.
