# Station material displacement envelope audit

Scope: source-level real-arithmetic interval proof and local CPU regression, dated 2026-10-12. No mother functions, renderer files, browser, or remote state were changed for this audit. This document does not certify GPU numerical error, complete ray-march safety, structural engineering, or rendered appearance.

Run `node --test kowloon-train88-r01/qa/material-envelope-proof.mjs`.

## Meaning and prerequisites

For a recorded candidate, let `d=h.d=h.baseD`, and let `F=evaluateStationGeometry(h,p,st).d`. We bound the **field-value difference** `Delta=F-d`. This is enough to prune candidate competition without deleting any nonzero material term. It does not by itself make either `d` or `F` a metric signed distance.

The tighter fixed bounds assume finite `age in [0,1]`. `repairAt` is `.08 + .65*A*B`, with both smoothstep-derived factors in `[0,1]`, so repair is in `[.08,.73]`, and retained age is in `[0,.92]`. Every public/render/probe entry must validate a finite numerical age; a UI slider or the default value is not proof of every entry. The test validates an example guard but does not assert that production calls it.

Positions, coefficients, extents, seeds and intermediate arithmetic must be finite. These are real-arithmetic bounds, with IEEE/WGSL implementation differences discussed separately below.

## Recommended bounds, metres

| Candidate | Delta lower | Delta upper | Basis |
|---|---:|---:|---|
| brick, id 1/12 | -0.000577108084385 | +0.006 | Rounded-box support plane, source contour range, final min cap |
| stone, id 2 | -0.004 | +0.004 | Explicit station clamp |
| ordinary iron, id 3 | 0 | +0.0008 | Corrosion clamped to [0,1] |
| roof iron, id 15 or `isStationRoof` | -0.000060 | +0.000788 | Coupled paint removal and corrosion |
| timber, id 4 | -B | +B | B = `kpWoodMacroDisplacementBound(stationWoodParams(h,st))` |
| plaster, id 13 | -0.021 | +0.001 | At most 20mm coating plus clamped stone substrate |
| concrete, id 17 | -0.000210 | +0.000854 | Fine noise and retained-age chip loss |
| other actual ingredients | 0 | 0 | No geometry modification in the present adapter |

Use the source runtime timber bound, not the numerical default quoted later. A conservative concrete bound of `[-.00021,+.00091]` also covers a generic retained/age input up to 1. Domain records with id 0 are **not actual ingredients**: they supply only domain lower bounds and must not create a physical surface or an exact upper bound.

### Brick proof

Source anchors: `station-field.mjs::brickQ`; `station-matter.mjs:28`; decoded `brick-core` WGSL lines 4, 10, 38–67 (`br_roundBox`, `br_chipWear`, `br_contour`, `br_contourLong`, `br_surfaceDelta`, `kpBrickBaseDistance`). The mother module stores its WGSL as one encoded string; decoded WGSL line numbers are distinct from JavaScript file lines. The test reports current decoded anchors.

Let S=0.1153846154 and b_z=.480*S. The station maps q_z=.055384615+d. The rounded-box function satisfies B(q) >= q_z-b_z for every q, including negative d and rounded corners. Reflections selected by `br_variant` leave the analytic rounded box unchanged. The offset mismatch is `.055384615-.480*S = -3.920000019e-10` m; it must not be silently treated as exactly zero.

All mask products are nonnegative and at most one. Chips are nonnegative because the input to `br_chipWear` is first clipped nonnegative. Its later tanh contribution is also nonnegative. `br_contour` is in [-.0048,.0048], and `br_contourLong` never falls below -.00265, hence is also >=-.0048. Therefore the weighted contour sum divided by max(1,totalWeight) is >=-.0048. This remains true when totalWeight<1.

The variation argument is .42. Since the seed hash is a fract value in [0,1), the gain is bounded by 1+.10*.42 = 1.042. Thus `native >= d + offsetError - S*.0048*1.042`. Erosion loss is in [0,.0016] and cannot reduce that lower bound. Finally `F=min(d+.006,native+loss)` gives the upper bound d+.006 and preserves the stated lower bound.

There is no need to sample Fourier edge functions to establish this global amplitude bound. Their inputs can be arbitrarily large: the tanh/weight argument already bounds them. Brick's periodic coordinate mapping and changing cell seeds are reasons not to infer a global Lipschitz constant from this amplitude result.

### Stone proof

