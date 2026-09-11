# KAOPU bounded learning cycle — R25 HRRRv4 serial SCM toolchain boundary

Date: 2026-09-11
Learning question: `LQ-ATMOSPHERE-001`
Status: Candidate partial; no Frozen change; no production Mother mutation.

## Why this question was selected

The coordinator still ranks `LQ-ATMOSPHERE-001` first under explicit user priority. R24 left the Weather-coupling gate blocked on the first real L1 SCM `ControlInstrumentedPair`. The highest-value bounded question is therefore not another cloud algorithm: it is whether the L1 SCM actually requires an MPI toolchain, and which dependencies are truly hard blockers for the locked serial test case.

## Logical errors rejected before implementation

1. **No `mpif90` => L1 SCM cannot run.** False. Current official WRF documentation states that 1-D and 2-D idealized cases must use a serial compile option, and the locked HRRRv4 GNU architecture explicitly advertises a serial mode. The locked configure script performs MPI capability tests only for `DMPARALLEL` builds.
2. **netCDF-C present => WRF NetCDF I/O is ready.** False. netCDF-Fortran is a distinct interface/library. A working `nc-config` and `libnetcdf` do not prove `netcdf.inc`, `netcdf.mod`, `nf-config`, or `libnetcdff` are available.
3. **The old configure script can say 'without NetCDF' => canonical L1 can simply avoid NetCDF.** False for this gate. The locked SCM namelist uses `io_form_history=2`, `io_form_input=2`, and `io_form_auxinput3=2`. Switching I/O families merely to evade a missing dependency changes the harness/tooling contract that R20-R23 are meant to validate.
4. **Current WRF build instructions are source-equivalent to HRRRv4/WRF3.9.** False. Current official documentation is useful corroboration for transferable requirements, but locked-source behavior remains authoritative for the HRRRv4 experiment.
5. **A missing build dependency should be patched around immediately.** Rejected. First close the canonical serial toolchain. If the locked source then fails against a modern compiler, record the first reproducible incompatibility before introducing any compatibility patch or source change.

## Evidence roots kept distinct

### Root A — locked NOAA-EMC HRRRv4 WRF3.9 architecture

`NOAA-EMC/HRRR@40ee6058c2fc6624cbfbbe8cf1c20c59e6a45827`, `arch/configure_new.defaults`, blob `f454bb000d020e88856d5be54de0df1b6fc82856`.

The GNU architecture advertises serial/smpar/dmpar/dm+sm. Its base stanza keeps `DMPARALLEL` commented, uses `gfortran/gcc` as serial compilers, and lists `mpif90/mpicc` as distributed-memory wrappers.

### Root B — locked NOAA-EMC configure logic

Same commit, `configure`, blob `6a2353f02837fe2b136362662161d7ad7acf02af`.

The MPI-2 test is conditional on `DMPARALLEL=1`. The same configure logic detects `libnetcdff` separately from `libnetcdf` and can query `nf-config` for NetCDF-Fortran dependencies.

### Root C — locked build driver and SCM I/O contract

Same commit:
- `compile`, blob `aca4393b8cd6898edcf676460e03768a114b54ff`, begins with `#!/bin/csh -f`;
- `Makefile`, blob `6bb8d424fc3216e81a4a33759735ef38591e8d33`, provides the `em_scm_xy` target;
- `test/em_scm_xy/namelist.input` uses NetCDF I/O form 2 for history, input and auxiliary forcing.

This establishes `csh` and a working NetCDF Fortran interface as relevant canonical build/run dependencies for the planned L1 path, while MPI is not a hard dependency for serial SCM.

### Root D — current official WRF documentation

Primary official documentation checked 2026-09-11:
- https://www2.mmm.ucar.edu/wrf/users/wrf_users_guide/build/html/running_wrf.html
- https://www2.mmm.ucar.edu/wrf/site/compiling_tutorial.html
- https://www2.mmm.ucar.edu/wrf/users/wrf_users_guide/build/html/compiling.html

Current WRF documentation states that 1-D/2-D idealized cases use serial compilation, requires netCDF-C + netCDF-Fortran for the standard build, and treats MPI/OpenMP as conditional on parallel processing.

### Root E — Unidata NetCDF-Fortran interface

Primary official documentation checked 2026-09-11:
- https://docs.unidata.ucar.edu/netcdf-fortran/current/nc_f77_interface_guide.html

