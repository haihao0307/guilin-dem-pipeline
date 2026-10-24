# Original GPUCloth fixed-D CI diagnostic

## Scope and current status

This is an independent diagnostic work station for the existing GitHub CI. It is not a replacement application, a publication candidate, or a full R02 acceptance test. No local browser was started while preparing it.

The D fitting inputs are an exact byte copy of the appearance lane’s frozen source-grade fixture. The solver is the unchanged original `GPUCloth` and WGSL from `haihao0307/guilin-dem-pipeline`, commit `c5c0bedbc35f24cbb35426ab9c14b74ca7fc5f49`, folder `kaopu-tailor-workbench/material-products/mp05-studio-r10-3fc034fa91ef`.

A completed diagnostic proves only that this fixed D canonical-body fitting experiment completed its original numerical safety checks on the recorded CI adapter. It does not prove that the final R07 display body, GNM head, moving garments, six people, image quality, or user-device performance are acceptable. The current R02 candidate remains unapproved.

## Exact execution contract

| Contract | Value |
|---|---|
| Body collider | 9,253 canonical vertices; all 18,416 retained body triangles |
| Neutral body bookkeeping | 104 original identity skin matrices; no animated pose |
| Source garments | Complete T01 and P01 source packets, including original seam/rise refinements |
| Garment source/output vertices | T01: 2,332; P01: 6,607 |
| Physical particles after original seam merging | T01: 2,220; P01: 6,097 |
| Schedule | 48 frames at 1/60 s; first 32 interpolate body/rest metrics, final 16 retain target body |
| Substeps | Original 240 Hz, four substeps per frame |
| Constraints | Original 16 iterations plus 12 guard iterations |
| Source safety ceiling | Edge length / current original rest length > 1.45 rejects and rolls back |
| Settings | gravity 1, bend 1, softness 1, damping 7, clearance 4 mm |
| Backend | Original GPUCloth only; no WASM or ReducedCloth fallback |

The original GPU code owns body carry, coloured constraints, contact gathering, per-substep body interpolation, waist updates, buffer readback, source safety checks, and rollback. The harness does not emulate these operations.

The sole import-map override maps the original CoupledCloth `native-motion.mjs` import to a small, explicitly labelled fixture constructor returning `packet.bridge`. The appearance lane’s `SourceFitActorBridge.mjs` is copied without changes. This neutral actor API is appropriate only for the declared fixed-body fitting experiment. All physics and contact source files remain byte-identical to the locked originals.

## CI commands

Run from the application directory, with the workflow’s exact `SOURCE_HEAD=${{ github.sha }}` and the existing Playwright 1.58.2 / Chromium setup:

```sh
node evidence/independent-gpucloth-d48/prepare.cjs --out /tmp/r02-original-gpucloth-d48-site
node evidence/independent-gpucloth-d48/run-ci.cjs --site /tmp/r02-original-gpucloth-d48-site --out /tmp/r02-original-gpucloth-d48-results
```

Preparation requires the thirteen original files at `SOURCE_LOCK.json`’s `localProjectPath` entries. They can be added to the new Git tree by reusing the lock’s existing original Git blobs; no re-upload of those source bytes is necessary. The 7,647,414-byte SDF uses existing Git blob `8d78db9862254da576df8514e3bbf3f073eb1d5c`.

The frozen gzip input remains at `evidence/APPEARANCE_CLOTH_SOURCE_FIT_D_INPUTS.json.gz`, Git blob `7047fc3e8b75d1db493e7a3772e8d4f19d0c976b`. The other fixture text files remain at their existing evidence paths. Preparation copies them into the isolated site with new serving names, without changing bytes.

If the original files are intentionally absent, preparation also supports an explicit `--fetch-locked-originals` flag. This reads only URLs under the single pinned original commit and verifies byte length, SHA-256, and Git blob ID before including a file. It does not fetch a newer solver. The root workflow currently plans existing-blob reuse, so this flag is not required.

Both the site and results directories must initially be empty. The driver refuses to launch a browser unless `GITHUB_ACTIONS=true`; do not bypass that guard. The fixed whole-run budget is twenty minutes. A timeout is incomplete evidence, never a safety pass.

Always upload the entire results directory plus the prepared `BUILD.json` and `SOURCE_LOCK.json`, including when the job fails. This station changes no production file or workflow; the root agent owns CI integration.

An optional probe-only mode is available, but a separate run is unnecessary because the full diagnostic begins with the identical probe:

```sh
node evidence/independent-gpucloth-d48/run-ci.cjs --probe-only --out /tmp/r02-original-gpucloth-d48-probe
```

## Adapter probe and source identity

