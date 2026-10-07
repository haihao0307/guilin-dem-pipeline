# PPF original CPU reproduction checkpoint

This is a technical checkpoint for the PPF learning experiment. It does not enable a published web entry. The existing garment workbench remains the independently verified garment solver.

## Original implementation

- Upstream: https://github.com/st-tech/ppf-contact-solver
- Exact source: `b4ee7a44a741754d5bdfe1926d064d2483cf1456` (2026-10-02 main)
- License: Apache-2.0, Ryoichi Ando / ZOZO
- Backend: the upstream CPU implementation, built without changing its solver equations, constraints, scene resolution or tolerances
- Build: Rust 1.99.0, `cargo build --locked --release --features cpu`; CPU build artifact identities are in `BUILD-VERIFIED.json`
- This is current main CPU reproduction, not a claim of bitwise equivalence to the SIGGRAPH Asia 2024 CUDA paper branch

## Complete original scenes

The authored `drape` scene uses five 128 × 128 sheets (81,920 dynamic vertices, 161,290 triangles), two pinned corners per sheet, a static procedural sphere, 5% strain limiting, `dt=0.01`, and 100 output intervals. The original `belt` scene uses three belts and three animated rollers, 12,346 dynamic vertices, 23,294 triangles, friction 0.5 on the rollers with the original max mixing rule, 6% belt strain limiting and 200 output intervals.

As of this checkpoint, drape has reached the official `Finished` outcome with all 101 vertex frames. Its independent original-UV audit found maximum principal stretch 1.048366218; no material area exceeded its upper limit plus 0.0001. The upstream execution-shape comparison against its committed CUDA reference passed. This compares aggregate solver execution statistics, not exact vertex geometry. The full belt run is still running; it must not be presented as complete yet.

The upstream contact fixture was run unchanged. Contact enabled held all vertices on the intended side; disabled contact produced 125 wrong-side vertex-frame observations. Drape's conservative sphere-inscribed-radius screen found no definitely inside vertices in all 101 frames. The original solver completed with its enabled per-step intersection checks. A separate full independent all-triangle-pair collision audit has not been completed.

## Checkpoint continuation

The official state stores current and previous vertices, dynamic state, simulation time, previous timestep and frame number. Velocities are recovered using those current/previous positions and timestep. Transient contact matrices and acceleration structures are rebuilt by the original loader. Plastic rest data would also be needed when plasticity is active; it is inactive in these two scenes.

Continuation uses the official `hold_at_frame` control, waits for `held`, then requests `save_and_quit`. Saving at the completed frame boundary avoids pairing a later substep time with an earlier output-frame vertex snapshot. The unmodified solver then resumes with `--load FRAME` against the same `param.toml` and `bin` inputs. Every input is SHA-256 checked between segments. A 12-frame contact-fixture control resumed from frame 6 reproduced all output frame bytes exactly. That scoped control is not a guarantee of cross-hardware bitwise equivalence for arbitrary scenes.

## Lossless web transport

`export-replay.py` only accepts a completed official run with every frame from 0 through the authored last frame. Each eight-frame chunk stores uint32 temporal XOR of the original float32 bit patterns, byte-plane transposition, and gzip. It preserves every frame and every original vertex bit. It does not quantize, remesh, interpolate, smooth or alter the solver result.

Topology and original local static coordinates are stored separately. Static vertices require the original `displacement[static_vert_dmap]` translation; dynamic output frames already contain world-space positions. Material UVs and object identities retain official order. uint64 triangle indices are narrowed only after an exact uint32 range check.

`web/codec.mjs` reverses the transport. `verify-replay.mjs CASE_DIRECTORY` verifies each compressed/decoded chunk and every original frame's SHA-256. The viewer is being prepared with a maximum of three decoded chunks, on-demand retrieval and explicit original-solver-result playback wording. Browser screenshots and lifecycle checks are still required before publishing that entry.

The exporter/auditor require Python, NumPy and cbor2. The codec verifier requires Node.js. Dependencies come from their official registries. No new hosted solver service or paid GPU service is required for replay. A static website cannot execute the original native Rust solver in response to a material slider.
