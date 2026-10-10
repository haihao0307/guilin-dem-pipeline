# N132 — Tailor R04.3.2 independent-browser WebGL boundary replay

- Date: 2026-10-10
- Mother: Tailor
- Pull request: #181
- State: Candidate / `NO_NOVELTY`
- Decision: `R0432_PUBLIC_BYTES_AND_CI_BROWSER_VERIFIED_SCOPED__HOLD_INDEPENDENT_WEBGL_RUNTIME_DEVICE_USER_ACCEPTANCE`

## One bounded question

Does R04.3.2's `publicVerified=true` generalize to an independent hosted Chrome, or does WebGL-context failure correctly force a scoped runtime HOLD without erasing the exact public/CI evidence?

## Existing real failure

The first public attempt at `fe8087cdd39e4c5ded8a0af86fb4d7f4e90a9cc0` failed because `parameter-schema.json` returned 404. The failure was retained, the bad prefix was marked not-deliverable, bundle closure was added, and a new fixed prefix was published.

A second, distinct failure appeared in an independent hosted Chrome: the exact fixed page loaded and displayed R04.3.2, but Three.js could not create a WebGL context. The page stayed in “未通过 / 待修复”, disabled interactive controls, exposed the reason, and explicitly refused an alternative model or shell.

## External method / primary evidence

- MDN documents that `HTMLCanvasElement.getContext()` returns `null` when the requested context is unsupported or incompatible with the current configuration: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext
- The HTML Standard permits WebGL/WebGL2 context creation to return null under the user agent's current configuration: https://html.spec.whatwg.org/multipage/canvas.html#dom-canvas-getcontext-dev

## KAOPU comparison

R2 already separates source, public-byte, browser/device, production and user-acceptance layers and already requires explicit failure with no silent fallback. N49 recorded the same WebGL-context mechanism for Coast. This Tailor observation is new subject-level evidence, not a new global rule. Result: `NO_NOVELTY`.

## Falsifiable hypothesis

If R04.3.2 claims remain layer-specific, then exact public bytes, CI Chromium and decoded galleries can pass while an independent browser unable to create WebGL is held at runtime, shows an explicit reason, leaves controls unavailable, and does not substitute another model.

## Minimal replay

### Exact release evidence preserved

- Native solve source: `cc40098fc782b9cb9ca99743e07f101356159421`
- Runtime source: `eeca9dee0c3a01be2b203eb3422bd62f146b8795`
- Fixed URL: https://haihao0307.github.io/guilin-dem-pipeline/kaopu-tailor-workbench/presets/r0432-eeca9dee0c3a/?preset=S02
- Native validation run: https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/38042213827
- Final public run: https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/38044151774
- Pages run: https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/38044272065
- Gallery decode run: https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/38045206400
- Exact result: 60 papers, 60 materials, 60 solver records, 22 static pass, 38 static fail.
- Decode result: 60 original PNGs and 432 distinct outfit thumbnails decode and are nonblank.
- Acceptance limits remain false: all-60 garments, physical fit, dynamic wear and user acceptance.

### Failed first publication preserved

- Run: https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/38043051246
- Failure: `parameter-schema.json` returned 404.
- Disposition: not delivered; failed prefix must not be reused.
- Repair: dependency-closure check plus republished exact fixed prefix.

### Independent hosted-Chrome observation

- Exact fixed HTML: loaded.
- Release marker: R04.3.2.
- WebGL context: unavailable.
- Console: `THREE.WebGLRenderer: Error creating WebGL context.`
- Visible state: “原系统连接失败：Error creating WebGL context.；不会改用替代模型或衣壳。”
- Interactive controls: unavailable.
- Silent fallback / creative substitute: none.

Replay: **15/15 boundary checks classified correctly**.

## Applicable boundary

Only the exact R04.3.2 subjects/fixed prefix and this hosted-Chrome environment. The failure does not invalidate successful exact-subject publication or gallery decode. Conversely, those successes do not certify the user's physical browser/device, the 38 failed garments, physical behavior, production use or user acceptance.

## Executable object

Updated the existing deduplicated Tailor regression case. Added one audit rule: public verification must remain split into exact bytes, CI browser, independent browser/device and user-acceptance layers. WebGL-context failure is explicit scoped HOLD evidence and never authorizes fallback.

No global R2/gate change and no production Mother branch change.

## Lifecycle

- POSTED: true — PR #181 comment 6097186622
- ACKNOWLEDGED: false for this independent-browser finding
- IMPLEMENTED: true for fail-closed/no-fallback behavior
- GATE-RUN: true
- ADOPTED: false
- USER-ACCEPTED: false

## Metrics

- First-candidate pass rate: unknown
- User correction count: unknown
- Same-class recurrence rate: unknown
- Rejected-lineage inheritance count: 0 observed in this replay
- Stale-delivery count: 0 for the final fixed prefix; 1 failed first-public attempt retained and not delivered
- Internal iterations per accepted delta: unknown
- User instruction to legal candidate time: unknown

## Routing receipt

- PR #181 comment: https://github.com/haihao0307/guilin-dem-pipeline/pull/181#issuecomment-6097186622
- Evidence branch: https://github.com/haihao0307/guilin-dem-pipeline/tree/automation/n132-tailor-r0432-independent-browser-webgl-20261010
- Production branch changed by this learning cycle: false
- Global R2/gate changed: false
