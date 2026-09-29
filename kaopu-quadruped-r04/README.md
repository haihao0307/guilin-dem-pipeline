# KAOPU Quadruped Instrument R04

R04 is the correction of the K3 preset-selection architecture.

The pure instrument contains no animal identity, example score, player UI, camera or finished object. It only implements a bounded bilateral-quadruped framework:

- continuous body field from score-supplied control volumes;
- mirrored front and hind limb chains;
- optional tail;
- score-supplied symmetric and central details;
- optional generic fibre cover and cap surface;
- score-supplied materials;
- deterministic replay and actual-output fingerprinting.

The score owns the specific body proportions, locations, radii, material values, cover parameters and random seed.

## Deliverables

```text
index.html                         interactive audit workbench
KAOPU_QUADRUPED_PLAYER.html        empty offline player; contains no scores
KAOPU_QUADRUPED_K4.js              pure one-file instrument
KAOPU_POLAR_BEAR_K4.score          external score data
KAOPU_TORTOISE_K4.score            external score data
KAOPU_NEUTRAL_QUADRUPED_K4.score   unseen neutral proof score
```

## Hard boundary tests

- instrument source contains no identity names or B/E/T selector;
- an empty player produces no object before a score is supplied;
- the same pure instrument plays all external scores;
- editing score control data changes actual output without changing instrument code;
- identical score + identical instrument version replays byte-identical geometry;
- standalone and public versions require no external runtime assets.

## Status

This is an architecture and framework proof. It is not a visual approval of any species and does not infer unseen photographic surfaces as fact.