The Fortran interface uses `netcdf.inc`/Fortran bindings and `libnetcdff`, which is distinct from and dependent on the C `libnetcdf` library.

These are engineering/build evidence roots, not physical atmospheric Observation Roots.

## Executable evidence

Probe: `PROBES/hrrrv4_scm_toolchain_probe_r25.py`
SHA256: `79d2ccfb66de7a4df832c922d642608440f721d7f3af8b2c4f78418be52665d1`

The bounded runtime contained:
- GNU Fortran 14.2.0 and GCC;
- Make, Perl, m4, cpp, ar, sed and awk;
- netCDF-C 4.9.3 and `nc-config`.

It did not contain:
- `csh`;
- `nf-config`, `netcdf.inc`/`netcdf.mod`, or a usable netCDF-Fortran interface;
- `mpif90`.

The executable C probe compiled, linked and ran against `libnetcdf`. The matching Fortran-style probe failed at `include 'netcdf.inc'`. The toolchain classifier therefore returns:
- `mpi_is_hard_blocker_for_serial_l1_scm = false`;
- `canonical_scm_requires_netcdf_io = true`;
- `ready_for_locked_serial_scm_configure_compile = false`;
- current blockers: `csh`, `netcdf-fortran`.

A package-install attempt could not complete because the bounded runtime could not resolve external package repositories. This is an execution-environment limitation, not evidence that the dependencies are intrinsically difficult to install elsewhere.

No WRF/HRRR model numerical execution occurred.

## Distilled transferable method

Introduce a `ToolchainCapabilityVector` instead of a single `environmentReady` Boolean. Separate:
- `BuildModeIdentity` (`serial`, `smpar`, `dmpar`, `dm+sm`);
- `HardDependency` required by the chosen canonical path;
- `OptionalParallelDependency` needed only by a different execution mode;
- `ArtifactFormatDependency` implied by canonical input/output contracts;
- `BuildDriverDependency` implied by the locked source tooling;
- `CompatibilityUnknown` for compiler/source-generation combinations not yet executed.

A missing dependency may block one execution mode but be irrelevant to another. Conversely, a library with the same family name may expose only one language interface and therefore not satisfy the consuming program.

This transfers beyond Weather: Houdini/UE/Blender/Substance/3ds Max automation should preserve which host mode, plugin/runtime ABI, language binding, artifact format and build/driver layer were actually validated rather than collapsing them into “tool installed”.

## Status ledger

- **Observation:** no new physical atmospheric Observation Root.
- **Candidate:** `ToolchainCapabilityVector`, `BuildModeIdentity`, `HardDependency` versus `OptionalParallelDependency`, `ArtifactFormatDependency`, and a serial-SCM L1 build contract.
- **Current Best View:** L1 `em_scm_xy` should be attempted as a locked-source serial build. Missing MPI is not a blocker for this 1-D validation harness; the current bounded environment is blocked by `csh` and NetCDF-Fortran instead.
- **Frozen:** none.
- **Rejected:** “missing mpif90 blocks serial SCM”; “netCDF-C proves netCDF-Fortran readiness”; “configure-without-NetCDF preserves the canonical L1 harness”; “current WRF build machinery can silently replace locked HRRRv4 build behavior”.
- **Unknown:** whether the locked HRRRv4/WRF3.9 SCM compiles unchanged with GNU Fortran 14 after canonical dependencies are installed; whether additional legacy-compiler incompatibilities appear; actual L1 model execution/non-interference/I/O cost; L3 operational-state execution; downstream visible-band optical closure.

## Routing / next gate

Close the **serial toolchain** first in an environment that can install the missing dependencies:
1. install/lock `csh` and a NetCDF-Fortran build compatible with the same compiler as NetCDF-C/WRF;
2. run the official Fortran+C+NetCDF compatibility test before WRF compilation;
3. configure the locked HRRRv4/WRF3.9 tree with the GNU **serial** option and no unnecessary distributed-memory dependency;
4. compile `em_scm_xy` without changing physics source code;
5. if compilation fails, record the first reproducible locked-source/compiler incompatibility before any patch;
6. if compilation succeeds, proceed to the existing R24/R22/R21/R23 L1 `ControlInstrumentedPair`, then R20 comparator and performance gates.

Do not advance ReplayStatus from toolchain closure or L1 success. `ReplayStatus` remains `source_callpath_authenticated` until the L3 state-source-aligned real-input/checkpoint gate is independently matched.
