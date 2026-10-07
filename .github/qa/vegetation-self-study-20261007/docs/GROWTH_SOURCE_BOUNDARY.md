# Root and coffee growth study: actual source boundary

## Existing mother reused as the source of architectural rules

The original VegetationGenerator 1.14.0 archive is preserved in the user's Library. Its `TreeArchitectureGrowth.ts` and `PlantArchitectureCatalog.ts` are executed locally without editing their bytes. Node 24's built-in TypeScript stripping and a relative-extension resolver are the declared loading adapter. Ten assertions pass for topological ordering, parent attachment inheritance, retained fractions, cycle rejection and caching. See `qa/mother-original-baseline.json` and its executable harness.

The original browser app has not been run in this isolated public QA. Original private Library packages are not part of the public candidate upload.

## New developmental addition

`GrowthGraph` inherits the connected parent-axis invariant and uses actual curve arc distance to advance each growing tip. A child is not born until its parent has reached the attachment point. The inverse of smoothstep is used to solve that time. Root and shoot use the same representation; the coffee candidate has 46 root axes and 21 shoot/petiole axes. Leaves stay attached to the advancing petiole tip, unfold independently, and grow their own blade. This is a new developmental reconstruction, not a numeric translation of the mother routine, which computes early and mature architecture poses.

Tests sample nine stages and check connectivity, birth order and finite geometry. Chromium and WebKit have rendered this candidate and passed the connection checks. Image quality is a separate gate and remains unaccepted.

## Video sources

The coffee-inspired “Houdini 植物生长RND” video (supplied capture shows 致奇, with 小拉 watermark), the Left888 Houdini source demonstration, and the supplied Blender / AnyTree growth videos are visual and workflow references. No original author scene or equivalent exact simulation has been obtained. The AnyTree reference is the Blender product, not the Python tree data library. No video playback substitutes the three-dimensional model. No reference video or private photo is uploaded.

## Remaining limits

This model is a bounded study of growth relationships, not a botanically calibrated growth simulator. Seconds are demonstration time, not real coffee phenology. Root fine hairs, substrate interaction, material detail, flower abscission and plant-specific branch morphology require further visual and scientific validation. It is not marked AAA or 100% reproduction.
