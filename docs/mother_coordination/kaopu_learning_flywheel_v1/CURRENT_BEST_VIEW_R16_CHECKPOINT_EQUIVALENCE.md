# KAOPU Current Best View — R16 checkpoint-equivalence extension

Date: 2026-09-10
Status: Candidate extension to `CURRENT_BEST_VIEW.md`; no Frozen change.

141. A numerical checkpoint has at least two independent validity axes: producer independence and semantic equivalence. Neither implies the other.
142. `independent_checkpoint_matched` requires a separately produced expected value **and** proven identity of diagnostic meaning, source model/configuration, cycle/time, horizontal/vertical support, units/reference, validity policy and derivation/equivalence relation.
143. A replay compared with itself is `SelfConsistencyReplay`: high implementation equivalence but no producer independence. It cannot authenticate operational numerical behavior.
144. The locked HRRRv4 `hrrr_wrfpost` contains a separate `EFFR(...)` effective-radius implementation used for CRTM. It is a useful `DifferentialComparator`, but its materially different input signature means equivalence to Thompson `calc_effectRad` remains Unknown until tested/proven.
145. A `SourceModelStateCheckpoint` emitted by the exact locked HRRR runtime/history/restart is the preferred future authentication target because it can be both independent of the KAOPU replay and source-native in meaning, provided emission, cycle/configuration and support identity are proven.
146. Source-code variable existence is not runtime-file availability. ARW carrying `re_cloud/re_ice/re_snow`, an NMM Registry declaring them, or a NEMS post reader requesting them does not by itself prove HRRR CONUS ARW operational files emit them.
147. Current NOAA-EMC UPP/RRFS explicitly carries Thompson `cleffr/cieffr/cseffr`; this is strong transferable evidence for producer-diagnostic carry-through, but it is `CrossGenerationReference`, not an HRRRv4 checkpoint.
148. Same variable name and units are not sufficient identity. Derivation semantics and space/time/vertical support are part of the quantity identity.
149. If a downstream postprocessor recomputes a producer diagnostic, it creates a semantic-equivalence obligation. Prefer carrying producer-native diagnostics with provenance when feasible.
150. Current official HRRR file availability does not advance replay authentication. `real_input_executed` begins only after selected records are actually decoded with GRIB record, cycle, level and support identity retained.
151. The authentication state after R16 remains `source_callpath_authenticated`; neither `real_input_executed` nor an eligible `independent_checkpoint_matched` has been established.
152. Effective-radius replay authentication, spectral optical closure, local disaggregation and renderer/evaluator validation remain separate gates.

R16 evidence status:
- No new physical atmospheric Observation Root was added.
- Primary engineering roots: locked NOAA-EMC HRRRv4 Thompson source; locked HRRR post `EFFR` implementation; HRRR internal effective-radius state routing; current NOAA-EMC UPP/RRFS effective-radius interface; current NOAA NOMADS HRRR product availability.
- Executable semantic probe: `PROBES/hrrrv4_checkpoint_equivalence_probe_r16.py`, result `8/8 PASS`.
- Frozen: none.
