# N54 — Fish R08 claim-scope audit: exact public bytes do not close source, verifier and browser claims

Status: new subject-level validation; `no-novelty` at the policy/regression level. No production branch, `main`, `gh-pages`, R2 baseline, existing gate, schedule or other Mother was changed.

## Bounded question

Does Fish R08's `PUBLICATION_PROOF.json` support the combined claim that the exact new artifact is traceable to its source, independently verified, and currently starts in a final public browser?

## Existing real failure

After N53, `gh-pages` advanced to `2624c62b498c57851955bd8876a25c06f5bb98c8`. Fish R08's proof records public blob `b7241def724254ebd029d17244fc2b70b692d2c6`, `exactPayloadMatched=true`, `publicBrowserPassed=true`, `independentVerifier="PASS"`, `shareAllowed=true`, and candidate source SHA `a4e48540a1405439fb5a8b20c7ca2d64822fa35a`.

Independent checks found three different claim scopes:

1. **Public payload identity is preserved.** The proof's blob equals the current R08 `index.html` blob, and the page identifies itself as `R08 · KFC8`.
2. **Source lineage is not independently replayable from the receipt.** The 40-hex `candidateSourceSha` returns 404 as a commit, blob and tree in the named repository, while the receipt contains no `sourceRepository` or object type that could resolve it elsewhere.
3. **Independent verification is only asserted, not evidenced.** The proof stores `independentVerifier: "PASS"` but no verifier identity, execution root, run ID, exact verification subject or evidence digest.
4. **Fresh public-browser validation did not reach the 3D runtime in this environment.** Initial load and one reload both displayed `启动失败：此浏览器未提供 WebGL2`; `getContext('webgl2')` was null and the canvas remained intrinsic `300×150`. The page truthfully keeps `visualAcceptance=false`, `motionAcceptance=false`, and `productionReady=false`.

The fresh browser result does not erase a prior browser run that may have passed in another environment. It prevents that historical claim from being treated as a portable, current browser fact without the missing run/environment receipt.

## External method and evidence

- NASA describes IV&V independence as technical, managerial and financial independence, not a bare PASS label: <https://www.nasa.gov/ivv-overview/>.
- NASA SWE-141 requires IV&V to operate independently and to track, record and communicate the evidence/results of independent testing: <https://swehb.nasa.gov/spaces/SWEHBVD/pages/102695499/SWE-141%2B-%2BSoftware%2BIndependent%2BVerification%2Band%2BValidation>.
- GitHub immutable-release guidance ties verifiable release identity to a commit SHA and release assets: <https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases>.

Transferred method: preserve each valid narrow claim, but do not promote a combined release claim unless its source revision is resolvable, its verifier receipt is attributable and subject-bound, and its current browser observation is explicit about environment and result.

## Comparison with current KAOPU rules

No new policy is needed. N26 already prevents a green/complete label from promoting stronger skipped or missing claim scopes. N48 already requires an immutable, replayable parent/source reference. N51 already requires verifier identity, independent execution root, exact subject, run ID and evidence digest. `PUBLIC_WEB_DELIVERY_GATE` already separates deployed bytes from final public-browser startup.

Therefore N54 is a new R08 validation fact but `no-novelty` for the制度 layer. No duplicate regression case is created.

## Falsifiable hypothesis

Applying the existing claim-scope, replayability and verifier fields to R08 will preserve exact public-payload identity while holding the stronger combined claim. A control with resolvable source identity, attributable independent verifier and passing current browser run should pass. A browser-failed control should hold only the browser scope; a changed public blob should lose the payload-identity claim.

## Minimal replay

`PROBES/fish_r08_claim_audit_n54.mjs` executed four cases: `4/4 passed`.

- Current R08: `HOLD_CLAIM_SCOPE_INCOMPLETE`; eight explicit missing/failed reasons; exact public payload identity preserved.
- Complete independent control: `CLAIM_SCOPE_VERIFIED_NOT_USER_ACCEPTED`.
- Complete lineage/verifier plus failed browser: only `CURRENT_PUBLIC_BROWSER_FAILED`.
- Public blob mismatch: `PUBLIC_PAYLOAD_SUBJECT_MISMATCH`, with no payload claim preserved.

