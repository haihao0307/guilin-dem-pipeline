# HUMAN-LOCAL-FEATURES-R03.1 — recovered public candidate and visual review

Reviewed 2026-10-13 after successful Actions run 38395977539. This is a functional, public-browser-verified candidate for the user's visual review, not user acceptance or photorealistic equivalence.

## Fixed interactive entry

https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/91b1dd7cf402294a26051abe051696b2848207af/kaopu-unified-human-workbench/head-look-r03-1-recovery/preview.html

Source: 11c8016f4478afc1480bf5a45e935aa34dd41996
Build: 91b1dd7cf402294a26051abe051696b2848207af
Permanent public evidence: 67825ded44153685c25b8ca6c6da5b25a3c4e24e
Preview SHA256: f4a1ae8cbbdd65f681925a157aed5db8500e10c2b23e05938363f7ab809bad39
Actions: https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/38395977539
Artifact: 11814916733, SHA256 7458e347a97fb4c25f721599cea6eb648f32be3b3d9091b8e010559cf7575fcd
Draft PR: https://github.com/haihao0307/guilin-dem-pipeline/pull/264

## Scope and interrupted work

User baseline R02 @ e468c26bd2baddd8cd7b35b066e44f4e5c92dc9b was a native-skin restoration (PR255), not completion of lips, orbital detail, ear colour and lighting tasks. The assistant's earlier cancellation interpretation was incorrect. Successor PR258 wrote bounded local-feature code but run38388636867 failed in the first browser locator actionability wait; immutable publication and public verification were skipped. This recovery starts from its last readable source 7dc53a7812d1edca0473fa12b848a919448c8ad4, not from a replacement face.

The same native overall complexion, skin recipe and assets, character/body, rig, eyeballs, lip/eyelid/ear geometry and idle system remain. Rejected R01 whole-face appearance, reference meshes and reference bitmaps are not imported. Camera-only views no longer perform needless original geometry and idle-cache resets. Lip support diagnostics include the exact union of original and revised feather support, with no arbitrary mask dilation or relaxed protected-skin gate.

## Available local work

Lips: muted pigment control, original/revised vermilion boundary blending, tapered corner transition and independent inner wet-band response; native lip expression retained.

Orbital region: local pigment and filtered microdetail attached to the retained eye-corner landmarks; independent detail/tint controls. Eyeballs and eyelid shape are not replaced.

Ears: bounded regional pigment around cartilage, concha and lobule; controllable thickness-estimated transmission with a separate tissue-exit visibility lookup. Original ear geometry and pore generation remain.

Lighting: independent neutral main/fill/rim and neutral environment, three depth maps, configurable fixed-radius PCF soft-edge filtering and bounded cavity/leak guards. This is not PCSS contact-hardening, full area-light integration or measured volumetric skin transport.

## Evidence actually read and inspected

The final downloaded artifact was extracted and DELIVERY.json, PUBLIC_QA.json and both unit logs were read. All 31 local unit checks, 12 retained-host algorithm checks and 21 exact-public browser checks passed. The public run produced 31 actual browser/renderer screenshots. Page errors, console/shader errors, failed requests and reference-asset requests were empty.

The final face, lip, single-eye and left-ear closeups and 390x844 viewport image were directly inspected. R02's original public lip screenshot was also reviewed for context. Final views are qa/public/08-final-face.png, 08-final-lip.png, 08-final-eye.png, 08-final-ear.png and 09-mobile-viewport.png. These are renderer output, not generated concept pictures.

Visual observations: the vermilion boundary is less sharply painted and less saturated than the R02 restoration view; upper/lower lip striations remain visible. The new lighting reduces the older very dark nostril-area contrast but does not correct its shape. Orbital and ear-local treatments are attached to the same original person. The eye surround still has uneven coarse folds and an awkward inner corner; the ear folds and lower attachment remain coarse, with visible root/edge defects. The overall face remains visibly synthetic/smooth in this presentation. Do not describe this as cinema-quality skin, fully corrected facial anatomy or reference-equivalent photorealism.

Actual local-albedo tests, in the three recorded inspection views: lips protected305150 / outsideChanged0 / outsideMax0; eyes protected286160 / outsideChanged0 / outsideMax0; ears protected270677 / outsideChanged0 / outsideMax0. These prove the recorded views' protected pixels, not every possible camera, body preset or device. All original recipe fields, native/display geometry, eye/rig state, pore cache, one-canvas state and idle generation were preserved in the tested comparisons. Camera-only view changes preserved geometry and idle generation. Trusted real pointer comparisons, lip-border pointer input, independent local responses, native expression/idle, invalid-archive atomic rejection and full-person archive roundtrip passed.

## How to inspect

The default panel is 原皮肤保留 · 五官局部完善. Use 嘴唇特写, 双眼周围, 单眼周围, 左耳色彩 or 右耳色彩. The four comparison buttons are 局部处理＋校准光, 原版对照, 只看局部改动 and 只看灯光改动. Individual local toggles and sliders remain separate. A lighting-only comparison changes perceived brightness and colour without changing the original skin recipe.

## Delivery boundaries and costs

Native downloads, geometry/idle calibration and GPU rendering remain costs. The CI uses software Chromium/SwiftShader; synchronous frame render plus pixel readback was very slow, including about239565ms for the first comparison and about7109–11802ms for the next comparison samples. These timings are not isolated shader compilation measurements, consumer-GPU frame times or proof of fluid interaction. No hardware FPS promise is made. The 390x844 check is layout-only, not a physical phone, Safari or Vision Pro test. Additional true volumetric transport and reference-equivalent skin would require separate material/geometry work and performance validation; merely changing lighting cannot supply that.

Old R01/R02/R03 source and fixed URLs remain unchanged. Only the new recovery directory and its workflow were added. Keep PR264 Draft, unmerged; no force push or history rewriting. The fixed public candidate is delivered for review; userVisualAccepted remains false. Do not resume from the old failed run or rebuild solely because the prior conversation crashed.
