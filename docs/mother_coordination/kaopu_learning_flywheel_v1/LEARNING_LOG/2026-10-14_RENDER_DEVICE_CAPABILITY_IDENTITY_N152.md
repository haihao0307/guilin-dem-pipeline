# N152 — Exact render-program capability identity

## Bounded question

Has Skin R02.1 converted the user-visible black-frame failure into a fail-closed, replayable compatibility gate, rather than only repairing the current 18-to-15 sampler instance?

Decision: the exact R02.1 black-frame repair remains a valid scoped candidate, but the reusable gate is `HOLD_CAPABILITY_GATE_POSITIVE_CONTROL_MISSING` until an intentionally over-budget final-program fixture is rejected.

## Existing real failure

- The user's Skin R02 page loaded roughly 80 MiB, built the UI and reported cached resources, but the 3-D canvas stayed black.
- Exact old subject `69d5cb9bfd68c2950112346403f1bf530d4180c0` used 18 active fragment samplers. The earlier Linux SwiftShader verifier exposed 32 fragment units and passed.
- Chrome 154 / ANGLE D3D11 WARP exposed 16 and logged `FRAGMENT shader texture image units count exceeds MAX_TEXTURE_IMAGE_UNITS(16)`.
- R02.1 exact public snapshot `7c406b142ac5732c999a87797251e38697b31f17` reorganized equivalent data to 15 fragment samplers, retained the feature set, linked on the 16-unit target and rendered a checked first frame.

This is a real environment-coverage failure: the user became the first low-budget compatibility verifier even though a higher-budget CI renderer was green.

## External method / evidence

The Khronos WebGL 2 specification exposes `LINK_STATUS` through `getProgramParameter` and explicitly makes active-program queries invalid after a failed link. It also treats texture-unit limits as implementation-dependent resources. The related OpenGL specification states that exceeding active sampler limits causes link failure.

- https://registry.khronos.org/webgl/specs/latest/2.0/
- https://registry.khronos.org/OpenGL/specs/sc/sc_spec_2.0.pdf

This confirms the production diagnosis but does not add a new teacher beyond the already implemented R02.1 method. Teacher decision: `NO_NOVELTY`.

## Comparison with current KAOPU controls

R02.1 already improves the current receipt materially:

- exact tested subject and public bytes;
- browser version, backend/driver and queried resource limits;
- final driver `LINK_STATUS` and active sampler inventory;
- first-frame and non-background pixel evidence;
- feature preservation and explicit `fallbackActive=false` semantics.

The missing reusable control is a test-only program that exceeds the declared target profile and proves the gate reports failure. Without that control, future changes to program discovery, sampler stage accounting or first-frame logic could make the checker silently stop observing the failure mode.

N152 creates a new regression because no existing KAOPU case covers render-program capability identity. It does not duplicate task freshness, tested-subject identity, provenance or generic browser execution checks.

## Falsifiable hypothesis

For a declared target profile, binding the exact final-program identity, driver link result, active resource counts, capability limits, preserved feature-set digest and a real first-frame readback—plus an injected over-budget program that the gate must reject—will detect both the original 18-over-16 black frame and any future attempt to pass by silently deleting features.

The hypothesis is falsified if the positive control links/passes, if the exact production program exceeds a bound without rejection, if a feature-reduced fallback passes as equivalent, or if a linked program with no usable first frame is promoted.

## Minimal historical replay

The N152 classifier replays seven cases:

1. old R02 passing only on a 32-unit SwiftShader profile;
2. model-ready / `onBeforeCompile` evidence without driver link status;
3. old R02 on the exact 16-unit D3D11 profile;
4. a budget pass obtained by silently removing an eye feature;
5. an in-budget linked program without first-frame readback;
6. exact R02.1 scoped evidence without a gate positive control;
7. a complete exact-program receipt with an over-budget control detected.

Result: see `PROBES/render_device_capability_result_n152.json`.

## Scope and adoption

- Candidate for WebGL workbenches with declared compatibility targets; not a global hardware-acceptance certificate.
- Does not require changing the already passed R02.1 runtime or re-running it merely to satisfy this learning note.
- A test-only over-budget shader must remain outside production visuals and lineage.
- Does not convert Chrome/WARP evidence into physical user-GPU, Safari, Vision Pro, mobile-device or performance acceptance.
- Does not authorize deleting skin, eye, ear, lip, lighting or material features to fit a budget.
- Does not modify PR #267, production branches, main, R2 or any threshold.
- Routed only to Skin PR #267: https://github.com/haihao0307/guilin-dem-pipeline/pull/267#issuecomment-6153809464
- Lifecycle after routing: `POSTED=true`; `CLASSIFICATION-GATE-RUN=true (7/7)`; `ACKNOWLEDGED / IMPLEMENTED / SKIN-PRODUCTION-GATE-RUN / ADOPTED / USER-ACCEPTED=false`.
- Effect KPIs: original user-visible black-frame correction count is one; all comparative rates and time-to-legal-candidate remain `unknown`.
