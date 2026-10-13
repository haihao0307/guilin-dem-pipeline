# ET18-A1 ear structure research and transfer record

## Scope and baseline

The workbench is derived from the user-frozen `7f90e53c1d114f65b08710d67d792d489719ee67` lip preview. It keeps the same character, canvas, canonical buffers, identity, eyes and lip system. Ear work is confined to a derived display geometry and an ear-only material extension.

This is not a claim of exact anatomy, clinical measurement, MetaHuman equivalence or final film certification. The target of A1 is a visibly reviewable anatomical upgrade with explicit controls and reproducible evidence.

## Teacher 1: Epic MetaHuman Identity

Official sources:

- https://dev.epicgames.com/documentation/en-us/metahuman/metahuman-identity-asset
- https://dev.epicgames.com/documentation/en-us/metahuman/mesh-to-metahuman
- https://dev.epicgames.com/documentation/en-us/metahuman/metahuman-dna-rig-definition-and-rig-operation

Transferred methods:

1. Use a standard continuous head topology rather than attaching an unrelated ear object.
2. Inspect the ear from side or oblique promoted views where the entire feature is visible.
3. Add feature constraints sparingly and isolate ear observations from frontal facial constraints.
4. Compare source and result with the same camera and lighting.
5. Treat coarse mass, rig-safe topology and high-frequency displacement as separate layers.

Not transferred:

- No MetaHuman mesh, DNA, textures, markers, rig or proprietary database output is copied into this repository.
- The A1 ear fields are original code authored against the existing KAOPU reference-space template.

## Teacher 2: external-ear anatomy

Sources:

- NCBI Bookshelf, External Ear Anatomy: https://www.ncbi.nlm.nih.gov/books/NBK470359/
- NCBI Bookshelf, Otoplasty anatomy: https://www.ncbi.nlm.nih.gov/books/NBK538320/
- 3D human ear modelling with parameterization and variation analysis, Ergonomics 2024, DOI 10.1080/00140139.2023.2236820

Structural map implemented in A1:

- helix and helical root
- antihelix with superior/inferior branching tendency
- scapha
- triangular fossa
- cymba and cavum of the conchal bowl
- tragus
- antitragus
- intertragal notch
- lobule

Anatomical constraints used:

- The auricle is principally elastic cartilage covered by thin adherent skin.
- The lobule is fibrofatty and does not continue the cartilaginous framework.
- The antihelix is a branching ridge, not a single painted groove.
- The helical root separates upper and lower conchal regions rather than leaving one uniform circular pit.
- Concha depth, antihelix prominence and helix contour are major shape-variation axes.
- The anterior and posterior ear surfaces should not share identical thickness, fat and shading assumptions.

## Teacher 3: Artec 3D Ear scan

Source page: https://www.artec3d.com/3d-models/ear

The exact OBJ package was retrieved in GitHub Actions and the package `license.txt` identifies the model as Artec Group Inc., CC BY 3.0 Unported. The archived intake records the exact ZIP, OBJ and license hashes. The downloaded OBJ contains 50,365 vertices and 99,999 face records.

Use boundary:

- The scan was inspected for fold continuity, ear-root attachment, conchal depth and common scanning defects.
- Hair remnants and incomplete/occluded rear-root regions make direct splicing unsafe.
- No scan vertex, face, UV, texture or normal is shipped in the public workbench.
- The output is an independently authored parametric reconstruction on the existing character surface, not a derivative mesh copy.

## A1 implementation rationale

1. Two local adaptive subdivision passes provide several thousand reviewable samples per ear while avoiding the cost of an unnecessary third pass.
2. Transition triangles keep every split edge continuous with the existing head surface.
3. The source/canonical position, topology, body and eye buffers remain read-only.
4. Anatomical ridges and cavities are functions over the existing ear chart, so left/right parameters can be saved without introducing detached meshes.
5. The deformation frame is derived directly from retained Y-up/Z-forward facial landmarks; it is not rotated a second time.
6. Skin variation is ear-local: mild blood-color variation, tangent-chart microrelief, roughness and a bounded back-light wrap approximation.
7. A/B comparison toggles the ear system without changing the camera or ear inspection light.

## Known limitations and next research gates

- Full external auditory canal depth is not reconstructed.
- There is no volumetric elastic-cartilage model or soft-tissue collision solver.
- Current scattering is not measured multilayer transport.
- Ear-root topology is still inherited from the source character; a later stage may require a dedicated continuous retopology patch.
- Statistical diversity currently exposes parameters but is not yet fitted to a licensed population dataset.
- Film-quality acceptance requires human visual review under several focal lengths and real GPU rendering, not only automated screenshots.

## EAR-R02 recovery — correlated regional phenotype, not developmental simulation

The failed A1 pore-image test is retained as a failure, not relabelled as a pass. This version separately tests all material controls on the rendered canvas. Rest-space pore pitch, filtered height/roughness transition, creases and post-host oil assignments are explicit; no measured optical constants are claimed.

The near-term fetal histology paper **Development and growth of auricular cartilage and muscles: A study using human fetuses** (2020; https://pubmed.ncbi.nlm.nih.gov/32163824/) and **Auricular cartilage configuration: A histological study using late-stage human fetuses and adult cadavers** (2021; https://pubmed.ncbi.nlm.nih.gov/33620139/ ; DOI 10.1002/ar.24608) motivate distinguishing regional cartilage configuration from merely stretching a silhouette. They do not validate the hand-authored coefficients in EarMath, and no fetal/clinical prediction is offered.

The public York Ear Model project (https://www-users.york.ac.uk/~np7/research/YEM/) and authors' original article record (https://pure.york.ac.uk/portal/en/publications/a-data-augmented-3d-morphable-model-of-the-ear/) provide a reference for related rather than independent shape changes. We neither downloaded its restricted model nor reproduced its learned population distribution. Eight presets and bounded bilateral perturbations here are explicitly authored.

Epic's primary documentation (https://dev.epicgames.com/documentation/en-us/metahuman/metahuman-identity-asset) supports checking ear-specific side views and controlled fitting, not assuming a single front view determines a full ear. No MetaHuman asset or DNA is included. MakeHuman ears01 (https://static.makehumancommunity.org/assets/assetpacks/ears01.html) is a different community and must not be called MetaHuman. No ears01 target vertices are included in this runtime.

Failure boundaries: local strain backtracking is not a cartilage solver; its sampled front/back gap is not continuous collision detection. Published parameters have artistic ranges, not clinical confidence intervals. Real deployment still faces source topology limits, licensed dataset access, manual anatomy calibration, texture/optics quality, and loading the retained full human runtime.
