# KAOPU Current Best View — R14 HRRRv4 Thompson replay extension

Date: 2026-09-10
Status: Candidate extension to `CURRENT_BEST_VIEW.md`; no Frozen change.

123. Model-derived replay identity must lock the provider/model release, exact source commit/tag, source path/blob and relevant runtime configuration; directory/family labels alone are insufficient.
124. `ReplayStatus.source_locked` and `ReplayStatus.runtime_authenticated` are different states. A locked algorithm becomes runtime-authenticated only after real source inputs, branch/configuration state and a numerical checkpoint are matched.
125. NOAA-EMC HRRR commit `40ee6058c2fc6624cbfbbe8cf1c20c59e6a45827` is an operational-directory sync for `hrrr.v4.1.20`; its Thompson module blob is `1e6cdb1e718473ee1a031e16b1c00c96113f19f8`.
126. The fetched `calc_effectRad` block in that HRRR snapshot has no textual difference from the official upstream WRF V3.9 block, but this equivalence is local to that routine and does not make the whole HRRR fork equivalent to upstream WRF V3.9.
127. Runtime physics branch state is first-class provenance. HRRR's `mp_physics=28` is relevant configuration evidence, but the Thompson source additionally sets `is_aerosol_aware` according to presence of aerosol arguments; high-level scheme selection alone cannot substitute for call-path verification.
128. The HRRR v4.1.20 `calc_effectRad` routine is now a source-locked Candidate for `MicrophysicsDiagnosticReplay`, not yet an operationally numerically authenticated replay.
129. Radiation effective radius remains an intermediate source-model diagnostic. It cannot be promoted directly to visible-light extinction, scattering, albedo or phase without the R13 `SpectralOpticalClosureContract`.
130. A source match, numerical replay match and renderer match are separate gates and must report separate errors. Success at one gate must not be propagated as evidence for another.

R14 evidence status:
- No new physical atmospheric Observation Root was added.
- Primary engineering roots are the NOAA-EMC HRRR v4.1.20 operational source sync and official upstream WRF V3.9 source.
- Executable probe: `PROBES/hrrrv4_thompson_effective_radius_replay_r14.py`, result `7/7 PASS`; all numerical atmospheric inputs are synthetic.
- Frozen: none.
