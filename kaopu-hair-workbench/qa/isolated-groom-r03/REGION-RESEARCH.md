# R03 anatomical evidence and explicit engineering inferences

Research 2026-10-10. This is visual anatomy for rendering, not medical advice. No source figures are copied.

- Healthy regional measurements: https://pmc.ncbi.nlm.nih.gov/articles/PMC7035527/ (239 Thai adults). Reported mean densities approximately134–163 hairs/cm² across the sampled regions; this is one study population, not a universal target. Our actual surface area/active density is separately measured and substantially lower.
- https://pubmed.ncbi.nlm.nih.gov/12859380/ (Ziering and Krenitsky,534 photographs) identifies multiple natural whorl patterns. Implement a local root-direction whorl that blends into grooming downstream, not circular tips for the entire head. Position/spin of this demo are artistic choices.
- https://www.ishrs-htforum.org/content/23/6/210 describes nape as a real hair-bearing region with often finer hairs. https://pmc.ncbi.nlm.nih.gov/articles/PMC5533061/ studies regional occipital diameter variation. These do not specify a universal lower hairline height. R02’s high flat cutoff had no anatomical evidence. R03 lowers and curves the posterior boundary on this GNM template while preserving ear exclusion.
- https://ishrs.org/wp-content/uploads/2018/12/ISHRS_SurgicalAssistantsManual_2010.pdf defines natural follicular units as commonly1–4 follicles. R03 uses1–3 nearby actual triangle-bound roots, with single hairs near the boundary. Inter-root spacing and probabilities are explicit artistic approximations. A visible skin opening is distinct from the follicle below skin; this demo does not expose anatomical follicle bulbs.

R02 left350μm gap at scalp roots. R03 reduces it to20μm and smoothly rises away from skin. Brow/beard retain their previously tested regional directions, with the same smaller root clearance.9 rendered segments are a provisional performance tradeoff, not an accepted smoothness result.


The36k×9 first render was rejected for crown tangling and coarse close-up flow. The whorl influence now decays within the root section, leaving longer shafts governed by the groom.32 geodesic supports and16 rendered segments serve the96k close-up mode; single-current-style caching limits retained CPU guide arrays. Radius decreases75→50μm in near mode. The96k test yields about151 active hairs/cm² in the crown and141 at occiput, with separately computed area. Matching one study range does not establish realism or population validity.
