# R07 bounded candidate acceptance

Tested runtime commit: [`e3e7dccfb566a5163bdf9510310520d520325212`](https://github.com/haihao0307/guilin-dem-pipeline/commit/e3e7dccfb566a5163bdf9510310520d520325212).

Actual Chromium/SwiftShader run: [39550260959](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/39550260959). Status: **bounded hosted-component checks passed; whole-building delivery is NOT COMPLETE**. [Machine-readable outcomes and hashes](candidate2-summary.json).

- All 360 old/new CPU tests passed. The new case components remain analytic function domains, with no object vertex/index buffers. Actual browser audit: 0 buffers, 0 indexed draws; all 168 screen dispatches used three ray-launch vertices.
- All three cases rendered at 840×667 with closed/open components and source-bound context. Point/normal/material/local-coordinate and ray samples passed, including parameter propagation, invalid rejection, baseline disable, reset and retained original source patches/roofs.
- Eight actual-window optical rays (four closed, four open) compared the same GLSL transport used by rendering against CPU evaluation. Maximum internal-path difference was 0.20 micrometres. This is sampled evidence, not a universal numerical bound or full glazing validation.
- Motion checks use 101 poses and bounded points against authored design solids. No overlap was found at those samples, including edited dimensions. This is **not** a continuous swept-volume proof; measured-shell occupancy remains undefined. No structural, accessibility, fire or hardware certification is implied.
- The exact same shader suite was reused for openT 0 / 0.5 / 1. Descriptors were replaced, not geometry simplified. CPU submission times were 11.5–56.2 ms, which are not presentation/GPU latency.
- At 160×127, two warmed software-renderer samples per case gave medians 323.4 ms (lowrise), 460.3 ms (KCC), and 273.1 ms (warehouse). Pointer-to-moving screenshot took 0.87 s and pointer-up-to-840×667 settled screenshot took 10.09 s. Both include automation/capture overhead. This is an on-demand learning viewer, not a 60-fps or iOS-device performance claim.
- Desktop 390×844 CSS layout passed; no actual iOS device was tested. R03/R04/R05 browser regression and 19 old-file hashes passed; 15 frozen R06 runtime hashes matched.

## Deliberate limits

Actual window placement, wall/frame depth, glass product and opening mechanism remain editable design assumptions. KCC contains a representative floor, not all storeys. Warehouse vehicle/freight interfaces have fixed frames only, not invented shutters or machinery; circular vents were not reclassified as glass. No security grille or detailed hinge/handle hardware was added. Glass reflection is sky-only; transmission stops at a second pane, with no caustics or internal-reflection simulation.

The pre-existing warehouse horizontal coplanar/material seam remains visible in its wide context view. Frozen R06 still has its known single unresolved underside-grazing pixel and **FAILED full zero-unresolved acceptance**; this R07 component result does not replace that report.

Candidate 1's co-boundary identity failure is preserved in [candidate1-summary.json](candidate1-summary.json), not relabelled as passed. R07 now chooses a stable representative from the final scalar-minimum + 10 micrometre identity window, while retaining the actual minimum signed distance/ray parameter and negative occupancy. The tolerance selects an identity, not a tessellation or geometry LOD.

This is a publicly reachable learning stage, not a formal product release. Existing source/material notices and formal-release provenance limitations remain applicable.
