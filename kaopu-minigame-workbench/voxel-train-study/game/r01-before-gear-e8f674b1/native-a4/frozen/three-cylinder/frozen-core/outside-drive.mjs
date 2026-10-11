/** Self-owned FH88 candidate outside slider-crank, SI throughout.
 * Local X forward, Z up; theta positive from +X to +Z; forward rolling omega < 0.
 * Local Y is outboard distance from this wheel's outer face (Y=0), NOT global gauge.
 * Rigid massless rod and ideal joints. Slider equivalent mass is an explicit input.
 * No boiler, valve timing, friction, wheel inertia, adhesion law, balance or fatigue.
 */
function finite(x, name) {
  if (typeof x !== 'number' || !Number.isFinite(x)) throw new TypeError(`${name} must be finite`);
  return x;
}
function positive(x, name) { finite(x,name); if (x <= 0) throw new RangeError(`${name} must be positive`); return x; }

export function validateDesign(p) {
  if (p?.identity !== 'FH88_ORIGINAL_OUTSIDE_DRIVE_CANDIDATE') throw new Error('NOT_AN_A3_RECONSTRUCTION');
  for (const key of ['wheelDiameterM','strokeM','rodPinCentresM','rodEnvelopeRadiusM','crossheadHalfLengthM','wheelDepthM']) positive(p[key],key);
  for (const key of ['rodPlaneOutboardM','guideMinM','guideMaxM']) finite(p[key],key);
  if (p.rodPinCentresM <= p.strokeM / 2) throw new RangeError('ROD_REACH_OR_TOGGLE');
  if (p.strokeM / 2 >= p.wheelDiameterM / 2) throw new RangeError('PIN_OUTSIDE_WHEEL_ENVELOPE');
  if (p.guideMinM >= p.guideMaxM) throw new RangeError('INVALID_GUIDE_INTERVAL');
  if (p.rodPlaneOutboardM < 0) throw new RangeError('OUTBOARD_FRAME_REQUIRED');
  return p;
}

export function pose(p, thetaRad, omegaRadS = 0, alphaRadS2 = 0) {
  validateDesign(p); finite(thetaRad,'theta'); finite(omegaRadS,'omega'); finite(alphaRadS2,'alpha');
  const r=p.strokeM/2, L=p.rodPinCentresM, s=Math.sin(thetaRad), c=Math.cos(thetaRad);
  const q=Math.sqrt(L*L-r*r*s*s), x=r*c+q;
  const xp=-r*s-r*r*s*c/q;
  const xpp=-r*c-r*r*(c*c-s*s)/q-r**4*s*s*c*c/q**3;
  const velocity=xp*omegaRadS, acceleration=xpp*omegaRadS**2+xp*alphaRadS2;
  if (![q,x,xp,xpp,velocity,acceleration].every(Number.isFinite) || q<=0) throw new RangeError('NUMERIC_GEOMETRY_OR_RATE_RANGE');
  return {
    crankPinM:[r*c,p.rodPlaneOutboardM,r*s], crossheadPinM:[x,p.rodPlaneOutboardM,0],
    axisCoordinateM:x, derivativeMPerRad:xp, secondDerivativeMPerRad2:xpp,
    velocityMS:velocity, accelerationMS2:acceleration,
    rodAngleRad:Math.atan2(-r*s,q), cosRodAngle:q/L,
    rodClosureResidualM:Math.hypot(q,r*s)-L,
    omegaRadS, alphaRadS2
  };
}

/** Input is a prescribed external net axial force EXCLUDING rod reaction; no steam-state inference.
 * A pressure example must explicitly convert delta-p * effective piston area externally.
 * Slider inertia is included. Rod, crank and wheel inertia are deliberately excluded.
 * A specified theta/omega/alpha is a kinematic boundary, NOT a solved vehicle trajectory.
 */