Source anchors: `station-matter.mjs:16,29`; decoded `stone-fields` WGSL lines 13–36, 55–70.

The source value noise is a convex interpolation of fract hashes. Its quintic interpolation weight is in [0,1] in real arithmetic. The three `st_sf` weights .57,.28,.15 sum to 1, so broad, region and the pore source are in [0,1]. Vein and pits are in [0,1]. Consequently the unclamped metric height is in:

`[(-.009-.0035-.025)*Sstone, (.009+.0035+.004)*Sstone]`

with Sstone=.12352941176470589, or [-.00463235294117647,+.002038235294117647]. Relief multiplier is at most .25+.75*.92=.94. Subtracting the final clamped height yields the optional tighter Delta interval [-.001915941176471,+.004]. The recommended +/- .004 instead follows directly from the final clamp and remains valid without the tighter age/noise argument.

The `h.q*.19` coordinate mapping changes frequency, not amplitude. It must not be incorrectly used as another .19 multiplier on the displacement magnitude.

### Timber proof

Source anchors: `station-matter.mjs:8,12,31`; decoded `wood-core` WGSL functions `kwVertexHash`, `kwVertexNoise`, `kwMacroField`, `kpWoodMacroDisplacement`, `kpWoodMacroDisplacementBound`.

VertexNoise is a convex interpolation of [0,1) hash values. MacroField has weights .58,.261,.11745 and divides by **.94**, not by their sum .95845. Therefore broad is in [0,1.0196276595744682], not merely [0,1]. longWave is in [0,1], and macroHeight is in [-.5,+.5153095744680852]. The maximum original source class multiplier is 1.08, giving magnitude <.557 times abs(macroDisplacementM*reliefScale), exactly the source bound function.

Station's current class function returns only 0 or 1; class 1 sets displacement to zero and class 0 uses multiplier 1. With current defaults and retained<=.92, amplitude is .0004907567320886851 and optional Delta is [-.000252891642780,+.000245378366045]. Runtime source bound at that maximum is .0002733514997733976. Keep calling the source bound with the fully adapted params, so a future relief change is covered. Texture scale and seed changes affect the coordinates, not this amplitude bound.

The switch between face classes can be discontinuous. This bound is expressly an amplitude bound, not a proof that a `.60*abs(F)` step is safe.

### Iron and roof paint proof

Source anchors: `station-matter.mjs:24–25,30`; `metal.mjs::kpMetalCorrosion` (decoded line 5).

Corrosion C is clamped to [0,1]. Ordinary iron adds .0008*C. For roof ingredients, paint coverage is 1-.8*C and paint thickness is .00006 times that coverage. The same C controls both terms, so Delta=.000848*C-.000060, giving [-.000060,+.000788]. Treating the terms independently would give a looser upper bound; no spatial noise evaluation is needed to derive the coupled bound.

Material microheight is a shading response. It is not an additional geometry displacement beyond `evaluateStationGeometry`.

### Concrete proof

Source anchors: `station-matter.mjs:17,32`; `metal.mjs::mt_kn`; `concrete-kst.mjs::kpConcreteStation`.

Fine noise is in [0,1]; the product of the two chip gates is in [0,1]. For retained r>=0, height is in [-.00021-.0007*r,+.00021]. Geometry subtracts height, so Delta is in [-.00021,+.00021+.0007*r]. At r<=.92 this gives +.000854. For arbitrary finite r, the algebraic interval is `[-.00021+.0007*min(0,r), +.00021+.0007*max(0,r)]`.

### Plaster proof

Source anchors: `receiver.mjs:20::stationPlasterParams`; `station-matter.mjs:18,33`; decoded `plaster-core` WGSL lines 14–17, 25–35.

Source coating thickness is clamped to [.013,.020] m. Coverage is a smoothstep result in [0,1], so actual retained coating thickness is in [0,.020], including **zero** after loss. The exposed stone substrate is independently clamped to +/- .001 m. Hence Delta lies in [-.021,+.001]. Half extents in `stationPlasterParams` change the macro coordinates, not this clamp argument.

With age in [0,1] and macro in [-1,1], unclamped thickness cannot exceed .0165+.003=.0195. The positive substrate height cannot exceed .25*.002038235294117647=.000509558823529412. These give the optional tighter lower Delta bound -.02000955882352941.

