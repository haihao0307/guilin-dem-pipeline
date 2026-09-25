# N39 — Artifact Size Is Not a Resource Budget

## Bounded question

Can Fish R012's exact 94,452,856-byte artifact identity plus a successful hosted Chromium run verify a constrained-device resource envelope?

## 1. Existing real failure

- R012 tested immutable subject b5f2d11cbf55e17518dda411bf034596818c46d5 in run 35974311593 / job 107551050350.
- The Delivery Receipt records the exact HTML size and SHA-256 and successful desktop, 390x844, public-browser, WebGL-unavailable and context-loss recovery checks.
- Its workflow uses GitHub-hosted ubuntu-latest and Playwright Chromium. It records no pinned resource-budget profile and no transfer, decoded-body, heap, RSS, GPU, CPU-window, first-visible or interactive measurements.
- R006 had successful hosted evidence but a real user white-screen report. That observation rejects the stronger user-visible claim; it does not prove resource exhaustion as the unique cause.

## 2. External method and evidence

- W3C Resource Timing distinguishes transferSize, encodedBodySize and decodedBodySize; a single file byte count is not interchangeable with all three. The current Recommendation also excludes data-URI resources from Resource Timing entries.
- Chrome DevTools Performance Monitor treats CPU usage, JavaScript heap size, DOM nodes, event listeners, documents/frames and layout/style work as separate live metrics.
- WebGL permits implementation-dependent drawing-buffer constraints, OUT_OF_MEMORY allocation outcomes and context loss/restoration. Recovery-path success therefore does not reveal the peak resource envelope.
- Paint Timing separately defines first paint and first contentful paint, so final runtime success does not by itself bind early visible progress.

Primary sources:

- https://www.w3.org/TR/resource-timing/
- https://developer.chrome.com/docs/devtools/performance-monitor
- https://registry.khronos.org/webgl/specs/latest/1.0/
- https://www.w3.org/TR/paint-timing/

## 3. Comparison with current KAOPU rules

R2 already separates evidence layers, forbids stale substitution and requires claim-scoped receipts. N33 covers visible shell before payload; N37 separates viewport emulation, hosted browser and physical device; N38 controls golden updates. No existing candidate found in the applicable regression set makes a resource-budget claim machine-decidable. That is the N39 novelty; the general rule that evidence scope must not be overstated is no-novelty.

## 4. Falsifiable hypothesis

If a resource gate requires a pre-pinned task budget, compatible claim/evidence environments and every required measurement, it will preserve the valid R012 artifact/runtime claims while refusing the unmeasured constrained-device claim. A complete compatible synthetic control should pass; missing, exceeded and environment-mismatched controls should yield three different non-pass decisions.

## 5. Minimal replay

resource_envelope_gate_n39.mjs replays the historical R012 receipt as evidence-preserving but resource-unknown, preserves the R006 user rejection without inventing a root cause, and evaluates four counterfactual controls.

Expected result: 12/12 assertions pass.

## 6. Applicability boundary

- Local to Fish large standalone WebGL deliveries that make resource claims.
- No global threshold is introduced.
- A task may choose different required metrics; unobservable GPU memory remains Unknown rather than fabricated.
- Hosted Chromium evidence cannot satisfy a physical-device profile unless the profile explicitly declares compatibility.
- Physical-device runtime and user acceptance remain independent.

## 7. Adoption decision

Candidate partial. Route only to Fish issue #91 for the next applicable task. Do not modify main R2, production branches, Canonical Truth or current release claims. Adoption requires a real Mother trial plus independent verifier evidence.

## Status and KPI

Prepared for POSTED routing only. ACKNOWLEDGED, IMPLEMENTED, GATE-RUN, ADOPTED and USER-ACCEPTED are false. First-pass acceptance, user-correction count, recurrence rate, stale delivery count and time-to-legal-candidate remain Unknown.

No first-tier external expert AI was called.
