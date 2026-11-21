# Learning Flywheel N332 — N331 export-observation subject audit

## One bounded question

Can N331 accept a clean-room observation made against a different export digest than the delivered export?

## Exact subject and counterexample

Audited N331 commit:

`automation/n331-zx85-function-export-closure-20261121@38638a0c71c289f9113c26e1bcc9ad3ddb8a52ea`

The adversarial fixture keeps N331's otherwise-valid anchor, manifest, object inventory, action inventory, behavior graph, generator birth records and two deterministic cold runs. It changes only the subject relationship:

- Delivery Receipt: export digest A;
- clean-room observation: explicitly observed different export digest B;
- `subjectBindingVerified=false`.

Expected: `HOLD_EXPORT_OBSERVATION_SUBJECT_MISMATCH`.

Actual: `[]`.

Decision: `HOLD_GATE_FAIL_N331_EXPORT_OBSERVATION_SUBJECT_UNBOUND`.

N331's 16/16 synthetic result remains historical evidence, but it is insufficient contract proof because none of its fixtures checks that the payload scan, runtime input trace, generator birth records and two-run determinism receipt belong to the delivered export bytes.

## Root cause and bounded correction

N331 binds the Producer receipt to `exportDigest` but does not compare that digest to an independently observed export subject. A clean observation from another package could therefore launder a delivered package containing teacher/reference, legacy or baked asset bytes.

The next correction is bounded to:

1. observation carries `observedExportDigest + observedManifestDigest`;
2. verifier compares both with the delivered receipt before using any observation facts;
3. different subject returns `HOLD_EXPORT_OBSERVATION_SUBJECT_MISMATCH`;
4. N331 fixtures remain and this exact counterexample becomes the next regression.

Teacher status: `NO_NOVELTY`. N312 already established subject-bound independent observations; N332 proves that known rule was not transferred into N331's export gate.

Production replay: `NOT_RUN`. No Mother implementation is authorized from this failed gate.

Lifecycle after routing: `POSTED=true` at [#91 issue comment 7062086374](https://github.com/haihao0307/guilin-dem-pipeline/issues/91#issuecomment-7062086374); `ACKNOWLEDGED=false`; `IMPLEMENTED=independent adversarial audit only`; `GATE-RUN=FAIL on exact N331 commit`; `ADOPTED=false`; `USER-ACCEPTED=false`.

No main, R2 OS, production Mother branch, public Site or production asset was modified.
