# Fixed semantic head candidate reproduction

The browser consumes the committed 1,092,630-byte R5 adapter. It never registers a face at startup. Teacher weights remain shared public, hash-locked inputs in SOURCE-LOCK.json. Candidate runtime and parameter ownership are in src/HeadTransfer.mjs and tests/semantic-head.mjs. These checks do not certify visual quality.

The six neutral / jaw-open landmark observation records are measurements of public teacher renders, with original camera, triangle, barycentric and source positions. They contain no photographs or user data. observations.json.gz is a lossless pack of the exact numeric fields used in registration; PROVENANCE.json records the original and compact per-file SHA256. The Anny and MHR stored R2 target landmark arrays match the observations exactly (maximum component difference zero).

Development-only reconstruction, from the repository QA directory:

1. Run python restore_sources.py and python tools/prepare_common.py
2. Run node tools/export_geometry.mjs and node tools/export_semantic_masks.mjs
3. Use the pinned registration-requirements.txt plus the existing Matplotlib runtime. Set OPENBLAS_NUM_THREADS=2 and MPLCONFIGDIR to a writable temporary directory
4. Run python tools/prepare_head_observations.py, then python tools/build_outer_mask.py
5. For each of anny and mhr, run python tools/register_head.py --target NAME --surface outer --preset default --tag=-r2 --landmarks-dir fixtures/head-landmarks --articulated-landmarks fixtures/head-landmarks
6. For each source, run python tools/refine_head_correspondence.py --target NAME --version r4 --contact-band
7. Run python tools/register_anny_tongue.py, python tools/build_cavity_operators.py, python tools/build_oral_anchor_operator.py, then python tools/build_head_adapter.py
8. Compare all output indices, barycentric fields, component operators, source hashes and runtime outputs against the committed fixed adapter. A different rebuild is a new candidate; do not loosen the runtime fingerprint or silently replace it

The separated cavity-operator builder and the compact measured-input pack were locally verified to repack the existing fixed R4 correspondence into the identical compressed SHA256 58c26071db007c8b19089ecd61e444e63cf27e74c5e1ccedced8b1729edfa8df. This is not a claim that a fresh NRICP solve on every CPU is byte-identical.

Known scope: GNM dentition is retained; Anny has an independently observed tongue component. Infant dental development is not supplied by the current common adapter and is not visually accepted. MHR eye-look fields are passed to the semantic surface; a separate rigid globe control has not been established by the native interface audit. The rejected 2.65 mm eye-cap rigid fit is not used as an eyeball rotation.

R5 adds the registered native tongue rest embedding and a positive cavity operator constrained by measured GNM dental contacts. The immutable contact anchor IDs and measurement provenance are in fixtures/oral-dental-contact-anchors.json. Its two ambiguous upper/lower contacts remain free. The R5 compressed SHA256 is d853111d360359e0ea0b655544b20108e800433905a2ff4f5d052ac755ef1e3b; it remains a visual candidate.
