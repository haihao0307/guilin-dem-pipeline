# KaoPuGram R0.2 — cross-workbench anchor core

A dependency-free Node.js prototype. It separates repository identity from runtime-selected object identity.

## Quick start
Add `kaopugram.yaml`:
```json
{"workbench":"clothing","domain":"clothing","context":{"activeModule":"cloth-solver","activeObject":"jacket-01"}}
```
Run `npm test` (Node.js 20+). Commands: `resolve [runtime.json]`, `propose <id> [protected,path,list]`, `verify <id>`, `promote <id> <approval-identity>`, `recover-plan <id>`.

## Design correction
File hashes are provenance/integrity checks, not quality metrics. Gram matrices compare adapter-provided feature relations; they do not extract semantic features from meshes or certify visual quality. Domain adapters must supply geometry, motion, material, physics and performance measurements. The core refuses to guess missing/ambiguous active-object context.

Promotion requires a clean worktree, matching passing verification, and explicit approval. Recovery only emits a plan; it never resets files or moves Git refs. Automated tests: 9 passed, 0 failed.
