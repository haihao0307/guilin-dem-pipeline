struct KpSurface {float height;vec3 albedo;float roughness;};
// User Library timber v3, exact box coordinate/noise/field formulas in WGSL.
// KpSurface must be declared by the parent brick module before this string.
// No bindings, stages, renderer, textures, geometry buffers or scene objects.
const float KP_WOOD_PI=3.141592653589793;
const float KP_WOOD_TAU=6.283185307179586;
struct KpWoodParams {
  float seed;
  float ringFrequency;
  float ringScale;
  float ringWarp;
  float fiberFrequency;
  float fineFiberFrequency;
  float poreFrequency;
  float fiberStrength;
  float colorBias;
  float roughness;
  float angleOffset;
  float textureScale;
  float grainContrast;
  float detailFineness;
  float microReliefM;
  float parallaxM;
  float macroDisplacementM;
  float reliefScale;
  float reliefQuality;
  float parallaxSteps;
  float clearcoat;
  float clearcoatRoughness;
  float specularLevel;
  float distanceFadeStart;
  float distanceFadeEnd;
  float toolPhase;
  float crackPhase;
  float knotPhase;
  vec2 pithOffset;
  vec3 darkGrainColor;
  vec3 lightGrainColor;
  vec3 agedSurfaceColor;
  vec3 weatheredColor;
  vec3 freshCutColor;
  vec3 cavityColor;
};
struct KpWoodSample {
  KpSurface surface;
  float cavity;
  float clearcoat;
  float clearcoatRoughness;
  float specularLevel;
  float macroHeightM;
  float parallaxHeight01;
};
KpWoodParams kpWoodDefaultParams() {
  KpWoodParams p;
  p.seed=0.7598925376683223;
  p.ringFrequency=22.0;
  p.ringScale=1.1240120360301806;
  p.ringWarp=1.174825141889602;
  p.fiberFrequency=8.73036012029089;
  p.fineFiberFrequency=72.0;
  p.poreFrequency=280.0;
  p.fiberStrength=0.34;
  p.colorBias=-0.015293409994337707;
  p.roughness=0.892843876922503;
  p.angleOffset=0.7194436165372647;
  p.textureScale=1.0;
  p.grainContrast=0.20902697160467504;
  p.detailFineness=1.0188769673019646;
  p.microReliefM=0.00028000000000000003;
  p.parallaxM=0.0010500000000000002;
  p.macroDisplacementM=0.0005600000000000001;
  p.reliefScale=0.7741619322448968;
  p.reliefQuality=3.0;
  p.parallaxSteps=12.0;
  p.clearcoat=0.0;
  p.clearcoatRoughness=1.0;
  p.specularLevel=0.13;
  p.distanceFadeStart=9.0;
  p.distanceFadeEnd=28.0;
  p.toolPhase=0.2499335163798811;
  p.crackPhase=1.1871775190974605;
  p.knotPhase=1.4286763223548267;
  p.pithOffset=vec2(0.04244730153121054,-0.07805894820950925);
  p.darkGrainColor=vec3(0.10224173308810132,0.06480326669290577,0.04091519690685319);
  p.lightGrainColor=vec3(0.31398871337571754,0.1946178304415758,0.11443537382697373);
  p.agedSurfaceColor=vec3(0.18782077230067787,0.13563332965520566,0.09758734714186246);
  p.weatheredColor=vec3(0.23455058216100522,0.21586050011389926,0.18782077230067787);
  p.freshCutColor=vec3(0.39157247774972326,0.26225065752969623,0.162029375639111);
  p.cavityColor=vec3(0.04091519690685319,0.027320891639074894,0.0202885630566524);
  return p;
}
float kwSaturate(float value, KpWoodParams wp, float fp) { return clamp(value, 0.0, 1.0); }