A further optional bound uses `pl_cell<=1-.6556965458313674`; its five positive weights sum to31/16. Thus macro<=.48*tanh(.78*(31/16)*(1-.6556965458313674))+.52=.7494177198163722, producing lower Delta -.019257811982978528. The default recommendation deliberately avoids depending on this extra detail.

`geometryMicroM` is zero in the present receiver. Station's geometry thickness closure explicitly uses macro only. Shading microheight must not be added again to the construction thickness.

## Conservative outside-only separation and exact competition

For real candidate i compute `[L_i,U_i]=[d_i+DeltaMin_i-pad_i,d_i+DeltaMax_i+pad_i]`. For a domain proxy, retain only its established geometric lower bound; it has no U. Preserve candidate overflow's explicit failure status.

1. Compute LB=min(all real L and domain lower bounds). If not `forceExact` and LB>.007, return a **bound-only** result with material id 0. Do not return a real surface normal, pigment or material at this point. Keep independent bound-family/provenance if roof/floor acceleration needs it.
2. Otherwise compute bestUpper=min(real U). Visit only real nodes with L<=bestUpper; evaluate the actual material geometry and tighten bestUpper with that **actual** value. Retain the actual minimum and its full coordinates/seeds. It is useful to evaluate the minimum-U node first.
3. Never submit an unevaluated nominal d, a domain proxy, or an upper/lower interval endpoint as an actual winner. At least one real node must be evaluated before an actual result is returned. Equality should not be pruned if deterministic surface ties matter.
4. Inside and near-surface queries always use exact competition in the chosen implementation. No negative-UB bound-only placeholder is proposed here.

Proof of pruning: if L_i>bestUpper, then F_i>=L_i>bestUpper>=min_j F_j, so candidate i cannot win. Tightening bestUpper with an actual F preserves the inequality. This proof is pointwise and does not require Lipschitz continuity.

Domain proxies are lower bounds on omitted subtrees, not exact physical candidates. If an exact query needs a value greater than an unresolved proxy's lower bound, the subtree must be expanded or the answer must remain bound-only. Existing domain gates emit proxies at distance>=2m. The present near-hit band and AO sample distances up to .8m should be compared against those thresholds; do not silently assume a proxy is a true object.

## Receiver effects that must accompany the change

- Current hit epsilon is up to .006m in R04 and .004m in the host. Normal offsets have length sqrt(3)*.00045=.0007794229m. A .007m separation threshold covers their sum only under an appropriate base-distance bound. Force-exact normal queries avoid differentiating the synthetic lower-bound field.
- AO samples at .2,.4,.6,.8m. **Positive** outside bounds returned as id0 would make the current AO skip those samples. AO must request an exact/occlusion-appropriate query; disabling negative bound placeholders alone does not fix this.
- `barrelAdvance` and `floorAdvance` currently test id15/id17. Returning id0 in the far field disables those accelerators unless their eligibility uses separate bound provenance. Provenance must never make a bound into an actual hit.
- Keeping interiors exact avoids the old shadow condition's failure to recognize a negative bound with id0 as occlusion.
- Material/normal recording and direct shade queries must consume a true evaluated winner. A force-exact query must not be swapped back to a bound-only result just because its distance is positive.

## What is and is not certified

The interval proofs certify **real-arithmetic field-value envelopes** under the stated prerequisites. They do not establish that the nominal architectural field is 1-Lipschitz. In particular, angular fluted-column radius functions are not automatically exact distances; wood face-class and brick-cell changes can also prevent a global finite Lipschitz constant for the materialized field. A distance step based on LB requires an independently established base geometric distance/Lipschitz bound. If a base field has constant K rather than 1, an appropriate exterior safe-distance conversion is LB/K. The `.60` factor and a nonzero minimum step are not universal substitutes for that proof.

The recommended bounds leave much more headroom than observed displacements in several materials, but finite sampling is not a proof. This script's 8,415 brick mapping points and 21,609 interval-union cases test regressions in arithmetic and selection logic only.

For implementation robustness, an illustrative outward padding is `2e-6 + 16*2^-23*max(1,abs(d))` m, applied by subtracting it from L and adding it to U. This accounts heuristically for growth of f32 scale error instead of pretending a constant one-micrometre pad covers arbitrarily large d. It is **not** a formal bound on every WGSL builtin, compiler transformation, cancellation, NaN, or overflow. Validate finite inputs, fail closed on nonfinite results, compare backends, and retain targeted surface/edge regression probes. No claim of arbitrary floating-point strict zero error is made.
