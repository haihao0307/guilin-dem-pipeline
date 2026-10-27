# Device-context failure repair candidate — 2026-10-27

The prior normal Chrome / SwiftShader whole test passed; the owner's deployed-page screenshot subsequently showed an empty canvas and context loss followed by restoration. Production acceptance therefore failed on that device. Its GPU model and exact last compilation/draw were not captured. A preceding empty `Error` is consistent with, but does not prove, an empty shader compile/link log.

This candidate keeps all 728 generated fields and the R32 703 / R31 693 / retained 519 visible sets, their scalar/range expressions, native 720×400 buffer (optional original 1440×800), 1600 distance steps, 4096 interval nodes, and thresholds unchanged.

Changes: maximum 16 fields in a distance dispatcher (pressure remains 4); ordinary KHR_parallel_shader_compile completion polling when supported; explicit shader detach/delete; exact program/pass/byte/count/timing diagnostics; distance draw coverage in disjoint 32×32 native-pixel tiles; ordinary WebGL2 fences with nonblocking client polling, not disabling watchdogs or security; one full resource rebuild after context restoration, with generation ownership and no automatic retry loop. Shared state remains two FBOs/four RGBA8 textures, not sixteen independent full-size sets. Initial source byte total increases despite the smaller largest program; no memory or speed improvement is claimed before measurement.

The first KAOPU V6 consumer migrates three joint instances generating 15 original fields. The other 713 definitions remain their existing analytic implementation. Both old and new model/source output are identical; shared Mother/parameter/TLO records add explicit contract bytes, not compression. Dimensions remain schematic, geographic placement and manufacturing dates unknown. No noise was added to engineered steel.

Pending: actual new Chrome whole-frame/interaction/restoration test, then exact same private Site deployment. Even a new CI pass cannot certify the owner's GPU or establish the specific cause of the screenshot. The production scripts do not invoke WEBGL_lose_context; fault injection exists only in the separate browser test.
