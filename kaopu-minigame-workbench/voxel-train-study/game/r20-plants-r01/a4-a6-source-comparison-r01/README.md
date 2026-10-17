# A4 → A6 source comparison R01

Open index.html through HTTP. Four independent synchronized orthographic spaces preserve original roots. Drag/wheel any view to control all cameras. Side/quarter views, source animation and bind-pose reset, and A6 exterior-layer toggle are available.

A4/A6 share the exact original three-driving-axle source; original coach and its learning-expression copy share exact full Mark3. A4 and Mark3 source units are not independently calibrated to metres. No claim that the two source assets are a correctly coupled or dimensionally certified train.

`npm install`; `npm test`; `npm run test:browser` (official Playwright Chromium required). Existing CI is used when local browser startup is restricted.

See CONVERSION_SCOPE.md for implemented source-residual expression, authored A6 function layer, unchanged source geometry/materials/animation, and unresolved pure-function/metric/mechanical requirements. See ATTRIBUTION.txt for original authors and CC BY 4.0.

## Loading repair (2026-10-17)
The previous first frame waited for all four independent recoveries and exposed no stage or byte progress. It also did not catch static module import failures and had no network deadlines. A slow/failed request could therefore leave all four panels grey with the original loading label. This is a verified software defect, not proof of which request stalled on an individual user's device.

The repaired loader shares verified source bytes within the page (one A4 and one Mark3 fetch/hash pass), while separately parsing each complete scene so node transforms, materials and animation mixers remain independent. Images are decoded from the exact bytes already hashed rather than fetched a second time by GLTFLoader. Every source field, complete payload and image is still verified. Gzip-magic detection accommodates transparent HTTP decompression; decompressed length and full SHA256 remain mandatory.

Each complete pair renders as soon as its own verification and restoration finish. The page shows per-source download bytes, retry attempt and verification/decode stage. Network attempts have a 90-second total deadline, including response body streaming, and at most two retries. Scene decode and gzip stages also have deadlines. An early classic-script bootstrap reports module failures and a 110-second no-progress condition instead of silently leaving the initial status. The reload button restarts the page; source bytes and immutable earlier commits are preserved.

Browser QA now supports TEST_URL to navigate the actual public Pages origin and records HTTP responses, request durations, stage samples and failure screenshots independently of localhost tests. Source and mechanical limitations are unchanged.
