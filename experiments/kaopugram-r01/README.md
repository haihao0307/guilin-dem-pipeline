# KaoPuGram R0.1 prototype (staging)

This is a test package staged temporarily in `guilin-dem-pipeline` because the separate `haihao0307/KaoPuGram` repository currently returns 404 and the connected GitHub actions do not expose repository creation.

## Included
- dependency-free Node.js CLI
- Git/workbench context resolver
- runtime selection context contract
- candidate anchor and explicit promotion lifecycle
- SHA-256 protected-file snapshots
- optional Gram matrix comparison over adapter-provided feature vectors
- drift detection and non-destructive recovery plan
- 6 automated tests

## Test
Requirements: Node.js 20+ and Git.

```bash
npm test
```

The source package is in `kaopugram-r01.tar.gz` in this folder. Extract it and run the tests.

## Current boundary
This proves the generic anchor lifecycle and a basic Gram relationship comparison. It does not yet extract mesh/cloth/hair features or judge visual/physical quality. Every workbench must export its active object/module through runtime context; when that is missing or ambiguous, the resolver refuses to guess.

Test result at staging time: 6/6 passed.
