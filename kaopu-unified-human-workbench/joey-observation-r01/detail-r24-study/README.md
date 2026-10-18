# R24 independent eye-shape study

R23 runtime 318b463ed70ff9a4637c426de66c1bea55a6224b remains the accepted user-review anchor. This experiment is not promoted and does not replace any published page. The user's approximate 85% assessment is not a scientific likeness score.

Revision 1 (1a721fed62b65788f8d712d88815fc25e7eca225, run 39084468890) passed engineering checks but showed no clear visual benefit: upper and lower lids moved together by only 0.15–0.28 screen pixels. It was not promoted.

Revision 2 measures actual bilateral Anny height1/2/3 responses in the original engine, without rendering multiple variants. Height1 positive/negative branches are sampled separately; height2 remains positive and height3 negative. A three-variable bounded solve proposes one modest upper-lid arc adjustment while weighting existing corners and lower lids to stay put. Artist-selected relative screen changes are not calibrated photo landmarks or a likeness score. The actual forward displacement and linear prediction mismatch are recorded. The soft weighted solution is scaled to predicted corner/lower-lid drift limits of 0.18/0.35 pixels; actual forward drift must stay below 0.25/0.40 pixels or the candidate rolls back. Coupled residuals must be reported rather than claimed independent upper-lid control.

No GNM identity, expression, gaze, facial width, mouth, eyebrow recipe, skin, lip finish, eye-white or hair-density changes. Reference camera and expression are not exactly known. No reference image or target coordinates are included here. Only this one further candidate is rendered; any failure or absent visible benefit keeps R23 as the accepted anchor.

The exact R23 face and all 98,358 hairs must load through the original strict locks first. The study changes only its in-memory copy after startup. Existing brow/lash roots are rebuilt; the current eye contact field is refreshed. All hair paths retain their original local offsets and follow current native triangle frames. A separate GPU check compares sampled GPU points against the current CPU root frames, not stale R64 world paths. This proves binding transport, not full hair collision or likeness quality.

Run build.cjs with esbuild 0.25.5, then verify.cjs with Playwright 1.57.0 in the established official Ubuntu Noble image. A/B use identical perspective cameras and lighting. Exact native restoration is required. Full-face and oblique screenshots require visual review; passing engineering checks is not portrait acceptance.

This page is an automated internal study only, not a new interactive release. Its study API restores the native baseline on an update exception. The inherited material/camera Reset button is not the study-control API.