float kwHash31(vec3 pIn, KpWoodParams wp, float fp) {
  vec3 p=pIn;
  p = fract(p * 0.1031 + wp.seed * vec3(13.71, 47.13, 91.77));
  p += vec3(dot(p, p.yzx + vec3(33.33)));
  return fract((p.x + p.y) * p.z);
}

float kwValueNoise(vec3 p, KpWoodParams wp, float fp) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (vec3(3.0) - 2.0 * f);
  return mix(
    mix(mix(kwHash31(i + vec3(0,0,0), wp, fp), kwHash31(i + vec3(1,0,0), wp, fp), f.x),
        mix(kwHash31(i + vec3(0,1,0), wp, fp), kwHash31(i + vec3(1,1,0), wp, fp), f.x), f.y),
    mix(mix(kwHash31(i + vec3(0,0,1), wp, fp), kwHash31(i + vec3(1,0,1), wp, fp), f.x),
        mix(kwHash31(i + vec3(0,1,1), wp, fp), kwHash31(i + vec3(1,1,1), wp, fp), f.x), f.y),
    f.z
  );
}

float kwFbm(vec3 pIn, KpWoodParams wp, float fp) {
  vec3 p=pIn;
  float result = 0.0;
  float amplitude = 0.5;
  mat3 rotation = mat3(vec3(0.00,0.80,0.60),vec3(-0.80,0.36,-0.48),vec3(-0.60,-0.48,0.64));
  for (int i= 0; i < 5; i++) {
    result += amplitude * kwValueNoise(p, wp, fp);
    p = rotation * p * 2.03 + vec3(7.1, 3.7, 5.9);
    amplitude *= 0.5;
  }
  return result;
}

float kwAaSine(float coordinate, KpWoodParams wp, float fp) {
  float footprint = fp;
  float attenuation = 1.0 - smoothstep(0.42, 1.15, footprint);
  return 0.5 + 0.5 * sin(KP_WOOD_TAU * coordinate) * attenuation;
}

float kwAaThinLine(float coordinate, float width, KpWoodParams wp, float fp) {
  float distanceToLine = abs(sin(KP_WOOD_PI * coordinate));
  float footprint = min(0.22, fp * 0.75);
  return 1.0 - smoothstep(width + footprint, width + 0.085 + footprint, distanceToLine);
}

float kwFlatAcross(vec3 g, vec3 localNormal, KpWoodParams wp, float fp) {
  return mix(g.y, g.z, abs(localNormal.y) > abs(localNormal.z));
}

float kwFlatDepth(vec3 g, vec3 localNormal, KpWoodParams wp, float fp) {
  return mix(g.z, g.y, abs(localNormal.y) > abs(localNormal.z));
}

float kwSidePhase(vec3 g, vec2 crossPosition, vec3 localNormal, float multiplier, KpWoodParams wp, float fp) {
  return kwFlatAcross(g, localNormal, wp, fp) * wp.fiberFrequency * multiplier;
}

float kwSideAnisotropicNoise(vec3 g, vec2 crossPosition, vec3 localNormal, float axialFrequency, float crossFrequency, float phase, KpWoodParams wp, float fp) {
  float planarAcross = kwFlatAcross(g, localNormal, wp, fp);
  float planarDepth = kwFlatDepth(g, localNormal, wp, fp);
  vec3 planarCoordinate = vec3(
    g.x * axialFrequency + phase,
    planarAcross * crossFrequency + wp.seed * 4.7,
    planarDepth * 0.72 + wp.seed * 9.1
  );
  return kwFbm(planarCoordinate, wp, fp);
}

float kwSideValueNoise(vec3 g, vec2 crossPosition, vec3 localNormal, float axialFrequency, float crossFrequency, float phase, KpWoodParams wp, float fp) {
  float planarAcross = kwFlatAcross(g, localNormal, wp, fp);
  float planarDepth = kwFlatDepth(g, localNormal, wp, fp);
  vec3 planarCoordinate = vec3(
    g.x * axialFrequency + phase,
    planarAcross * crossFrequency + wp.seed * 6.3,
    planarDepth * 0.54 + wp.seed * 3.8
  );
  return kwValueNoise(planarCoordinate, wp, fp);
}

