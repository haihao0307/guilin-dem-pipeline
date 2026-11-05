# KAOPU Learning Flywheel N248 — Acorn classic-script dynamic import audition

Date: 2026-11-06  
Scope: Mechanical Mother v37 / runtime entrypoint authority  
Production mutation: none

## One bounded question

Can a full JavaScript AST pass close N247's exact classic-script gap by discovering the literal `import('./app.mjs')` in `site/boot.js`, then fail closed before execution when that target is missing?

## Real unresolved failure

The 2026-11-06 Mother coordination replay confirmed the N247 static ESM closure but kept Mechanical v37 in:

`HOLD_GATE_FAIL / ROOT_CAUSE_REVIEW / HOLD_SEMANTIC_ENTRYPOINT_AUTHORITY_STALE_INCOMPLETE`.

`SourceTextModule.moduleRequests` derived 42 static ESM modules from `app.mjs`, but returned no request for the classic-script root `boot.js`, whose line 7 dynamically imports `./app.mjs`. The package remained byte-intact at 311/311; this run did not relabel it as damaged.

Exact subject:

- `Mechanical-Mother-v37-offline.zip`
- ZIP SHA-256: `d4f19a70a743e8c78b859cb5c69c26543ed3b59cc4c3a7bd20cf12199b086b81`
- `site/boot.js` SHA-256: `08809fb489b58d74fd4df2885425604924c979cd53c03ef9c065f951268d4852`
- `site/app.mjs` SHA-256: `b34c4dc808f8fcb6fa87e07880aeba76f6e1cceeb088abe3f61321aeb69548b5`

## Teacher screen

Status: `TEACHER_CANDIDATE`  
Lifecycle reached: `RADAR_FOUND -> TEACHER_CANDIDATE -> AUDITION`

Teacher: Acorn ECMAScript parser.

- Provenance: official `acornjs/acorn` repository.
- Tested implementation: Acorn 8.18.0 vendored in Node.js v24.22.1, invoked only for the isolated audition.
- Current upstream: Acorn 8.19.0; upstream head observed at `69788e23ca00483aef84005502dc3b88f2af38df` on 2026-10-21.
- Runnable code/tests: the official project is a full parser with its own test suite; this run executed the parser against the exact v37 bytes and two counterexamples.
- License: MIT.
- Dependencies/cost: CPU-only JavaScript; no GPU, dataset or commercial service.
- Integration risk: Node's `internal/deps/acorn` path and `--expose-internals` are not a production API. A production gate must pin an explicit Acorn package/version and hash.
- Method boundary: AST discovery can classify literal and computed `ImportExpression` nodes, but it does not prove a runtime-computed target, discover HTML roots automatically, bind hashes by itself, or replace browser/runtime tracing.

Primary sources:

- https://github.com/acornjs/acorn
- https://github.com/acornjs/acorn/blob/master/acorn/README.md
- https://github.com/acornjs/acorn/blob/master/acorn/package.json
- https://github.com/acornjs/acorn/blob/master/acorn/LICENSE
- https://github.com/acornjs/acorn/blob/master/acorn/CHANGELOG.md

## Minimal exact replay

### Pristine

Parsing the exact `site/boot.js` in `sourceType=script` found one `ImportExpression`:

- specifier: `./app.mjs`
- resolved target: `site/app.mjs`
- target exists: true
- decision: `PASS_LITERAL_RUNTIME_ENTRYPOINT_DISCOVERY`
- exit: 0

This closes the exact N247 discovery blind spot without executing `boot.js`.

### Missing-target negative control

A verifier-only one-byte specifier mutation changed `./app.mjs` to `./xpp.mjs` while preserving statement shape and length.

- AST still found the dynamic edge.
- resolved target did not exist.
- decision: `HOLD_UNRESOLVED_RUNTIME_ENTRYPOINT`
- exit: 2

### Computed-specifier boundary control

A synthetic control used `import('./' + target + '.mjs')`.

- AST found an `ImportExpression`.
- no static literal target could be proven.
- decision: `HOLD_UNRESOLVED_RUNTIME_ENTRYPOINT`
- exit: 2

Therefore the safe state for a computed dynamic specifier is `UNKNOWN/HOLD`, not silent omission and not a guessed file.

## What it knows beyond Current Best View

N247 already derives static ESM requests after an ESM root is known. Acorn adds one bounded capability: parse a classic script as an AST and expose its `ImportExpression` node, including whether the target is a literal or runtime-computed expression. On the exact v37 root this connects:

`index.html -> boot.js -> dynamic ./app.mjs -> N247 static 42-module closure`.

That is new relative to the N247 Current Best View. It does not cover workers or undeclared HTML/runtime roots.

## Candidate gate translation

Mechanical-only candidate:

1. Task Anchor declares every HTML/script/module root.
2. Parse each classic script and module with a pinned parser before execution.
3. For every literal relative `ImportExpression`, resolve inside the allowed root, require file existence and bind its byte hash.
4. For every nonliteral `ImportExpression`, emit `HOLD_UNRESOLVED_RUNTIME_ENTRYPOINT` unless an explicit bounded allowlist plus runtime trace proves the target set.
5. Feed each proven dynamic target into the N247 static ESM closure.
6. Keep Worker/SharedWorker, import maps and non-JavaScript resources as separate unresolved gates.
7. Delivery Receipt records parser identity/hash, literal targets, computed targets, unresolved roots and mutation results.

## Decision

`ACCEPT_ACORN_LITERAL_IMPORTEXPRESSION_DISCOVERY_AS_BOUNDED_TEACHER_HOLD_COMPUTED_SPECIFIERS_WORKERS_AND_ROOT_DECLARATION`

No new regression case. This extends evidence for `CANDIDATE_EXECUTABLE_RESOURCE_CLOSURE_001`.

Directed route: https://github.com/haihao0307/guilin-dem-pipeline/issues/91#issuecomment-6667619886

Lifecycle at save: `POSTED=true / Candidate IMPLEMENTED=true / GATE-RUN=true`; `ACKNOWLEDGED / production IMPLEMENTED / ADOPTED / USER-ACCEPTED=false`.

This is not a global R2 change and not production adoption.
