# KAOPU object workbench

Home lists Rabbit first, then Anemone. Each object loads only when chosen; Rabbit’s teacher starts only when opened. Rabbit colors, length, visual width/density and absolute 100/150/200% zoom are visible on the first screen. Automatic orbit, manual pinch/drag, grooming and state files remain available.

## Loading and preservation

`python full-cluster/build.py` produces an object-lazy online `kuko-anemone-candidate.html`, a hashed original Rabbit JSON bundle, the licensed reference JPEG, and complete offline `kuko-anemone-standalone.html`. Online Rabbit assets load on Rabbit entry; its photo reference loads only when opened. The offline HTML embeds all core resources. Source assets are not replaced or reduced in quality.

Home creates zero WebGL contexts. Parsed Rabbit model JSON is cached per frame; unchanged noise parameters avoid duplicate Perlin generation; equal-size framebuffers retain storage. Original SEDDI modules/assets/licenses remain byte-identical. A network-load failure may retry on re-entry; a failed WebGL frame asks for page reload.

## Corrected, bounded anemone

The preceding root jitter and divergent rest headings caused confirmed mesh intersections. `bounded-radial-prefix-1` deliberately corrects that shape: count 240 / length 0.7 / thickness 0.03 / curvature 0.7 / seed 73, no positional jitter, radial heading, lean 0.23 and phase −1.35. Every original individual length/radius remains; the rounded tube profile and body connectivity remain. This is not byte-identical r03 geometry. Original r03 source stays archived.

Only this exact geometry preset is certified. Unsupported changes reject before mutation; shape controls show their actual values but are temporarily disabled. Wider shape ranges need separate verification.

The certificate rebuilds actual 43 shader rings and 42 triangle-enclosing capsules, checks static inter-tube separation, nonlocal self separation and body triangle distance, then applies per-segment cumulative displacement bounds to continuous regional flow. With a 1e−5 numerical reserve, default all-time model-unit bounds are approximately +.003133 between tubes, +.022967 for nonlocal self contact and +.005865 against the body outside the socket.

Flow remains nonzero but conservative: default 15% of the previous regional amplitude. Direction/timing/strength remain adjustable under a common cap, whose effective scale is displayed. This is bounded kinematics, not fluid simulation, collision response or generic CCD. The first three rendered strips are an intentional shallow root socket. Watertight welding, local triangle-manifold quality, arbitrary shape parameters and large-amplitude natural motion are not certified.

`node full-cluster/src/anemone-safe-layout.js` recomputes the certificate. Runtime currently scans once and caches; actual startup cost is measured separately, not hidden.

## Shared warm/cool side lights

The exact normalized positions, artistic RGB ratio, spotlight cone and inverse-square equations come from [the pinned R13 rocks01/02 rig](https://github.com/haihao0307/guilin-dem-pipeline/blob/f048def853b70e2347a8ad3308d714c9d0f1dd90/kaopu-material-workbench/lab-r13/wet-material.frag#L378-L392). Rabbit skin/Shell/Fin receive two actual colored direct contributions and ambient once, preserving original Kajiya response, AO and alpha masks. Teacher shading stays original. Anemone retains its airy tissue/rim response and ordered two-layer transparency. DISPLAY_GAIN=.08 is a documented material-transfer setting, not Kelvin or physical calibration. Original-light comparison remains available; original-material reference disables irrelevant side-light controls.

## State and scope

Rabbit visual width remaps mask coverage, not geometric strand diameter. Density changes existing Shell/Fin texture repetition, not follicle count. Appearance/light edits retain combed GPU normals; parameter import resets grooming as disclosed. Rabbit JSON v3 adds validated lighting. v1/v2 load original lights; v1 also restores width 1.

Anemone JSON v4 records safe geometry, bounded motion and lighting. Older files are accepted only if geometry exactly matches the certified preset; unsupported shapes reject atomically. Importing an old time does not reconstruct the old motion algorithm.

Natural tissue colors remain photographic fits informed by [Titus 2024](https://zenodo.org/records/13760333) and [the 2021 field study](https://www.vliz.be/imisdocs/publications/370236.pdf). [NOAA](https://oceanexplorer.noaa.gov/ocean-fact/animal-color/) informs lighting/depth context; these are not NOAA/PICRC measured RGBs or endorsement. Red/blue artistic alternatives remain labelled. General motion references include [SICB](https://sicb.org/abstracts/sea-anemone-tentacles-flutter-and-flap-in-water-flow-in-the-field-/) and sampled H. magnifica previews; videos are not republished.

Wootton’s macro photo retains CC BY 2.0 attribution. SEDDI MIT source/assets and the user-provided KuKo reference remain preserved. KuKo’s original is opaque SDF shading; two visible layers here approximate transparency, not full volumetric tissue transport.

## Verification

Static: `node full-cluster/tests/lighting-static.cjs` and `node full-cluster/tests/safe-layout.cjs`. Exact-version Actions QA covers offline/public bytes, genuine GPU pixels, native simulated touch, state round trips and interrupted flows. Use each build’s receipt; static checks and screenshots do not imply natural appearance, AAA quality or production readiness. Chromium mobile emulation is not physical iPhone/Safari validation.
