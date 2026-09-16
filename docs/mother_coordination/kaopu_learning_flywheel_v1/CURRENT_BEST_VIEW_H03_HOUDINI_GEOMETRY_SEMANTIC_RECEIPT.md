# Current Best View — Houdini cooked-geometry semantic receipt H03

Status: **Candidate partial / source-contract CPU verified**

Keep H01/H02 recipe and definition provenance separate from cooked output. For polygonal output, preserve both the exact transport hash and a conservative semantic receipt covering coordinate frame/units, stable IDs, topology and winding, owner-specific typed attribute schemas and values, detail metadata, and group semantics. Quality metrics remain a third, non-identity layer.

Thirteen synthetic CPU checks passed. The receipt ignored harmless enumeration and cyclic-start noise but detected equal-bbox/count topology changes, vertex UV changes, winding reversal, group/detail changes and schema precision changes. Missing or duplicate stable IDs fail closed.

This is not a universal Houdini geometry canonicalizer and no Houdini runtime ran. Packed geometry, volumes, curves, polygon soups, USD, cross-machine float behavior, renderer behavior and human acceptance remain Unknown. Production Mothers, Canonical Truth and Frozen R1 remain unchanged.