The driver uses exactly one fixed set of Chromium arguments: `--no-sandbox`, `--enable-unsafe-webgpu`, `--use-webgpu-adapter=swiftshader`, `--use-gpu-in-tests`. It does not scan flag combinations or silently choose another backend. This choice follows the explicit SwiftShader adapter flags in Chromium’s upstream [FlagSpecificConfig](https://chromium.googlesource.com/chromium/src/+/HEAD/third_party/blink/web_tests/FlagSpecificConfig). The [Chrome headless GPU testing guide](https://developer.chrome.com/blog/supercharge-web-ai-testing) provides related environment context; its alternative Vulkan/ANGLE flag group is not combined into this station.

The first page operation requests a high-performance adapter, matching the original solver’s preference, and records actual adapter information, features and limits. The probe does not request a device. Missing WebGPU, no adapter, or fewer than ten storage buffers per shader stage is a terminal nonpass. No substitute solver runs. If eligible, the unmodified `GPUCloth.create()` requests its own adapter/device; the harness separately records that actual adapter and device after successful initialization. A successful preliminary probe alone does not prove initialization or computation succeeded.

The runner checks all prepared file bytes before serving. It serves only a closed allowlist on CI loopback, blocks outside browser requests, and records the actual navigation response body SHA-256. Browser-side checks verify every original source and fixture before creating the world. The runtime WGSL is loaded from the unchanged original relative URL.

## Initial-state and frame evidence

Before creating a GPU device, the same browser reconstructs original CoupledCloth, original BodySDF and original WaistAttachments from the frozen inputs. It compares the full typed-array SHA-256 values for body, garment p/v/old/w/mass/map/faces/pins/output, all distance and bending constraints including order, all seam pairs, and actual waist rows/targets. It also reconstructs and verifies all 48 original Float32 body-target arrays. A mismatch blocks GPU execution.

This checks CPU constructor state. The source GPU initializer independently sets Float32 old positions to p; the harness correctly does not compare that original GPU initialization rule to CPU constructor old=0.

Every successful step records current and original-paper edge stretch, exact body target hash, source rollback/safety counters, finite checks, original command/parameter count, actual GPU query time when supported, and wall time. Original source engineering guard excursions outside [0.9, 1.12] are reported; they do not replace the unchanged final 1.45 source stop ceiling.

On rejection, the full original `rejectedState` is saved as lossless Float32 binary encoded in base64, including any nonfinite bit patterns. The last committed body, positions, velocity, topology, pins, seam pairs and current rest descriptors are also preserved. CPU rollback differences are reported separately. The original CPU edge.rest descriptors may retain the attempted fitting fraction after a rollback; the report explicitly identifies that rest reference and does not claim all GPU memory was compared.

The optional final original dense contact audit is nearest-face sampling. It is not a union-inside test, continuous collision detection, or visual acceptance.

## Result meanings

| Result | Meaning |
|---|---|
| WEBGPU_UNAVAILABLE / WEBGPU_ADAPTER_UNAVAILABLE | No eligible API/adapter; no solver ran |
| ADAPTER_STORAGE_BINDINGS_INSUFFICIENT | Adapter exists but fails the original ten-storage-binding requirement |
| ORIGINAL_GPU_INITIALIZATION_FAILED | Source GPU creation/shader/device setup failed |
| ORIGINAL_GPU_D48_REJECTED_SOURCE_GATE | Actual original GPU rejected a numerical state and invoked its safety rollback |
| ORIGINAL_GPU_STEP_FAILED | Device, validation, or another original GPU step error; not automatically a physical strain failure |
| DIAGNOSTIC_PRECONDITION_OR_RUNTIME_FAILED | Input, source, accounting, or harness verification failed |
| ORIGINAL_GPU_D48_COMPLETED_NOT_APPROVED | All 48 source steps and unchanged safety checks completed; scope remains numerical fixed-D only |
| DIAGNOSTIC_INCOMPLETE / DIAGNOSTIC_CLEANUP_FAILED | Driver could not complete or cleanly close; no complete CI acceptance |

The driver exits 0 only for an eligible standalone probe or a completed D48 run with no recorded browser/HTTP errors and clean cleanup. Otherwise it exits 2 while preserving incremental evidence.

## Local checks already performed

The preparation closure was built without network access from the locked local originals. JavaScript syntax was checked. A Node-only reconstruction used the exact browser-side audit functions and returned zero differences across the full constructor state and all 48 body-target hashes. See `CPU_INITIAL_RECONSTRUCTION.json`.

No browser or GPU was started locally. Actual WebGPU availability, shader compilation and the 48 GPU steps remain pending the authorized GitHub CI run.