float kwRidgeFromNoise(float value, KpWoodParams wp, float fp) {
  return 1.0 - abs(value * 2.0 - 1.0);
}

float kwKnotSignal(vec3 g, vec2 crossPosition, vec3 localNormal, KpWoodParams wp, float fp) {
  float broad = kwSideAnisotropicNoise(
    g,
    crossPosition,
    localNormal,
    0.34,
    1.35,
    wp.knotPhase + 8.0
  , wp, fp);
  float compact = kwSideValueNoise(
    g,
    crossPosition,
    localNormal,
    0.72,
    2.25,
    wp.knotPhase * 0.37 + 17.0
  , wp, fp);
  return smoothstep(0.71, 0.91, broad) * smoothstep(0.58, 0.86, compact);
}

vec4 kwWoodSignals(vec3 g, vec3 localNormal, float surfaceClass, KpWoodParams wp, float fp) {
  float crossSection = step(0.72, abs(localNormal.x));

  float driftY = kwFbm(vec3(g.x * 0.24 + wp.seed * 3.1, 1.17, 7.93), wp, fp) - 0.5;
  float driftZ = kwFbm(vec3(g.x * 0.21 - wp.seed * 4.7, 9.31, 2.41), wp, fp) - 0.5;
  vec2 longWarp = vec2(driftY, driftZ) * wp.ringWarp * 0.115;
  vec2 crossPosition = g.yz + wp.pithOffset + longWarp;
  float theta = atan(crossPosition.y, crossPosition.x);

  float oval = 0.075 * sin(wp.seed * 31.0 + wp.angleOffset);
  vec2 ringPosition = crossPosition * vec2(1.0 + oval, 1.0 - oval);
  float radial = length(ringPosition);
  float ringNoise = kwFbm(vec3(
    g.x * 0.18 + wp.seed * 2.4,
    ringPosition.x * 2.2,
    ringPosition.y * 2.2
  ), wp, fp);
  float ringCoordinate = radial * wp.ringFrequency * wp.ringScale;
  ringCoordinate += (ringNoise - 0.5) * wp.ringWarp * 1.18;
  ringCoordinate += sin(theta * 2.0 + wp.seed * 13.0) * 0.12 * wp.ringWarp;
  ringCoordinate += sin(theta * 5.0 - wp.seed * 7.0) * 0.045 * wp.ringWarp;
  float ringLine = kwAaThinLine(ringCoordinate, 0.060, wp, fp);
  float ringBody = kwAaSine(ringCoordinate + (ringNoise - 0.5) * 0.16, wp, fp);
  float ring = kwSaturate(ringBody * 0.62 + ringLine * 0.38, wp, fp);

  float broad = kwSideAnisotropicNoise(g, crossPosition, localNormal, 0.18, 1.55, wp.angleOffset, wp, fp);
  float flow = kwSideAnisotropicNoise(g, crossPosition, localNormal, 0.42, 3.35, wp.seed * 11.0 + 2.4, wp, fp);
  float medium = kwSideAnisotropicNoise(g, crossPosition, localNormal, 0.88, 7.20, wp.seed * 17.0 + 4.7, wp, fp);
  float knot = kwKnotSignal(g, crossPosition, localNormal, wp, fp);

  float phaseWarp = (broad - 0.5) * 5.4 + (flow - 0.5) * 2.9;
  phaseWarp += sin(g.x * 0.58 + theta * 1.7 + wp.seed * 19.0) * 0.50;
  phaseWarp += knot * (4.0 + 1.6 * sin(g.x * 1.05 + wp.knotPhase));

  float coarseLine = kwAaThinLine(
    kwSidePhase(g, crossPosition, localNormal, 0.58, wp, fp) + phaseWarp + wp.angleOffset / KP_WOOD_TAU,
    0.065
  , wp, fp);
  float coarseVein = kwRidgeFromNoise(flow, wp, fp);
  float coarseFiber = kwSaturate(
    broad * 0.47 +
    coarseVein * 0.31 +
    coarseLine * 0.22
  , wp, fp);

  float mediumLine = kwAaThinLine(
    kwSidePhase(g, crossPosition, localNormal, 1.85, wp, fp) + phaseWarp * 1.72 + wp.seed * 7.0,
    0.040
  , wp, fp);
  float mediumFiber = kwSaturate(
    medium * 0.47 +
    kwRidgeFromNoise(flow * 0.62 + medium * 0.38, wp, fp) * 0.37 +
    mediumLine * 0.16
  , wp, fp);

  float crackGate = smoothstep(
    0.79,
    0.94,
    kwSideValueNoise(g, crossPosition, localNormal, 0.32, 3.1, wp.crackPhase + 13.0, wp, fp)
  );
  float sideCrack = kwAaThinLine(
    kwSidePhase(g, crossPosition, localNormal, 0.17, wp, fp)
      + phaseWarp * 0.16
      + wp.crackPhase / KP_WOOD_TAU,
    0.014
  , wp, fp) * crackGate;
  float radialGate = smoothstep(
    0.72,
    0.93,
    kwValueNoise(vec3(radial * 1.9, g.x * 0.27, wp.seed * 9.0), wp, fp)
  );
  float radialCrack = pow(max(0.0, sin(theta * 7.0 + wp.crackPhase)), 26.0)
    * smoothstep(0.08, 0.27, radial)
    * radialGate;
  float cracks = mix(sideCrack, max(sideCrack * 0.12, radialCrack), crossSection);

  return vec4(ring, coarseFiber, mediumFiber, cracks);
}

