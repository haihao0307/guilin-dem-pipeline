# Farmland Mother R041 · Cellular Fields & Complete Irrigation

R041 keeps the R039 terrain mother and replaces the R040 large regular paddy blocks with a multiscale field organization.

Implemented:
- 56 irregular plain paddy cells produced by deterministic constrained power-cell clipping.
- 81 contour-derived terrace parcels.
- Shared plain-field boundary ownership, no sampled overlaps, full domain coverage.
- 137 field control volumes, each with inlet and outlet.
- 285 irrigation/drainage graph edges; every field has a source path and river path.
- 18 moving straw-hat farmers, 8 moving buffaloes, 5 field shelters.
- Actor paths stay inside assigned fields and use the common terrain height function.

QA: see `R041_QA.json`.

This remains a synthetic knowledge and visual candidate. It is not a surveyed reconstruction of a named historical agricultural site.

visualAcceptance=false
productionReady=false
