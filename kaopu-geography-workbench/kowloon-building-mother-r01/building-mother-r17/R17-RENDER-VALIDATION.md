# R17 validation record (2026-10-25)

Not released. R16 remains public baseline. Original openable window library is not yet located; the existing glass is not claimed as that library.

## Confirmed runtime changes

- Native grey background, independently tested cool high-left and warm low-right lights.
- Neutral candidate roof/floor/structural materials replace previous purple/green diagnostic colors. Material identity remains inferred where photographs do not establish it.
- Six registered KCC host faces contain 176 integrated windows. Host wall is a finite solid with inner face, opening side faces, inset infill and sill, not a source surface plus global hole subtraction. Thickness is an explicit candidate parameter, not surveyed.
- Other source faces and buildings still retain older bounded source representation. Floor-isolation mode currently falls back to the prior representation; it must not be described as fully migrated.

## Actual native browser evidence

QA commit 4f935e0bed4d959d6c5239bf880740947a9f9bc7, run 40156737179:
- 1366x900 viewport, 1002x527 native drawing buffer, no movement resolution reduction.
- Whole cold draw 32.782 seconds. Whole warm draw 11.501 seconds. This is not interactive performance.
- 484 host CPU/GPU ray comparisons passed; host-row scheduling preserves all 6,336,648 hit-buffer components and displayed pixels bitwise.
- 484 remaining-aperture CPU/GPU ray comparisons passed for wood/metal glass and closed/open doors. Maximum recorded local-position error 0.183 mm; IDs and material roles matched. Entire scene restored and rendered afterward.
- Cool-only/warm-only/both actual frames differ. This proves actual lighting, not a label-only control.

## In progress, not claimed passed

- Whole-scene candidate-limit scheduling native buffer A/B: commit ef11fc268b4b09862d86d1892228805863b375a6, run 40157541252. CPU adversarial F32 tests passed but do not replace GPU results.
- Retained lift 1 to 4 to top and each generated room by corridor traversal: commit 95a574692597c6ab2a43a6aed98405f57dafc5b9, run 40157341151. Accelerated controller-clock QA is not a smooth real-time demonstration. Interior layout is a design candidate, not registered as-built plans.

## Current bottleneck

Previous whole-frame GPU stage deltas: assembly about 5.85 s, remaining apertures about 3.92 s, integrated hosts about 0.49 s. No geometry was removed to improve timing. Primary aperture candidate scheduling must retain original interval, ownership tie rules, neighbors, local surface identities and final nearest-hit acceptance. Any invalid numerical bound fails open to original traversal.

## Later results, 03:29 UTC

- Primary candidate scheduling: native 6,336,648 components and full color image identical; 8.994→9.056 s in paired render, no demonstrated speed gain.
- Host-first pass order: same native equivalence for the tested whole view; 11.155→11.159 s, no demonstrated speed gain. Disabled by default. Independent counterexamples show clipping entry-cap and Float32 broad-phase risks, so ordinary-view equivalence is not a universal certificate. Local guard retains original order for clipping/slice views.
- Full-frame journey run 40157341151 hit its existing total budget only after actual arrival at design 4 and 28, and actual 20-step entry into top rooms A/B/C. No page errors recorded. D/E/F not completed by that run. Thus lift logic did not stall; per-waypoint software rendering exhausted budget.
- Following explicit user task coordination, keyframe QA records original controller and interlock states while advancing original simulation time without drawing every intermediate state, then draws actual complete keyframes. It does not alter floor dimensions, controller speed, collision geometry, or assert real-time smoothness. Run 40158264855 pending.

## Keyframe journey result, 03:34 UTC

Run 40158264855 succeeded. Actual native frames confirm design levels 4 and 28 reached with stationary/leveled/open doors and A–F top-floor rooms reached via twenty path increments each. Controller simulation retained its normal parameters and 0.05 s internal steps; intermediate simulation states were recorded without rendering every tick. This is neither real-time playback nor proof of actual building interiors. Arrival frames took 7.5–10.1 s and room frames 3.8–4.4 s on SwiftShader. The script used a corridor bookmark between room entries; a subsequent explicit return-path regression is pending, so continuous return traversal is not yet claimed.

Both no-benefit optimization experiments are default-off in the local final candidate. Source/host geometry and material remain unchanged.
