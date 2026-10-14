# Independent GNM initialization comparison

This isolated QA experiment preserves the accepted R64 identity and R65 rev2
display. It compares that identity with one candidate initialized from the same
GNM head mean, clearing 41 historical Anny face-local controls while retaining
the original body/lifecycle settings and the complete native composed engine.
Nothing here replaces the production character or declares portrait acceptance.

Both starts receive the same per-view perspective-camera and two-action smile
estimation budget. A single shared candidate identity uses the 170 native head
coefficients with a bounded total norm and a mean prior. The other 83 GNM
eye/dental coefficients remain fixed. Original JS full-mesh recomputation is
checked against the differentiable composed adapter before rendering.

The private fitting data remain local. This directory contains only our artistic
archives, display cameras/lights, and QA code. No reference photographs, observed
pixel targets, external replacement mesh, or Disney detector/weights are included.
Existing sparse observations and manually reviewed visible contours are not the
GNM paper's approximately 600-point observation system.

E04/U07 are training views. U05 was used historically and is only an update-level
validation view. E03 is reserved for final evaluation except six explicitly
declared camera-calibration points. Its mouth and outline are not optimized;
neutral expression is retained, leaving smile-related residual uncertainty.
Camera focal length is not known: the intermediate focal-ratio family is selected
before fitting, with other solutions retained privately as ambiguity evidence.

The workflow renders both states with identical appearance settings. Each gets
its independently reestimated camera and expression. Thus this comparison tests
the complete fit, not an isolated identity delta under a proven physical camera.
Hair remains the existing imperfect R65 display, and E03 lighting is a common
studio approximation. Real geometry/contact and visual review remain necessary.

Run the existing Playwright 1.57 QA with PORTRAIT_STATE=baseline or new. The job
uses read-only repository permissions and uploads evidence; it does not deploy.
