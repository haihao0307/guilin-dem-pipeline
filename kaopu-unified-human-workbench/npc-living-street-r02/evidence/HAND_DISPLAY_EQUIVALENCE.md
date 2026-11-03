# R07 hand subset: canonical / display equivalence review

Date: 2026-10-20. Scope: read-only source inspection for the F identity grasp failure. This is a source-contract review, not a visual approval or a new runtime grasp result. No production file was changed.

## Conclusion

The **hand subset** of the retained canonical body has the same vertex IDs and triangle vertex triples in the R07 display surface. The display refinements do not subdivide, smooth, or displace the hands. Consequently, a fixture built from the correct 9,253 canonical body recipes can reproduce the hand geometry used by `findPalmSupport` and `fitCylinderGrasp`, provided it uses the actual identity, complete per-influence rest positions, the same normal construction, and the native/display coordinate conversion.

This conclusion does **not** apply to the head or to all 266,098 display vertices. The head has additional vertices, midpoint ancestors, displacement, and local normal corrections. The final skin material grouping reorders triangle records; **triangle ordinal is not identity**. Compare the retained vertex IDs and oriented vertex triples instead.

The palm shader adds a fragment-level relief normal. That shading normal is different from the CPU `geometry.attributes.normal` read by `findPalmSupport`; it is not an additional physical hand surface or displacement to account for in the cylinder fit.

## Frozen source

- R07 source head: `5543f756ca3af1428323696324303fa70b8de850`.
- File: `vendor/r07-preview.html`.
- SHA-256: `d1bd7940b885cb872143bc0e68ce85fd2f663c81be36a18e58fc6086781cf31a`, also pinned by `build.cjs`.
- Active adapter: `src/ActorAdapter.mjs`, especially `restVertex`, `findSkinPatch`, `findPalmSupport`, `fitCylinderGrasp`, and `makeActor`.
- Binding: `src/NativeBinding.mjs`, `NativeBinding` constructor and `sampleVertex`.
- The original minified closure symbols below are unique searchable source anchors. For inspection, the script was formatted with esbuild into `/tmp/HAND_DISPLAY_EQUIVALENCE_R07_formatted.mjs`; the second skin script was formatted into `/tmp/HAND_DISPLAY_EQUIVALENCE_R07_skin.mjs`. Formatting did not change the frozen source file.

## Surface stages and hand exclusion

| Stage / original closure symbol | Actual source selector and operation | Consequence for the hand |
|---|---|---|
| Canonical face fields, `w4` | Allocates zero-filled `fA`, `fB`, `fEye`, `fRest`; writes fields only at `bodyCount + gnmRecipeIndex`. Field smoothing also requires both endpoints at or beyond `bodyCount`. | Body vertices retain zero face fields and `fRest = [0,0,0]`.
| Dense surface, `C1`; caller `P1.update` | Initial eligible flag is `a >= t`, with `t = this.model.bodyCount`. The split helper returns `-1` when either endpoint is ineligible. Original positions are copied with `l.array.set(a.array)`; curvature correction is only applied to newly appended midpoint IDs. | Body hand edges do not split. Hand positions and incident triangle triples are retained.
| Ocular surface, `D1` | Splits only triangles whose three `csType` values exceed `3.5`. Copies original positions; adjusts only appended ocular midpoints. | Body type is `0`, so hand triangles and positions remain unchanged.
| Lip surface, `O1`; rails `L5` | Splits triangles selected by lip `roi` or the first-layer thin-face `fA.z > .65` branch. Displaces only samples with `roi`. | Hand `fA.z = 0`. Original `L5` evaluated at body `fRest = [0,0,0]` gives `roi = false`, `front = 0` (numeric check below).
| Lip biomechanics, `H5`, `Kl`, `Ql` | `l19Oral` is zero-filled and written only at `bodyCount + gnmRecipeIndex`. `Kl` makes an active sample only for lip `roi` or positive oral ownership, and `Ql` edits only `active`/lip samples. | Body oral ownership is `0`, and body lip `roi` is false. The later lip microgeometry pass also excludes hands.
| Fold surface, `nh` | Edge eligibility requires `csType < .5`, `fA.x > .18`, and further face-region tests. Face fairness and normal polish have their own face ROI, using template face coordinates. | Hand `fA.x = 0`; no hand edge split or positional correction. Normal polish is face-only.
| Regional face surface, `$l`; mask `w5` | `w5` returns `0` when template face Y is `<= .203`, as well as for protected types/ear ownership. `$l` first copies the source position buffer and explicitly restores source normals for zero-weight vertices. | Body face Y is `0`, so both positions and original geometric normals are preserved.
| Ear ownership, `W5`; ear surface, `ch`; sample `k8` | `eWeight`/`eOwned` are zero-filled and written only to the GNM tail. `ch` splits only triangles with all three ear weights positive; `k8` returns null for weight below `1e-8`. After its guard, `ch` restores source normals for zero-weight original vertices and throws if their position changed. | Every body hand point has zero ear weight. Hand position and normal are explicitly protected.
| Final procedural skin `geometryFor` (second script) | Sets `result.attributes = g.attributes`; copies every original triangle triple into either `other` or `head`, then builds a concatenated index buffer. | Same vertex and normal arrays, same hand triples. Triangle order and material group change.

