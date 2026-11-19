# R13 motif-coherent strand layout, bounded candidate 2

The existing fill connected both sides of each motif at the same longitudinal
parameter. Small per-stitch bows preserved that repeated comb structure.
Candidate 2 applies a single smooth shear to the complete ruled motif domain:

`t' = t + .06 * strength * sin(pi*t)^2 * sin(3*pi*t+phase) * 4*u*(1-u)`.

Its longitudinal derivative is at least `1-.06*4*pi > .246` at full strength.
Every fixed-u strand order remains monotone. The 4u(1-u) envelope fixes both
original attachments exactly. A numerical inverse maps retained old interior
samples into the domain; only XY changes, with no new samples. Z, radii, seeds,
IDs, path counts, layer boundaries and every non-fill path remain unchanged.
This is stylized visual grouping, not certified satin/needle/bobbin mechanics.

The first candidate moved boundary attachments monotonically along their
analytic side. It accepted only 66/658 botanical groups at .65 strength because
519 groups introduced a new intersection against retained discrete outlines;
73 cropped groups also stayed unchanged. Its 1978/30576-needle coverage was too
small for an overall claim. That failed candidate is retained in
`r13-stitch-grouping-candidate1.js`; it is not the live module.

Candidate 2 retains entire cropped motifs, and rejects an entire proposed motif
on failed domain inversion, new boundary crossing, new self crossing, new
inter-strand crossing or ordering failure. These are checks on the actual
retained XY polylines, not just the mathematical field. Existing flow and short
guard run first; the new operation never changes their acceptance or sampling.
There is no density reduction or relaxed 250000-segment budget.

`node --test tests/r13-stitch-grouping.test.mjs` passes six checks: neutral R12 curve
JSON, actual neutral yarn/ordinary-fuzz/instanced-fuzz buffers, strict domain
ordering, preservation and determinism, placed/bound material extremes, and
identical explicit rejection for over-budget recipes. New parameter/version
fields are excluded from old-schema JSON comparison; retained path data has no
zero-mode metadata pollution.

`r13-stitch-grouping.json` records full-size actual placement/binding and Float32
geometry for three motifs × three materials × strengths .65/1. All 18 cases
have zero detected radial, reversed-edge, opposed-winding, degenerate or
non-finite defects in every layer. The corresponding nine .65 material cases
also build the actual fuzz buffers. The largest per-layer count is 39717 roots,
well below 300000. First/last root checks for every populated source path give
maximum attachment residual 6.72e-7 cm against the actual sampled triangles.

At recommended display strength .65:

| Motif | Accepted / cropped retained groups | Changed / total fill paths | Segments | Max internal XY shift |
|---|---:|---:|---:|---:|
| botanical 18×22 cm, .17 mm fill | 585 / 73 | 27914 / 30576 (91.29%) | 239869 | .63785 mm |
| rosette 18×22 cm | 181 / 60 | 11912 / 14364 (82.93%) | 146068 | .79042 mm |
| ribbon 22×6 cm | 60 / 0 | 2772 / 2772 (100%) | 40843 | .48017 mm |

No complete motif was rejected for other safety reasons in these defaults.
Retained cropped groups are excluded from the changed-path counts. Endpoint
movement is exactly zero. The baseline and candidate have identical counts at
each recipe; varying arc length can change fuzz allocation and is reported.
All comparisons use the same current structure/material, not historical default
restoration. Default .65 has smaller deformation than the tested limit 1.

API: `normalizeLaceParams` / `LACE_DEFAULTS` field `stitchGrouping`, range 0–1,
neutral core default 0; main lane may set display default .65. Bundle
`stitch-grouping.js` before `lace-core.js`. No display, material, fibre, state or
app files were changed by this lane. The main lane owns final same-camera whole
fabric and close-up visual acceptance. Open tube ends and inherited rendering
limitations remain outside this task.
