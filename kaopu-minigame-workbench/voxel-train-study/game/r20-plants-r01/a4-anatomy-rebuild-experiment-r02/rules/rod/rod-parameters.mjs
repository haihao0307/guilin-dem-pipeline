// Scalar dimensions fitted from locked teacher node 103. No source vertex table.
export const ROD_PARAMETERS = {
  "version": "source-103-channel-and-end-connections/2",
  "units": "unscaled source-local units; not metres",
  "source": {
    "nodeIndex": 103,
    "parentNodeIndex": 102,
    "parentName": "Main Gear_42",
    "meshIndex": 65,
    "materialIndex": 1,
    "objectSHA256": "749efd6d1b1a19aa97d9d024baa33f4f5df382eb19a2be88c10ef7ba6e1a5fe4",
    "payloadSHA256": "829caf7934c5d58d59a35f0e2125ae1ccc1c551447a62fed22bf4bd2170673b2",
    "vertexCount": 1810,
    "triangleCount": 1748,
    "fieldAccessors": {
      "position": 260,
      "normal": 261,
      "uv": 262,
      "index": 263
    },
    "fieldSHA256": {
      "position": "dbd54142f62ee1ec4696b91a41b63d36ed51f2bc118f06ff07c403f787f2da1e",
      "normal": "f5a4370f4e832bc951dc0b5f50985462d2f5dfa68217a216b408bbbb0c079908",
      "uv": "d1ee9d40dc7256f879d4cf62d0470eaf2002ddc360f6bef6e188ce5915a5a3a0",
      "index": "6db4d3e974c8c64a1453f015bd04e2221cd8db3aa03f25cccddddbfa76294cf7"
    },
    "fnv1a32IdentityGuards": {
      "position": "b11c3bf2",
      "normal": "51ddddbf",
      "uv": "b2f9e018",
      "index": "1ecca795"
    },
    "material": {
      "doubleSided": true,
      "name": "Button_Silver",
      "pbrMetallicRoughness": {
        "baseColorFactor": [
          0.2549097217737352,
          0.2549097217737352,
          0.2549097217737352,
          1.0
        ],
        "metallicFactor": 0.8736661585,
        "roughnessFactor": 0.17511432930000004
      }
    }
  },
  "frame": {
    "u": [
      0.9998922307294251,
      4.78848057592784e-05,
      -0.014680757268589114
    ],
    "v": [
      -4.788485096029967e-05,
      0.9999999988534598,
      3.4843294816919245e-07
    ],
    "w": [
      0.014680757268441683,
      3.5459047598620197e-07,
      0.9998922318759654
    ],
    "origin": [
      0,
      0,
      0
    ]
  },
  "section": {
    "outerBackU": 0.03404670733325184,
    "grooveFloorU": -0.002095509069466526,
    "openSideU": -0.010271535700033104,
    "bottomV": -0.08250115087719154,
    "grooveBottomV": -0.07055815570105628,
    "grooveTopV": 0.04860001139437154,
    "topV": 0.0622256757014819
  },
  "generatedRangeW": [
    -4.2,
    -0.2
  ],
  "sourceTriangleSelection": {
    "rule": "local-z vertex span > 1 source unit",
    "threshold": 1,
    "expectedCount": 36
  },
  "measuredDimensions": {
    "outerThicknessU": 0.044318243033284944,
    "grooveDepthU": 0.008176026630566578,
    "remainingBackThicknessU": 0.03614221640271836,
    "outerHeightV": 0.14472682657867345,
    "grooveHeightV": 0.11915816709542781,
    "bottomFlangeHeightV": 0.011942995176135257,
    "topFlangeHeightV": 0.01362566430711036,
    "generatedLengthW": 4.0
  },
  "derivation": "Least-squares common longitudinal direction from long source edges; orthonormal lateral frame from source face normals. Three lateral planes and four flange planes determine an eight-corner open C section. This is seven cross-section scalars, not a retained vertex contour table.",
  "criticalSectionsEvidence": {
    "sha256": "72361ba03edb81ab2e4d310b76e1f60d79a2771e4134d2e2d9679b59d917b836",
    "sourceWorldPlanes": [
      -1.4,
      -0.5,
      0.5
    ],
    "sourceSegmentCounts": [
      36,
      112,
      36
    ]
  },
  "limits": [
    "Source Main Gear_42 identity does not certify the real mechanism classification or engineering units.",
    "Three original hex fastener components and two smaller offset collars remain explicit untouched source fallback (700 triangles).",
    "The circle faces and covered central boss are reconstructed as found; there is no certified unobstructed through-hole.",
    "Source overlaps including high-end opposite-wound coincident groove/end-cap layers are retained, not repaired or boolean-unioned.",
    "Generated normals are analytic/smoothed by profile; generated UVs are new planar/profile mappings. Current original Button_Silver material has no texture bindings; future texture mapping is unvalidated.",
    "Default geometric fit is CPU sampled and section-tested; modified parameter variants are editable experiments, not accepted fits or verified engineering parts."
  ],
  "endConnections": {
    "radialSegments": 32,
    "cornerSegments": 5,
    "circleCenterV": -7.280671035954367e-07,
    "outerRadius": 0.12700009094716108,
    "bossRadius": 0.06815664358510108,
    "backU": -0.01971805230926894,
    "frontU": 0.04349314353143614,
    "bossFrontU": 0.10369208143433435,
    "tabShoulderCircleStep": 5,
    "tabTopV": 0.15492461420425085,
    "tabCornerRadius": 0.012714475328249153,
    "collarCentersW": [
      -4.4429872791044565,
      -2.21934175785778,
      0.00023972721499042094
    ],
    "channelTerminalCircleCenterW": -0.03021938215842815,
    "sourceComponents": [
      {
        "name": "low-collar-and-channel",
        "sourceTriangleCount": 408,
        "minimumW": -4.569987257
      },
      {
        "name": "middle-independent-collar",
        "sourceTriangleCount": 320,
        "minimumW": -2.346342021
      },
      {
        "name": "high-independent-collar",
        "sourceTriangleCount": 320,
        "minimumW": -0.126760287
      }
    ],
    "sourceTerminalPolicy": "Full bowed end cap and opposite-wound groove patch are coincident in the source and intentionally both retained as generated surfaces; do not boolean-union or claim manifold.",
    "dimensionsDerivedFrom": "Least-squares circle in lower 32-gon; concentric boss; three u planes; tab shoulder at 5/32 of full circle and circular top corners. Shared dimensions, three independent axial placements."
  },
  "parameterization": {
    "editableShapeScalars": 19,
    "definition": "7 C-section planes + 8 shared collar dimensional scalars (centerV, outerRadius, bossRadius, backU, frontU, bossFrontU, tabTopV, tabCornerRadius) + 3 collar W centers + 1 terminal circle W center. The frame is a separate measured placement basis. Three integer tessellation/attachment controls (radialSegments, cornerSegments, tabShoulderCircleStep) are also editable. Identity metadata and fallback selectors are not shape parameters.",
    "sourceCoordinateTablesUsedForGeneration": false
  }
};
