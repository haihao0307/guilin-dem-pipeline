# R04 continuation: close the inherited motion-controller bypass

Date: 2026-10-22. Baseline: c59077d66edd3b8bbe1956bbe6eabf9610eb37ed, Draft PR 329. Baseline run 39568484287 completed successfully, including the full file suite and the public suite. Its prior PR narrative was stale. That success did not cover the inherited MotionStudio ownership boundary.

## Reproduced source and observed UI

The delivered R04 re-parents `#stage` into `#npc-view` before native R07 finishes loading. R07 then appends its own MotionStudio host to the new parent and creates `ct=new l({viewer:De,controller:ge,host:c})`. The constructor creates `existing-human-motion-modes`, installs mode/play/reset/step controls, and schedules a separate RAF. `window.fullCommonWorkbench.motion()` exposes this instance. The earlier real-browser inspection found this panel visible, enabled and not inert. Hiding old body siblings did not cover a panel added later inside the new workbench.

The native mode selector can change viewer.mesh visibility, camera state and legacy actors outside RuntimeCommands. A command queue around new buttons alone therefore cannot establish sole ownership. A blank screenshot, HTTP 200 or successful physical test is not a test for this bypass.

## Bounded correction

The observation packaging adapter now replaces exactly one SHA-locked R07 composition anchor. It leaves `ct=null` and removes the unused host, without constructing the legacy controller at all. Thus there is no legacy MotionStudio RAF, button handler, scene root or publicly exposed controller instance to compete with the NPC runtime. This is not merely a CSS hide, and it does not call legacy dispose(), which would reveal the original hidden generator mesh.

The unchanged native startup renderer is split into NativeBootRenderer.cjs. Its bytes are exactly the previous NativeBootPatch.cjs blob 8845d01be0a3f35cf0146e1de7826739dfc57eee, SHA256 d951fdd3878c32c1ca3b7f8027ad12633960da1b6b68e6dbc2065e4b7c3dd1ac. The new wrapper checks this SHA before building. The existing build manifest records the wrapper SHA, and the source commit pins both files.

Original HUMAN-INTEGRATED-R07, body geometry, materials, native binding, actor solver, physical algorithms, command queue and all existing verification thresholds remain unchanged. The original human workbench keeps its MotionStudio; only this observation composition omits it. A missing, duplicated or drifted anchor fails the build.

## Verification and boundary

New fixture tests cover the original failing construction path, the corrected path, missing/duplicate anchors, invalid input, cancellation and repeated initialization. Golden-host tests check reversibility, unchanged canonical SHA, script syntax and the actual built output. Separate real Chromium checks require complete native readiness, no old controller or controls or scene root, preserved actor switching, and the 390 by 844 viewport. A viewport is not a physical phone test.

The existing full candidate/public workflow is retained unchanged and must complete for the new source before delivery. The new focused workflow is supplementary, not a replacement. No browser pass, visual acceptance or production readiness is claimed by this source document. SharedWorker, room navigation, learned motion generation and unrestricted-script security isolation are outside this correction. The receipt is diagnostics, not a security boundary against hostile same-origin JavaScript.