## Applicability boundary

This audit is limited to the exact Fish R08 proof and public subject observed here. It does not judge fish anatomy, continuous-skin correctness, motion quality, a user's physical device, or whether another correctly documented browser run passed. It does not set `shareAllowed=false` globally; it records that this fresh environment did not pass and that the combined proof is incomplete.

## Decision and routing

Decision: `no-novelty`; save the new validation and route it only to the Fish execution line via #91. On the next Fish receipt, add `sourceRepository`, resolvable `candidateSourceRevision`, `verifierIdentity`, `verifierExecutionRoot`, `verifierRunId`, `verificationSubjectSha`, `verifierEvidenceDigest`, plus browser engine/device/GPU/WebGL mode. Do not rerun visual work merely to satisfy documentation, and do not discard the verified public blob identity.

Routing receipt: issue #91 comment `5924332047`; audit commit `2cb092b9c127695cbf9fc55769b00bb80afc5579`. Lifecycle: `POSTED=true`, `GATE-RUN=true`; `ACKNOWLEDGED`, `IMPLEMENTED`, `ADOPTED`, and `USER-ACCEPTED` remain false. Reliable KPI deltas remain `unknown`.

No external AI was claimed or invoked as a participant.

## Evidence update — Fish R12: missing proof is UNKNOWN, not a byte mismatch

Fish R12 advanced `gh-pages` to `59bedc432bda44f8683ac3cbc5511df4da715a93` with commit claim `publish verified thirty-fish dynamic 3D school R12`. The exact R12 directory contains only `index.html` (blob `1237d3480d6e87ce311a7c1d8473d7cb1eb94c2b`, 30,113,266 bytes); `PUBLICATION_PROOF.json` returns 404. GitHub reports successful generic `build`, `report-build-status`, and `deploy` checks, but none is a Fish semantic or public-runtime verifier.

A fresh public-browser run reached the R12 page but stopped at `启动失败：此浏览器未提供 WebGL2`. The page itself remained `visualAcceptance=false`, `motionAcceptance=false`, and `productionReady=false`. This result is environment-scoped: it does not prove that R12 fails on a capable device, but it cannot support a portable/current `verified` claim.

SLSA verification requires provenance whose subject digest matches the artifact and whose builder/source expectations are checked; GitHub likewise requires an attestation to be cryptographically verified and signer identity validated. Inference for KAOPU: when no exact subject-bound proof exists, identity is **unverified**, not positively mismatched. Sources: <https://slsa.dev/spec/v1.2/verifying-artifacts>, <https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations>.

The existing N54 regression was therefore updated rather than duplicated. Its evaluator now preserves three states:

- `exactPayloadMatched=true` with equal digests → `EXACT_PUBLIC_PAYLOAD_IDENTITY_VERIFIED`;
- `exactPayloadMatched=false` → `PUBLIC_PAYLOAD_SUBJECT_MISMATCH`;
- absent/`null` exact proof → `PUBLIC_PAYLOAD_IDENTITY_UNVERIFIED`.

Falsifiable replay: the prior four cases must remain unchanged, while current R12 must hold the combined claim for `PUBLIC_PAYLOAD_IDENTITY_UNVERIFIED`, missing source/verifier evidence, and `CURRENT_PUBLIC_BROWSER_FAILED`. Result: `5/5 passed`.

Decision: Candidate evaluator refinement validated only in the coordination regression harness. It is not globally enforced, does not alter R2 or production branches, and does not judge fish anatomy, motion quality, a user's device, or user acceptance. Rollback is the parent coordination commit `0c5b220353da835c9d2fab109c0bb9cdd4a3b787`. Routing receipt: Fish issue #91 comment <https://github.com/haihao0307/guilin-dem-pipeline/issues/91#issuecomment-5927172068>. Lifecycle: `POSTED=true`, `IMPLEMENTED_CANDIDATE=true`, `GATE-RUN=true`; `ACKNOWLEDGED=false`, `ADOPTED=false`, and `USER-ACCEPTED=false`. Reliable KPI deltas remain `unknown`.
