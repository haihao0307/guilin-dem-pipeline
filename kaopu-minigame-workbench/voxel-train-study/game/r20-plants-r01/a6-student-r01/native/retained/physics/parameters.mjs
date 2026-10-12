// Shared native-ES-module parameters for Node and browser; all dynamics use SI.
export const A4_GAME_PARAMETERS = {
  "schema": "FH88_SI_DRIVING_PARAMETERS_R01",
  "status": "A4 driver-calibrated integration into the existing train game. FH88 SI dynamics remain a tunable game model, not a certified historical locomotive simulation.",
  "clock": {
    "fixedDtS": 0.008333333333333333,
    "maxStepsPerAdvance": 1200
  },
  "train": {
    "massKg": 205000,
    "equivalentMassFactor": 1.08,
    "adhesiveMassKg": 60000,
    "brakedMassKg": 205000,
    "wheelDiameterM": 2.032,
    "initialMechanicalThetaRad": 0.25
  },
  "engine": {
    "cylinderCount": 3,
    "cylinderBoreM": 0.4699,
    "strokeM": 0.6604,
    "cutoffMin": 0.1,
    "cutoffMax": 0.8,
    "polytropicExponent": 1.2,
    "diagramFactor": 0.8,
    "mechanicalEfficiency": 0.9,
    "maxIndicatedHeatFraction": 0.22,
    "steamTemperatureK": 673.15,
    "steamGasConstantJkgK": 461.526,
    "steamHeatJkg": 2800000,
    "maxSteamFlowKgS": 9,
    "referencePressurePa": 1800000,
    "exhaustPressurePa": 120000,
    "maxDirectionChangeSpeedMps": 0.2
  },
  "supply": {
    "pressureComplianceJPa": 1500,
    "maximumPressurePa": 2500000,
    "initialPressurePa": 1800000,
    "initialFireKgS": 0.8,
    "fuelLowerHeatingValueJkg": 25000000,
    "absorbedHeatFraction": 0.75,
    "fireLagS": 45,
    "ambientLossW": 120000,
    "coalInitialKg": 3000,
    "waterInitialKg": 18500,
    "maxFiringKgS": 1.5
  },
  "rail": {
    "gravityMps2": 9.81,
    "adhesionCoefficient": 0.15,
    "rollingConstantN": 2500,
    "rollingLinearNsM": 60,
    "aeroQuadraticNs2M2": 6,
    "maxBrakeForceN": 120000,
    "brakeBuildS": 1.5,
    "brakeReleaseS": 2.0,
    "maxAbsGrade": 0.1
  },
  "initialControls": {
    "throttle": 0,
    "reverser": 1,
    "cutoff": 0.55,
    "brake": 1,
    "firingKgS": 0.8,
    "grade": 0
  },
  "assumptions": {
    "inherited_candidates": "A4 geometric references: 3 cylinders; 18.5 in bore (0.4699 m); 26 in stroke (0.6604 m); 6 ft 8 in drivers (2.032 m). 205 t total game consist, inertia factor 1.08, 60 t adhesive load and mu=0.15 remain design assumptions.",
    "pressure": "Usable thermal reserve E=C*(p-p_exhaust), hot-start only; not IAPWS, vessel design, boiler-water-level or cold-start simulation.",
    "valves": "Cycle-averaged double-acting p-V work with polytropic expansion and exhaust floor. Throttle is an ideal effective admission-pressure control plus finite valve flow capacity, not exact regulator geometry or valve timing.",
    "adhesion": "Ideal instantaneous pressure/steam reduction to mu*Madh*g; no wheelspin, slip loss or real historical anti-slip hardware.",
    "water": "Finite usable feedwater inventory; no boiler/tender split or feed pump dynamics.",
    "resistance": "Uncalibrated A+B|v|+Cv^2 resistance and grade mg*sin(atan(grade)); no curvature, coupler slack, derailment or route profile.",
    "brake": "Aggregate train brake with first-order build/release and adhesion bound; not air/vacuum pipe simulation or stopping-distance certification."
  },
  "sources": {
    "driverDiameter": "https://collection.sciencemuseumgroup.org.uk/objects/co205732/london-north-eastern-railway-steam-locomotive-mallard-4-6-2-a4-pacific-class-no-4468-steam-locomotive",
    "cylinders": "https://theengineer.markallengroup.com/production/2018/09/Gresley-Silver-Jubilee.pdf"
  }
};
