# KAOPU Current Best View — R19 validation-harness equivalence extension

Date: 2026-09-10
Status: Candidate extension to `CURRENT_BEST_VIEW.md`; no Frozen change.

177. A reduced model harness inherits source code, not automatically the validation identity of the production model. Test-case dynamics, boundaries, initialization, physics options, state sources and support scale are part of evidence identity.
178. The locked HRRRv4 source contains WRF `em_scm_xy`, but that SCM is a 3x3 periodic single-column configuration with no horizontal gradients and default `mp_physics=2`; it is not the locked HRRRv4 CONUS state/configuration.
179. Locked HRRRv4 CONUS uses 3 km, 1800x1060 horizontal points, 51 vertical levels, `mp_physics=28`, external/rapid-refresh aerosol ICBC and specified lateral boundaries.
180. Switching a reduced SCM to `mp_physics=28` can exercise the aerosol-aware Thompson code path, but using WRF's internal aerosol-profile mode changes state initialization and therefore does not make the SCM HRRR-equivalent.
181. Every validation run needs a `ValidationHarnessIdentity` and a `HarnessEquivalenceVector` covering code path, physics option, state initialization, boundaries, dynamics, support and decomposition.
182. Every harness also needs an `EvidenceCeiling`: the strongest claim its evidence may support. A lower-equivalence harness cannot silently promote a higher-equivalence ReplayStatus.
183. Validation should use a ladder: L0 semantic/static probe; L1 SCM instrumentation preflight; optional L2 reduced real-data case preserving selected HRRR semantics; L3 locked HRRRv4 ControlInstrumentedPair.
184. L1 is valuable because it can cheaply detect runtime-I/O variable/stream/NetCDF/comparison-pipeline failures before an expensive HRRR run, but an L1 pass cannot advance ReplayStatus.
185. The inspected current public WRF Testing Framework ARW table includes non-aerosol Thompson `mp=8` but does not list aerosol-aware Thompson `mp=28`. This prevents inheriting a public mp=28 regression guarantee from that table; it does not prove universal absence of mp=28 testing.
186. Runtime-I/O remains lower source-code perturbation than Registry modification, but official WRF documentation warns of performance cost; each harness must measure performance separately from numerical non-interference.
187. A reduced bit-wise control/instrumented match proves only non-interference for that harness identity. It does not prove full-domain HRRR non-interference, source-model replay authenticity, Thompson physical validity or visible-band optical validity.
188. ReplayStatus therefore remains `source_callpath_authenticated` after R19. Operational advancement still requires an eligible locked HRRRv4 real-input checkpoint.

R19 evidence status:
- No new physical atmospheric Observation Root was added.
- Independent engineering roots remain distinct: locked NOAA-EMC HRRRv4 SCM/CONUS source; official NCAR WRF Thompson aerosol-aware documentation; official WRF runtime-I/O documentation; inspected official WRF Testing Framework table.
- Executable semantic probe: `PROBES/hrrrv4_validation_harness_probe_r19.py`, result `12/12 PASS`.
- Frozen: none.
