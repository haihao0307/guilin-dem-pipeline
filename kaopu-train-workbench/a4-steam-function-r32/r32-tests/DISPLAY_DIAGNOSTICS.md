# R32 display diagnostics (not whole-frame acceptance)

- 40425990063: installed stable Chrome with normal sandbox loaded all whole-scene scripts and linked 10 programs; first rendering stage lost context.
- 40427309054: transparent trace associated the long stall with pressure-group GPU execution; JS call trace alone does not prove GPU completion or a unique guilty draw.
- 40428578157: corrected boiler interval pruning (analytic geometry unchanged) and 25 pressure calls returned in JS, but first whole frame still lost context after ~393 s. Correctness fix did not resolve display.
- 40429518019 / 622533bf7c37106e6b7f2e1eeef35c3629a337e6: diagnostic first actual pressure shader at native 720×400 coordinates, only one scissored pixel [273,219]. finish/readback took 394165.7 ms and returned RGBA [0,0,0,0]; console context-loss followed immediately. CI status is green because the diagnostic returned, NOT because any whole frame or valid pixel passed. Synchronous lost=false/error=0 preceded the asynchronous event; next probe waits an event turn and rejects zero alpha.

This comparison shows pixel area is not the sole explanation. Next bounded probe groups only pressure dispatch into <=4 original fields/program, keeping complete source functions, original geometry, local-ID-to-field mapping, draw order, native resolution, material expressions and 1600/4096 iteration limits. This is a candidate, not a proven GPU fix. No sandbox, watchdog, certificate or browser security setting is weakened. Backend is software ANGLE/Vulkan SwiftShader, not the user phone GPU.
