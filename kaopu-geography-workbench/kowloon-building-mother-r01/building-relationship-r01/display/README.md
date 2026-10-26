# Relationship display backend

Display-only, zero external dependencies. `renderer.mjs` exports `RelationshipRenderer` and `pickScene`.

- `new RelationshipRenderer(canvas, scene)`; `setScene(scene)` synchronously cancels obsolete work and queues replacement scene.
- `render({eye,target,fov,width,height,selectedId,semanticColors})` returns Promise. FOV is radians; width/height are actual native pixel dimensions. `cancelPending()` rejects with AbortError; `dispose()` terminates Worker and preserves last canvas image. Failures and 20 s timeout stop explicitly.
- Scene `{primitives,roundMembers,semanticColors}`. Existing Mother finite polygon prisms retain all loops/holes/end caps/side planes. Slanted bases supported. Capsule members use analytic ray intersections including round ends; no polygon-cylinder approximation. Filtering/explosion translations belong to view-model; never mutate Mother data.
- Original `nodeId` is returned by `pickScene(scene, eye, direction)` as `{hit,nodeId,t,point}`; ray direction normalized. Picks the nearest nonzero-opacity surface, including transparent glass.
- Standard pixel-center even/odd scan conversion + per-pixel analytic plane z-buffer. Not face-center painter ordering. Opaque nearest surface first, transparent surfaces sorted far-to-near at each pixel, blended in linear light. Glass opacity applies to each real entry/exit surface, not physical refractive/absorption material simulation.
- Original-size Canvas 2D + module Worker; no WebGL or Float32 framebuffer required. No automatic size reduction, image substitution, external mesh or model triangulation. Colors are authored teaching display colors, not surveyed material values. Two directional lights / gray gradient; **no cast shadows**.
- Limits: 4,194,304 native pixels, edge <=8192, 500,000 transparent fragments; explicit error instead of silently dropping geometry. Float64 depth/Int32 IDs/Float32 RGB and final RGBA buffers are transient per frame. All projected primitive vertices must lie in front of camera; near clipping not implemented, so keep external orbit distance >=1.4 bounding radius. This is not an interior first-person viewer.
- CPU planar boundary math has 1e-8 m tolerance in picking; raster pixel-center ties may choose a different owner exactly on coincident faces. Tests avoid claiming mathematical identity at shared edge ties.

Tests: ../.. /tests/display.test.mjs checks holes, slope, capsule, transparency, IDs/depth at eight views; worker.test.mjs executes actual Worker using Node adapter with Canvas presentation mocked. Cloud timing is not mobile/browser timing. Mother core/function bytes must exclude these display files.
