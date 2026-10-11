# R11.0 — R3/R9 fusion plus the user's three selected teachers

New directory only. Base is the actually browser-verified R10 source at d560e03d82bdfff0d4cd70c5383f609567151a30. Original R3, R9 and R10 paths are immutable for this change.

One GNM head and renderer. Six retained hairstyles. New: 14 real Mindfront CC0 eyebrow geometries extracted from individual tube strands and rebound to the current skin, with separate shape span/thickness/arch/tail/height, shaft length, density, colour, width, direction and lift. R9 original brows remain selectable and are never overlaid with the new brows.

Selected MIT routines from Perm and Digital Salon inform the portable direction/length strand representation, endpoint-preserving smoothing, root-indexed flattened particle topology and typed-array guide export. R3 wave/microcurl is a bounded optional detail residual. It is NOT Perm neural inference and NOT running CUDA physics.

Reproduce from repo root: `python kaopu-hair-workbench/fusion/r11/build11.py`, `node kaopu-hair-workbench/fusion/r11/bundle.mjs`, `python kaopu-hair-workbench/fusion/r11/package.py`. Requires esbuild and Pillow; official source downloads are pinned and hash checked. Tests: `tests/unit.mjs`, `tests/verify11.mjs <URL>`.

Use delivered PUBLIC_URL.txt after its public-browser test succeeds. The single HTML bundles JS/CSS and eyebrows; the original GNM head/samplers are still fetched from fixed SHA-256-verified public assets. Source authorship and licenses remain preserved in the distributed bundle and files. See TEACHERS.md and BUILD_MANIFEST.json. No physics, full-collision, female-asset, actual-device performance or cinematic-quality completion claim is made.
