# R10.0 R3 + R9 unified human grooming candidate
New path only. Frozen source: 40861390bb57673c677a08d5216286d2dcbcf4da.

One real GNM head, one renderer, six hairstyle presets, R9 teacher brows and R3 expanded five-zone beard. Default: R3 side-sweep. Root inspection, top/ear/nape/beard cameras, regional density and direction, per-region length, taper, beard irregularity, schema-checked local save/restore/import/export.

Open public-lite.html through the delivered fixed-commit public preview. It contains the bundled JS/CSS, but fetches SHA-verified GNM head and sampler assets from the original fixed public source; it is not an offline asset package.

Reproduce: python kaopu-hair-workbench/fusion/r10/build.py ; node kaopu-hair-workbench/fusion/r10/bundle.mjs ; python kaopu-hair-workbench/fusion/r10/finalize.py . esbuild is required for bundling.

See RESEARCH.md and BUILD_MANIFEST.json. See evidence after Actions for the actual tested build. Inherited old tests do not certify new bytes. Old R3/R9/other workbench routes are not overwritten. Do not merge this branch automatically.
