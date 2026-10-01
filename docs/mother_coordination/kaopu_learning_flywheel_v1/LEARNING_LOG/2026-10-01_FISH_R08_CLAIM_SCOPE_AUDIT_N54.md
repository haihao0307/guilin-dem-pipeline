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

Lifecycle before routing: `GATE-RUN=true`; all of `POSTED`, `ACKNOWLEDGED`, `IMPLEMENTED`, `ADOPTED`, `USER-ACCEPTED` are false. Reliable KPI deltas remain `unknown`.

No external AI was claimed or invoked as a participant.
