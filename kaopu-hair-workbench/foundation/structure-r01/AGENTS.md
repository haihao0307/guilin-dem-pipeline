# Hair Structure Lab rules

Read `docs/SCALP-AUTHORITY-04.md` before changing growth domains, follicles, hairstyle compilation or their rendering.

For temporal-region work also read `docs/TEMPLE-REGION-REVIEW-04.md`. The existing temple IDs denote sideburn/preauricular strips, not the whole temporal area. Regional labels and landmark overlays never redefine the approved growth boundary. Do not impose one sex, cohort, hairline contour or density average on every character.

- The only approved scalp domain is `F02.1@ee3c7fac9f187dd9e5dc81d1363c4814b9a015a3`, recorded in `locks/scalp-f02-1.json`. Keep its four source modules and native mapping unchanged during grooming, material, physics or UI work.
- Do not intersect the mapped domain with a guessed native/world height, silhouette, collision surface or new cap. Source boundary coordinates map through the native triangle and barycentric binding. A strand cut field is not a follicle boundary.
- Preserve all 3,300 candidate identities/bindings and the 3,067 approved eligible roots. A style mask is a separate density choice within that domain; never describe a reduced style count as the approved scalp domain.
- `tools/check-approved-scalp.mjs` compares the ACTUALLY APPLIED domain and masks to the approved source, not just file hashes. It must reject an added height crop and hidden valid roots. Do not update this authority to make a failing change pass.
- Preserve the 135 existing R03 guide curves while repairing the domain; additions cover restored roots. If a later authorized hairstyle change needs to modify a retained curve, record the exact affected regions and same-camera before/after evidence before updating that groom reference. Growth-domain authority stays separate.
- After each small visual change, inspect fresh left, right and back views of both the scalp domain/roots and the complete guides. A nonzero guide count, screenshot pixel difference or successful render does not certify anatomical coverage.
- Full hair remains a persistent scene layer. Diagnostic/region switches must not remove the complete hair or crop its tips. Keep the visibility regression checks.
- Run the appropriate build and `check-approved-scalp`, contract, runtime, visibility and public checks. Report remaining problems honestly; no dense hair, optical or physical acceptance is implied by sparse guide validity.
- Follow the user requirement: off-screen QA, no desktop mouse control, and stop a single task at three hours.
