# KAOPU Current Best View — R29 parameter-surface extension

Date: 2026-09-11
Status: Candidate extension to `CURRENT_BEST_VIEW.md`; no Frozen change.

307. Apparently incompatible parameter descriptions must not be treated as a documentation conflict until the parameter surfaces are proven identical.
308. In UE 5.8, raw `Volumetric Advanced Material Output.PhaseG/PhaseG2` and the default cloud material instance `Phase A/Phase B` are different documented surfaces. The former is a primitive material-output input; the latter is a user-facing parameter surface of `m_SimpleVolumetricCloud_Inst` derived from `m_SimpleVolumetricClouds`.
309. Epic documents raw `PhaseG/PhaseG2` as negative-forward / positive-backward, while the default material `Phase A/B` controls are documented positive-forward / negative-backward. This does not by itself prove a contradiction because the wrapper-to-primitive transform is not established by the inspected documentation.
310. The R29 executable probe proves an identity mapping is inconsistent with those two descriptions, while multiple sign-reversing transforms are consistent. Therefore documentation alone cannot identify the actual transform.
311. A sign inversion is a viable hypothesis, not a promoted fact. The exact `m_SimpleVolumetricClouds` graph or UE runtime must authenticate the mapping.
312. Introduce `ParameterSurfaceIdentity` with explicit layer identity (`physical-source`, `kernel/primitive`, `graph-internal`, `asset-wrapper`, `instance/UI`, `display-only`), stable identifier, UI label, semantic, range/default, target primitive(s), version and evidence status.
313. Introduce `ControlTransformIdentity` whenever a parameter crosses surfaces. The mapping may be identity, sign inversion, scale/offset, nonlinear, conditional, fan-out to multiple internal targets, or Unknown.
314. Use `CrossSurfaceSemanticMismatch` when two surfaces expose different conventions but their mapping is unresolved. Reserve `PrimaryDocumentationConflict` for incompatible claims about the same versioned parameter surface under the same interpretation context.
315. Houdini HDA promotion and Substance exposed graph parameters independently demonstrate that public controls and internal node parameters are distinct surfaces; one public control can drive one or multiple internal parameters.
316. Renderer-neutral Weather/Atmosphere phase state must never adopt a wrapper UI convention. It crosses into a renderer only through an explicit versioned adapter and, where applicable, a `ControlTransformIdentity`.
317. R29 adds no physical Observation Root, does not execute UE/Karma/WRF/HRRR, leaves `ReplayStatus=source_callpath_authenticated`, modifies no production Mother branch and leaves Frozen unchanged.

R29 evidence status:
- **Observation:** no new physical atmospheric Observation Root; Epic, SideFX and Adobe sources remain software/documentation evidence roots.
- **Candidate:** `ParameterSurfaceIdentity`, `ControlTransformIdentity`, `CrossSurfaceSemanticMismatch`, refined UE raw-vs-wrapper phase fixture.
- **Current Best View:** raw UE `PhaseG` and default-material `Phase A/B` must be tracked as separate surfaces; raw sign is source-documented, wrapper user semantics are separately documented, and the transform between them remains Unknown.
- **Frozen:** none.
- **Rejected:** same/similar label implies same parameter; direct-copy mapping without evidence; assuming negation merely because it reconciles signs; wrapper UI semantics as physical truth; using another renderer to choose UE's sign.
- **Unknown:** actual `m_SimpleVolumetricClouds` Phase A/B -> raw PhaseG/G2 mapping; UE 5.8 runtime primitive behavior; UE Extinction numeric unit; acceptable phase reduction tolerance; R25 serial-SCM runtime.
- **Executable source-semantic probe:** `PROBES/ue_phase_parameter_surface_probe_r29.py`, result `12/12 PASS`, SHA256 `81e5de2c9eaec2ae5e953c4333bdc97adc0ef3c5a5defac7677a3df3c81a3475`.
