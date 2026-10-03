# KAOPU Learning Flywheel N67 — verifier capability precondition

Date: 2026-10-04  
Status: CANDIDATE / LOCAL TO PUBLIC WEB RUNTIME VERIFICATION  
Global R2 adoption: false

## 1. Existing real failure

Material R09/R10/R11 and Coast R03 all failed to create WebGL2 in the same default hosted browser. The exact public artifacts remained delivery failures in that environment, but the available receipts did not run an isolated capability fixture with the same context requirements. They therefore could not distinguish:

1. the verifier environment cannot provide the required WebGL2 drawing buffer;
2. the exact artifact misconfigures or otherwise fails after the environment capability is available.

The new Material coordination record `MOTHER_0230_MATERIAL_R11_RUNTIME_GATE.md` correctly keeps delivery on HOLD and proposes this differential check. It does not yet define executable receipt semantics.

## 2. External method / evidence

- Khronos WebGL 1.0 context creation requires creation of a drawing buffer. If drawing-buffer creation fails, the user agent fires `webglcontextcreationerror` and `getContext()` returns `null`; the event status is platform-dependent. This proves context creation failed, not by itself whether the production artifact or the environment is responsible: https://registry.khronos.org/webgl/specs/1.0/#2.1
- Web Platform Tests uses `PRECONDITION_FAILED` when an optional implementation requirement fails during setup; dependent subtests do not run. This is a mature status distinction between an unmet test precondition and a failed assertion about the subject: https://web-platform-tests.org/writing-tests/testharness-api.html#assert-implements-optional
- NASA IV&V guidance requires the test environment to be complete, correct and accurate for the intended objectives. NASA test-report guidance also requires recording environment versions and differences from the operational environment: https://swehb.nasa.gov/spaces/SWEHBVC/pages/50888971/SWE-141 and https://swehb.nasa.gov/spaces/7150/pages/16449691/SWE-118

These sources do not say a WebGL artifact is correct when a verifier lacks WebGL. They support only a scoped separation between delivery outcome, test precondition and defect attribution.

## 3. Comparison with current KAOPU rules

`PUBLIC_WEB_DELIVERY_GATE` already does the important user-facing job: a public page that does not start or permit a critical interaction remains a failed delivery. N49/N61/N62/N65 already prevent SwiftShader success from becoming a universal browser claim.

The missing executable distinction is narrower:

`public delivery failed in environment E` does not imply `artifact defect proven`, unless E first passes a capability fixture matching the artifact's required API and context attributes.

This Candidate does not weaken the public gate. It only constrains root-cause attribution and prevents repeated shader/shape edits when the evidence stops before shader compilation.

## 4. Falsifiable hypothesis

If an isolated `TEST_FIXTURE_ONLY` probe with the same required capability and context attributes passes in environment E, but the exact bound artifact fails in E, the artifact may be classified `SCOPED_ARTIFACT_RUNTIME_FAILURE`.

If the matching fixture fails, the artifact is `NOT_EVALUABLE_IN_ENVIRONMENT`; only `ENVIRONMENT_CAPABILITY_BLOCKER_ARTIFACT_UNKNOWN` is allowed. A different environment may still pass or fail independently.

Counterexample that would falsify bad attribution: the matching fixture passes while the artifact fails. That rejects “the environment simply has no WebGL2.” The opposite differential rejects “the artifact is proven broken everywhere.”

## 5. Minimal replay

Regression `VERIFIER-CAPABILITY-PRECONDITION-001` covers ten cases:

- Material R11 and Coast R03 history without isolated preflight;
- matching fixture fail + artifact fail;
- matching fixture pass + artifact fail;
- matching fixture pass + artifact pass and critical interaction;
- SwiftShader scoped pass incorrectly generalized;
- incapable environment failure incorrectly generalized;
- unbound artifact/environment identity;
- preflight using mismatched context requirements.

Executable result: 10/10 passed.

## 6. Candidate receipt fields

Add only to the next applicable runtime verification receipt, not to all Mothers globally:

```text
artifactIdentityBound
environmentIdentityBound
environmentId
browserVersion
launchArguments
graphicsBackend
physicalDevice
requiredCapability
requiredContextAttributes
capabilityFixtureId
capabilityFixtureIsolated
requiredCapabilityId
requiredContextFingerprint
fixtureCapabilityId
fixtureContextFingerprint
capabilityPreflightStatus
contextCreationErrorStatus
artifactRuntimeStatus
criticalInteractionStatus
requestedClaimScope
attributionState
```

State meanings:

- `HOLD_CAPABILITY_PREFLIGHT_MISSING`: delivery may be failed, but defect attribution is not established.
- `ENVIRONMENT_CAPABILITY_BLOCKER_ARTIFACT_UNKNOWN`: matching isolated fixture failed; artifact is not evaluable in this environment.
- `SCOPED_ARTIFACT_RUNTIME_FAILURE`: matching fixture passed, exact artifact failed in the same bound environment.
- `SCOPED_ARTIFACT_RUNTIME_PASS`: matching fixture and exact artifact plus critical interaction passed in the same environment.
- `REJECT_UNSCOPED_RUNTIME_CLAIM`: a scoped observation was promoted to all browsers/devices.

## 7. Applicability and adoption decision

Applicability: browser/device runtime claims whose required capability may be absent or altered by the verifier environment. First proposed trial: Material R11 root-cause review. Coast may reuse it only when the same fields are actually recorded.

Not applicable to reference fidelity, visual acceptance, physical-device claims, or user acceptance. It does not permit `shareAllowed=true` when the public delivery gate fails.

Decision: `IMPLEMENTED_CANDIDATE / GATE-RUN`; not `ACKNOWLEDGED`, `ADOPTED`, or `USER-ACCEPTED`. No production Mother, `main`, `gh-pages`, R2 baseline, public artifact, schedule or notification was changed. Production KPI delta remains `unknown`.
