# KAOPU Learning Log — Water event replay contract W03

## Question

How should W01/W02 water fluxes handle retry duplicates, out-of-order delivery, late events and corrections without applying the same water twice or mutating nonlinear state in the wrong chronology?

## Evidence and bounded method

CloudEvents 1.0.2 defines `source + id` as the event identity and permits consumers to treat a repeated pair as a duplicate. It does not promise exactly-once delivery or prescribe payload hashing, revisions or state replay. OGC SensorThings 1.1 separately distinguishes `phenomenonTime` (when the observation happened) from `resultTime` (when the result was generated). These official roots support identity and time separation only.

The bounded CPU fixture added a KAOPU candidate ledger on top: immutable payload hashes, exact-redelivery no-ops, explicit supersession and deterministic phenomenon-time replay into a storage capped at 112 m³. All seventeen checks passed.

## Observation

- Exact re-delivery of one sealed event changed neither final storage nor overflow and was counted once as a duplicate.
- Changing payload under the same `source + id` was rejected before state mutation. Reusing an `id` under a different source remained a distinct identity.
- Arrival order `[outflow, rain-1, late-rain, rain-2]` and chronological input produced the same canonical replay: final storage 108 m³ and overflow 6 m³.
- Appending the late 3 m³ event directly to the already-mutated current state produced 111 m³ and overflow 3 m³. Chronological replay produced 108 m³ and overflow 6 m³. The difference is caused by the capacity nonlinearity, so additive commutativity cannot justify direct late append.
- Revision 2 explicitly superseding a 5 m³ event with 4 m³ yielded overflow 5 m³. The predecessor was inactive rather than being added beside its replacement.
- A report remained in the evidence ledger but did not enter the mutation set.

## Candidate / Current Best View

Extend W01/W02 with an immutable event envelope:

- delivery identity: `source + id`;
- sealed mutation payload hash;
- phenomenon interval distinct from result/arrival chronology;
- event kind separating state mutation from report/evidence;
- monotonic revision and explicit `supersedes` identity.

Exact re-delivery is an idempotent no-op. A changed payload under an existing identity fails closed. A late unique event or accepted correction invalidates later derived state and triggers deterministic replay from a suitable checkpoint. A correction replaces its predecessor; it is never added beside it. Supersession must have a known predecessor, matching source/subject/type/interval, increasing revision, one successor per predecessor and no cycle.

The payload-hash, supersession and replay rules are KAOPU candidates derived from the official identity/time semantics and the executable counterexamples; they are not claims made by CloudEvents or OGC.

## Rejected

- “At-least-once retry may safely reapply the same water event.”
- “An event ID is globally unique without its source scope.”
- “Same identity with changed content is a correction.”
- “Arrival/result time may replace phenomenon time for physical mutation order.”
- “Late flux can always be appended because water balance is additive.”
- “A corrected value should be applied in addition to the original.”
- “A reporting snapshot is a physical input event.”

## Unknown

- Checkpoint cadence, retention, compaction, concurrent ingestion isolation and recovery after a partially committed replay remain unverified.
- Real Mother clocks, durable storage, transport retries and target-runtime implementation remain unverified.
- Real hydrology, physical parameters, joint execution, browser/device behavior and Mother adoption remain unverified.

## Next gate

Mother-owned isolated trial: persist an event ledger and checkpoint, inject an exact retry, an altered same-identity payload, an out-of-order unique event and one explicit correction, then crash between ledger commit and derived-state publication. Require atomic recovery to the same receipt and retain W01 volume plus W02 interval/method gates.

Mother feedback before this round: none found for W02. Routing remains prepared, not delivered, acknowledged or adopted.

First-tier expert AI: not called.
