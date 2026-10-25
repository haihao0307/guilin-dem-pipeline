# Portable current R30 status audit

Copy this directory to `r30/current-status-audit`. From the R30 directory run:

```sh
node current-status-audit/run-current-audit.js
```

Requirements: Node.js and Python 3 with NumPy, already used by the project tests. Optional explicit model path: `node run-current-audit.js /path/to/r30`. No network, browser, repository changes or output files are required; temporary files are removed after execution. CI may use the same command as a small extra step. Nonzero exit indicates source/version drift or a failed scoped assertion, not automatically a new physical collision.

The runner loads actual source from its parent directory following the current index.html geometry script order, including both outer-crosshead modules. It does not use the legacy load-r29.js or an outer study directory. It checks 19 module hashes, reevaluates current scalar fields, regenerates same-time inverse matrices, and rechecks 12 selected rigid relationships over 1,441 common phases and four affine basis points. It explicitly checks L/R terminal eyes use input translation, not the rotating short-link frame. Only nine of those relations permit the nine specified negative shaft/head/eye connections. Three casting-union pairs are separately confirmed stationary. Source and bounded intended-union classifications remain locked; changing geometry requires a fresh audit rather than automatic exemption.

750 saved-point records must classify as: profile 16 = 3 intended stationary unions + 9 intended rigid connections + 4 removed historical points; 584 outer + 10 middle/frame historical regression records eliminated; outer 02 retains six intended connection witnesses and 110 no-witness records; 24 nominal boundary contacts replay. Duplicates across historical reports are not unique collision totals. The original negative-control tests and snapshots are not removed or relabeled as current models.

Expected JSON includes `passed: true`, `currentConfirmedUnexpectedNegativePairs: []`, `globalCertificate: false`, `unresolvedRelations: 110`. This 110 is only the outer relation set. The separate 223 still-visible profile no-witness relations and 30 historical suppressed relations remain in the ledger. The two active sets are not summed or asserted disjoint, and a no-witness outcome is not clearance. Exact contact, conditional geometry bounds, inferred construction, historical fidelity, locking/load adequacy and complete continuous all-pair clearance remain distinct questions.

Input storage: 39,267 bytes of exact pool-indexed point records in 1 text chunk(s), each at most 48,000 bytes. `node read-witness-points.js` reconstructs in memory and verifies both chunk and full-payload SHA-256. There are no stored whole-scene sources, phase matrix caches or expanded replay outputs. Each current classification is explicitly asserted against the saved expected category. Original negative scalar evidence remains in the separately retained upstream audit, identified by HISTORICAL_INPUT_SHA256.json.
