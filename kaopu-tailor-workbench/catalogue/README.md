# Garment catalogue integration checkpoint

This work consumes the pinned MIT GarmentCode source generator through one shared Pyodide runtime. The existing accepted shorts, sleeveless top and short-sleeve top keep their original material programs, body assets, solver kernels, substeps, iterations and dimensional bounds.

The 23 source configurations now generate real analytic paper and material triangles. All original vertices, transforms, seam directions, darts and gathering coefficients are retained. Curve tessellation is limited to 0.25 mm chord deviation. This establishes generation and meshing, not physical fit for all styles. New configurations remain explicitly marked as awaiting physical validation. Old straight/curved swatch URLs remain available as archived experiments.

The catalogue UI uses one active viewport and one worker. Python is loaded only for a real source-generation request. The same worker can later run the unchanged accepted garment solver. It must restore normal fetch behavior after loading its pinned compressed dependencies. It is terminated on departure/cancellation; the viewer disposes WebGL, controls, RAF and observers.

## Original PPF garment bridge

The unmodified official CPU binary at `st-tech/ppf-contact-solver` commit `b4ee7a44a741754d5bdfe1926d064d2483cf1456` has run the existing real short-sleeve paper through 840 frames (14 seconds), including support release at 6 seconds and 8 subsequent seconds of gravity. It used about 40 minutes of authoring computation. It is not a native solver invoked by a static web-page button.

The paper has 3090 original material vertices and 5582 triangles. Its rest material, UVs and total mass are preserved. Initial coincident unsewn centre edges were separated using only a 3 mm rigid translation per side. The official soft stitches preserve separate material particles and close toward the contact gap. They are not the old ideal zero-width welded constraints.

Final independent strict triangle checks found no body or self intersections. Maximum tensile stretch is 4.288%; maximum seam gap is 3.83 mm. Compression is reported separately: 3.10% of material area exceeds 10% intrinsic compression; the worst sleeve-armhole triangle is compressed by 87.5%. These are numerical material deformations, not something explained away by lighting or ordinary bending. The material parameters remain uncalibrated, and no parameter was changed to hide those measurements.

The first new gathered skirt uses the exact live source paper. Sparse numerical stitch samples retain intermediate material vertices to accommodate 30% gathering instead of shrinking the rest material. Its initial PPF validation and two-frame profile passed; the complete simulation is a separate ongoing experiment.

## Licensing and sources

- GarmentCode source: MIT, Maria Korosteleva and contributors; pinned source and notices reside in the existing `garment-pattern-catalogue-r01` directory
- PPF code: Apache-2.0, Ryoichi Ando / ZOZO and contributors; the original native solver is retained in the separate authoring workspace
- Existing public Anny synthetic adult body: original recorded model provenance and CC0 asset terms retained
- New glue, geometry conversion, material identity checks, controls and viewer integration are original workbench code

No private Human-Clothing-Workbench R3 asset, user photo, noncommercial simulator code, runtime service credential or newly paid service is included in this candidate.
