# Landscape Mother Studio 01

User-authorized online workbench and three original procedural examples. The seven-file `landscape-mother` core remains byte-identical at cleanup commit `7f5591a56898cd7441a0b95e24025d3a7586376c`. This workbench is a separate consumer with no regional data binding.

Each example evaluates a 2049 by 2049, one metre height surface over 2048 by 2048 metres. Uniform 128 metre storage partitions duplicate exactly matching edge bytes; camera frustum culling changes only visibility. There are no alternate meshes, texture inputs, numeric texture samplers, material images, vegetation, image sky or external rendering libraries. Cached immutable buffers are redrawn on demand.

Only `fields.mjs` defines the authored examples. Geometry generation is in `worker.mjs`, real numeric gates in `checks.mjs`, analytic materials in `shaders.mjs`, fixed buffer rendering and camera in `renderer.mjs`, and application wiring in `app.mjs`. No patch overrides or retired runtime imports.

The river is intentionally authored, not real hydrology. Union-find, complete quad coverage, finite coordinates, degenerate faces, all-vertex and triangle-centroid clearance, and exact storage-edge comparisons are measured. These checks do not constitute artistic approval. Stage and public module-worker browser runs are separate evidence. Browser screenshots are QA outputs only, never rendering inputs.

Run `node --test test.mjs`; `node test.mjs --compile` compiles all three full scenes. Run `python stage.py --output /tmp/lm-site --commit COMMIT`, serve that directory, then `python browser_qa.py --url http://localhost:PORT/ --output /tmp/lm-qa`. The public publisher may write only `landscape-mother-workbench/` on gh-pages, after staging checks. It must preserve all other public directories, source branches, regional truth and Pages settings.

First-pass examples remain below final art acceptance. Rock silhouettes and material response need further art direction; the water material is a basic numeric display. Do not label them AAA-ready or survey data. Mobile QA uses the exact same geometry and does not establish real-phone performance.
