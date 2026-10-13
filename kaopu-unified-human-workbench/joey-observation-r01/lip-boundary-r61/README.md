# R61: separate the existing lip mask from lighting and geometry

This bounded observation holds the R57 native face and R58 eyebrow profile fixed. It uses the original R05 CommonSkinLayer's existing beauty, color and regions views in the same scene for E04 and U07. No new shader, pigment, geometry or photograph is added. The source is 0b4703359efbae10ffc6c0e5fe3fc081e7eca4fe, full/ui/skin/{CommonSkinLayer,SkinRegions}.mjs.

The current lip mix is .60. The original vermilion field comes from GNM template landmarks 48–59, material and upper/lower lip region gates, then follows immutable canonical vertex recipes. It is not a camera-space mask and is not a newly measured boundary of the reference person. Current controls already include upper-lip height .4, upper volume .4 and cupid width -.25 from earlier work. Simply increasing those again, or confusing a pale pigment edge with missing geometry, would not be an evidence-based improvement.

Each layer switch verifies exact current native geometry and field hashes, unchanged camera, no lip mask on non-skin, and returns to the same beauty pixels. The complete starting archive/native mesh is restored afterward. The color view is the existing lighting-independent paint branch, still passed through the renderer's output colour handling; do not call it recovered or calibrated albedo. Regions visualize the existing lip field, not anatomical ground truth. Normal perspective and the previously authored per-view expression are retained. Source photographs and target coordinates stay outside the project.

Inspect the actual mask/colour/beauty relation before selecting a next single lip-shape adjustment. This run itself is not a new face, likeness improvement, or new skin-system release.
