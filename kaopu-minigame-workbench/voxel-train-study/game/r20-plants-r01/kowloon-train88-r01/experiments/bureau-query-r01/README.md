# Bounded bureau query / advance diagnostic

The failed same-game run b1d47b2f / 38280533764 stopped before completing its first 16×16 sun trace. No context loss or GPU crash preceded its intentional 240-second watchdog cleanup. Prior original geometry numerical probing at 566993e3 completed: WebGL first draw 4591.2 ms, subsequent age draws 3.7 / 3.2 ms. That does not prove the current loop's failure cause.

This experiment preserves `sceneField` exactly. The frozen runtime loop body is split at its single query call into one RGBA32F result and one pure advance pass. The original program remains available, unchanged. Terminal full material/local-frame/normal functions are untouched; this experiment does not yet change the receiver or claim a game frame.

Four isolated owned Chromium processes, each with hard cleanup:
1. Existing 192-point geometry probe, age .58, cold + two warmed draws.
2. Same points and fields through the proposed compact query helper. Bit compare all four channels.
3. Synthetic orthographic 16×16 sun fixture: original initialization, single field query, independent original advance. Record the first output and a bounded complete trace.
4. The exact original dynamic loop with its uniform iteration count set to one, once only. Compare the first step if it completes. Hard deadline 90 seconds; no retries.

Shader compile-status, program link, first draw-through-readback and warmed work are recorded separately. First draw can still include driver deferred compilation; it is not reported as pure geometric execution. This is correctness/cost diagnosis and does not establish readable images, gameplay, hardware performance, or acceptance of bureau placement.
