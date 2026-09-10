# KAOPU Current Best View — R20 instrumentation comparator extension

Date: 2026-09-10
Status: Candidate extension to `CURRENT_BEST_VIEW.md`; no Frozen change.

189. An intentionally instrumented model output is not expected to be byte-identical to its control artifact. Added fields change schema/artifact identity even when all pre-existing model state is bit-wise unchanged.
190. `ArtifactIdentity`, `SchemaIdentity` and `StateNonInterferenceIdentity` are distinct. File hashes are useful for artifact identity but are the wrong equality gate for a control/instrumented pair with an intentional schema delta.
191. Comparator identity is part of evidence provenance. Record comparator repository/commit/blob/build, operand direction, value types covered, dimension/type checks, time handling, attribute/schema coverage and result interpretation.
192. The locked HRRRv4 `diffwrf` traverses variables from file 1 and searches for each in file 2. For instrumentation validation, the semantic order is therefore `control -> instrumented`.
193. With control first, `re_cloud/re_ice/re_snow` added only to the instrumented output are naturally outside the locked comparator traversal, which is appropriate for testing pre-existing real-valued state non-interference.
194. The locked HRRRv4 `diffwrf` numerically compares `WRF_REAL` fields; it does not by itself establish complete equality for skipped integer/string state, all attributes, exact added-variable allowlists or every dataset-manifest property.
195. The inspected current upstream WRF `diffwrf` also compares `WRF_INTEGER`, demonstrating that validation tools evolve. A newer comparator may supplement a locked check but cannot silently rewrite the historical evidence coverage of the locked HRRRv4 tool.
196. Every control/instrumented experiment needs an `InstrumentationManifest`: the exact variables allowed to be added, with required type/dimensions/units/staggering and time support.
197. Every comparator needs a `ComparatorCoverageVector` with separate axes for shared real values, integer values, dimensions, types, time labels/count, shared attributes and exact added-variable set.
198. HRRRv4 instrumentation validation should use a `TwoLayerInstrumentationComparator`: locked `diffwrf(control, instrumented)` for shared real-valued state plus a versioned schema/metadata sidecar for the coverage gaps.
199. Numerical/state equality, schema equality and performance perturbation remain separate gates. Passing one cannot substitute for the others.
200. R20 improves the validity of the upcoming L1/L3 experiment but executes no WRF/HRRR run; `ReplayStatus` remains `source_callpath_authenticated` and Frozen remains unchanged.

R20 evidence status:
- No new physical atmospheric Observation Root.
- Engineering roots remain distinct: locked NOAA-EMC HRRRv4 `diffwrf`; current official upstream WRF `diffwrf`; official WRF bit-wise validation documentation.
- Executable semantic probe: `PROBES/hrrrv4_instrumentation_comparator_probe_r20.py`, result `8/8 PASS`.
- Frozen: none.
