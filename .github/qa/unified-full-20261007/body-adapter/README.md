# MHR → fixed canonical body: bounded QA adapter

R1 replaces the failed R0 torso/shoulder correspondence with a continuous offline neutral registration. The failed files and maps remain in `baseline-r0/`; detailed diagnosis and before/after evidence are in `REPAIR-R1.md`.

This is a real, executable **body adapter prototype**, not full GNM + Anny + MHR acceptance. It only writes the first 9,253 vertices of the fixed 25,417-vertex common person. It neither substitutes the MHR mesh nor modifies the parent's GNM head, neck repair, source data, production files, or QA branch.

The frozen public R01 mapped one identity axis. This local adapter is independent of that baseline. It evaluates every native MHR vector and transfers source effects through one driver-specific binding; numeric response is not reported as complete semantic coverage.

## Entry point and output

`createBodyAdapter()` in `load-adapter.mjs` loads the pinned restored teachers and the two compact mapping assets. `MHRBodyAdapter.mjs`, `TargetBinding.mjs`, `math.mjs`, and `MHRDetailedEngine.mjs` are browser-compatible modules; only this convenience loader and the generators use Node/Python.

Call `adapter.evaluate(mhrState, {rigOwner:'mhr', phenotypes, localChanges, targetRestVertices})`. The MHR state has the original 45 identity, 204 pose, 72 expression values, and boolean correctives flag. The 37 official locked slots and all native rig limits are enforced. MHR root translation inputs are native units, **not metres**: the pinned transform maps root_tx=1 to 10 cm. No source scalar is reinterpreted as an Anny control.

The result includes:

- `vertices`: 9,253 body vertices, in canonical order, metres Z-up
- `restVertices`: the current zero-pose Anny body in that same order
- `native`: unchanged full native evaluation, including rest, source joints and skin matrices
- `targetRestMatrices`, `targetPosedMatrices`, `skinMatrices`: 127 complete matrices
- `names`, `parents`, and `skinWeights`: complete CSR target weights; no truncation (currently up to six influences)
- `attachment`: rest, posed and skin frames, positions and world scale for c_spine3, c_neck, c_neck_twist1_proc and c_head
- `sourceBindMatrices`, `sourcePosedMatrices`, `targetBinding`, `inputState`, `targetShape`

All matrices are **row-major**, act on column vectors, and use metres/Z-up. The current Anny zero-pose `boneHeads`, not its template-space `restBoneHeads`, supplies the target pivots. The latter retains template root placement and would misplace this entire binding by about 16.75 cm.

For the reference adult, c_neck is approximately [0, 0.00519709, 0.58614415] and c_head [0, -0.03300208, 0.69517660] m. Both have world scale 1. Their rest-displacement scales are 1.16353443 and 1, respectively. These are **Anny-derived target pivots**, not GNM's deliberately different native pivots. Use the returned matrices, not these rounded numbers, for attachment.

Rig ownership is controlled by the parent. Saved MHR **204-channel pose/scale/translation and MLP** values are inactive when Anny owns articulation. The parent has specified that all 45 MHR identities remain shared shape state: it can extract their rest contribution with zero MHR pose, zero expression and correctives=false, then run the Anny skinning pass once. Calling the articulated adapter with rigOwner='anny' still throws; this guard does not change shared identity policy. See `CRANIAL-HOOK.md` for the separate joint-conditioned rest packet and final skin/posed matrix inputs. Parent-level ownership, mode-switch and archive tests remain required.

## Single construction route

1. Evaluate pinned Anny at the canonical reference phenotype and sample `canonical.annyRecipes` without changing order.
2. Convert MHR cm/Y-up to common metres/Z-up: (x, -z, y) / 100.
3. Build a semantic 127-joint target rest skeleton from the current Anny zero-pose joints. Primary limbs align proximal/distal directions. The palm uses wrist, index, middle and pinky landmarks. Procedural twist joints preserve their native segment fractions. Finger phalanges map to the corresponding Anny joints. Native-only proximal thumb/foot details use documented local frame offsets.
4. Initialize the source neutral surface for correspondence with every original influence. Correct spine/limb length scaling along the bone axis without erroneously inflating transverse radius. Fit a continuous source displacement field against the actual canonical torso/shoulder surface using symmetric source→target and target→source constraints plus a source-mesh Laplacian. An extended support band avoids pinning the moving collar to an artificially fixed neighbor. This is offline only; it does not replace the target body or smooth a posed result.
5. Find closest source triangles within compatible anatomical groups on that registered neutral surface. In particular, Anny metacarpals use the MHR wrist/palm region, not the distal phalange group. Store three source indices and barycentric weights per canonical body vertex. The mapping is fixed thereafter.
6. At runtime, recompute the target bind from the configured Anny rest shape. Apply the exact MHR local native Euler/scale/translation deltas to that target hierarchy. Local parameters are used directly rather than subtracting rounded global matrices, so an unchanged branch stays exact.
7. Evaluate native identity, expression and the complete nonlinear MLP **before skinning**. Transfer each source rest delta through **each original source influence**, the bone's rest-frame alignment and segment scale, then skin with that target posed frame. Only then barycentrically interpolate. Averaging rest deltas and skin weights first would introduce incorrect cross terms.

The base target Anny body receives the complete normalized interpolated source weights. At a zero rig pose, its base is copied exactly. All identity/expression/corrective changes are real source fields, not labels wired to invented offsets. No influence pruning, per-frame nearest-neighbor lookup, Poisson solve, or runtime optimization is used. The current CPU sample spans roughly 16–62 ms/evaluation including native inference and rebuilding Anny target rest; this is environment-dependent, not a browser frame-rate promise.

