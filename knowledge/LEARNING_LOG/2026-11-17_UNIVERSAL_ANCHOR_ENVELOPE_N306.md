# N306 — KaoPuGram Universal Anchor Envelope

## Bounded question

What is the smallest domain-neutral envelope that every KAOPU workbench can emit without letting a common service guess terrain, garment, hair, character, animal, or building semantics?

## Comparison with Current Best View

R2 already protects whole accepted baselines. N305 added a Candidate for component-scoped Golden Baselines. The remaining gap is cross-workbench interoperability: component identity must travel through one common protocol, while component discovery and semantic validation remain local to versioned workbench adapters.

OCI's descriptor model is useful here because its small common envelope carries type, digest, and size while the referenced content remains independently typed. KaoPuGram can transfer this separation without importing container runtime or registry machinery.

## Falsifiable replay

The same command, “靠谱锚定当前满意部分,” was replayed in two synthetic current contexts:

- Terrain adapter selected one 12.5 m terrain tile and explicitly excluded weather runtime state.
- Garment adapter selected one front-shell pattern piece and explicitly excluded the body collider.
- Both emitted the same envelope schema with different artifact types and component media types.
- A workbench with no active selection returned HOLD_ANCHOR_SCOPE_UNRESOLVED.
- Independent digest/size verification passed the valid garment payload and held a tampered seam allowance.
- Capture did not claim independent verification, user freezing, or user acceptance.

## Candidate decision

TEACHER_CANDIDATE / AUDITION.

Keep the universal service deliberately ignorant of domain semantics. Require every workbench to provide an approved, versioned adapter that resolves explicit component scope against the exact parent commit. Trial the protocol on historical terrain and one Garment Mother only. Do not change R2 or create a common production service until the adapter boundary survives that trial.

No new regression case was created. The current request is a protocol design need, while existing stale-delivery and no-method-invention regressions already cover old context and unauthorized scope changes.

## Failure boundaries

Identity is not quality. Unknown adapters cannot verify semantics. UI selection without a matching parent commit is stale. Canonicalization must be versioned. LFS, generated, runtime, browser, and device artifacts need payload-level descriptors. A Producer may capture an anchor Candidate but cannot mark it independently verified, frozen by the user, adopted, or user accepted.
