# KAOPU Current Best View — R28 phase-convention extension

Date: 2026-09-11
Status: Candidate extension to `CURRENT_BEST_VIEW.md`; no Frozen change.

293. A phase parameter is incomplete unless it carries a `PhaseConventionIdentity`: phase family, parameter meaning, incoming/outgoing direction-vector orientation, cosine/angle definition, sign-to-forward convention, normalization, lobe/blend semantics, spectral identity, implementation/version and evidence status.
294. A scalar asymmetry parameter `g` should be preserved as a first angular/Legendre moment where that is its source semantic. It is not a complete phase curve.
295. PBRT documents HG `g` as the mean cosine and positive `g` as forward scattering, while also explicitly using a both-directions-away vector convention that differs from common scattering literature. Therefore algebraic formula sign and physical forward/backward semantics must not be conflated.
296. The R28 executable probe verifies that transforming the cosine for the different direction-vector convention preserves the same physical HG distribution exactly at the sampled angles.
297. Current official UE 5.8 documentation contains a material conflict that must remain explicit: generated API/header and Volumetric Cloud Component Properties documentation describe PhaseG `g<0` as forward and `g>0` as backward, while the official default Volumetric Cloud Material page describes positive Phase A/B as forward and negative as backward.
298. The UE documentation conflict means `UERuntimePhaseSign` is `Unknown`; current documents are insufficient to promote a sign binding. SideFX/PBRT agreement does not resolve UE runtime behavior.
299. SideFX Karma currently documents positive anisotropy as forward and negative anisotropy as backward. Direct source-`g` routing to Karma is still permitted only after source and target phase family/angle conventions are shown compatible.
300. One first moment does not uniquely determine a two-lobe phase representation. The R28 probe constructs two normalized dual-HG mixtures with identical `P1=0.85` but second moments `0.7450` and `0.8375`, and an integrated angular L1 distance of about `0.7231` between them.
301. `PhaseMomentPacket` should preserve normalization `P0=1`, first moment `P1=g`, optional higher moments, source family/fit identity, spectral band and evidence status. Higher moments that are not present in the source must remain Unknown rather than being invented.
302. Mapping one source phase representation into another is a `PhaseReductionIdentity`, not a raw parameter copy. It must record source/target representations, objective, angular/spectral weighting, fitted parameters, fixture, error metric and tolerance.
303. If current primary documents disagree on a contract, preserve a `PrimaryDocumentationConflict` instead of choosing the statement that best matches expectation. Promotion waits for source-level or executable evidence.
304. Phase QA must precede multiple scattering, tone mapping and image acceptance. Use a homogeneous single-scattering directional fixture with known geometry and signed `g` pairs to authenticate renderer sign and angular convention from linear radiance.
305. Renderer noise/firefly controls, dual-lobe artistic shaping and multiscatter approximations are evaluator state. They may not mutate Weather or source optical truth.
306. R28 adds no physical Observation Root, does not run UE/Karma/WRF/HRRR, leaves `ReplayStatus=source_callpath_authenticated`, modifies no production Mother branch and leaves Frozen unchanged.

R28 evidence status:
- **Observation:** no new physical atmospheric Observation Root; Epic, SideFX and PBRT roots are renderer/reference-implementation evidence only.
- **Candidate:** `PhaseConventionIdentity`, `PhaseMomentPacket`, `PhaseReductionIdentity`, `PrimaryDocumentationConflict`, directional single-scattering phase-authentication fixture.
- **Current Best View:** preserve phase conventions and source moments explicitly; authenticate renderer sign/family separately; quantify any representation reduction before visual acceptance.
- **Frozen:** none.
- **Rejected:** universal raw-`g` identity; silently resolving conflicting primary docs; inferring physical convention from formula sign alone; unique dual-lobe mapping from one `g`; adding a second lobe for appearance and calling it physical; image similarity as phase proof.
- **Unknown:** actual UE 5.8 Volumetric Cloud PhaseG runtime sign/family; source-to-Karma family equivalence for the R27 HRRR optical asymmetry; acceptable reduction tolerance; UE Extinction unit; R25 serial-SCM runtime.
- **Executable numeric/source-semantic probe:** `PROBES/hrrrv4_phase_convention_probe_r28.py`, result `14/14 PASS`, SHA256 `d2b3db87487c3cc73f4ef474b4ad73533ec88eb5a1ec74a97e05e30abdc09856`.
