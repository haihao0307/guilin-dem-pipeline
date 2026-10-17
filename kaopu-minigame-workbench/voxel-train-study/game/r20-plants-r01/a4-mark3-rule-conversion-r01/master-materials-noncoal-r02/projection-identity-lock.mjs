/** Frozen r01/r08 non-coal identity anchors; no original A4 payload is required. */
export const PROJECTION_IDENTITY_LOCK=Object.freeze({
  "schema": "kaopu.noncoal-material-projection-anchor/1",
  "projectionSchema": "kaopu.noncoal-inheritance-projection/1",
  "sourcePayloadSHA256": "9fcc5fd501b5e45b8c6034a5297c7eea4d9441be5af25d1c02ab3a58322d089e",
  "sourcePayloadBytes": 35178744,
  "definitionKeys": [
    "asset",
    "scene",
    "scenes",
    "nodes",
    "meshes",
    "materials",
    "textures",
    "samplers",
    "animations",
    "accessors",
    "bufferViews"
  ],
  "identityKeys": [
    "schema",
    "sourceIndices",
    "removed",
    "fieldLocks",
    "nodeLocks"
  ],
  "projectedCounts": {
    "nodes": 325,
    "meshes": 195,
    "materials": 21,
    "fields": 922
  },
  "compactDefinitionSHA256": "92981395f104830eefc3b0b78c8a84cd3d1e591ef9f4a4bb8f509bde5739b3e4",
  "identitySHA256": "4de3857ea932caf5dd9c32b47148af0c3e0d188afdbdac8717e294ea73fbc59e",
  "fixedV31RuntimeLockSHA256": "3d52e46ed8dfe95f503d5d255205b7dd6f606046139fced0be35b7a3fc64b879",
  "parserDefinitionSHA256": "8fc98e56b59c800062838faf5fb44eb0c5c1597572bd4b413be43a435f300661",
  "parserSerialization": "Existing JSON.stringify -> parse glTF path converts metadata -0 to +0; separate exact anchor, binary geometry arrays are not serialized.",
  "negativeZeroMetadataPaths": [
    "g.nodes.152.matrix.2",
    "g.nodes.152.matrix.4",
    "g.nodes.240.matrix.2",
    "g.nodes.242.matrix.2",
    "g.nodes.242.matrix.4",
    "g.nodes.248.matrix.8",
    "g.nodes.248.matrix.9",
    "g.nodes.248.matrix.11",
    "g.nodes.276.matrix.1",
    "g.nodes.276.matrix.2",
    "g.nodes.276.matrix.3",
    "g.nodes.276.matrix.4",
    "g.nodes.276.matrix.6",
    "g.nodes.276.matrix.7",
    "g.nodes.276.matrix.8",
    "g.nodes.276.matrix.9",
    "g.nodes.276.matrix.11",
    "g.accessors.585.max.2",
    "g.accessors.585.min.2",
    "g.accessors.589.max.2",
    "g.accessors.589.min.2",
    "g.accessors.613.max.2",
    "g.accessors.613.min.2",
    "g.accessors.685.max.2",
    "g.accessors.685.min.2",
    "g.accessors.849.max.1",
    "g.accessors.849.min.1",
    "g.accessors.853.max.1",
    "g.accessors.853.min.1",
    "g.accessors.857.max.1",
    "g.accessors.857.min.1",
    "g.accessors.867.max.2",
    "g.accessors.867.min.2",
    "g.accessors.871.max.2",
    "g.accessors.871.min.2",
    "g.accessors.885.max.2",
    "g.accessors.885.min.2",
    "g.accessors.887.max.1",
    "g.accessors.887.min.1",
    "g.accessors.889.max.1",
    "g.accessors.889.min.1",
    "g.accessors.891.max.1",
    "g.accessors.891.min.1",
    "g.accessors.893.max.1",
    "g.accessors.893.min.1",
    "g.accessors.905.max.2",
    "g.accessors.905.min.2"
  ],
  "supportedScopes": [
    {
      "model": "a6-noncoal-inheritance-r01",
      "historicalA4Anchors": {
        "fullFieldPayloadBytes": 47362176,
        "fullFieldPayloadSHA256": "829caf7934c5d58d59a35f0e2125ae1ccc1c551447a62fed22bf4bd2170673b2",
        "objectSHA256": "749efd6d1b1a19aa97d9d024baa33f4f5df382eb19a2be88c10ef7ba6e1a5fe4",
        "program05SHA256": "7d89415d78dae58d758af8e670e5e5c4cd5b4a20f3dbf24d17e1820eb1ab1907"
      }
    },
    {
      "model": "a6-noncoal-inheritance-r08",
      "historicalA4Anchors": {
        "fullFieldPayloadBytes": 47362176,
        "fullFieldPayloadSHA256": "829caf7934c5d58d59a35f0e2125ae1ccc1c551447a62fed22bf4bd2170673b2",
        "objectSHA256": "749efd6d1b1a19aa97d9d024baa33f4f5df382eb19a2be88c10ef7ba6e1a5fe4",
        "program08SHA256": "1d4add951fb8b3fa87bc0af1dbab421b0122dfa4752c9b6655a877c4ae203c68"
      }
    }
  ],
  "scope": "Only coal excluded. All other source components, shell, transforms, animation, material/texture dependencies retained. This subset is not a complete A6 design."
});
