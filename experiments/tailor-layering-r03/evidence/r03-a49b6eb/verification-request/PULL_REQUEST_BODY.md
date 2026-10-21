## Purpose

Verify the deployed, fixed R03 clothing-layering page against the exact runtime
produced by the successful full matrix for source
`a49b6eb9bdf9f3bb097a4470465bc463d97dfb7b` (production Draft PR #324).

This verification request changes only three `.github` files. All production
source remains byte-identical to a49. This PR stays draft and is not for merging.

## Actual public acceptance

- Fixed target: https://haihao0307.github.io/guilin-dem-pipeline/kaopu-tailor-workbench/material-products/layering-r03-20261021-a49b6eb/
- Tested runtime tree: `114feff8d1b1c79a9a164fc8a99b181507d1cc89`.
- Independent `public / desktop` and `public / mobile` jobs run in fresh Chromium
  contexts and preserve separate original artifacts, including on failure.
- Desktop performs real initialization, one solver step, a read-only contact and
  geometry audit, OFF/ON execution changes and a camera operation. It also
  requires the exact final URL, zero console/page errors and nine actual HTTP
  readbacks matching the previously tested capsule fingerprints.
- Mobile checks the actual 390×844 entrance, a touch camera change with completed
  GPU frame and pixel evidence, unchanged physics, reachable controls and layout.
  This is viewport/touch emulation, not a physical-phone performance claim.

Both jobs and independent artifact review are required before the public URL is
shared as an accepted technical candidate. The complete six-job solver/browser
matrix remains a separate prerequisite. SwiftShader timings do not establish
real-time performance; human visual acceptance and production readiness remain
false until a separate human decision.
