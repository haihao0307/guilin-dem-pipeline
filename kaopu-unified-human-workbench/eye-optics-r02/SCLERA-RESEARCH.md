# Sclera, conjunctiva, and lid-contact optics: source note

Checked 2026-10-10. Scope: preserve the recovered native eye shape and improve real shadow/occlusion before adding surface detail. No source assets or code were copied; candidate files were not edited.

## Immediate recommendation

Keep the recovered GNM corneal cover and inner sclera geometry fixed. First verify that the scleral body actually responds to changing light direction and lid visibility. Add/repair geometry-derived lid shadow and indirect-light occlusion before judging white balance, vessels, or scattering. A dark painted upper band can match one frame but cannot establish correct light transport.

The four references below cover human scleral optics, distinct anterior tissue layers, reflective meniscus geometry, and a historical real-time implementation. Their measurements do not specify one universal RGB material or a ready-made Three.js SSS preset.

## Four primary references

### 1. Vogel et al., 1991: human sclera optical measurements

“Optical properties of human sclera, and their consequences for transscleral laser applications.” Lasers in Surgery and Medicine 11(4), 331–340. DOI: 10.1002/lsm.1900110404.

- Primary publisher record: https://onlinelibrary.wiley.com/doi/abs/10.1002/lsm.1900110404
- Indexed abstract: https://pubmed.ncbi.nlm.nih.gov/1895865/
- Human tissue adjacent to the limbus; five laser wavelengths: 442, 514, 633, 804, and 1064 nm. Measures total transmission/absorption/reflection and angular distributions; infers coefficients with a Kubelka–Munk model.
- Visible short-wavelength transmission is diffuse; wavelength and contact-delivery conditions materially affect transmission. This supports a scattering body with wavelength-dependent transport, rather than treating the globe as a uniformly white opaque paint.
- Limits: sparse laser wavelengths, sample/location/measurement geometry, and model dependence. Total reflection percentage is not the renderer’s diffuse albedo; transmission percentage is not a material transparency slider. The accessible abstract does not provide a verified coefficient table suitable for conversion into shader defaults.
- Rights: no permissive reuse license verified for article or figures. No separately licensed raw dataset or code located. Cite the result and implement independently; do not redistribute figures/textures.

### 2. Teeuw et al., 2024: distinct human anterior tissue thicknesses

“Assessment of conjunctival, episcleral and scleral thickness in healthy individuals using anterior segment optical coherence tomography.” Acta Ophthalmologica 102(5), 573–580. DOI: 10.1111/aos.16606. First online 2023-12-23.

- Article: https://onlinelibrary.wiley.com/doi/full/10.1111/aos.16606
- Institutional rights record/PDF: https://pure.eur.nl/files/125595786/Assessment_of_conjunctival_episcleral_and_scleral_thickness_in_healthy_individuals_using_anterior_segment_optical_coherence_tomography.pdf
- Prospective AS-OCT study of 107 healthy adults. Layer boundaries use tear film, superficial/deep episcleral vasculature, and the inner scleral boundary. Nasal/temporal measurements are 2 mm from limbus; superior/inferior locations differ.
- Thickness units are μm. Example cohort means: conjunctiva 83 ± 15 μm, episclera 127 ± 35 μm; sclera varies strongly by quadrant. These are population/location measurements, not target-character constants.
- Useful separation: superficial tissue and vascular appearance are not identical to the scleral scattering body. This study measures geometry, not visible scattering coefficients, blood oxygenation, RGB color, roughness, or SSS diffusion radius.
- Rights: article/figures identified as CC BY-NC-ND. Do not reuse or adapt figures as workbench assets. Raw data are available from the corresponding author on reasonable request, without a separate public data license verified here. No code license found.

### 3. Yokoi et al., 1999: meniscus as a specular optical surface

“Reflective meniscometry: a non-invasive method to measure tear meniscus curvature.” British Journal of Ophthalmology 83(1), 92–97. DOI: 10.1136/bjo.83.1.92.

