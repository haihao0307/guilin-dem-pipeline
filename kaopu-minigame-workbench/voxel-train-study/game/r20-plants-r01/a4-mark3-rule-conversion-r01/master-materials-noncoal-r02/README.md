# Non-coal projection → fixed v3.1 material candidate

Local candidate only. Does not edit or publish user-viewer, source assets, existing projection runtime, or any previous material version. This layer remaps identities; it does not alter a material recipe or improve microtexture visibility.

## Entry

```js
import {installTrainMaster} from './train-binding.mjs';
const binding = await installTrainMaster(THREE, source);
// Initial mode is source-exact, retaining original material references.
binding.switchMode('master-upgrade');
binding.switchMode('source-exact');
binding.dispose();
```

Installation is async for identity SHA verification. The returned switchMode/records/materialRecords/dispose API matches fixed v3.1, with projectionReport added. Current user-viewer loadNoncoal supplies source.projection, source.g, source.model and source.root. Its addPanel must capture source.materialRestMatrices before animation and before display-parent placement; this wrapper requires that WeakMap and never captures a current animated pose. Alternatively, supply the verified manifest via source.manifest or the optional third argument `{manifest}`. Use the existing loadProjection verification first; this material layer does not replace payload/asset decoding and integrity checks.

The projection is deliberately fixed to the exact r01 and r08 historical anchors (a6-noncoal-inheritance-r01 / a6-noncoal-inheritance-r08): 325 compact nodes, 195 meshes, 21 materials, 922 fields. SourceIndices and retained identity locks must match the frozen complement. It rejects a manifest from another model, reordering, coal reintroduction, changed compact definitions, parser/model mismatch and out-of-range associations. It does not accept clearcoat overrides or new material families.

## Identity contract

- Actual glTF objects, parser JSON, parser.associations, arrays, geometry and transforms stay compact and unchanged.
- A new associations Map copies every entry/value, including ancestor groups. nodes/meshes/materials become original A4 indices. primitive indices remain local and unchanged.
- A sparse in-memory **audit view**, never rendered or parsed, maps node.mesh and primitive.material consistently. Original coal node/mesh/material positions stay holes. It carries no deleted coal fields or geometry payload.
- Fixed, byte-identical v3.1 receives only this audit view and the original mesh/material object keys. Source material selection and PBR semantics are the previous policy, not a name-based replacement.
- `records[].sourcePrimitive` and `sourceMaterialIndex` are original A4 identities; `projectedPrimitive` and `projectedMaterialIndex` show compact identities. Missing/inconsistent tuple associations preserve the original material and are reported in `unmatchedAuditedTuples`; `allExpectedTuplesMapped` is the completeness gate.
- Compact material20 is original material21 Roof_Grey; original material20 Coal is absent.

Two exact hashes distinguish the pre-parse compact document and actual GLTF JSON path. The existing JSON.stringify→parse path turns47 metadata -0 values into+0; its independently locked parser form is accepted, without relaxing the source definition lock. Binary geometry arrays are not serialized or modified by this adapter.

## Verified CPU result

Actual non-coal35,178,744-byte payload was decoded and loaded through Three r170 GLTFLoader. Actual retained PNGs were decoded to CPU RGBA DataTextures for material/UV binding checks. No dummy geometry or full A4 source object/payload was used.

- 195 mesh slots;75 selected,120 retained;7 source material definitions partially/fully selected.
- bare-metal27; black-painted-steel23; dark-iron9; paint16; no glass upgrade in this A4 projection.
- All75 original A4 v3.1 tuples exactly match. Direct compact-ID use gives only71, missing four shifted tuples.
- At animation0.37s: installation/switching leaves all325 local/world transforms unchanged and still uses the initially captured rest matrices.
- Every geometry attribute/index object, typed array reference and byte hash stays unchanged; original material object references restore. Source textures/pixels/UV transform/sampler/color-space are unchanged and not disposed.
- Eight corruption/scope tests fail closed; a missing mesh association leaves that slot source-exact and reports74 selected/121 retained instead of guessing.
- Removed source nodes311–316, meshes187–191, material20 and fields748–767 remain absent. Standalone projection runtime requests are recorded; no full A4 payload is requested.

Full per-use test artifact: `../research-materials/artifacts/noncoal08-master-r02-verification.json`. Test command from workspace root:

```sh
node --experimental-loader ./a4-mark3-rule-conversion-r01/research-a6-noncoal/browser-node-import-loader.mjs a4-mark3-rule-conversion-r01/research-materials/verify_noncoal_master_r02.mjs
```

## Limits and dependency closure

This is CPU identity/geometry/material restoration verification, not browser visual acceptance. Fixed v3.1 microtexture visible-detail review previously did not pass; that limitation remains. Material domains are uncalibrated reference units. Inherited A4 identity artwork is retained; this does not create A6's new88/Flying Hong Kong/陆港牌 or certify an A6 exterior.

All fixed v3.1 modules/vendor files are copied byte-identically under vendor/master-materials-v3-1. The new runtime requires17 reachable ESM modules (the original14 plus this wrapper, identity hash utility and identity anchor), injected Three r170, and an already loaded verified projection model. No new texture, mesh, binary or network dependency is introduced by the material adapter. runtime-lock.json lists the complete packaged source/provenance closure with per-file bytes andSHA. The original v3.1 lock remains included as an immutable upstream anchor.

## r02 integrity correction

The r01 material wrapper is preserved as an audit anchor and is superseded for integration. r02 synchronously snapshots projection, compact definition, parser definition, all association values, rest matrices and scene/material assignment references before any SHA await. Hash and remapping use the same snapshots. Before binding, it rejects concurrent mutation of these live inputs, including signed-zero changes, parser/map replacement and mutable association values. It does not freeze, rewrite or mutate the caller. Animation transforms can continue normally; only captured rest matrices and identity/hierarchy/material assignments are guarded. Large buffer data URIs are not cloned.

Known historical anchors distinguish r01 program05SHA256 and r08 program08SHA256. When a manifest is supplied its model must match that exact anchor. Unknown model/history combinations fail closed. The fixed v3.1 vendor closure remains byte-identical.
