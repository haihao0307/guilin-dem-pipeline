/* One fixed AxleSpec: retained inferred model geometry, not historic measurements. */
window.A4_AXLE_SPEC=KAOPU_WHEEL_RING_MOTHER.createAxleSpec({
 "common": {
  "halfGauge": "0.71750000000000003",
  "flangeHalfGauge": "0.65949999999999998",
  "referenceTheta": "0.40000000000000002",
  "travelScale": "1.016"
 },
 "classes": {
  "bogie": {
   "rollingRadius": "0.48259999999999997",
   "flangeRadius": "0.50759999999999994",
   "hubRadius": "0.082042000000000004",
   "innerRadiusMin": "0.41759999999999997",
   "spokeLower": "0.0656336",
   "spokeEnd": "0.45009999999999994",
   "basisZero": "(-0.0)"
  },
  "driving": {
   "rollingRadius": "1.016",
   "flangeRadius": "1.0409999999999999",
   "hubRadius": "0.17272000000000001",
   "innerRadiusMin": "0.95100000000000007",
   "spokeLower": "0.13817600000000002",
   "spokeEnd": "0.98350000000000004",
   "basisZero": "0.0"
  },
  "trailing": {
   "rollingRadius": "0.55879999999999996",
   "flangeRadius": "0.58379999999999999",
   "hubRadius": "0.094995999999999997",
   "innerRadiusMin": "0.49379999999999996",
   "spokeLower": "0.075996800000000003",
   "spokeEnd": "0.52629999999999999",
   "basisZero": "0.0"
  }
 },
 "axles": [
  {
   "axle": 0,
   "classRef": "bogie",
   "centerZ": "5.7911999999999999"
  },
  {
   "axle": 1,
   "classRef": "bogie",
   "centerZ": "3.8862000000000001"
  },
  {
   "axle": 2,
   "classRef": "driving",
   "centerZ": "2.2098"
  },
  {
   "axle": 3,
   "classRef": "driving",
   "centerZ": "0.0"
  },
  {
   "axle": 4,
   "classRef": "driving",
   "centerZ": "(-2.2098)"
  },
  {
   "axle": 5,
   "classRef": "trailing",
   "centerZ": "(-5.1054000000000004)"
  }
 ],
 "enclosures": [
  {
   "axle": 1,
   "role": "flange",
   "axis": 2,
   "min": "3.3785979999999998"
  },
  {
   "axle": 5,
   "role": "flange",
   "axis": 1,
   "min": "-0.02500199999999991"
  }
 ]
});
window.A4_WHEEL_RING_MOTHER=KAOPU_WHEEL_RING_MOTHER.create(A4_AXLE_SPEC,{
 "classes": {
  "bogie": {
   "innerRadius": "0.41759999999999997",
   "halfThickness": {
    "tyre": "0.070000000000000007",
    "flange": "0.012",
    "hub": "0.085"
   }
  },
  "driving": {
   "innerRadius": "0.95100000000000007",
   "halfThickness": {
    "tyre": "0.070000000000000007",
    "flange": "0.012",
    "hub": "0.085"
   }
  },
  "trailing": {
   "innerRadius": "0.49379999999999996",
   "halfThickness": {
    "tyre": "0.070000000000000007",
    "flange": "0.012",
    "hub": "0.085"
   }
  }
 },
 "instances": [
  {
   "axle": 0,
   "side": "left"
  },
  {
   "axle": 0,
   "side": "right"
  },
  {
   "axle": 1,
   "side": "left"
  },
  {
   "axle": 1,
   "side": "right"
  },
  {
   "axle": 2,
   "side": "left"
  },
  {
   "axle": 2,
   "side": "right"
  },
  {
   "axle": 3,
   "side": "left"
  },
  {
   "axle": 3,
   "side": "right"
  },
  {
   "axle": 4,
   "side": "left"
  },
  {
   "axle": 4,
   "side": "right"
  },
  {
   "axle": 5,
   "side": "left"
  },
  {
   "axle": 5,
   "side": "right"
  }
 ]
});