vec4 kwSecondarySignals(vec3 g, vec3 localNormal, KpWoodParams wp, float fp) {
  vec2 crossPosition = g.yz + wp.pithOffset;
  float broadWarp = kwSideAnisotropicNoise(
    g,
    crossPosition,
    localNormal,
    0.46,
    4.4,
    wp.seed * 21.0 + 1.7
  , wp, fp);
  float fineNoise = kwSideAnisotropicNoise(
    g,
    crossPosition,
    localNormal,
    1.55,
    18.0 * max(wp.detailFineness, 0.45),
    wp.seed * 29.0 + 5.3
  , wp, fp);
  float fineLine = kwAaThinLine(
    kwSidePhase(g, crossPosition, localNormal, 4.6 * max(wp.detailFineness, 0.45), wp, fp)
      + (broadWarp - 0.5) * 8.5
      + wp.seed * 19.0,
    0.026
  , wp, fp);
  float fineFiber = kwSaturate(
    fineNoise * 0.53 +
    kwRidgeFromNoise(fineNoise, wp, fp) * 0.30 +
    fineLine * 0.17
  , wp, fp);

  float poreNoise = kwSideValueNoise(
    g,
    crossPosition,
    localNormal,
    4.2 * max(wp.detailFineness, 0.45),
    38.0 * max(wp.detailFineness, 0.45),
    wp.seed * 23.0 + 11.0
  , wp, fp);
  float poreGate = kwSideValueNoise(
    g,
    crossPosition,
    localNormal,
    0.85,
    7.0,
    wp.seed * 31.0 + 2.0
  , wp, fp);
  float pores = smoothstep(0.865, 0.982, poreNoise)
    * smoothstep(0.52, 0.82, poreGate);

  float toolWave = kwAaSine(g.x * 1.45 + kwFlatAcross(g, localNormal, wp, fp) * 0.22 + wp.toolPhase / KP_WOOD_TAU, wp, fp);
  float toolMask = smoothstep(
    0.79,
    0.96,
    kwSideValueNoise(g, crossPosition, localNormal, 0.54, 2.3, wp.toolPhase + 5.0, wp, fp)
  );
  float tool = toolWave * toolMask;

  float knot = kwKnotSignal(g, crossPosition, localNormal, wp, fp);
  return vec4(fineFiber, pores, tool, knot);
}

