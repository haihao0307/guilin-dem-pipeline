# SKIN-FULLBODY-R02

Continue the user-approved direction of HEAD-PROCEDURAL-R01 C4 without replacing the person. Freeze parent receipt 7a6c507256bd5ff0f63d7090b947d5ae1a339148 and public comparison 7ca673bc5f2be9dc2462252ae94580e81f05ab8a. New work lives only here and in dedicated R02 workflows; Draft, no merge, no force push or history rewriting.

## What changes

All native skin triangles use a single new procedural surface group, rather than different head and body materials. Non-skin triangles remain native. Exact original triangle set and shared canonical attributes are retained. The head template offset is read from the original person and applied to the continuous native full-body rest field, so pores do not become constant on the body and do not swim with world-space movement.

C4 head optics, pores, lip shape/material and the native eyes/rig/parameters remain. Additional body fields vary microstructure, chroma and roughness across the neck, torso, limbs, joints and glabrous palm/sole regions. Eyelid, canthus, nose, cheek, ear rim/lobe and subtle oral/chin fields are separate. Ear transmission uses native R05 geometric thickness/path confidence with R06 exit/occlusion visibility and current light direction. It is a bounded RGB approximation, not complete volumetric transport.

A new panel provides ten anatomy/body appearance controls, five diagnostic modes, head/neck, profile, full body, back, torso, hand, eye and ear cameras, ear backlight, original R01 grouping comparison and extended full-person save. Existing fifteen head sliders and original platform remain. Old archives without proceduralBodySurface explicitly keep the old body mode. Invalid new fields are rejected before native restore.

## Files

BodySurface.js is the authored extension. build.cjs copies the retained head modules into this isolated directory, changing only the full-skin grouping/cache contract in the copied HeadSurface.js. It verifies the frozen native host and R01 preview digests before writing the new self-contained preview. Original directories are not modified. Generated copies are retained with the build for inspection and hashing.

OBSERVATION_AND_OPTICS.md contains the screenshot diagnosis, biological/rendering first-party references, per-zone decisions and uncertainty. verify-body.cjs supplements the original real-browser and native-head regressions with body coverage, control, ear-light, archive and public-page checks.

## Acceptance and limits

An unverified build is **交付未完成**. Delivery requires a fixed HTTPS preview with real browser rendering and corresponding PUBLIC_*_QA.json, acceptance screenshots, digest and DELIVERY.json. A passing test count is not user visual approval. The native body geometry can still have coarse contours/facets; this iteration does not secretly replace it, synthesize body hair, add a volumetric skin solver, or repair every inherited eye/nose/ear shape problem. Shader/body-area cost and original startup resource cost remain. SwiftShader and a 390px viewport are not consumer GPU or real-phone certification.
