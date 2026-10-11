# Runoff A/B: bounded defect correction

Actions run **38137195213**, commit **9203d5a93bc58b4a0dd63ff081b0bf8aac2c42be**. Evidence: `qa/runoff-9203d5a9/receipt.json` and its six PNGs. All six images were actually inspected on 2026-10-11. Renderer: Three 170, 800 × 600, ANGLE / SwiftShader software WebGL.

## Visual conclusion

- The legacy actual-sill image has hard vertical bands continuing above and below the window. The candidate removes these full-height bands and retains a short dark mark immediately below the real sill. Its simplified, partly straight-sided appearance remains visible.
- The candidate borrowed-door and street-eye images no longer show the former long water bands. The old/new pairs preserve camera, inspection level, geometry, door state and lights; draw-call and triangle counts match exactly.
- This corrects a receiver/source adaptation defect. The grey walls remain low fidelity and visually plain; this is **not film-quality material, mature old-wall realism, or overall visual acceptance**. Receipt visualAcceptance and interactiveAcceptance remain false. No further material tuning was made for this archive.

The prior component-isolation run 38135442707 / cacd775c identified the bands as the red V26 streak contribution: API dry versus shader bypass and restored wet versus baseline each differed by zero pixels. The current A/B rebuilds the same recipe with the true legacy full-building domain versus the finite-source adapter; it does not substitute the adapter's local-domain bypass for the old baseline.

## Source and domain boundaries

Original V26 source, extracted GLSL, cache implementation, plaster source and water-binding file all still match the recorded source locks. Full SHA-256 verification is in `runoff-domains-gpu-evidence.json`.

- V26 mother module: `3d8308fb51ba8f77ad54bd2b6039a84dde9a1c3dbd452bb05228273d6a4dd028`
- Plaster original fragment: `6e6acf08c21ed3ad3dd390325e17ffd404f85d4d86eff957b499bcdb1dee55ff`

The adapter changes receiver domains and adds an explicitly new deterministic source envelope / ground-only composition. It does not claim the complete adapted equation is the original algorithm. Sixty-five recipe-backed sources comprise 49 sill undersides and 16 exposed slab/roof edges. Interior plaster receives no rain or ground damp; upper storeys do not acquire repeated ground damp. No new noise or tessellation was introduced. The photographed W1 sill source is at [-3.88, 3.91, 0.685] metres, projected onto the wall at z=0.55, with a 0.9 m finite fall.

## Cache and frame evidence

120 logical wall domains share 33 templates: 18 original-field GPU bakes, 15 zero templates, 21,280 sampled nodes. Shared retained low-state arrays are **155,648 B**, versus 515,840 B without sharing. The measured cache build is **101.8 ms** (approximately 102 ms). This is cache construction alone, not whole-scene startup; whole candidate build was 6769.5 ms. The byte count is not total scene or GPU memory.

Completed render plus synchronous readback, milliseconds:

| Same view | Legacy first / second | Candidate first / second | Calls / triangles |
| --- | ---: | ---: | ---: |
| Borrowed door | 2143.9 / 1284.3 | 2226.9 / 1280.8 | 509 / 731,848 |
| Street eye | 2569.9 / 2199.0 | 2354.2 / 2283.6 | 2467 / 3,950,888 |
| Actual sill | 1141.9 / 1149.4 | 1250.6 / 1243.4 | 482 / 1,136,436 |

The second frame is only **one same-camera warm sample**. Across these three views the candidate warm samples are 1243.4–2283.6 ms. These are SwiftShader software-rendered readback timings, not hardware-GPU speed or interactive FPS. First samples are not guaranteed cold compilation measurements; caches and driver state can already be warm. Two frames per view do not establish a steady-state distribution or a statistically reliable speed change.

All 12 readbacks have GL error 0; receipt errors are empty. GPU compile/readback passed. The previous 39/39 CPU tests remain the implementation gate; this documentation-only archive did not change or rerun the implementation.
