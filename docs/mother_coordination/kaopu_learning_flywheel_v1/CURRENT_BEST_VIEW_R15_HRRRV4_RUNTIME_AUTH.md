# KAOPU Current Best View — R15 HRRRv4 runtime-authentication extension

Date: 2026-09-10
Status: Candidate extension to `CURRENT_BEST_VIEW.md`; no Frozen change.

131. Replay provenance needs an explicit authentication ladder: `source_locked -> source_callpath_authenticated -> real_input_executed -> independent_checkpoint_matched -> runtime_authenticated`. Later stages cannot be inferred from earlier ones.
132. The locked HRRR v4.1.20 source/configuration path for `mp_physics=28` resolves to `THOMPSONAERO`; that driver supplies `NWFA`, `NIFA`, and `NWFA2D`, and the locked Thompson source sets `is_aerosol_aware=.TRUE.` when those arguments are present. The source call path is therefore Candidate-authenticated as aerosol-aware.
133. Source-callpath authentication is not a cycle-specific binary trace. Operational runtime identity still requires a fixed cycle/input, executable/configuration identity and numerical evidence.
134. Current public HRRR native analysis exposes the field categories required by `calc_effectRad`: `PRES`, `TMP`, `SPFH`, `CLWMR`, `NCONCD`, `CIMIXR`, `NCCICE`, and `SNMR`; this is input-schema sufficiency, not numerical replay validation.
135. Same units do not imply same quantity semantics. HRRR `SPFH` is specific humidity while the Thompson routine's `Qv` is water-vapor mixing ratio. A source-faithful adapter must explicitly transform `q -> q/(1-q)` and retain the transform lineage.
136. A quantity-type error may be numerically masked by later algebraic cancellation. Agreement in one derived diagnostic does not repair incorrect input semantics.
137. `MASSDEN` may be used to cross-check reconstructed density, but substituting it for the source routine's density calculation changes the replay implementation unless equivalence is independently demonstrated.
138. A real input plus the same implementation's replay output is self-consistency evidence, not an independent numerical checkpoint. Runtime authentication requires a separately generated expected output with matching model/configuration/support identity.
139. NCEP GRIB2 can represent effective-radius parameters (`EFRCWAT`, `EFRCICE`, `EFRSNOW`), while the inspected public HRRR native inventory does not publish them. Format capability and product publication are separate facts.
140. Weather replay status, spectral optical closure status, local disaggregation status and renderer/evaluator status remain independent gates.

R15 evidence status:
- No new physical atmospheric Observation Root was added.
- Primary engineering roots: locked NOAA-EMC HRRR v4.1.20 source/configuration, NOAA/NCO public HRRR native inventory, and NCEP GRIB2 parameter table.
- Executable semantic probe: `PROBES/hrrrv4_runtime_input_auth_probe_r15.py`, result `8/8 PASS`; atmospheric numerical inputs are synthetic.
- Current replay state: `source_callpath_authenticated`, not `runtime_authenticated`.
- Frozen: none.
