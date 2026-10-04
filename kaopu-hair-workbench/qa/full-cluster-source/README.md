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

## Mobile loading and high magnification update

The first online Rabbit bundle is3,983,565 bytes. The two original static shell PNGs are fetched only when procedural mode is disabled; their original bytes are SHA-256 checked. Download stages, byte progress, timeouts and an in-page retry replace indefinite loading. The same4096² nine-octave Perlin shader is rendered in64 scissored512² tiles into oneRGBA8 texture, removing a duplicate64MiB surface. Geometry, texture quality and default original-light pixels are retained.

Rabbit +/− controls add/subtract100 percentage points within100–600%; original quick presets remain. Manual pinch/import retains30–600% for compatibility. Above250%, geometry scale stays capped while the lens narrows, avoiding near-plane intrusion. Two-finger translation and Shift-drag pan the lens; reset restores centered100%.

The Anemone two-light branch now uses a fixed, world-space ellipsoidal bulk attenuation proxy before surface response. It represents average intervening tissue/gaps with fitted extinction, not exact per-tube shadows, calibrated thickness or a fluid/SSS solver. Lamp positions and RGB remain pinned; an object-specific response compensation and hue-preserving highlight shoulder avoid treating unattenuated light as ubiquitous ambient. Camera/screen coordinates do not enter this attenuation. Geometry and alpha/depth remain unchanged.

## Local tissue/surface correction

The next candidate separates neutral bulk cluster visibility from local palette-derived tissue absorption. Wet surface return uses untinted GGX/Smith/Schlick with a fitted roughness of .30; light RGB, positions and powers remain the pinned R13 rig. Added optical varyings carry the actual ring radius, nominal cap radius, cap fraction and tangent without changing vertex position or normal equations. The local cylinder chord/cap blend and fixed .06-world-unit absorption reference are bounded appearance approximations, not measured subsurface scattering. Existing ordered two-layer alpha coverage remains an approximation and still scales reflected light at silhouettes; the combined KuKo-style response is not a complete energy-conserving transport model. Visual acceptance remains pending real GPU images.

## Accepted baseline and requested speed extension

The user accepted runtime38cc5b3f0e33c86f0e3db87ac8da1b5075b305db4a6ebfc90216a03e8a009456 as the visual/functional baseline. Subsequent work stops material/palette/layout polish. This revision only expands the independent accumulated motion-clock multiplier from0–2 to0–6, keeping default1, the same phase at any fixed motion time, and the exact existing geometry certificate. The validated amplitude interval is unchanged; near-flat strong-current deformation remains separate research and is not silently enabled. No fluid-measurement or physically exact tissue claim is made.


## 2026-10-04：第四项「梳理」

首页顺序为兔子、海葵、毛束、梳理。第四项按需创建独立 WebGL 2 页面，离开即暂停，回到页面保留参数和镜头。预览为实际渲染的原生截图。

该案例以原创程序化头像学习 Houdini 的分区、导向、多层聚束与局部 Frizz 方法。它包含头顶、短发、胡须、上唇胡和眉毛五个生长区域；成稿、引导线、分区、发束视图共用曲线函数。未使用原教程的人头、纹理或工程，不在浏览器内运行 Houdini，也未实现头皮动画绑定、风力或碰撞仿真。独立模块 SHA-256：`0b4812dc194a3fc3b399c95f6c79c1d394c5c02099676480965c7663c2d4efbb`。

原兔子渲染代码、SEDDI 模块与资产不变；海葵保持已接受形态、配色、灯光和 0–6 倍独立水流时钟。离线文件将两份模型 JSON 原字符串用 `String.raw` 包装，避免重复转义；所有原始模块、模型、纹理和元数据的运行值逐字节相同，无新增解压依赖。QA 分别验证 file/public、真实 WebGL 输出、参数往返、隐藏零 RAF、重入与错误重试、Chromium 原生触控；这些不能代替 iPhone/Safari 实机测试。
