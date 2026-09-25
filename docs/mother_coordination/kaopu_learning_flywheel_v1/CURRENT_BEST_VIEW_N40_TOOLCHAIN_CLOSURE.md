# N40 Current Best View — Toolchain Closure

## Observation

Fish R012 has an immutable tested source, workflow blob, run/job identity and a successful historical run. Those facts remain valid.

The workflow references checkout, setup-node and upload-artifact by mutable major tags; uses ubuntu-latest; requests Node 22 without a patch version; invokes ambient Python, pip and npm; installs direct npm packages without a committed lock/frozen install; and records no resolved Chromium or system-dependency identity.

## Candidate

Historical run success and future rerun reproducibility are separate claims.

A rerun reproducibility receipt should bind:

1. immutable or resolved action SHAs;
2. runner image release and available SBOM identity;
3. resolved runtime versions;
4. dependency lock plus frozen-install decision and installed-tree digest;
5. browser build and system-dependency inventory;
6. one toolchain-manifest digest bound to the tested source, workflow, run and output.

## Boundaries

- Run 35974311593 remains HISTORICAL_RUN_VERIFIED.
- N40 does not infer that toolchain drift caused either earlier R012 failure.
- Exact direct package versions do not close transitive dependencies.
- This Candidate does not require every KAOPU build to become network-isolated or bit-for-bit reproducible.
- An observed action-resolution manifest may preserve historical evidence even when a maintainable workflow uses tags; a future rerun claim still compares exact resolved identities.
- This does not replace N30 tested-subject binding, N31 attempt lineage or N37 environment/device classification.

## Decision

Candidate partial. Trial only on the next Fish long-lived regression rerun. Main R2, production artifacts and existing release status remain unchanged.