float kwMacroSignal(vec3 g, KpWoodParams wp, float fp) {
  return kwFbm(g * vec3(0.12, 0.70, 0.70) + vec3(wp.seed * 5.0), wp, fp);
}

float kwCoarseRelief(vec3 g, vec3 localNormal, float surfaceClass, KpWoodParams wp, float fp) {
  float crossSection = step(0.72, abs(localNormal.x));
  vec2 crossPosition = g.yz + wp.pithOffset;
  float theta = atan(crossPosition.y, crossPosition.x);
  float radial = length(crossPosition);

  float broadWarp = kwValueNoise(vec3(g.x * 0.18, crossPosition * 2.4) + vec3(wp.seed * 3.1), wp, fp);
  float sideBand = kwAaSine(
    kwSidePhase(g, crossPosition, localNormal, 0.62, wp, fp)
    + (broadWarp - 0.5) * 3.2
    + wp.angleOffset / KP_WOOD_TAU
  , wp, fp);
  float ringBand = kwAaSine(
    radial * wp.ringFrequency * wp.ringScale
    + (broadWarp - 0.5) * wp.ringWarp * 0.55
  , wp, fp);
  float sparseGate = smoothstep(
    0.84,
    0.965,
    kwValueNoise(vec3(g.x * 0.31 + wp.crackPhase, crossPosition * 4.1), wp, fp)
  );
  float sideCrack = kwAaThinLine(
    kwSidePhase(g, crossPosition, localNormal, 0.20, wp, fp)
    + (broadWarp - 0.5) * 0.22
    + wp.crackPhase / KP_WOOD_TAU,
    0.015
  , wp, fp) * sparseGate;
  float radialCrack = pow(max(0.0, sin(theta * 7.0 + wp.crackPhase)), 24.0)
    * smoothstep(0.08, 0.28, radial)
    * sparseGate;

  float sideHeight = (sideBand - 0.5) * 0.36 - sideCrack * 0.60;
  float endHeight = (ringBand - 0.5) * 0.34 - radialCrack * 0.68;
  return kwSaturate(0.5 + mix(sideHeight, endHeight, crossSection), wp, fp);
}

float kwVertexHash(vec3 pIn, KpWoodParams wp, float fp) {
  vec3 p=pIn;
  p = fract(p * 0.1031 + wp.seed * vec3(17.17, 41.73, 83.11));
  p += vec3(dot(p, p.yzx + vec3(31.32)));
  return fract((p.x + p.y) * p.z);
}

float kwVertexNoise(vec3 p, KpWoodParams wp, float fp) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (vec3(3.0) - 2.0 * f);
  return mix(
    mix(mix(kwVertexHash(i + vec3(0,0,0), wp, fp), kwVertexHash(i + vec3(1,0,0), wp, fp), f.x),
        mix(kwVertexHash(i + vec3(0,1,0), wp, fp), kwVertexHash(i + vec3(1,1,0), wp, fp), f.x), f.y),
    mix(mix(kwVertexHash(i + vec3(0,0,1), wp, fp), kwVertexHash(i + vec3(1,0,1), wp, fp), f.x),
        mix(kwVertexHash(i + vec3(0,1,1), wp, fp), kwVertexHash(i + vec3(1,1,1), wp, fp), f.x), f.y),
    f.z
  );
}

float kwMacroField(vec3 pIn, KpWoodParams wp, float fp) {
  vec3 p=pIn;
  float result = 0.0;
  float amplitude = 0.58;
  for (int i= 0; i < 3; i++) {
    result += amplitude * kwVertexNoise(p, wp, fp);
    p = p * 2.07 + vec3(5.2, 9.1, 3.7);
    amplitude *= 0.45;
  }
  return result / 0.94;
}

