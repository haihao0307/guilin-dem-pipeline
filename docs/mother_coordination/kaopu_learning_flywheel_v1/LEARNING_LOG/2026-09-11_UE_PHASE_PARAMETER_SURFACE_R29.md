# KAOPU bounded learning cycle — R29 UE phase parameter-surface identity

Date: 2026-09-11
Learning question: `LQ-ATMOSPHERE-001`
Status: Candidate partial; no Frozen change; no production Mother mutation.

## Why this question was selected

The coordinator still ranks `LQ-ATMOSPHERE-001` first. R28 correctly refused to guess a UE phase sign, but it treated two official descriptions as a direct documentation conflict. The highest-value bounded follow-up was to test whether those descriptions actually refer to the same parameter surface.

## Logical error corrected before implementation

R28 over-classified the evidence as `PrimaryDocumentationConflict`. The official UE 5.8 pages describe two different surfaces:

- `Volumetric Advanced Material Output -> Phase G / Phase G2`, where Epic documents `g < 0` as forward and `g > 0` as backward.
- the default engine cloud **material instance** `m_SimpleVolumetricCloud_Inst`, derived from `m_SimpleVolumetricClouds`, where the user-facing `Phase A / Phase B` controls are documented as positive-forward and negative-backward.

Those statements are not logically contradictory unless an identity mapping between the material-instance controls and raw `PhaseG/PhaseG2` has first been established. The official pages inspected this cycle do not establish that mapping.

A hidden sign inversion is one possible reconciliation, but assuming `g_raw = -PhaseA` would itself be another unsupported leap. Many sign-reversing transforms satisfy the two documented direction semantics. The exact parent-material graph or runtime must be inspected.

## Primary evidence roots kept distinct

### Root A — Epic UE 5.8 Volumetric Advanced Material Output
Official Component Properties and generated API/header documentation both identify the primitive `PhaseG/PhaseG2` surface and document negative values as forward scattering and positive values as backward scattering.

Sources checked 2026-09-11:
- https://dev.epicgames.com/documentation/unreal-engine/volumetric-cloud-component-properties-in-unreal-engine
- https://dev.epicgames.com/documentation/unreal-engine/API/Runtime/Engine/UMaterialExpressionVolumetricAdv-_1

### Root B — Epic UE 5.8 default Volumetric Cloud Material
The official material page explicitly says its settings are parameters of the default material instance `m_SimpleVolumetricCloud_Inst`, derived from `m_SimpleVolumetricClouds`. Its `Phase A / Phase B` user controls are documented positive-forward / negative-backward.

Source checked 2026-09-11:
- https://dev.epicgames.com/documentation/unreal-engine/volumetric-cloud-material-in-unreal-engine

### Root C — SideFX Houdini asset parameter promotion
Current SideFX documentation shows that an HDA user-interface parameter may be promoted from an internal node and drive that internal parameter through a reference. The asset control and internal primitive remain distinct parameter surfaces even when directly linked.

Sources checked 2026-09-11:
- https://www.sidefx.com/docs/houdini/assets/asset_ui.html
- https://www.sidefx.com/docs/houdini/ref/windows/optype

### Root D — Adobe Substance 3D Designer exposed parameters
Adobe documentation distinguishes graph-level exposed controls from node-level parameters and explicitly allows one exposed graph control to drive multiple internal node parameters. This independently supports the transferable distinction between public control surface and internal operator parameter.

Source checked 2026-09-11:
- https://helpx.adobe.com/substance-3d-designer/using/exposing-parameters.html

These are software/documentation evidence roots, not physical atmospheric Observation Roots.

## Executable evidence

Probe: `PROBES/ue_phase_parameter_surface_probe_r29.py`
Result: `12/12 PASS`
SHA256: `81e5de2c9eaec2ae5e953c4333bdc97adc0ef3c5a5defac7677a3df3c81a3475`

