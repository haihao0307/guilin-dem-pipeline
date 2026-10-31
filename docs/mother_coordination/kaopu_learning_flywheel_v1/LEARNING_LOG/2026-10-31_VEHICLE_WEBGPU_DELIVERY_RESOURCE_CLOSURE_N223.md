# N223 — Vehicle WebGPU delivery resource closure

## Bounded question

Does the current private Vehicle checkpoint contain a runnable, manifest-pinned WebGPU compute route, or only a host prototype plus CPU/mock evidence?

## Why this question is current and real

The audited Library object was updated on 2026-10-31 and is the current private Vehicle checkpoint. N221 established that compute-to-storage-to-canvas is a standards-level triangle-free route Candidate. N222 established that function-class sharing does not erase per-instance work. Neither result proves that a specific Mother package actually delivers the route.

The exact audited archive is `KAOPU_VEHICLE_FUNCTION_REBUILD_R01_PRIVATE.zip` version 18, SHA-256 `745b9f97c5511f145131f35b007458c81adb8851f865e2103b5e69c0436c8e77`.

## Observation

The package contains a genuine CPU direct-function renderer and an isolated GPU host prototype:

- `preview/index.html` obtains a 2D canvas context, calls `putImageData`, and labels the display `CPU Canvas2D`.
- `runtime/display/renderer.mjs` loops over every part, evaluates per-object grids/jets, rasterizes approximate tangent footprints on CPU, and produces RGBA/depth/object-ID buffers. This is function display without runtime triangles, but it is not WebGPU compute.
- `runtime/gpu-experiment/index.mjs` defines five compute passes and loads `./compute.wgsl`.
- The GPU experiment README truthfully limits support to self-authored plane/biquadratic fixtures, rejects transforms/trims/compositions/current car bundles, and says no real adapter compiled or executed WGSL.

The new failure is delivery closure: `runtime/gpu-experiment/compute.wgsl` is absent from the archive and absent from `CHECKPOINT_MANIFEST.json`. The checkpoint builder's text allowlist includes Python/JS/HTML/Markdown/text, but not `.wgsl`. Thus archive integrity succeeds while the runnable route is incomplete.

The green tests do not refute this:

- owner suite: 17 CPU/fail-closed checks and 5,202 math-core scalar comparisons; `gpuExecuted:false`, `shaderCompiled:false`;
- independent suite: 30 CPU/mock checks; its mock replaces `fetch()` with an empty shader string and injects compilation messages rather than loading the delivered shader;
- independent review records a SHA-256 for `compute.wgsl`, showing that a reviewed source existed before packaging, but that byte is not in this delivered checkpoint.

## Existing system comparison

R2 already requires truthful receipts, frozen evidence, freshness, and no silent fallback. The checkpoint manifest hashes every captured byte, but its current invariant is one-way: `captured -> hashed`. It does not prove `runtime reference -> captured and hashed`. This is not a duplicate of freshness or no-creative-substitute; it is a concrete transitive-resource closure gap.

## Falsifiable hypothesis and replay

Hypothesis: requiring local runtime references to exist, be manifest-pinned, and be loaded from delivered bytes would catch incomplete executable routes that captured-file hash verification and mock-only tests miss.

The N223 probe replayed this on one current Vehicle package. It passed all 13 evidence checks and found the exact missing/unpinned shader dependency while preserving the valid CPU/function-geometry claims.

Decision: `HOLD_VEHICLE_WEBGPU_ROUTE_DELIVERY_RESOURCE_CLOSURE_FAILED`.

## Candidate, not global rule

Candidate gate fields:

- Task Anchor: `runtimeEntryPoints`, `transitiveRuntimeResources`, `resourceManifestPins`, `resourceLoadTestMode`, `realBackendExecutionStatus`.
- Delivery Receipt: `executableResourceClosure`, `missingRuntimeResources`, `mockedResourceLoads`, `backendActuallyExecuted`.
- Fail closed: `HOLD_RUNTIME_ROUTE_NOT_DELIVERED` when any in-scope local resource is absent/unpinned or all green tests bypass/replace its load.

Smallest Mother follow-through: add the intended WGSL byte to the private checkpoint allowlist, pin it in the manifest, make a test load the packaged bytes, then compile/dispatch the bounded fixture on a real adapter when available. Passing that still would not prove current vehicle-bundle support, production integration, performance, fidelity, or N222 instance-work elimination.

## State

- Observation: current archive and manifests inspected; owner and independent CPU/mock suites rerun.
- Candidate checker: IMPLEMENTED on the learning branch only.
- GATE-RUN: current Vehicle package, 13/13 evidence checks.
- Mother routing: pending POSTED to #91.
- ACKNOWLEDGED / production IMPLEMENTED / ADOPTED / USER-ACCEPTED: false / unknown.

