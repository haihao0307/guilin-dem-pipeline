# Granite source audit

Date: 2026-10-13 UTC. Scope: read the existing source and extract reference code for the next Kowloon stone-frame increment. This is not an implementation, visual approval, or physical calibration. No GPU run or production-file change was made by this audit.

## Frozen source

- Library path: `/历史建筑生产线/STONE_STUDY.html`.
- Library ID: `libfile_3d00eceb0dbc8191bc4bf7b704079ede`, version `1`, 129266 bytes; file ID `file_0000000050e881fd9d2a7535dc38d5f8`.
- Original study version: `stone-response-s1.0`.
- Original HTML SHA256 recorded in `candidate/sources/stone.json`: `ad02a23d6a95a4c269b93beef614a97a9c330edda2214d9e3f9812de02e0ab5a`. The full HTML hash was not independently recomputed in this read-only lookup.
- The original study does not have an independently verified Git commit here. Its link to `haihao0307/HOUSE@5420ec41480a3a0280c11ad28f8318eb5ed86a72` identifies the older comparison/geometry source, not a verified commit containing this study's kind-2 extension.
- Existing inherited leaf at `haihao0307/guilin-dem-pipeline@1f46ba78170752a07086caa3e66c87f2fa4c7fcf:kaopu-minigame-workbench/voxel-train-study/game/r20-plants-r01/kowloon-station-r05-heritage/mothers/stone-fields.mjs` is kind 0 only. Its local SHA256, verified against `SOURCE_LOCK.json`, is `c911825d6c698d7bc66ff3715c57915d0e964647b7b8835f5d412d08f710b75e`.

## Verbatim extract and verified hashes

`granite-source-reference.glsl` contains verbatim source windows 1687–1693 (seed/event uniforms and low-level helpers) and 1601–1652 (material uniforms, `StoneSample`, `sf`, `scell`, and complete four-branch `stoneFields`). Only the header, block order, and separating blank lines are new. Lighting, render loop, geometry meshes, source scans, and textures are excluded.

Extract-file SHA256: `fbeaa3ae04ede4b9572b97dec3a5f274637b89c7d71a40e7851766c875e3040e`.

Hashes below were recomputed from the exact function signature through its matching closing brace, with no trailing newline. All match the existing `candidate/sources/stone.json`:

- `sf`: `7f5a2154c9da3d75d0862f6d7bfb2dfad127e1129bb0b1fe0972fe2fcd2b3a5d`
- `scell`: `a7e47401110ddd68aba82b372ab07e3e9f25e66580b65c67e8f5b762b23b75e5`
- `stoneFields`: `91588fcc0cb6b47990d4e90910c94e3ef63222cdeebd0f0ba21c0f6982110850`

## Original parameter facts

- Line 1583 labels kind 2 as 花岗岩, with 浅色晶粒、粉色矿物、深色晶片. Kind 0 is 青灰石灰岩 and explicitly includes mineral veins.
- Interface: `StoneSample stoneFields(vec3 pos)` returns linear `color`, source-unit `height`, `rough`, `mineral`, and `cavity`.
- `sSurface = (scale, mineral, wet, roughBias)`. Defaults: `(1, .7, 0, 0)`.
- UI ranges: scale `.5–2`, mineral `0–1`, wet `0–1`, roughBias `-.2–.2`.
- `sDisplay.w` is chroma: default `1`, UI range `.4–1.8`.
- `sRelief`: default `1`, UI range `0–1.5`; it multiplies final source height. Changing scale does not divide the original height amplitude.
- Master seed `8231`; derived color `8632`, pore `8538`, weather `8832`. Source code retains the original seed salts.
- Original normalized geometry uses `scale = 3.4 / longest(shapeRatio)` at lines 816–821. The study does not contain `scaleM` or a calibrated metre conversion.

## Frequencies and height, without invented noise

First `p = pos * sSurface.x`; original warp is `q = p + .25 * (sf(.8*p+seed), sf(.8*p+seed+7), sf(.8*p+seed+19))`.