export function loads(p, state, netPistonForceN, reciprocatingEquivalentMassKg) {
  validateDesign(p); finite(netPistonForceN,'net piston force'); finite(reciprocatingEquivalentMassKg,'slider mass');
  for (const key of ['thetaRad','omegaRadS','alphaRadS2']) finite(state?.[key],key);
  if (reciprocatingEquivalentMassKg < 0) throw new RangeError('NEGATIVE_MASS');
  const k=pose(p,state.thetaRad,state.omegaRadS,state.alphaRadS2);
  const transmittedAxialN=netPistonForceN-reciprocatingEquivalentMassKg*k.accelerationMS2;
  const rodTensionN=transmittedAxialN/k.cosRodAngle;
  const crankForceN=[transmittedAxialN,0,rodTensionN*Math.sin(k.rodAngleRad)];
  const guideReactionN=[0,0,crankForceN[2]];
  const torqueNm=transmittedAxialN*k.derivativeMPerRad;
  const crossProductTorqueNm=k.crankPinM[0]*crankForceN[2]-k.crankPinM[2]*crankForceN[0];
  const crankPowerW=torqueNm*state.omegaRadS;
  const pistonPowerW=netPistonForceN*k.velocityMS;
  const sliderKineticEnergyRateW=reciprocatingEquivalentMassKg*k.accelerationMS2*k.velocityMS;
  if (![transmittedAxialN,rodTensionN,torqueNm,crossProductTorqueNm,crankPowerW,pistonPowerW,sliderKineticEnergyRateW,...crankForceN].every(Number.isFinite)) throw new RangeError('NUMERIC_LOAD_RANGE');
  return {...k, netPistonForceN, transmittedAxialN, rodTensionN, crankForceN, guideReactionN,
    torqueNm,crossProductTorqueNm,crankPowerW,pistonPowerW,sliderKineticEnergyRateW,
    powerResidualW:pistonPowerW-sliderKineticEnergyRateW-crankPowerW,
    equivalentWheelRimForceN:-torqueNm/(p.wheelDiameterM/2),
    rimForceScope:'torque/radius only; requires wheel inertia and contact dynamics before vehicle traction'
  };
}

/** Continuous full-revolution separation certificates, not a triangle-mesh collision engine.
 * Rod envelope is a constant-radius capsule. Wheel is contained in Y in [-depth,0].
 * Intentional crank pin / rod bearing and slider bearing contacts are outside these two tests.
 */
export function sweepCertificates(p) {
  validateDesign(p);
  const r=p.strokeM/2,L=p.rodPinCentresM, R=p.wheelDiameterM/2;
  const xMin=L-r,xMax=L+r;
  const wheelRodGapLowerBoundM=p.rodPlaneOutboardM-p.rodEnvelopeRadiusM;
  const crossheadWheelXGapLowerBoundM=xMin-p.crossheadHalfLengthM-R;
  const guideRearMarginM=xMin-p.crossheadHalfLengthM-p.guideMinM;
  const guideFrontMarginM=p.guideMaxM-(xMax+p.crossheadHalfLengthM);
  const qMin=Math.sqrt(L*L-r*r);
  if (![qMin,xMin,xMax,wheelRodGapLowerBoundM,crossheadWheelXGapLowerBoundM,guideRearMarginM,guideFrontMarginM].every(Number.isFinite) || qMin<=0) throw new RangeError('NUMERIC_ENVELOPE_RANGE');
  return {
    scope:'FULL_REVOLUTION_ANALYTIC_ENVELOPE_SUBSET',
    crossheadCentreRangeM:[xMin,xMax], requiredGuideEnvelopeM:[xMin-p.crossheadHalfLengthM,xMax+p.crossheadHalfLengthM],
    maxAbsoluteRodAngleRad:Math.asin(r/L), maxAbsoluteGuideToTransmittedForceRatio:r/qMin,
    wheelRodGapLowerBoundM,crossheadWheelXGapLowerBoundM,guideRearMarginM,guideFrontMarginM,
    wheelRodSeparated:wheelRodGapLowerBoundM>0,
    crossheadWheelSeparated:crossheadWheelXGapLowerBoundM>0,
    guideContainsCrosshead:guideRearMarginM>=0&&guideFrontMarginM>=0,
    // Conservative analytic upper bound using |sin cos| <= 1/2, q >= qMin.
    secondDerivativeAbsUpperBoundMPerRad2:r+r*r/qMin+r**4/(4*qMin**3),
    notChecked:['rod/cylinder','rod/frame details','other driving axles','opposite-side or inside machinery','coupling rods','valve gear','elastic deflection','bearing pin design','balance','thermal growth','3D swept solid exhaustiveness']
  };
}

export function noSlipOmegaRadS(speedMS, wheelDiameterM) {
  finite(speedMS,'speed'); positive(wheelDiameterM,'wheel diameter');
  return -speedMS/(wheelDiameterM/2);
}
