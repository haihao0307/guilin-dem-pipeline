# R18 first-interstation native street preview

Derived from the user-accepted R17 metre-scale train. R17 and the original R14 entry remain unchanged. This new complete game entry reuses R17 Session, train, two coaches, people, audio, steam, station and bridge logic. It has an isolated save/view/quality namespace.

## Actual authored coverage

Only the first two existing stations are covered: scene distance **0–700 metres**. The inherited historical timetable displays **4.4 km**; this is not 4.4 km of new geometry and no time/velocity multiplier is changed. The deterministic route contains 37 two-building parcels (74 buildings), including margins opposite the full platform at both stops. Buildings remain on negative Z; positive Z retains the passenger/platform/camera corridor. The existing bridge is at 355 scene metres. Adjacent buildings step back there rather than leaving a long empty town gap.

The original R17 near parcel is preserved at x=27. Additional parcels vary upper-floor count (2–6, plus the shop ground floor), floor height, width, setback, brick/timber facade, repair/age, shop trade, open/closed state and 12 fictional Traditional Chinese shop titles. The 32 licensed glyphs remain native Bézier functions with counters; no font bitmap, image texture, baked geometry or photograph is delivered.

## Streaming

Each parcel resolves from seed1978 and its stable index. Near preserves the detailed existing architecture. Mid/far retain building mass, actual facade holes and reveals, balcony/cage outlines, signboard/support silhouettes and roof form; small interior goods, fine bars, letters and cloth progressively disappear with distance. This is discrete distance LOD with hysteresis, not a cinematic crossfade. Transition visibility must be reviewed in actual motion.

One nearest parcel (two buildings) receives full near detail. Mid enters76m/exits88m; far enters140m/exits156m. Hard caps:16 chunks,520000 expanded street triangles,48MB unique street geometry,2 builds per render. The manager downgrades departing parcels before upgrading approaching parcels, shares primitive/glyph geometry and releases GPU storage at the last reference. A finite CPU glyph cache stays while the segment is active and is cleared on full exit/disposal. Two persistent shop-light slots avoid changing shader-light counts.

The phase-one CPU sweep at 5m intervals had 14 maximum resident chunks,480936 expanded street triangles,7.79MB unique geometry and1.75MB instance attributes. The finite CPU geometry cache reached16.6MB and cleared at manager disposal. These exclude the preserved train/host renderer and do not establish a hardware frame rate. Read `evidence/` and actual CI results for measured costs; a small score is not equivalent to cheap rendering.

## Evidence boundaries

All dynamics use `Session.view.elapsed`; world coordinates rebase by the accepted train distance, without changing Session physics, station timing or actor speed. Default two full-size coach bodies, gauge, wheel geometry and platform height are inherited unchanged. No new train/actor asset, terrain system or unsupported microscope integration is claimed.

The native-browser test uses real UI keyboard/mouse and production time, completes both stations' passenger service, and captures first stop,150m,350m,500m and next stop. Captures pause by the real P control; only the pause-sheet presentation is hidden for the PNG. Any incomplete/failed run remains explicitly failed. Official CI uses software SwiftShader: this is actual WebGL rendering, not physical phone/desktop GPU benchmarking or final film-quality approval.

The candidate is a separate Draft PR and is not published merely because tests pass. The initial R17 baseline still exists at ../r17/.

## Bounded acceptance repairs

Low-detail omission consumes the same authored random choices as near detail. Tests compare all37 parcels at every LOD: canopy rest/attachment/deformed points, window/cage/sign/opening identities. Failure attempts count before construction and stop at2 per update, including failures; budget rejection keeps the old parcel rather than recursively rebuilding. The complete71 ten-metre positions are checked under6 original cameras in both layouts (852 deterministic CPU states), with no missing desired chunk. This complements native real-WebGL samples; it is not falsely labelled as852 rendered frames.

First browser run38041741742 completed both stops at696.123m but failed its initial sample-count gate:52 occupied10m bins, max rendered gap23.803m, with slow software rendering. The revised native gate requires0→690+ coverage, all seven100m bands, monotonic distance, and≤36.05m maximum step (unchanged Session2s catch-up limit×18m/s). Audio decoder verification remains enabled; official ffmpeg/ffprobe and shell pipefail are installed/enforced. Final acceptance must be read from the subsequent CI result.