// pSourceM = member-local metres + inherited source grainOffset, +X axial.
// Signed normal displacement; use only this function in the geometry distance.
float kpWoodMacroDisplacement(vec3 pSourceM, float surfaceClass, KpWoodParams wp) {
  float fp=0.0;
  vec3 grain=pSourceM*max(wp.textureScale,0.001);
    float broad = kwMacroField(grain * vec3(0.28, 1.15, 1.15) + vec3(wp.seed * 7.0), wp, fp);
    float longWave = 0.5 + 0.5 * sin(grain.x * 0.82 + wp.seed * 29.0 + broad * 1.55);
    float macroHeight = (broad - 0.5) * 0.78 + (longWave - 0.5) * 0.22;
    float classWeight = 1.0;
    if (surfaceClass > 0.5 && surfaceClass < 2.5) { classWeight = 0.0; }
    else if (surfaceClass > 2.5 && surfaceClass < 3.5) { classWeight = 1.08; }
  return macroHeight * wp.macroDisplacementM * wp.reliefScale * classWeight;
}
// Conservative magnitude bound for the original vertex displacement, in metres.
// Source macro noise is nonnegative with sum (0.58+0.261+0.11745)/0.94;
// original normal class multiplier is at most 1.08. This is not a Lipschitz bound.
float kpWoodMacroDisplacementBound(KpWoodParams wp) {
  return 0.557*abs(wp.macroDisplacementM*wp.reliefScale);
}
// New screen-independent AA bridge. This is a nominal physical frequency estimate,
// not the original screen derivative and not a proof of derivative equivalence.
// fp=0 preserves the unfiltered original field exactly (up to float arithmetic).
float kpWoodCoordinateFootprint(float physicalFootprintM,KpWoodParams wp) {
  return max(physicalFootprintM,0.0)*max(wp.textureScale,0.001)*max(wp.ringFrequency*wp.ringScale,wp.fiberFrequency*4.6*max(wp.detailFineness,0.45));
}
// Complete source material terms before source-specific lighting or gamma.
// The caller supplies the actual member-local surface normal and face class.
// 0=longitudinal, 1=end grain, 2=joint cut, 3=weathered side.
// No camera-ray parallax march is hidden in this pure field call.
KpWoodSample kpWoodOriginalSample(vec3 pSourceM,vec3 normalIn,float surfaceClass,KpWoodParams wp,float physicalFootprintM,float cameraDistanceM) {
  vec3 localNormal=normalize(normalIn);
  vec3 g=pSourceM*max(wp.textureScale,0.001);
  float fp=kpWoodCoordinateFootprint(physicalFootprintM,wp);
  vec3 baseColor=vec3(0.0);
  float heightMeters=0.0;
  float roughness=wp.roughness;
  float cavity=1.0;
    vec4 signals = kwWoodSignals(g, localNormal, surfaceClass, wp, fp);
    vec4 secondary = kwSecondarySignals(g, localNormal, wp, fp);
    float ring = signals.x;
    float coarseFiber = signals.y;
    float mediumFiber = signals.z;
    float cracks = signals.w;
    float fineFiber = secondary.x;
    float pores = secondary.y;
    float tool = secondary.z;
    float knot = secondary.w;
    float macroTone = kwMacroSignal(g, wp, fp);

    float crossSection = step(0.72, abs(localNormal.x));
    vec2 crossPosition = g.yz + wp.pithOffset;
    float radial = length(crossPosition);
    float endRay = kwAaSine(atan(crossPosition.y, crossPosition.x) * 3.0 / KP_WOOD_TAU + radial * 2.0 + wp.seed * 7.0, wp, fp);

    float longitudinalTone =
      (coarseFiber - 0.5) * 1.02 +
      (mediumFiber - 0.5) * 0.43 +
      (macroTone - 0.5) * 0.56 +
      (fineFiber - 0.5) * 0.11 +
      knot * 0.26 -
      cracks * 0.70 -
      pores * 0.08;
    float endTone =
      (ring - 0.5) * 1.08 +
      (endRay - 0.5) * 0.19 +
      (macroTone - 0.5) * 0.38 -
      cracks * 0.72 -
      pores * 0.05;
    float grainTone = mix(longitudinalTone, endTone, crossSection) + wp.colorBias;
    float grainMix = kwSaturate(0.50 + grainTone * wp.grainContrast * 2.72, wp, fp);
    vec3 grainColor = mix(wp.lightGrainColor, wp.darkGrainColor, grainMix);
    baseColor = mix(wp.agedSurfaceColor, grainColor, 0.78);

    if (surfaceClass > 0.5 && surfaceClass < 1.5) {
      baseColor = mix(baseColor, wp.freshCutColor, 0.20);
    } else if (surfaceClass > 1.5 && surfaceClass < 2.5) {
      baseColor = mix(baseColor, wp.freshCutColor, 0.27);
    } else if (surfaceClass > 2.5 && surfaceClass < 3.5) {
      baseColor = mix(baseColor, wp.weatheredColor, 0.53);
      roughness = min(0.98, roughness + 0.045);
    }

    baseColor *= 0.905 + macroTone * 0.19;
    baseColor = mix(baseColor, wp.cavityColor, cracks * 0.40 + pores * 0.065 + knot * 0.025);

    float distanceToCamera = cameraDistanceM;
    float detailFade = 1.0 - smoothstep(wp.distanceFadeStart, wp.distanceFadeEnd, distanceToCamera);
    float sideMicro =
      (coarseFiber - 0.5) * 0.32 +
      (mediumFiber - 0.5) * 0.24 +
      (fineFiber - 0.5) * 0.12 -
      pores * 0.30 -
      cracks * 0.94 -
      tool * 0.13 +
      knot * 0.09;
    float endMicro =
      (ring - 0.5) * 0.34 +
      (fineFiber - 0.5) * 0.05 -
      pores * 0.22 -
      cracks * 1.0;
    float microSignal = mix(sideMicro, endMicro, crossSection);
    heightMeters = microSignal * wp.microReliefM * wp.reliefScale * detailFade;

    roughness = clamp(
      roughness + pores * 0.045 + cracks * 0.075 + (0.5 - macroTone) * 0.022 - wp.clearcoat * 0.085,
      0.18,
      0.98
    );
    cavity = clamp(1.0 - cracks * 0.34 - pores * 0.06 - ring * crossSection * 0.035, 0.60, 1.0);

  return KpWoodSample(KpSurface(heightMeters,baseColor,roughness),cavity,wp.clearcoat,wp.clearcoatRoughness,wp.specularLevel,kpWoodMacroDisplacement(pSourceM,surfaceClass,wp),kwCoarseRelief(g,localNormal,surfaceClass,wp,fp));
}
KpSurface kpWoodOriginalSurface(vec3 pSourceM,vec3 localNormal,float surfaceClass,KpWoodParams wp,float footprintM,float cameraDistanceM) {
  return kpWoodOriginalSample(pSourceM,localNormal,surfaceClass,wp,footprintM,cameraDistanceM).surface;
}
// Original fragment micro-height: PBR normal detail, NOT a replacement for macro geometry.
float kpWoodHeight(vec3 pSourceM,vec3 localNormal,float surfaceClass,KpWoodParams wp,float footprintM,float cameraDistanceM) {
  return kpWoodOriginalSurface(pSourceM,localNormal,surfaceClass,wp,footprintM,cameraDistanceM).height;
}
// Compatibility entry: top longitudinal face of the original default box timber.
// age/wet/repair are reserved host arguments; the original v3 has no such model.
// Scene overlays must be explicit outside this source-preserving material leaf.
KpSurface kpWoodSurface(vec3 pLocalM,float age,float wet,float repair,float footprintM) {
  return kpWoodOriginalSurface(pLocalM,vec3(0.0,1.0,0.0),0.0,kpWoodDefaultParams(),footprintM,0.0);
}
