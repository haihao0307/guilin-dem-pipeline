export default {
  "identity": "FH88_ORIGINAL_THREE_PARALLEL_CYLINDER_BENCH_R01",
  "lengthUnit": "m",
  "worldFrame": "X forward, Y left, Z up; positive crank angle +X toward +Z",
  "track": {
    "nominalGaugeM": 1.435,
    "gaugeMeaning": "distance between inner 56E1 head faces; profile-specific wheel reference is separate",
    "railHeadProxyWidthM": 0.06985,
    "railTopZM": 0,
    "profileStatus": "56E1 declared reference dimensions; rounded profile visualization, not manufacturing certification"
  },
  "wheel": {
    "diameterM": 2.032,
    "envelopeHalfWidthM": 0.105,
    "flangeProfile": "Existing GAME lathed tread and inner flange, retained and explicitly gauge-fitted",
    "backToBackM": 1.355,
    "contactMeaning": "Lathed flat tread spans rail crown; flange relieved inboard, profile geometry tested",
    "referenceHalfSpacingM": 0.7825
  },
  "strokeM": 0.6604,
  "rodPinCentresM": 3.35,
  "outsideRodGapFromWheelFaceM": 0.25,
  "cylinders": [
    {
      "id": "right",
      "axisAngleRad": 0,
      "axisYM": -1.107425,
      "crankPhaseRad": 0,
      "equivalentReciprocatingMassKg": null
    },
    {
      "id": "inside",
      "axisAngleRad": 0,
      "axisYM": 0,
      "crankPhaseRad": 4.1887902047863905,
      "equivalentReciprocatingMassKg": null
    },
    {
      "id": "left",
      "axisAngleRad": 0,
      "axisYM": 1.107425,
      "crankPhaseRad": 2.0943951023931953,
      "equivalentReciprocatingMassKg": null
    }
  ],
  "phaseRationale": "Forward common angle decreases: left +120 degrees reaches the corresponding dead centre 120 degrees after right. Inside remains the explicit equal-phase 88 horizontal-cylinder design, not a reconstruction of the inclined A4 inside motion.",
  "provenance": {
    "nominalGaugeM": "Selected nominal 88 design gauge, not measured from the old game-unit shape.",
    "railHeadProxyWidthM": "56E1 official ArcelorMittal section: 69.85 mm head; not claiming historical1935 rail.",
    "diameterM": "Science Museum Group Mallard A4 catalogue: 2.032 m; adopted for 88.",
    "strokeM": "Existing FH88 candidate.",
    "rodPinCentresM": "3.35 m drawing-scaled estimate from LNER supplied general arrangement, The Engineer 27 Sep 1935 p320, using labelled 2.2098 m driver interval; estimated uncertainty \u00b10.08 m. Not an original dimension annotation.",
    "envelopeHalfWidthM": "Existing GAME tyre profile maximum axial envelope 105 mm.",
    "axisYM": "Explicit axial stack for tyre, separate coupling plane and connecting rod, with shape-level sweep verification; not manufacturing survey.",
    "drivingAxleXM": "Middle coupled axle, verified against LNER 1935 general arrangement and SNGLT e2149 engineering photograph."
  },
  "unresolved": [
    "exact original connecting-rod drawing dimensions",
    "historical inclined inner cylinder and conjugated valve gear",
    "full structural and wheel/rail contact dynamics",
    "surveyed 60009 wheel profile"
  ],
  "drivingAxleXM": -2.2098
};
