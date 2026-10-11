# KAOPU function room candidate · bounded-host-r01

Native WebGPU inspection candidate. Default reviewed link options are `?scale=.5&stone=slate&cloth=filtered`.

The complete room and inside views were actually rendered at 480×320 in Actions run38158637329, renderer commit6062d761c3cf59e3dcc481ef5a1d7412e328f21e. All153600 primary pixels per view are accounted for; primary/secondary exhaustion and unresolved cloth quadrature counts are zero. Sparse original-equation retries remain recorded. The host adds a153600pixel ceiling, drawing-time control lock and per-frame parameter snapshot; all reviewed WGSL fields and traversal code are unchanged. Public-host QA is separate.

This is a functional/material candidate, not final cinema-quality acceptance. Real device performance and portrait composition are untested. Software adapter setup took169.98s; room551.70s; inside482.17s. These are not phone timings or a real-time claim. Wait for each frame to finish before switching views. Mouse drag/orbit and wheel zoom are available after completion.

Known appearance limits: cloth conditional colour integration is not full subpixel light transport; wood coarse parallax is unsupported; glass uses finite-slab Fresnel plus straight transmission rather than full refraction. No characters or cloth mechanics are claimed.

The full room is evaluated from function domains. No surface vertex/index buffers, per-brick records, reference photographs, mesh assets, appearance maps or numeric field volumes are shipped. Source licences and function provenance remain under sources/. RUNTIME_CLOSURE.json separates transfer bytes from known GPU buffers; browser, driver, pipeline and initialization peak memory are not measured.
