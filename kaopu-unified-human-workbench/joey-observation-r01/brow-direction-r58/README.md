# R58: existing native brow direction

One isolated eyebrow candidate on the unchanged R57 face. Lower the strong central arch, place a modest crest outward, and taper the tail. These are authored current-head local curve parameters, not measurements of a person.

The original R52 `BROW_PROFILE` is the effective interface. The unused `outerLift` options in `AppearanceR52` are not changed. Source fibres remain the existing Mindfront MakeHuman Eyebrows01 CC0 curves and retain their existing licence/provenance. Skin, eye shape, lips, hair source, density and material are not changed.

The renderer temporarily supplies the candidate profile while constructing a separate original surface-bound brow instance, then restores every profile field. Both instances use real triangle/barycentric supports. A/B share the same native mesh, hair object, eye material, lights and camera. Only eyebrow visibility switches. Neutral E04/U05/profile and the existing U07 light smile are captured, including exact same-object pixel restoration.

The original R52 output is verified before restoring the fixed R57 candidate. Native R57 position SHA must remain exact for every eyebrow capture. Failed binding closes the isolated browser and cannot affect production. Old R52/R54 and all other workbenches remain intact. No reference photographs or image-space target coordinates are included. Four small local tests verify profile restoration and source mismatch handling; real-render results and visual acceptance are reported separately.
