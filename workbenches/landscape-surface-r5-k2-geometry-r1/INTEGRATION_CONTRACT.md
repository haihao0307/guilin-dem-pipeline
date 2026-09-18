# Landscape Mother · R5.K2 + Microscope Real Geometry R1

Date: 2026-09-16

This branch integrates the independently verified Microscope real-geometry kernel into the accepted R5.K2 karst body without replacing the accepted macro form.

## Frozen macro identity

- accepted R5 macro commit: `039d3a7f32c73ff3ac292c5bbb18c3f6f5535b90`
- R5.K2 source commit: `e7e04ffab58d97edd4442443fcba682d3f2c9de5`
- source path: `workbenches/landscape-surface-r5-k2/index.html`
- source SHA-256: `919df1a9eff14a6d310d4aca93a2ccfcc9a59bb70a9b44b0bfe7d57aed335709`

The following must remain protected from the displacement pass:

1. peak top band;
2. peak-foot band;
3. the forward rim/surface band of the primary cave opening;
4. the forward rim/surface band of the secondary notch/opening;
5. topology/index order.

## Geometry contract

Reference geometry is immutable `P0 = main.rest`.

The candidate geometry is:

`P = P0 + n0 * A * M * (D_N - bias * max(D_N, 0)^2)`

where:

- `n0` is the R5.K2 pre-displacement vertex normal;
- `A` is a conservative metre-scale amplitude;
- `M` is a protection gate derived from height, slope and cave-mouth protection;
- `D_N` is a fixed-object-space multi-scale Microscope series;
- camera state does not affect geometry;
- time does not affect static rock geometry.

## Safety gate

The builder must compute and record:

- requested/effective displacement amplitude;
- max and RMS displacement;
- max normal-angle change;
- protected-vertex drift count;
- triangle flip count.

If triangle flips occur, amplitude is reduced deterministically until the topology gate passes. `P0` is never rewritten.

## Scope boundary

This pass is geometry integration only. R5.K3 living-karst water/mineral bookkeeping remains a later layer. The original SDF/collision field is not yet regenerated from the displaced surface, so this candidate is not production-ready until the geometry-field coupling is closed.
