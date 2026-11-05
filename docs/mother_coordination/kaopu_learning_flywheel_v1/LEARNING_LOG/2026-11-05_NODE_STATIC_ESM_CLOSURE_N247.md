# KAOPU Learning Flywheel N247 — Node static ESM request graph audition

Date: 2026-11-05  
Scope: Mechanical Mother v37 / display entrypoint authority  
Production mutation: none

## One bounded question

Can a parser-derived static ESM closure detect the exact N246 omission—`site/render.mjs` is executed by `site/app.mjs` but absent from `displayPolicy.dependencies`—without treating package-file integrity as semantic runtime authority?

## Real failure

N246 proved two separate facts:

1. `FILE-MANIFEST.json + CHECK-PACKAGE.py` correctly bind delivered bytes.
2. `displayPolicy.dependencies` is only a partial semantic entrypoint ledger and omits `render.mjs`.

This run re-used the exact v37 ZIP, SHA-256 `d4f19a70…86b81`. Fresh extraction again passed `311/311`.

## Teacher screen

Status: `TEACHER_CANDIDATE`  
Lifecycle reached: `RADAR_FOUND -> TEACHER_CANDIDATE -> AUDITION`

Teacher: Node.js `vm.SourceTextModule.moduleRequests`.

- Provenance: official Node.js API and `nodejs/node` implementation/tests.
- Runnable evidence: local Node.js v24.22.1 with `--experimental-vm-modules`.
- Upstream tests: `test/parallel/test-vm-module-modulerequests.js`.
- License: MIT.
- Maintenance: official current docs still expose `moduleRequests`; 2026 upstream discussion proposes a replacement loader API, which is a version-stability risk.
- Dependencies/cost: CPU-only, no third-party parser package in this audition.
- Risks: experimental API; static source requests only; no browser import-map or HTML/worker/resource resolution; no dynamic-import discovery.

Primary sources:

- https://nodejs.org/api/vm.html#sourcetextmodulemodulerequests
- https://github.com/nodejs/node/blob/main/test/parallel/test-vm-module-modulerequests.js
- https://github.com/nodejs/node/blob/main/LICENSE
- https://github.com/nodejs/node/issues/62720

## Minimal replay

Root: `site/app.mjs`.

The probe recursively parsed every relative static request and resolved a 42-module closure with zero missing and zero external requests.

Positive result:

- `app.mjs` explicitly requests `./render.mjs`;
- `render.mjs` is in the derived closure;
- `render.mjs` is absent from `displayPolicy.dependencies`;
- `displayPolicy.dependencies` declares `app.mjs` SHA `37f4297…d9941`, but delivered `app.mjs` is `b34c4dc…548b5`.

Therefore the semantic dependency authority is both incomplete and stale even though the package manifest is intact.

Negative boundary:

- `boot.js` contains `import('./app.mjs')`;
- `moduleRequests` for `boot.js` is empty;
- the method cannot discover dynamic import roots, workers, HTML module entries or non-JavaScript resources.

## What it knows beyond Current Best View

KAOPU already knows how to hash a declared file and how to verify a full package manifest. The new knowledge is narrower: parse the executed ESM source to derive static dependency requests, then compare the derived closure against the declared semantic authority. This catches an omitted edge that neither a stale hand-written list nor a whole-package checksum explains.

It is not a complete runtime-discovery gate. The valid composition is:

`explicit root ledger -> static ESM closure -> byte hashes -> dynamic-import/worker/runtime trace -> independent verifier`.

## Decision

`ACCEPT_STATIC_ESM_REQUEST_GRAPH_AS_BOUNDED_TEACHER_HOLD_DYNAMIC_IMPORT_AND_ROOT_DISCOVERY`

No new regression case. Extend evidence for `CANDIDATE_EXECUTABLE_RESOURCE_CLOSURE_001`.

Candidate minimum trial, Mechanical display only:

1. bind all semantic roots explicitly;
2. derive and hash every static ESM request before import;
3. reject missing, unresolved or out-of-root requests;
4. separately cover `import()`, workers and HTML/resource roots;
5. rerun the N246 `render.mjs` mutation and a dynamic-import counterexample.

This is not a global R2 change and is not production adoption.
