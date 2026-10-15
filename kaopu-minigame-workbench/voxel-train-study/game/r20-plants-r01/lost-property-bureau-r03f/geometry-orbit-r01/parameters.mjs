export const SOURCE_PARAMETERS = {
  "SCENE": {
    "version": "bureau-r03e-arcaded-tower-01",
    "units": "metres",
    "building": [
      92,
      80
    ],
    "oldBuilding": [
      44,
      38
    ],
    "previousBuilding": [
      72,
      64
    ],
    "clearWarehouse": {
      "min": [
        -28,
        -28
      ],
      "max": [
        44,
        34.5
      ],
      "size": [
        72,
        62.5
      ],
      "area": 4500
    },
    "hall": {
      "side": "west x-negative",
      "depth": 14
    },
    "office": {
      "side": "south z-negative",
      "depth": 12
    },
    "receiving": {
      "min": [
        -28,
        34.5
      ],
      "max": [
        44,
        40
      ]
    },
    "arcade": {
      "clearWidth": 3.2,
      "axisDepth": 3.9,
      "sides": [
        "west",
        "south"
      ]
    },
    "tower": {
      "storeys": 4,
      "roofHeight": 28,
      "halfWidthsXZ": [
        [
          7.1,
          8.2
        ],
        [
          6.35,
          7.1
        ],
        [
          5.05,
          5.4
        ],
        [
          3.8,
          3.8
        ]
      ],
      "transitionsY": [
        [
          7.2,
          8.4
        ],
        [
          12.3,
          13.7
        ],
        [
          18.2,
          19.4
        ]
      ]
    },
    "chimney": {
      "height": 31,
      "baseRadius": 2.45,
      "topRadius": 1.18,
      "basePlinthRadius": 3
    },
    "banks": 2,
    "rowsPerBank": 16,
    "bays": 20,
    "levels": 6,
    "regularSlots": 4800,
    "smallSlots": 17280,
    "capacityIs": "mixed-size addresses, not actual inventory",
    "fiction": true
  },
  "INTERIOR_LAYOUT": {
    "version": "bureau-r03e-open-public-lobby-02",
    "hallBounds": [
      [
        -38.35,
        0,
        -39.4
      ],
      [
        -28.55,
        10.35,
        39.4
      ]
    ],
    "clearWarehouse": [
      [
        -28,
        -28
      ],
      [
        44,
        34.5
      ]
    ],
    "handover": {
      "first": [
        -32.4,
        1.3,
        -6
      ],
      "pitchZ": 3.2,
      "count": 8,
      "counterHalfSize": [
        0.78,
        0.65,
        1.35
      ]
    },
    "publicLobby": {
      "clearPortal": {
        "x": [
          -41.7,
          -29
        ],
        "z": [
          -20.8,
          -15.2
        ]
      },
      "towerZ": [
        -26.2,
        -9.8
      ],
      "waitingBenches": [
        [
          -37.1,
          0,
          -24.9
        ],
        [
          -37.1,
          0,
          -11.1
        ],
        [
          -37.5,
          0,
          -3
        ],
        [
          -37.5,
          0,
          5
        ],
        [
          -37.5,
          0,
          13
        ]
      ]
    },
    "clearTransport": {
      "hallSpineX": -30.5,
      "warehouseSpinesX": [
        -26.5,
        4,
        42.5
      ],
      "gateZ": [
        -20,
        0,
        20
      ],
      "rearCrossZ": 33.5
    },
    "publicCrossingsZ": [
      -18,
      20
    ],
    "warehouseColumns": {
      "x": [
        -28.42,
        44.32
      ],
      "zStart": -28,
      "zPitch": 10.4166665,
      "zCount": 7,
      "halfWidth": 0.11
    },
    "lightZones": [
      {
        "zone": 0,
        "count": 7,
        "first": [
          -35.6,
          4.48,
          -33
        ],
        "step": [
          0,
          0,
          11
        ]
      },
      {
        "zone": 1,
        "count": 9,
        "first": [
          -24,
          9.05,
          -32.35
        ],
        "step": [
          8,
          0,
          0
        ]
      },
      {
        "zone": 2,
        "count": 18,
        "first": [
          -22,
          8.45,
          -17.583333
        ],
        "grid": [
          6,
          3
        ],
        "step": [
          12,
          0,
          20.833333
        ]
      },
      {
        "zone": 3,
        "count": 5,
        "first": [
          -35.6,
          9.05,
          -33
        ],
        "z": [
          -33,
          0,
          11,
          22,
          33
        ]
      },
      {
        "zone": 4,
        "count": 9,
        "first": [
          -24,
          4.48,
          -32.35
        ],
        "step": [
          8,
          0,
          0
        ]
      },
      {
        "zone": 5,
        "count": 4,
        "first": [
          -39.5,
          4.8,
          -23
        ],
        "grid": [
          2,
          2
        ],
        "step": [
          8,
          0,
          10
        ]
      }
    ],
    "reservations": "Architectural fixtures only. Filing cabinets are office records; empty storage bays remain empty."
  },
  "PUBLIC_COUNTER_LAYOUT": {
    "version": "bureau-r03f-continuous-service-counter-01",
    "handoverSurfaceY": 1.3,
    "writingSurfaceY": 0.84,
    "writingClearanceY": 0.79,
    "writingHalfWidthZ": 0.64,
    "writingFrontX": -33.72,
    "bodyFrontX": -33.06,
    "continuousTop": {
      "x": [
        -33.18,
        -31.82
      ],
      "z": [
        -7.35,
        17.75
      ],
      "y": 1.3,
      "radius": 0.13
    },
    "protectedHandoverHalfZ": 0.9,
    "staffFixtures": [
      {
        "id": "number-sign",
        "center": [
          0.38,
          1.47,
          -1.23
        ],
        "half": [
          0.05,
          0.14,
          0.22
        ]
      },
      {
        "id": "folio",
        "center": [
          0.24,
          1.325,
          1.31
        ],
        "half": [
          0.2,
          0.025,
          0.2
        ]
      }
    ],
    "publicCrossingsZ": [
      -18,
      20
    ],
    "staffSpineX": -30.5,
    "staffSpineHalfWidth": 0.65,
    "staffStandingEnvelope": {
      "x": -31.48,
      "halfWidthX": 0.3,
      "designOnly": true
    },
    "caseworkOnly": true
  },
  "VIEWS": {
    "counterPanel": {
      "eye": [
        -34.4,
        1.05,
        -6.65
      ],
      "target": [
        -33.065,
        0.74,
        -6.65
      ],
      "cut": 0
    },
    "service": {
      "eye": [
        -35.8,
        1.63,
        -7.95
      ],
      "target": [
        -32.4,
        1.58,
        4.3
      ],
      "cut": 0
    },
    "writing": {
      "eye": [
        -34.8,
        1.6,
        -5.1
      ],
      "target": [
        -32.95,
        1.02,
        -5.15
      ],
      "cut": 0
    },
    "office": {
      "eye": [
        -24,
        1.65,
        -35.65
      ],
      "target": [
        -24,
        1.15,
        -31.5
      ],
      "cut": 0
    },
    "arcade": {
      "eye": [
        -42,
        1.65,
        13
      ],
      "target": [
        -40.5,
        2.4,
        -18
      ],
      "cut": 0
    },
    "transfer": {
      "eye": [
        9,
        3.2,
        15
      ],
      "target": [
        6.2,
        1,
        9.75
      ],
      "cut": 0
    },
    "transport": {
      "eye": [
        6,
        11,
        24
      ],
      "target": [
        6.5,
        1.5,
        13.7
      ],
      "cut": 1
    },
    "gripper": {
      "eye": [
        10.9,
        2.65,
        11.3
      ],
      "target": [
        12.6,
        1.85,
        9.15
      ],
      "cut": 0
    },
    "exterior": {
      "eye": [
        78,
        48,
        -88
      ],
      "target": [
        4,
        3,
        0
      ],
      "cut": 0
    },
    "section": {
      "eye": [
        66,
        81,
        -66
      ],
      "target": [
        3,
        1,
        0
      ],
      "cut": 1
    },
    "hall": {
      "eye": [
        -36.2,
        2.25,
        -22.8
      ],
      "target": [
        -31.1,
        3.15,
        -10.8
      ],
      "cut": 0
    },
    "warehouse": {
      "eye": [
        4,
        3.2,
        -27
      ],
      "target": [
        11,
        4,
        18
      ],
      "cut": 0
    },
    "freight": {
      "eye": [
        65,
        32,
        65
      ],
      "target": [
        12,
        3,
        22
      ],
      "cut": 1
    },
    "street": {
      "eye": [
        -87,
        23,
        -23
      ],
      "target": [
        -36,
        5,
        -12
      ],
      "cut": 0
    },
    "window": {
      "eye": [
        -42,
        7.9,
        3.1
      ],
      "target": [
        -38.55,
        7.65,
        0
      ],
      "cut": 0
    },
    "roof": {
      "eye": [
        32,
        20,
        -55
      ],
      "target": [
        33,
        13.6,
        -35.7
      ],
      "cut": 0
    }
  },
  "sources": {
    "domain.mjs": "99b33f62cfc12379d1e408519254c38b3b74c5954effeb53d0a8ed0606fa98c8",
    "interiors.mjs": "59704d6761ad6662d70710cfeab3d7cc62ce22b38060bff66b1d0659ecf8c6b0",
    "public-counter.mjs": "11efda423463266f60bf5f1973403af18b2ce508e26a2f98638351286a9185f7",
    "windows.mjs": "35c6c9b0702132dbd180c359924ddcbcdd4dcc88838ea8bb0b536f29f1f6cdac",
    "inventory.mjs": "fe226b95eb3498dbf8fe6c0c0e13ad82a8413b96fbf8993d59da9d09d4ca7d84"
  }
};