The probe models the two documented parameter surfaces separately. It proves:
- direct identity mapping is inconsistent with the two documented sign semantics;
- a sign inversion can reconcile them;
- a scaled sign inversion can also reconcile them;
- therefore the documentation alone does not identify the actual transform.

This is source-semantic executable evidence only. It does not prove that Epic's default material actually uses negation, does not run UE, and does not authenticate runtime radiance.

## Distilled transferable method

Add `ParameterSurfaceIdentity` for every externally visible control. Record at least:
- system/version;
- surface layer (`physical-source`, `kernel/primitive`, `graph-internal`, `asset-wrapper`, `instance/UI`, `display-only`);
- stable identifier and UI label separately;
- documented semantic/range/default;
- target primitive(s), if known;
- mapping/transform identity and version, if known;
- evidence status.

Add `ControlTransformIdentity` whenever a control crosses a parameter surface. It must preserve whether the mapping is identity, sign inversion, scale/offset, nonlinear function, fan-out to multiple nodes, conditional mapping, or Unknown.

Use `CrossSurfaceSemanticMismatch` instead of `PrimaryDocumentationConflict` when apparently incompatible statements refer to different surfaces and the mapping between them is unresolved. Reserve `PrimaryDocumentationConflict` for incompatible claims about the same versioned parameter surface/identifier under the same interpretation context.

This transfers directly to Houdini HDAs, Substance exposed graph controls, Unreal Material Instances and similar wrapper systems. A convenient artist control is not automatically the physical/operator parameter it eventually drives.

## Constraints for ordinary developers

The remaining UE question cannot be solved reliably from current public prose alone. The exact `m_SimpleVolumetricClouds` parent-material graph is Engine Content, and the mapping from `Phase A/B` to the raw Advanced Output inputs is not documented textually in the inspected pages. A developer needs a matching UE 5.8 installation/project or equivalent source/asset inspection, plus a controlled linear-radiance fixture if runtime behavior is to be authenticated.

Without that access, claiming the mapping is negation would be invented precision.

## Status ledger

- **Observation:** no new physical atmospheric Observation Root.
- **Candidate:** `ParameterSurfaceIdentity`, `ControlTransformIdentity`, `CrossSurfaceSemanticMismatch`, and the refined two-surface UE phase test.
- **Current Best View:** UE 5.8 raw `PhaseG/PhaseG2` has source-documented negative-forward semantics; default-material `Phase A/B` has separately documented positive-forward user semantics; their mapping is Unknown. Do not call this a same-parameter documentation conflict unless identity of the surfaces is first proved.
- **Frozen:** none.
- **Rejected:** equating controls by similar phase naming; assuming wrapper-to-primitive identity; assuming the undocumented mapping is negation; treating a wrapper UI label as physical truth; selecting whichever sign matches another renderer.
- **Unknown:** exact `m_SimpleVolumetricClouds` Phase A/B -> raw PhaseG/G2 transform; UE 5.8 runtime primitive sign/family; UE Extinction numeric unit; acceptable phase-reduction tolerance; R25 serial-SCM runtime.

## Routing / next gate

For UE 5.8, run two deliberately separate fixtures:
1. a minimal Volume material that wires a scalar parameter directly into raw `Volumetric Advanced Material Output.PhaseG`, with multiscatter/display effects isolated;
2. the default `m_SimpleVolumetricCloud_Inst` surface using its `Phase A/B` controls.

Use the same homogeneous medium, light/view geometry and signed sample set. First authenticate the primitive raw `PhaseG` sign from linear radiance or shader/source evidence. Then vary `Phase A/B` and solve the actual wrapper-to-primitive mapping. Record that mapping as `ControlTransformIdentity`; do not infer it from labels.

Karma remains a separate adapter with its documented positive-forward anisotropy convention. Weather/Atmosphere source `g` must stay renderer-neutral and may only cross into either renderer through an explicit, versioned adapter.

No R29 result advances `ReplayStatus`; the existing L3 HRRR checkpoint/replay gate retains that authority.
