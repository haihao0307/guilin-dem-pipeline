# R03 real-browser evidence candidate

This folder is a prepared QA deliverable, not a browser pass and not a publication.
No runtime source or connector/repository state was modified to prepare it.

## Files and destination

Place the folder's contents in the candidate checkout at
`kaopu-unified-human-workbench/tests/boxing-r03/`. The workflow template is intended
for `.github/workflows/human-boxing-r03-qa.yml` on the existing authorized QA branch.
Only the coordinating task may decide whether/when to copy or publish those files.

- `boxing-r03-browser.cjs`: real Playwright Chromium and SwiftShader checks.
- `assertions.cjs`, `assertions.test.cjs`: strict QA assertions and two small tests.
  Synthetic unit fixtures only test the assertion helper; they never enter the app.
- `r02-preservation-baseline.json`: hashes captured from the prior R02 workbench.
  Protects the original shape pipeline, source assets, presets, CSR skinning,
  R01/R02 boxing entry points, R02 ring and glove geometry. Do not rebase this onto
  the changed candidate simply to make a mismatch disappear.
- `prepare-manifests.cjs`: freezes candidate bytes and checks the numeric replay
  against the exact MotionPrograms/MotionR03/MotionRange source hashes.
- `qa-workflow.yml`: contents-read-only Actions workflow. No secrets, publishing,
  credentials persistence, package lifecycle scripts or permission expansion.

## Finalize only after runtime and numeric evidence are stable

From the workspace root:

```sh
node human-boxing-r03-20261009/qa-tools/prepare-manifests.cjs \
  --workbench human-boxing-r03-20261009/workbench \
  --replay human-boxing-r03-20261009/motion/reports/WORST-POSE-REPLAY.json
```

This creates `candidate-source-manifest.json` and copies
`WORST-POSE-REPLAY.json` into this folder. A missing inventory loader or a stale
numeric replay is an error, not a reason to relax its source gate. If motion source
changes, regenerate/revalidate the corresponding numeric evidence before freezing
again. The first-time baseline command was already run with the R02 directory.

The frozen candidate manifest is checked against both the checkout and actual
HTTP-served bytes. The protected R02 hashes are checked separately. The candidate
inventory must still say `validationOnly: true`, `canPublish: false`, 18 programs,
and 1,296 measured character/role bindings. Passing browser mechanics does not
pretend that visual reviews or production approval have happened.

## What it measures

- Real load, immediate real cancellation, complete cleanup, retry; no response mock
- 36 full people, 25,417 vertices / 50,624 triangles each, complete CSR weights;
  36 distinct native-rest and shape hashes; all remain visible and unscaled
- 18 complete R02 rings; preserved gloves, ropes, corner equipment and old entry
- 18 structurally distinct authored programs and all 18 same-program comparisons
- 18-round programme distribution to every body pair and round-19 role exchange
- 1.14 / 1 / 0.55 shared-clock tempo; equal-time full-bone pose comparison;
  deterministic results independent of render chunking; invalid-step rejection
- Actual Jolt queries/events, provenance/TOI/normal/age/response-policy gates;
  complete adult-contact cycles in bounded rounds 0/6/12 until a real body response
  occurs, and the actual triggering round's response-on/off pose difference
- Measured response bounds sampled each 30 physical steps, not a claim that each
  integration step was visually measured; the response integrator tests remain
  separate evidence
- Real controls, pause/restart, side/front/rear views, skeleton/proxy overlays,
  ropes, comparison and round selection
- Paused resize redraw/pixel checks at 390×844, 768×1024 and 1600×1050;
  responsive viewport evidence, not physical-mobile-device performance
- 18 readable per-program adult pair screenshots (each program's authored first
  attack peak), full-body comparison view, child plus tallest/widest-adult side
  and rear views, and both globally worst elbow windows from numeric evidence
- Actual old R02 navigation and 72 original presets / 36 default visible entries
- Console/runtime/shader/network errors, frozen-source integrity and unchanged
  live neutral geometry/state/full CSR buffer hashes after all checks

Failure gates are strict. The progressively written `report.json`, screenshot and
workflow artifact remain available when a stage fails. A failure stops dependent
stages; their absence is not a pass. Automated pose and image capture does not
judge artistic quality, garment quality or learned research equivalence.

## Continuous video, explicitly offline

By default a full 16 canonical-second adult cycle is captured at 12 output FPS,
with ten real 1/120-second physical simulation steps between every frame. Each
worst-elbow window also gets a 24 FPS continuous clip using five fixed steps/frame.
The primary cycle uses 1.14× tempo; worst numeric windows use 1× and safe mode to
match base choreography. All 36 people stay active, including off-camera actors.

Every video burns in `OFFLINE FIXED-STEP REPLAY - NOT REALTIME` and has a JSON
frame-by-frame canonical/physical/step/event timeline. This measures deterministic
continuous playback, never real-time throughput. Raw PNG sequences for the two
worst windows are retained; the encoded full-cycle staging PNGs are deleted only
after successful ffmpeg encoding to bound disk use. The 18 per-program full-size
screenshots are always retained.

## Actions run

The template checks out only the three required workbench directories and uses
`persist-credentials: false` with `permissions: contents: read`. It installs pinned
Playwright 1.57.0 and official `jolt-physics@1.1.0` with `--ignore-scripts`, installs
real Chromium, and uses Ubuntu's ffmpeg. The runtime itself still fetches and
SHA-256-verifies the official Jolt browser WASM module. No mock Jolt is substituted.

Optional environment controls:

- `BOXING_R03_WORKBENCH`: candidate workbench on disk
- `BOXING_R03_BASE`: HTTP URL to that exact candidate workbench
- `BOXING_R03_OUT`: output folder
- `BOXING_R03_VIDEO=0`: deliberate first diagnostic run without encoded video;
  this cannot count as completing requested continuous video evidence
- `BOXING_R03_PHASE=video`: rerun only source/load/full-character and video checks
  after a full functional run; this is explicitly recorded as a partial run

The local environment cannot provide the requested real-browser evidence because
of its browser-socket restriction. Preparation ran syntax checks and the small
assertion unit tests only, plus read-only source/preservation comparisons.
Actual Chromium outcomes must come from the Actions artifact and its exact commit.
