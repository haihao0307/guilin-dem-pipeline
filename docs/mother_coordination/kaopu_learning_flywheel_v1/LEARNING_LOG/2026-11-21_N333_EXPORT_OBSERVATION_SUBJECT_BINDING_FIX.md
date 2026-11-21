# Learning Flywheel N333 — export observation subject-binding correction

## One bounded question

Can the minimal N332 correction bind every clean-room observation to the delivered export and manifest subjects without changing N331's other export rules?

## Correction

The verifier now rejects before consuming clean-room facts unless:

- the manifest digest recomputed from the delivered manifest equals the receipt's `manifestDigest`;
- `observation.observedExportDigest == receipt.exportDigest`;
- `observation.observedManifestDigest == receipt.manifestDigest`;
- `observation.subjectBindingVerified == true`.

No object/action inventory, function-generation, offline replay, forbidden-payload or size-budget rule was weakened.

## Results

- N331 inherited suite plus the exact N332 counterexample: **17/17 PASS**;
- focused export/manifest binding probe: **4/4 PASS**;
- production export replay: `NOT_RUN`.

The historical N331 16/16 result remains recorded as insufficient; it is not rewritten as if it had covered the counterexample.

## Decision

`CANDIDATE_N331_OBSERVATION_SUBJECT_BOUND_HOLD_PRODUCTION_REPLAY_UNVERIFIED`

Teacher: `NO_NOVELTY`. This is an executable transfer of the already-known N312 subject-binding rule.

Only after an affected ZX85 Whole/Export Mother freezes a production source head, export/manifest digests, object/action inventories and size budget may this Candidate receive a production trial. Verifier authentication/freshness remains a separate gate and is not claimed by this correction.

Lifecycle before routing: `POSTED=false`; `ACKNOWLEDGED=false`; `IMPLEMENTED=candidate gate correction only`; `GATE-RUN=17/17 + 4/4 fixture only`; `ADOPTED=false`; `USER-ACCEPTED=false`.

No main, R2 OS, production Mother branch, public Site or production asset was modified.
