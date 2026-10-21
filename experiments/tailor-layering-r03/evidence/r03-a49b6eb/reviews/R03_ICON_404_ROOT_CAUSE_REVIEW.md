# R03 observed browser icon 404 — independent root-cause and gate review

**Decision: the now-proven noncritical origin-root icon 404 may be classified separately under a narrowly reviewed new verifier rule. Neither of the two failed historical workflows is a PASS, and final sharing remains HOLD until the new rule is reviewed and actually passes.**

## Newly established evidence

The actual diagnostic mobile summary at `r03-public-diagnostic/mobile/evidence/public-mobile/summary.json` has SHA-256 `d3ca20c8010f5024771e6037ba94e996bd386478c16c6780faa0c190364215fc`. It still records `passed:false` at the unchanged assertion requiring all console errors to equal zero.

This reviewer directly read the following original observations:

- Exactly one console error, whose `location.url` is `https://haihao0307.github.io/favicon.ico` and whose text is the browser's HTTP 404 resource error.
- Exactly one error-level CDP Log entry, `source:network`, for the same URL, with `networkRequestId:3214.3`.
- A CDP request with ID `3214.3`, exact same URL, method `GET`, type `Other`, initiator type `other`, and the fixed R03 page as `documentURL`.
- A CDP response with the same ID and URL, HTTP **404**, type `Other`, `fromDiskCache:false`, `fromServiceWorker:false`.
- No CDP loading failures, no page errors, and all **89** retained Playwright application-network records returning HTTP 200.

The URL is the origin-root browser icon request, outside the fixed R03 directory and its tested 308-file runtime. The observation identifies the failing request; this is no longer an inference from a generic error string. All earlier actual mobile scene/touch/frame/pixel/control assertions had completed before the final console assertion failed.

## Why this changes the earlier diagnosis

When location was absent, the correct result was an unknown potentially material console error and HOLD. Passive instrumentation has now established the precise request. The earlier no-attribution decision must not be presented as though favicon had been known then.

The exact normative source is `haihao0307/guilin-dem-pipeline@a49b6eb9bdf9f3bb097a4470465bc463d97dfb7b:knowledge/PUBLIC_WEB_DELIVERY_GATE.md`, version 1.2.0. Its mandatory loop requires successful critical scripts/data/styles, no page exception, no fatal console error and no critical resource failure. It does not require a browser's missing origin-root icon to be reclassified as a fatal application/runtime failure. The frozen `TASK_ANCHOR.json` likewise has no user-authored absolute-zero-all-ordinary-console requirement.

The helper's absolute zero-console assertion was an additional, broader test condition. For that original condition, both failures remain real and are retained. For the actual application-delivery contract, this observed browser icon error can be classified as a known noncritical browser request. That is an evidence-based correction to validation scope after ROOT_CAUSE_REVIEW, not a physical tolerance change or an unlocated error waiver.

This **does change the original acceptance assertion**. The next verifier must say so openly; it must not reuse the diagnostic report's statement that all 39 assertions remain unchanged.

## Narrow acceptance boundary for the proposed new verifier

Approval in principle is limited to at most this one precisely identified event in a run:

1. Derive the exact permitted URL as the fixed page origin's `/favicon.ico`, with no alternative path, query or hash.
2. Preserve the original console record and count. If an error exists, require exact URL/location and HTTP 404 error text; no generic filename/suffix allowlist.
3. Require the matching raw CDP network error, request and response with the same nonempty request ID and exact URL, HTTP 404, type `Other`, GET and browser `other` initiator. A missing or inconsistent binding fails.
4. Reject any additional console error, page error, unmatched CDP error/loading failure or failed critical runtime resource. A 404 from `app.mjs`, a different icon path, a query variant, or a script-initiated request must not acquire this exception.
5. Keep all original source/HTTP/geometry/material/physical/touch/pixel/control assertions. No production modification, request interception, fake response, favicon injection or browser cache alteration is needed or authorized by this classification.
6. Report both **total console errors** and **classified noncritical icon errors**, plus **unexpected/fatal errors**. A run with this event must never be described as having zero total console errors.

A run with no console/CDP error can pass normally. The classification is not required to invent or force an icon error. Tests of the new classifier should exercise rejection of extra errors, missing CDP correspondence and wrong paths/initiators; a classification error is a release-gate defect.

## Bounded task and history

The same Task Anchor and its old reentry failure remain in the record. `MOTHER_PRODUCTION_OPERATING_SYSTEM_R2_ZH.md` section 10 requires root-cause review after repeated failure; the new raw evidence now establishes a specific classification defect. A bounded verifier correction may follow that review. This is not a reset of the failure budget or permission for repeated speculative retries.

First-public run **39544000653** and passive-diagnostic run **39549894670** remain failed workflows. Their successful desktop lanes and earlier mobile actions retain only their stated scopes. A new verifier source identity and new actual successful public execution are required before independent final acceptance. Six full production CI members remain PASS for unchanged a49 source; no repeat World run is justified by a verifier-only classification correction.

**Current state: HOLD pending review and execution of the precise classifier. `shareAllowed:false`, `visualAcceptance:false`, `productionReady:false`.**
