# KAOPU Current Best View — R25 HRRRv4 serial SCM toolchain extension

Date: 2026-09-11
Status: Candidate extension to `CURRENT_BEST_VIEW.md`; no Frozen change.

249. Validation-tool readiness is not one Boolean. Preserve a `ToolchainCapabilityVector` that separates execution mode, language interfaces, artifact-format libraries, build-driver tools, auxiliary runtime data and unresolved compiler compatibility.
250. `BuildModeIdentity` is evidence-bearing provenance. A dependency required by a `dmpar` build is not automatically required by a `serial` build of the same model.
251. For the L1 HRRRv4/WRF3.9 `em_scm_xy` harness, MPI is not a hard dependency: current official WRF documentation requires serial compilation for 1-D idealized cases, the locked GNU architecture advertises serial mode, and the locked configure script gates its MPI capability tests on `DMPARALLEL`.
252. The absence of `mpif90` must therefore not be used to classify the serial L1 harness as blocked. MPI remains relevant to later execution modes such as full L3 HRRR, but not to this specific serial-SCM build gate.
253. NetCDF-C readiness and NetCDF-Fortran readiness are separate capabilities. `nc-config`/`libnetcdf` cannot stand in for `netcdf.inc`/Fortran bindings/`libnetcdff`.
254. The locked SCM uses NetCDF I/O form 2 for history/input/auxiliary input. Configuring the legacy source without NetCDF or changing I/O family merely to bypass a missing dependency changes the canonical L1 artifact contract and is not the same validation experiment.
255. The locked HRRRv4 build driver is csh-based. Missing `csh` is a real build-driver blocker for the canonical compile path even though the scientific source itself is Fortran/C.
256. `HardDependency` and `OptionalParallelDependency` must be typed separately. A toolchain audit should identify which missing capability blocks the selected experiment rather than listing all absent ecosystem tools as equivalent failures.
257. The bounded R25 environment successfully compiled/linked/ran a netCDF-C probe but failed the corresponding Fortran netCDF interface probe and lacked csh. It is therefore correctly classified as `serial-WRF build not ready`, with blockers `csh + netCDF-Fortran`, not `MPI`.
258. Toolchain closure is engineering evidence only. Successfully configuring or compiling `em_scm_xy` cannot promote Weather physics, effective-radius replay, physical Observation status or `ReplayStatus`.
259. Modern WRF documentation may corroborate transferable build semantics but must not silently replace locked HRRRv4/WRF3.9 build behavior. Source/version/build-mode identity remains first-class.
260. After canonical dependencies are present, the next evidence step is an unchanged locked-source serial `em_scm_xy` compile. Any GNU Fortran 14 or other legacy-source incompatibility must be recorded before introducing a compatibility patch; no patch may be silently folded into the source-authenticated experiment.

R25 evidence status:
- Observation: no new physical atmospheric Observation Root.
- Candidate: `ToolchainCapabilityVector`, `BuildModeIdentity`, `HardDependency`, `OptionalParallelDependency`, `ArtifactFormatDependency`, and the serial-SCM L1 build contract.
- Current Best View: attempt L1 via serial WRF; MPI is not a hard blocker for this harness. Current bounded-runtime blockers are csh and netCDF-Fortran.
- Frozen: none.
- Rejected: “missing mpif90 blocks serial SCM”; “netCDF-C implies netCDF-Fortran”; “no-NetCDF configure preserves canonical L1”; “current WRF build machinery is automatically source-equivalent to locked HRRRv4”.
- Unknown: locked WRF3.9 compatibility with GNU Fortran 14 after dependencies are installed; later build/runtime failures; actual L1 non-interference/performance; L3 operational execution and downstream optical closure.
- Executable environment/toolchain probe: `PROBES/hrrrv4_scm_toolchain_probe_r25.py`, SHA256 `79d2ccfb66de7a4df832c922d642608440f721d7f3af8b2c4f78418be52665d1`.