- `sf` is the original three-term quintic value-noise sum: frequencies `1`, `2.07`, `4.11`, weights `.57`, `.28`, `.15`, offsets `0`, `13.7`, `27.2`.
- Broad variation: `sf(q*1.35+seed)`.
- Regional pigment multiplier: `sf(q*3.2+seed+11)`.
- Fine grain: `valueNoise3(q*49+seed)`.
- Weather field: `sf(q*2.2+seedVector(uWeatherSeed,.09))`.
- Pits: `pow(max(0,(sf(q*19+seedVector(uPoreSeed,.061))-.57)/.43),2)`.
- Crystals: `scell(q*13+seed)`. The original 27-neighbour closest-cell search returns `vec4(hash33(cellId+3.4),sqrt(minDistanceSquared))`. The kind-2 formula uses hash components x/y; it does not use distance w. There is no separate measured phenocryst population or independent phenocryst-size parameter.
- Kind-2 height: `(crystal.y-.5)*.003 + (broad-.5)*.009 + (grain-.5)*.00035 - pits*.007`, then multiplied by `sRelief`.
- Kind-2 colour and mineral masks use `a=smoothstep(.28,.34,crystal.x)`, `b=smoothstep(.62,.68,crystal.x)`; dark/light/pink sRGB colours and all rough/wet/chroma equations remain in the verbatim extract.
- Kind 2 does not consume `vein`, `phase`, or `bands`; these are present because the extract preserves the complete original function.

## Metre bridge: inherited fact versus new binding

Existing receiver facts: `KP_STONE_SCALE_M=.42/3.4=.12352941176470589`, explicitly marked uncalibrated in `candidate/sources/stone.json`; station sampling uses `h.q*.19`, and height is multiplied back by `KP_STONE_SCALE_M`.

Ignoring local warp distortion, the inherited nominal crystal-grid spacing would be `KP_STONE_SCALE_M / (13*.19*scale)`: approximately 50.01 mm at scale 1 or 25.01 mm at scale 2. Removing only `.19` yields approximately 9.50 mm or 4.75 mm, respectively. These are arithmetic grid spacings, not measured grain diameters or an approved fine-grained preset.

For an explicit new architectural metre bridge, a consistent convention is `sourcePos = localPositionM / graniteScaleM`, retain original `sSurface.x`, and return `heightM = originalHeight * graniteScaleM`. The original function already applies `sRelief`; do not apply it twice. A source-space footprint, if introduced, must use the same coordinate Jacobian/scale. Choosing `graniteScaleM`, any source scale beyond its existing UI range, maintenance tint, or retained-age relief is a NEW architectural binding requiring its own declared evidence; it must not be represented as an original measured parameter.

Both geometry and material must share the same kind-2 coordinates, source state, seeds, and height equation. Do not replace generic `stationStoneHeight`/`kpStoneSurface` globally: id13 plaster substrate also uses them. Keep the frozen kind-0 source, and bind granite only to the intended stone members. Current heritage finishing also remaps stone colour/roughness; any change to that mapping is a separate architectural finish decision.

`crystal.y` changes discretely at closest-cell boundaries. Direct use as a distance displacement can create discontinuities. Source arithmetic fidelity does not establish a smooth or conservative SDF; boundary normals, march safety, and footprint handling need implementation QA. No new noise is required.

## Unmeasured status and licence boundary

The original page states that all four material directions use the same existing stone mesh, the four lithological shapes have not been built separately, and parameters are visual candidates without physical measurement calibration. Its manual visual approval is false. No calibrated fine-grained granite preset was found in the inspected original source or existing named material-workbench sources.

`candidate/sources/STONE_NOTICE.md` retains attribution to LuthBird1, Stone Brick, CC BY 4.0, https://sketchfab.com/3d-models/stone-brick-8a31a831769f491f849f20715127d239 . Preserve this attribution and change disclosure. The original programme's existing notice does not license unrelated assets, establish a new blanket licence, or prove that this granite branch is a scan of the Kowloon material. This reference extraction contains programme text only; do not upload the original HTML, scan, GLB, photos, or restricted textures as a side effect.

Result: an exact existing kind-2 granite mother is available for faithful translation; the fine-grain architectural scale remains a separately declared, unmeasured binding. The ongoing B candidate and all implementation files remain untouched by this audit.
