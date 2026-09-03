# Landscape Mother · Guilin Putao Fenglin V014

This scoped candidate rebuilds one 4 km by 4 km Guilin peak-forest scene from the canonical 12.5 m elevation store.

Production boundaries:

- prototype: Yangshuo Putao dense fenglin plain;
- source-driven peak positions, elevations, local bases, relative heights and watershed footprints;
- independently authored closed 3D vertical walls, solution grooves, foot-cave placeholders and procedural material response;
- fixed geometry for every device;
- zero images, zero runtime texture sampling, zero external models and zero runtime LOD;
- no fog, distant mountains, clouds or other landform families;
- manual visual approval remains false.

Run `build_putao.py` with `PUTAO_CHUNK_DIR` and `LANDSCAPE_OUT`. The GitHub Actions workflow downloads and SHA256-verifies exact byte ranges from the repository's public canonical elevation store.