- Primary archived article: https://pmc.ncbi.nlm.nih.gov/articles/PMC1722770/
- Publisher PDF: https://bjo.bmj.com/content/bjophthalmol/83/1/92.full.pdf
- The authors recover lower-meniscus curvature from reflected stripes, calibrated using known glass-capillary radii. In 45 normal eyes, reported radius is 0.365 ± 0.153 mm, range 0.128–0.736 mm; shape variations are also observed.
- Useful consequence: a meniscus should have a curved reflective interface whose highlight changes with surface normal, view, and environment. The radius is a measured physical length, not a highlight-width or opacity parameter.
- Limits: lower central meniscus measurements are not a uniform full-eyelid mesh recipe, nor a measurement of tear BRDF roughness, RGB absorption, or the target eye. No universal numerical default is inferred here.
- Rights: freely readable archival access is not a verified permissive figure license. No separately licensed dataset or code located. Use original geometry and cite the experiment; do not copy clinical photographs.

### 4. Chiang and Fyffe, 2010: a useful real-time precedent, with explicit approximations

“Realistic Real-Time Rendering of Eyes and Teeth.” USC ICT Technical Report ICT-TR-01-2010.

- Author-institution PDF: https://ict.usc.edu/pubs/ICT%20TR%2001%202010.pdf
- Separates eyeball ambient occlusion, approximate scleral scattering, conjunctival vessel texture, and conjunctival specular/bump response. Section 1.2.3 uses SSAO; section 1.2.4 explicitly assumes a scattering contribution rather than measuring one.
- Useful architectural evidence: contact/ambient occlusion, body diffusion, and wet-surface reflection are different contributions. Their numerical normal-blending, specular, and artistic iris approximations are not calibrated human optical constants.
- Limits: this is a historical real-time approximation. Its final-color AO multiplication can also darken highlights; a modern implementation should distinguish indirect diffuse visibility, direct-light shadowing, and specular visibility instead of treating all three as one multiplication.
- Rights: publicly readable report; no permissive article/figure/code/texture license verified. No associated licensed source release found during this pass. Reimplement concepts independently; copy neither photographs nor shaders.

## Parameter discipline

These are mathematical/implementation requirements, not fitted defaults from the papers:

- Geometry thickness, meniscus radius, vessel width/depth, light size, and transport mean free path have length units. Declare the world-to-mm scale once. Convert μm to mm by division by 1000.
- Absorption μa, scattering μs, and reduced scattering μs′ have inverse-length units. μs′ = μs(1 − g); they are not interchangeable. A cm⁻¹ value becomes mm⁻¹ by division by 10. Dimensionless optical depth requires coefficient and distance in matching units.
- g, phase refractive index, albedo, Fresnel reflectance, and roughness are dimensionless but have different meanings. No one-to-one conversion exists from OCT thickness or total reflectance to a roughness slider or an RGB material color.
- Beer–Lambert attenuation describes a specified path/component; using exp(−μt d) alone does not solve multiply scattered scleral diffuse transport.
- Apparent tissue RGB also depends on illumination spectrum, exposure/tone mapping, sensor/color space, tissue layers, and vascular absorption. A generic study cannot identify the target eye’s biological parameters from an ordinary photograph.

## Important excluded calibration shortcut

Nemati et al. 1996, DOI 10.1364/AO.35.003321, is often surfaced for conjunctiva/sclera coefficients. Its publisher tables explicitly say **rabbit** tissue, use cm⁻¹, and assume g = 0.9. The publisher also links a 1997 erratum. Do not label these values as human measurements or silently transfer them to RGB defaults.

Primary record and correction link: https://opg.optica.org/ao/abstract.cfm?uri=ao-35-19-3321

## Suggested same-shape acceptance checks (engineering inference)

1. Lock camera, recovered meshes, exposure/tone mapping, background, and texture inputs. Save baseline render and layer/debug views.
2. With one controlled light, move illumination between upper/side/lower directions. Real lid shadow must move consistently; a stationary UV band is not a pass. Temporarily remove the lid occluder and verify the shadow disappears.
3. Inspect direct shadow and indirect occlusion separately. Do not compensate for an unlit/overexposed shader path by painting darker sclera. If the custom shader does not consume a shadow term, mesh shadow flags alone cannot fix it.
4. Only after visibility works, add an original scattering approximation with a stated unit scale and label it an approximation until calibrated. Preserve shadow shape while avoiding a chalk-hard terminator; do not fill every occluded region with a constant glow.
5. Distinguish superficial vessel absorption from bulk scleral tint. Any chosen vascular density, diameter/depth, and redness remain authored controls unless supported by matching data.
6. Build a narrow, original concave meniscus surface fitted to the actual lid/globe contact. Verify its highlight responds to environment/view changes and does not remain an emissive white stripe. Do not change the underlying eye silhouette to make the highlight easier.

No acceptance claim is made about the candidate renderer; this note is research guidance only.
