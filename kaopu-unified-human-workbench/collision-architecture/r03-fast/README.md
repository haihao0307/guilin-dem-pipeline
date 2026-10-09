# 精确分层加速验证 · R03 Fast

This is a separate local browser candidate. It is **not connected to the 18-arena real-time controller**. The [R02 accuracy reference](../r02/) and its [geometry/numerical contract](../r02/README.md) remain unchanged. The earlier `collision-fast/` experiment and its frozen measurements also remain intact.

## What this page verifies

- Real existing presets 16, 12 and 35: rounded adult, short/slim young adult, sturdy senior. No rule-generated mock body is used.
- Actual existing motion poses 0, 0.55 and 1.10 canonical seconds.
- Complete 25,417-vertex human, full CSR weights and 40,120 skin triangles. The display retains its existing 50,624 triangles.
- Actual 770-triangle left and right gloves, including their articulated cuffs updated from each actual pose.
- On the **same input snapshots**, compare the full oracle/fast `hit` object, including points, normals, barycentrics, relative displacement, triangle IDs, TOI and region; also compare `trianglePairs` and `unresolved`. Nonfinite hit numbers fail.
- Cold and warm body/guard queries. Cold totals include fresh glove preparation and, for guard, hierarchy construction/refit. Warm fast queries reuse the same immutable prepared snapshots/hierarchy. R02 has independent body caches but its public API reconstructs glove arrays each call. The UI exposes this cache difference.

`Validation.mjs` is shared by the browser page and Node acceptance test. It reproduces R02's actual head-front 0.6 m reference sweep, then isolates a 10 mm translation around the measured first contact for body and guard separately. Long reference-sweep construction is timed separately; it is not hidden inside a short-query latency. Each target pose stays static in this page fixture. Separate existing numerical evidence covers moving targets, cuff refits, near misses and unresolved cases.

## Local acceptance

From the existing workbench checkout, with its existing pinned assets available:

```sh
node --max-old-space-size=640 --expose-gc collision-architecture/r03-fast/tests/actual-fixtures.mjs
```

The test writes `tests/NODE-VALIDATION.json` (the published evidence copy is losslessly compressed as `tests/NODE-VALIDATION.json.gz`): 3 real bodies × 3 actual poses × body/guard × cold/warm = 36 exact result comparisons. It uses the existing `full/boxing/tests/load-model.mjs` pinned asset loader and does not copy or republish model data. `FAST_PRESET=16`, `12`, or `35` can run one body when executor memory requires separate processes; report only the cases actually completed.

The browser check requires an HTTP-served copy of this candidate beside the existing workbench dependencies and an installed Playwright browser:

```sh
FAST_SURFACE_URL=http://127.0.0.1:8765/collision-architecture/r03-fast/ \
FAST_QA_OUT=collision-architecture/r03-fast/tests/browser-results \
node collision-architecture/r03-fast/tests/browser.cjs
```

Set `CHROMIUM_PATH` only when the executor uses an existing explicit Chromium binary. The script verifies all nine real fixtures, repeated validation and reset. It writes exactly two requested screenshots, `overview.png` and `contact.png`, plus `BROWSER-VALIDATION.json`. Failure writes `BROWSER-FAILURE.json`; failed/incomplete browser work must not be reported as passed. Screenshot files are evidence only after a real browser run has produced them.

## Runtime modules

`SurfaceNarrowPhase.mjs` uses conservative analytic full-CSR bounds. `MeshSurfaceContact.mjs` filters attackers through body nodes, caches invariant work, and refits guard BVH bounds from all actual endpoint vertices. Guard candidates return to original triangle ID order before CCD. Both import the exact immutable solver from `../r02/`; relocation imports have been adapted for this directory.

`FixedStepCollisionWorld.mjs` is provided for later controller integration. Its required `sampleTime` is **physical simulation seconds**, normally incrementing by `1/120`. At playback speed 1.14, the motion's canonical increment is `0.0095`; optional `canonicalTime` is metadata only. The API rejects skipped/reversed/variable physical intervals and replaced geometry identities/revisions. In-place geometry edits require a caller revision bump, a rebuilt surface and a reset. The diagnostic page does not connect this world to the boxing controller.

Snapshots and their arrays must remain immutable while prepared data is reused. No mesh simplification, omitted CSR influence, frozen cuff, lower iteration budget or unresolved-to-miss conversion is introduced. The original 20 μm tolerance, linear endpoint-vertex trajectory and explicit unresolved limits still apply.

## Packaging and release boundary

Only files within this directory are new candidate source, tests and owned numerical evidence. `PACKAGE-MANIFEST.json` lists that bounded deliverable. Dependencies are referenced in place: the existing sibling R02 oracle and the existing workbench loader, human, motion, Three.js and glove modules. No full-project dependency manifest or model binary is copied here.

Node checks do not substitute for browser screenshots or browser timings. A real browser run is still required before calling this browser candidate verified. Even a successful isolated browser run does not certify simultaneous 18-arena contacts, Jolt integration, physical response, whole-body dynamics or cloth collision. No external upload, CI configuration or publication is performed by this preparation.
