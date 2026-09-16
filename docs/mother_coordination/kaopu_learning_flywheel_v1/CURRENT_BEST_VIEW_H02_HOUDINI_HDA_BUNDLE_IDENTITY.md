# Current Best View — Houdini HDA bundle identity H02

Status: **Candidate partial / source-contract CPU verified**

The H01 definition payload must not be represented by only a whole `.hda` hash or only `binaryUncompressedContents()`. A library hash over-couples the selected asset to container metadata and sibling definitions; a Contents-only hash omits other sections that can contain interface, scripts or referenced embedded resources.

Record separate transport, selected-definition bundle and cook-receipt identities. The conservative definition bundle includes the exact fully qualified type, sorted section-name/content hashes, options and interface. Twelve CPU counterexample checks pass.

This is exact-definition provenance, not semantic equivalence or Houdini runtime determinism. Production Mothers, Canonical Truth and Frozen R1 remain unchanged.
