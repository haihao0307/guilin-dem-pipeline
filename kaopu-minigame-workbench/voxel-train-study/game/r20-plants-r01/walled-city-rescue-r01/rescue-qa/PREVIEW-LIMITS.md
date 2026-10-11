# City rescue: playable visual candidate

This independent entry preserves the existing train and station. It is the same generated10-storey building and original NativeActor runtime used by the actual rescue QA. It is not a final art release or a reconstruction of historical Kowloon Walled City.

## Verified gameplay
R05 actual real-button browser flow passed both rescue orders,18.2m finite-line constraints, same-line recovery, timed front-door closure, real rear borrowed route, door protection, pause, timeout/retry and mobile layout. The three people share the original model and use independent104-bone poses. A separate three-frame normal-rAF sample used actual original sole diagnostics. Software-GPU numbers are not phone FPS.

## Still unfinished
Building art, inhabited detail, custom clothing, convincing smoke/fire and unified age-driven shape/material birth are unfinished. The latter candidate remains excluded because its conservative whole-building triangle budget is too high. The existing fire ribbons and countdown are fictional game rules, not a physical fire or real rescue training model. There is no complete building SQLite export yet.

## Size and loading
The42 pinned original NativeActor dependencies total109,696,568bytes (109.7MB,104.6MiB), not counting this entry's source modules and shared Three library. This includes34,937,952bytes for the original external GNM file, verified from its fixed Git tree. Three actors share this resource load, rather than tripling it. Runtime decoded data, CPU arrays and GPU memory are larger than network byte totals.

Source/provenance text is separately about0.68MB. It must never be described as the whole scene's size. The shared Three module is1,314,681bytes and OrbitControls32,134bytes, already present in the train workbench. Current code uses same-page Promise sharing and ordinary HTTP caching; no offline/service-worker cache or measured repeat-visit saving is claimed. Original shape/skeleton data trimming remains a future separate validation task; the tested rig is unchanged.

GNM size source: https://api.github.com/repos/xrblocks/assets-gnm/git/trees/134feb02b11fa642a43ff5e7e880246255a74e86?recursive=1
Original actor source: https://github.com/haihao0307/guilin-dem-pipeline/commit/30c5405cc9801e216e1155249a1b87232e4faccd

Dependency breakdown: Anny whole shape dictionary46,002,168B (41.94%); GNM whole head model34,937,952B (31.85%); MHR whole model23,931,058B (21.82%); metadata/bridges/face/neck/head/motion4,825,390B (4.40%). These are source file sizes, not measured compressed HTTP traffic.

Next bounded optimization: the current three actors all use defaultState; their original generated shape is identical and only team color differs. A future validated native cache can retain that exact generated canonical shape, indices, normals/skin-region fields, the complete per-influence rest positions and weights (no top4 truncation),104-bone bind/rest hierarchy, original support/leg calibration and required walk/standing parameters. It can then omit the unused shape-search/alternate-morphology dictionaries from this fixed scene's startup. This has not yet been implemented; original shape fingerprints, source hashes, full-pose GPU equivalence and both original-foot route regressions remain mandatory before replacing the loader. It is not permission to substitute an external mesh or a simplified person.

R06 focused director QA: candidate bdb30c60f6f1bc6b96e43c2f86b071096f193923, run38142300566, both success orders at900×700 and390×844 after the same-clock0.95s transition. Two residents are visibly separated on the real roof; the crew stays at its actual lower platform/room. All sampled original soles pass. This is presentation verification, not a fresh claim of all earlier gameplay coverage or art acceptance.