## Reproduce

From the enclosing `unified-full-20261007` directory:

```
node body-adapter/export-input.mjs
node body-adapter/export-bind.mjs
.venv/bin/python body-adapter/register-body.py
.venv/bin/python body-adapter/generate-mapping.py
node body-adapter/test-native-parity.mjs
node body-adapter/test-body.mjs
node body-adapter/check-kinematics.mjs
.venv/bin/python body-adapter/check-corrective-gold.py
node body-adapter/audit-body-channels.mjs
.venv/bin/python body-adapter/plot-neutral.py
.venv/bin/python body-adapter/render-evidence.py
```

The continuous registration takes about 16 seconds and the compact mapping extraction less than one second in this environment and uses NumPy, SciPy, Trimesh and Rtree from the already-restored environment. No additional teacher download or package installation is required. Generated raw test arrays are scratch files; the only mapping assets needed at runtime are `map-indices.u32` and `map-bary.f32` (222,072 bytes together).

## Focused evidence and boundaries

- The neutral canonical body is byte-identical to the current Anny-derived rest body. Restoring neutral is exact. Newborn (-1/3), baby (0), child (1/3), adult (2/3), old (1) and other configured rest shapes pass this neutral invariant. This does not validate extreme-age posed retarget quality.
- The instrumented native engine is byte-identical to the original restored teacher for the 11 focused cases, and its 342 original reference fixtures pass with maximum sampled error 0.000122071 cm. It only adds returned internal arrays; the model, weights and equations are unchanged.
- `corrective-gold-report.json` obtains the gold from **actual native same-pose MLP-on minus MLP-off vertices**, inverts the full native per-vertex blended skin linear map, transfers that observed rest delta and skins once. Six flexion/twist/shoulder/finger fixtures agree within 0.000378 mm. Treating the posed native difference as a rest delta is wrong by up to 18.525 mm in those same cases. This validates the coordinate convention, not anatomical correspondence quality.
- Simple elbow flexion keeps the target elbow pivot fixed and forearm length unchanged to numerical precision. Root translation and the posed snapshot export round trip pass in `kinematics-export-report.json`.
- `elbow-surface-evidence.png` shows the actual canonical arm surface from two views, not just a joint overlay. The focused 60°/90° elbow and elbow-plus-0.7-rad twist cases have no torn elbow edges in the inspection. The current exact fixture metrics are in `surface-quality-report.json`; the original R0 values remain under `baseline-r0/`. These are limited fixtures, not an all-pose acceptance claim.
- All 321 native scalar slots are audited in `body-channel-report.json`, including 37 official locks. All 45 identity and 167 unlocked rig slots have a measured body response at the audited values. Expression numerical responses can be tiny boundary/rounding effects; all 72 facial semantics still require the parent head adapter. **None of these counts establishes full coverage**, particularly for head expressions.

### Known quality limits, kept visible

**The two R0 failure fixtures are repaired, with a retained baseline.** Torso static correspondence improves from median 32.162 / p95 79.437 mm to median 0.581 / p95 2.467 mm (maximum 11.975 mm). These are actual neutral surface distances, not dynamic error or full-body acceptance. The original axilla edge [4954,4975], 6.456 mm at rest, changes from 14.735 mm in R0 to 6.839 mm in R1 for the exact same shoulder-plus-elbow fixture (2.282× → 1.059×). Pure shoulder is 1.052×. See `experiment-r1/repair-analysis.json` and same-camera source/common renders.

Eight fixed-identity neutral/pure shoulder/pure upper-arm twist/pure elbow/pure forearm twist/combined/mirrored fixtures retain the same topology and repeat exactly. None has a canonical edge stretched over 2×; their largest stretch is 1.481×. All 127-joint posed-snapshot round trips remain below 6.1e-13 mm. This repairs the named failures, but does not validate arbitrary shoulder extremes, contacts, self-intersection, all body shapes, gait, or complete hands/feet. Existing hand/foot correspondence limitations remain explicit.

Palms and limb proportions deliberately follow the configured Anny rest. A static native MHR/Anny palm difference is not counted as dynamic rotation error. The proximal MHR thumb0 and several foot helper joints lack exact Anny counterparts; their frame-offset construction is explicit and still requires broader hand/foot extreme-pose review. No contact, self-intersection, gait, extreme shoulder, or unrestricted pose sweep is accepted by this checkpoint.

The body map returns neck/head frames and can show neck-boundary effects, but **does not transfer or claim the GNM head geometry**. The parent must implement native head-only identity/expression/local articulation and inner anatomy. MHR dedicated neck/head rotation columns are 24–29. `neck_length_flexible` 131 and eye-scale fields 136–138 are officially locked; active `scale_neck_length` is 140. Other proportion fields are retained natively. Facial descendants in the returned target skeleton are continuity placeholders and explicitly marked in binding provenance; they are not a validated GNM facial rig.

## Export consistency

`exportSnapshot(result)` produces the evaluated canonical body and the same posed skeleton, complete weights, source state and Anny target shape. The snapshot uses its **posed world matrices as snapshot bind matrices**, with their inverses supplied, so importing the baked evaluated positions does not skin them a second time. Original target rest binds are retained separately as provenance. The tested current-pose skin round trip is below 1e-12 mm.

An ordinary LBS skeleton by itself cannot reproduce the nonlinear native MLP in later frames. Future playback must run this native evaluator + adapter for every frame, or bake the evaluated meshes/per-frame residuals. This is a truthful posed snapshot, not a promise that a static exported rig alone has full native MHR animation behavior. The parent owns final common-mesh GLB/USD and archive integration.
