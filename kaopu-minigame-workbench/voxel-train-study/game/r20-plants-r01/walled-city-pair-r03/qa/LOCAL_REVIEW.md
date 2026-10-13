# Real WebGPU review runner

`local-review.cjs` serves an exact-byte, in-memory snapshot of `runtime/` on a loopback-only ephemeral port. It does not edit runtime, cameras, geometry, materials, or source mothers. All nine source mothers must match `PAIR_MOTHER_LOCK.json` before launch.

## Commands

Run from the project root. Playwright must already be installed, with its Chromium browser available.

```sh
# Safe default: initialization and only one 16 × 16 central tile.
node qa/local-review.cjs --mode smoke --out qa/smoke-review

# Entire uncut normal-perspective 320 × 400 image, explicitly requested.
node qa/local-review.cjs --mode full --view overall --out qa/full-review

# Isolated new frontage candidate, still using original locked shared mothers.
node qa/local-review.cjs --candidate whole-frontage-r04 --mode smoke --out qa/frontage-smoke
node qa/local-review.cjs --candidate whole-frontage-r04 --mode full --view overall --out qa/frontage-full
node qa/local-review.cjs --candidate whole-frontage-r04 --mode full --view facade-detail --out qa/frontage-detail

# Existing installed Chromium, when the environment allows browser processes.
CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium node qa/local-review.cjs --mode smoke --out qa/installed-chromium-smoke

# CPU-only runner contract checks. These do not establish WebGPU rendering.
node --test tests/local-review.test.cjs
```

An existing receipt is never overwritten. Use a fresh output directory per attempt. The native image is 320 × 400 at the default 640 × 800 viewport. `--viewport` changes actual runtime dimensions; the native PNG is never enlarged. The UI screenshot remains a separate artifact. `--growth off` uses the runtime's existing world-state option for a baseline comparison.

`--candidate` accepts only the exact allowlisted value `whole-frontage-r04`. It snapshots both `/runtime/` and `/whole-frontage-r04/runtime/`, then opens `/whole-frontage-r04/runtime/index.html`. Original shared relative imports resolve against the captured original bytes. No other project directory is served; request paths with traversal segments, backslashes, or null bytes are rejected. The default remains the original runtime.

## Evidence

- `receipt.json`: host, exact flags, source-mother parity, status, timings, ray counters, scheduler measurements, and failures
- `source-hashes.json`: exact source hashes for the frozen runtime that was served
- `initial-proof.json`: actual initialized runtime proof
- `proof.json`: final runtime proof, or bounded failure readback when available
- `frame.json`: actual completed runtime frame record
- `native-canvas.png`: direct native canvas PNG export, never a screenshot substitute
- `ui.png`: separate screenshot including runtime controls/status
- `progress.jsonl`, `console.jsonl`: actual browser progress and console records

Smoke mode is limited to a rectangle no larger than 16 × 16, defaults to 20,000 submissions and a 180-second render timeout, and is explicitly labeled `smoke-passed-not-full-frame`. Initialization is bounded to 360 seconds. Full mode defaults to a two-hour render timeout and the runtime's 2,000,000-submission cap. Those are safeguards, not performance promises. Any unresolved primary/visibility query or candidate overflow fails verification, even when the native PNG is retained for diagnosis.

## Verified local blocker, 2026-10-13

On this task's cloud command executor, Chromium 154.0.8037.57 could not start. A normal launch and an approved-escalation launch both stopped in Chromium's process-singleton initialization with:

```text
FATAL:chrome/browser/process_singleton_posix.cc:297
Check failed: . socket() failed: Operation not permitted (1)
```

The checked-in runner reproduced this at the `browser-launch` stage in 395 ms; see `local-launch-check/receipt.json` and `local-launch-check.log`. The loopback server started, but no browser page, adapter, shader compilation, render, or PNG was produced. All nine mother hashes passed before launch. No process-security settings were changed and no alternate route around the restriction was attempted.

The host reported AMD EPYC 9V74, nine available logical CPUs, approximately 9.73 GiB RAM, and Node 24.19.0. These describe the execution host, not measured WebGPU performance. GPU runtime timing remains unmeasured here. The historical `anchor-original` result is separate prior evidence, not validation of current geometry.

The runner can be executed in an authorized GitHub Actions environment with installed Playwright Chromium. Leave `CHROMIUM_EXECUTABLE_PATH` unset there, run smoke first, and retain the complete output directory even on failure. Run the full review only when explicitly intended; it is not started by smoke.
