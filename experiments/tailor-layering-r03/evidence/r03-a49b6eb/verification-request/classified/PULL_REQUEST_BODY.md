## Why this verification correction is needed

The immutable R03 production source remains `a49b6eb9bdf9f3bb097a4470465bc463d97dfb7b` and the public runtime remains tree `114feff8d1b1c79a9a164fc8a99b181507d1cc89`. All six full production CI members passed in run 39539509515. This PR changes verification files only.

First public run 39544000653 and passive diagnostic run 39549894670 remain **failed** workflows: desktop passed, mobile completed its scene, touch, frame, pixel and control checks but failed the extra zero-all-console-errors assertion. The first error lacked a location and is not retrospectively attributed. The diagnostic directly located its only error as the browser's optional origin-root `https://haihao0307.github.io/favicon.ico` HTTP 404, outside the immutable R03 runtime, with matching raw Console, CDP Log, GET request and 404 response.

## Reviewed rule change

The frozen project public-delivery policy requires no page exception, fatal console error or failed critical resource; it does not make a proven optional browser icon fatal. Following independent ROOT_CAUSE_REVIEW, this changes the previous absolute-zero-console assertion. It does **not** claim that every acceptance assertion stayed unchanged.

Only one exact, fully matched browser-initiated origin-root favicon 404 may be classified as noncritical. The raw console error and its total count remain recorded. Missing attribution, any different path/origin/text/request/initiator, another console/CDP error, any CDP loading failure, or any additional HTTP failure fails the gate. The former broad network favicon suffix exclusion is tightened to the exact already-proven URL, status 404 and no loading failure. The classifier has 22 positive/negative tests; the new workflow runs them before the actual mobile test.

All existing production source, public URL/resource fingerprints, physical, geometry, render-frame, touch, canvas-pixel and layout checks remain. No production code, runtime files, network interception, fake response, favicon injection or cache manipulation is added. Chromium/SwiftShader remains a functional CI check, not a mobile-hardware or real-time performance certification.

## Evidence and current state

- Historical failures are retained without overwriting their original summaries or artifacts.
- The diagnostic source `349f7b784141d9cfb2737b799e15202a9c801f01` preserved the original assertions and was intentionally allowed to fail for attribution.
- The new classifier source is `b6d0fef01a2d229ce09a6ff1e9bce11d44aafb1c`; it must produce a new successful actual desktop + mobile workflow before final sharing.
- Existing public URL is the fixed R03 build; source and runtime identities are unchanged.
- `visualAcceptance:false` and `productionReady:false` remain. This PR stays draft and unmerged.