Dense/ocular/lip/fold stages recompute vertex normals. On a hand vertex, the same incident triangles with the same positions feed the same normal computation. Refinements around the face cannot propagate smoothing across the entire mesh: this is local incident-triangle accumulation, not global normal diffusion. Repeated normal computation therefore does not introduce a hand detail deformation. A fixture that recomputes only a cutout of the hand may omit incident triangles and produce a different boundary normal; retain the complete body triangle set for this check.

## Direct source anchors

The following are abbreviated source excerpts, with original symbol names retained:

```js
// C1 constructor: t is model.bodyCount.
r = Array.from({ length: s.attributes.position.count }, (o, a) => a >= t);
// Edge splitter:
if (!r[g] || !r[m]) return -1;
// C1 update copies existing points before writing only new midpoint IDs:
l.array.set(a.array);

// w4: zero face fields; GNM-only writes.
o = new Float32Array(i * 4); // fA
a = new Float32Array(i * 4); // fB
l = new Float32Array(i * 3); // fRest
// In the gnmRecipes loop:
E = s + b; // s is bodyCount
l.set(v, E * 3);

// W5: zero-filled body ear fields; GNM-only writes.
t = new Float32Array(n.vertexCount);
i = new Float32Array(n.vertexCount);
c = n.bodyCount + s;

// ch.update: restore original normal for zero ear weight.
if (u[y] === 0) {
  // Each coordinate of p is copied from source normal d.
  // g records the maximum difference from source position.
}
if (g !== 0) throw Error("EAR-R04 invariant failed: protected scalp moved");

// Second script geometryFor:
result.attributes = g.attributes;
result.morphAttributes = g.morphAttributes;
sorted.set(other);
sorted.set(head, other.length);
```

## Lip selector numerical cross-check

`evidence/HAND_DISPLAY_EQUIVALENCE_LIP_SELECTOR.json` records the original `Xl`/`L5` functions evaluated against the retained hot packet's GNM template and barycentric landmarks. This supplements the selector inspection; it does not replace a full runtime geometry comparison.

- Input body face coordinate: `[0,0,0]`; type `0`.
- Sample bottom rail Y: `0.2233047571491728 m`.
- Sample top rail Y: `0.23960969649868485 m`.
- Front threshold: `0.11119334660381583 m`.
- Returned `front = 0`, `roi = false`.

The body zero field is far outside both the lip height and forward masks. The oral ownership branch is separately zero by construction in `H5`.

## Geometric normals versus rendered palm relief

The common skin material `Ow` installs attributes/varyings and fragment color, roughness, and relief terms. The later procedural skin script explicitly retains `vertexContract.vertexShader`. Its palm/sole ridge term adds to `psH`, then perturbs the fragment normal with derivatives in `normal_fragment_maps`:

```glsl
psH += ridge * .000006 * fbGlabrous * fbPores
       * (1. - smoothstep(.06,.26,psFoot));
// The later fragment normal step uses screen derivatives of psH.
normal = normalize(normal - slope);
```

This does not modify `geometry.attributes.position` or the CPU normal buffer. `findPalmSupport` intentionally tests `geometry.attributes.normal`, not a sampled lighting normal. There is no missing palm mesh subdivision or displaced palm support caused by these visual ridges. The host also contains a separate boxing mesh shader; that is not the R07 viewer surface pipeline used by this adapter.

## Exact fixture contract

1. Build the body using `canonical.annyRecipes` in its 9,253-entry canonical order. Raw Anny IDs must never be paired with canonical faces. Use the complete current identity and local changes.
2. Preserve all influences, including each joint-conditioned rest position. `NativeBinding` adds a neutral residual to each influence so their weighted sum reproduces the actual canonical point. It performs a second residual correction against the Float32 display point. Copy the production formula and precision path; a generic `weight * commonRestPoint` row is insufficient.
3. Keep the complete canonical body incident triangles when computing normals. Use the same native Three implementation and Float32 display coordinates. Native to display is `[x,z,-y]`; display positions and normals convert back with `[x,-z,y]`.
4. For the hand subset, display vertex ID equals canonical body vertex ID. Construct the `displayRange` stride of four and `displayPacked` rows as production expects. This avoids treating base `range` (stride two) as a display range.
5. Build `handVertices` from the same wrist descendant set and `weight > 1e-6` rule. `findPalmSupport` excludes finger/metacarpal1 moving weight, tests geometric normal alignment `>= .3`, and returns a retained triangle vertex with one-hot barycentric weight. Group sorting can change the first containing triangle but cannot move that one-hot vertex.
6. Use the actual skin matrices / Float32 bone-data path when evaluating the fitted hand, including thumb opposition. `fitCylinderGrasp` samples `binding.sampleVertex(id, true)` on the complete weighted hand-vertex set. Its current collision scope is vertices against a finite cylinder, not a proof of continuous hand-triangle nonintersection.
7. No dense/head midpoint ancestry is required for these retained hand IDs. The full actor and any head-surface test still need the complete dense, ocular, lip, fold, and ear ancestor stages from `NativeBinding`. Do not generalize this hand-subset result into whole-display equivalence.

## Limits and disposition

This review has not independently compared a live F actor hand dump byte-for-byte with the fixture. It establishes why a correctly built canonical hand fixture is geometrically appropriate and identifies the conditions for the comparison. F's grasp pass/fail and its penetration values belong to the separate production-function grasp diagnostic owned by the scene lane.

No tolerance change, fallback grasp, mesh simplification, or production alteration is recommended by this review. Production `src/NativeMotion.mjs` remained at SHA-256 `a85cd8dfddc85f25762c721d2ac060d97c82e3469e5bb39dc76aae75f29caa22` during the inspection.
