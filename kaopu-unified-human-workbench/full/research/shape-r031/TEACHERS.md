# R03.1 teacher audit and implementation

## Observed gap

The published R02/R03 recipes left all 253 GNM identity coefficients at zero. They changed transferred Anny local nose/chin fields, but barely explored the native scanned head identity space. Three actual low-weight Anny renders at muscle 0.08 / 0.35 / 0.65 also remained too smooth at the clavicle and costal margin. Muscle is not a synonym for bone visibility.

## Used teachers

- Google GNM v3: [official parameter guide](https://github.com/google/GNM/blob/main/gnm/shape/README.md), [model weights and Apache-2.0 license](https://huggingface.co/google/gnm-v3), [forward implementation](https://github.com/google/GNM/blob/main/gnm/shape/gnm_common.py). The existing head170 basis already contains statistical scale and coupled globe translation. The extra eyeball3 and dental80 identity parameters remain zero; head identity still transports the existing eye geometry and joints.
- Anny / MakeHuman MPFB: [Anny repository](https://github.com/naver/anny), [actual target catalogue](https://github.com/naver/anny/blob/main/src/anny/data/mpfb2/targets/target.json), [asset license](https://static.makehumancommunity.org/about/license.html). Anny code is Apache-2.0; core MPFB shape assets are CC0. Native muscle/fat/tone and regional shapes stay the base. No independent rib/clavicle target exists in the inspected 256 local controls.
- NCI SEER anatomy: [pectoral girdle and pelvis](https://training.seer.cancer.gov/anatomy/skeletal/divisions/appendicular.html), [thoracic cage](https://training.seer.cancer.gov/anatomy/skeletal/divisions/axial.html). Images were viewed as anatomical references, not copied into the workbench. The clavicle is a curved strut separated from its adjacent fossae; the costal margin is a paired oblique boundary, not a horizontal waist band.
- BodyParts3D: [current official CC BY 4.0 license](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html), [modeling notes](https://lifesciencedb.jp/bp3d/info_en/userGuide/releaseNotes/modelingNote-2.0.pdf). Used for landmark relationships only. It combines scans, CT and CAD edited to anatomical landmarks; it is not an unmodified individual scan or population tissue-thickness truth. No bone model is imported, no third-party mesh is published.

## Applied methods

1. Fit three named identity profiles through the existing first 60 GNM head basis vectors using a regularized Jacobian of 13 embedded-landmark measurements: jaw widths, brow span, nose width/length/projection, eye width/separation, mouth width, lip thicknesses, lower-face height and chin projection. This preserves the original head topology and native identity-to-joint coupling. Names describe the resulting measured profile, not an invented semantic meaning for one PCA coefficient.
2. Constrain neck/calvarium drift and coefficient magnitude. The square-jaw raw fit receives a further 0.8 gain after one tiny outer-face normal inversion was detected. The shipped state records the actual applied coefficients. Raw fit predictions are not clinical measurements.
3. Keep adult low-fat muscle at 0.35, reduce the previous excessive waist/torso narrowing, and add a bounded normal displacement field around current shoulder, spine, elbow, knee and ankle anchors. Narrow shallow crests have broader weak adjacent depressions; all additions are inserted into every original CSR rest contribution before skinning. Bones, weights and topology remain unchanged. No pelvis ring or sharp hip-corner amplification is added.
4. Review the actual rendered full body, torso close-up and front/oblique/side head. Screen neutral head/body triangles, exact rest return, posed finite geometry, and explicit blink/jaw frames. Numeric finite tests alone do not establish nonpenetration for every motion.

## Other sources checked, not integrated

- [FLAME official license](https://flame.is.tue.mpg.de/modellicense.html): FLAME 2023 Open is now CC Attribution with additional stated restrictions. Older versions retain different terms. No new FLAME download or license acceptance was needed.
- [FaceScape license](https://nju-3dv.github.io/projects/FaceScape/static/license/LicenseAgreement_FaceScape.pdf): noncommercial/research access and redistribution limits. No data, weights or derived target package imported.
- FaceWarehouse current redistribution terms were not verified from the official site; no assets imported.

This is an adult art-direction study, not a BMI model, health diagnosis or anatomical certification. Children and the published R03 six cases remain unchanged.
