import assert from 'node:assert/strict';

const KERNEL = 0.3;
const EIGEN_FLOOR = 1e-7;
const SCALE_CAP = 1024;
const CUTOFF2 = 4;

const clamp01 = (x) => Math.min(1, Math.max(0, x));

function colorSource(dc, sh) {
  return dc.map((v, i) => clamp01(v + sh[i]));
}

function colorR186(dc, sh) {
  return dc.map((v, i) => clamp01(clamp01(v) + sh[i]));
}

function ellipseFromBase([aBase, b, cBase]) {
  const a = aBase + KERNEL;
  const c = cBase + KERNEL;
  const detBase = aBase * cBase - b * b;
  const det = a * c - b * b;
  const alphaScale = Math.sqrt(Math.max(detBase / Math.max(det, 1e-6), 0));
  const halfTrace = 0.5 * (a + c);
  const radius = Math.sqrt(Math.max((0.5 * (a - c)) ** 2 + b * b, EIGEN_FLOOR));
  const lambda1 = Math.max(halfTrace + radius, EIGEN_FLOOR);
  const lambda2 = Math.max(halfTrace - radius, EIGEN_FLOOR);
  const angle = 0.5 * Math.atan2(2 * b, a - c);
  return {
    aBase, b, cBase, detBase, det, alphaScale, angle,
    rawScale1: Math.sqrt(lambda1), rawScale2: Math.sqrt(lambda2),
    scale1: Math.min(Math.sqrt(lambda1), SCALE_CAP),
    scale2: Math.min(Math.sqrt(lambda2), SCALE_CAP)
  };
}

function splatSample(splat, x, y, useDecodedEllipse, useR186Color) {
  const e = useDecodedEllipse ? splat.decodedEllipse : splat.sourceEllipse;
  const dx = x - splat.center[0];
  const dy = y - splat.center[1];
  const ca = Math.cos(e.angle);
  const sa = Math.sin(e.angle);
  const u = (dx * ca + dy * sa) / e.scale1;
  const v = (-dx * sa + dy * ca) / e.scale2;
  const r2 = u * u + v * v;
  if (r2 > CUTOFF2) return [0, 0, 0, 0];
  const rgb = useR186Color ? splat.viewerColor : splat.sourceColor;
  const alpha = Math.exp(-0.5 * r2) * splat.opacity * e.alphaScale;
  return [rgb[0], rgb[1], rgb[2], alpha];
}

function over(dst, src) {
  const oneMinus = 1 - src[3];
  return [
    src[0] * src[3] + dst[0] * oneMinus,
    src[1] * src[3] + dst[1] * oneMinus,
    src[2] * src[3] + dst[2] * oneMinus,
    src[3] + dst[3] * oneMinus
  ];
}

function render(splats, order, options = {}) {
  const size = options.size ?? 33;
  const out = [];
  for (let iy = 0; iy < size; iy++) {
    for (let ix = 0; ix < size; ix++) {
      const x = ix - Math.floor(size / 2);
      const y = iy - Math.floor(size / 2);
      let rgba = [0, 0, 0, 0];
      for (const index of order) {
        rgba = over(rgba, splatSample(
          splats[index], x, y,
          options.useDecodedEllipse === true,
          options.useR186Color === true
        ));
      }
      out.push(rgba);
    }
  }
  return out;
}

function diffMetrics(reference, candidate) {
  let maxRgb = 0;
  let maxAlpha = 0;
  let sumSqRgb = 0;
  for (let i = 0; i < reference.length; i++) {
    for (let c = 0; c < 3; c++) {
      const d = Math.abs(reference[i][c] - candidate[i][c]);
      maxRgb = Math.max(maxRgb, d);
      sumSqRgb += d * d;
    }
    maxAlpha = Math.max(maxAlpha, Math.abs(reference[i][3] - candidate[i][3]));
  }
  return { maxRgbAbs: maxRgb, rgbRmse: Math.sqrt(sumSqRgb / (reference.length * 3)), maxAlphaAbs: maxAlpha };
}

function maxInteractionResidual(reference, dc, order, ellipse, combined) {
  let maxRgb = 0;
  for (let i = 0; i < reference.length; i++) {
    for (let c = 0; c < 3; c++) {
      const additive = (dc[i][c] - reference[i][c]) +
        (order[i][c] - reference[i][c]) +
        (ellipse[i][c] - reference[i][c]);
      const residual = (combined[i][c] - reference[i][c]) - additive;
      maxRgb = Math.max(maxRgb, Math.abs(residual));
    }
  }
  return maxRgb;
}

const splats = [
  {
    center: [0, 0], depth: 50,
    dc: [-0.2, 0.05, 0.05], sh: [0.8, 0, 0], opacity: 0.5,
    sourceEllipse: ellipseFromBase([16, 0, 4]),
    decodedEllipse: ellipseFromBase([18, 0.8, 3.2])
  },
  {
    center: [0.35, -0.2], depth: 50.000001,
    dc: [1.2, 0.05, 0.05], sh: [-0.8, 0, 0], opacity: 0.5,
    sourceEllipse: ellipseFromBase([9, 0.4, 2.25]),
    decodedEllipse: ellipseFromBase([7.5, -0.4, 3])
  }
];

for (const s of splats) {
  s.sourceColor = colorSource(s.dc, s.sh);
  s.viewerColor = colorR186(s.dc, s.sh);
}

const exactBackToFront = [1, 0];
const sameBinInputOrder = [0, 1];
const reference = render(splats, exactBackToFront);
const dcOnly = render(splats, exactBackToFront, { useR186Color: true });
const orderOnly = render(splats, sameBinInputOrder);
const ellipseOnly = render(splats, exactBackToFront, { useDecodedEllipse: true });
const combined = render(splats, sameBinInputOrder, { useR186Color: true, useDecodedEllipse: true });

const ablations = {
  dcOnly: diffMetrics(reference, dcOnly),
  orderOnly: diffMetrics(reference, orderOnly),
  ellipseOnly: diffMetrics(reference, ellipseOnly),
  combined: diffMetrics(reference, combined)
};

const centerIndex = 16 * 33 + 16;
const center = {
  reference: reference[centerIndex],
  dcOnly: dcOnly[centerIndex],
  orderOnly: orderOnly[centerIndex],
  ellipseOnly: ellipseOnly[centerIndex],
  combined: combined[centerIndex]
};

const tinyBaseScale = 0.00341945566911428;
const tinyVariance = tinyBaseScale ** 2;
const tinyEllipse = ellipseFromBase([tinyVariance, 0, tinyVariance]);
const tinyCenterAlpha = tinyEllipse.alphaScale;
const halfPixelR2 = 2 * (0.5 / tinyEllipse.scale1) ** 2;
const tinyHalfPixelAlpha = halfPixelR2 <= CUTOFF2 ? Math.exp(-0.5 * halfPixelR2) * tinyEllipse.alphaScale : 0;
const continuousMassProxyBefore = tinyVariance;
const continuousMassProxyAfter = tinyEllipse.alphaScale * Math.sqrt(tinyEllipse.det);

const capSourceMajor = 1499.68672723382;
const capSource = ellipseFromBase([capSourceMajor ** 2 - KERNEL, 0, 10 ** 2 - KERNEL]);
const capDecoded = ellipseFromBase([1453.61891487762 ** 2 - KERNEL, 0, 10 ** 2 - KERNEL]);

const result = {
  schema: 'kaopu-gaussian-reference-compositor-probe/r47',
  status: 'Candidate-pass',
  sources: {
    threeRevision: '148ef33ecb6d2502ff796d4554abd1549c95d519',
    spzRevision: 'affd0ecea7fbb4c265ee119475af7ee5b2997482'
  },
  fixture: {
    imagePixels: [33, 33],
    splats: 2,
    exactBackToFront,
    sameBinInputOrder,
    note: 'Derived stress control; not a learned asset, GPU image, or acceptance threshold.'
  },
  ablations,
  centerPixel: center,
  maxRgbNonAdditiveInteractionResidual: maxInteractionResidual(reference, dcOnly, orderOnly, ellipseOnly, combined),
  tinyFootprint: {
    baseScalePixels: tinyBaseScale,
    r186ScaleAfterKernelPixels: tinyEllipse.scale1,
    r186AlphaScaleAtCenter: tinyCenterAlpha,
    r186AlphaAtHalfPixelDiagonalOffset: tinyHalfPixelAlpha,
    continuousMassProxyBefore,
    continuousMassProxyAfter,
    relativeMassProxyError: Math.abs(continuousMassProxyAfter - continuousMassProxyBefore) / continuousMassProxyBefore
  },
  capMask: {
    sourceRawMajorScalePixels: capSource.rawScale1,
    decodedRawMajorScalePixels: capDecoded.rawScale1,
    rawDifferencePixels: Math.abs(capSource.rawScale1 - capDecoded.rawScale1),
    sourceDisplayedMajorScalePixels: capSource.scale1,
    decodedDisplayedMajorScalePixels: capDecoded.scale1,
    displayedDifferencePixels: Math.abs(capSource.scale1 - capDecoded.scale1)
  },
  checks: {
    combinedImageErrorExceedsEverySingleAblation: ablations.combined.maxRgbAbs > Math.max(ablations.dcOnly.maxRgbAbs, ablations.orderOnly.maxRgbAbs, ablations.ellipseOnly.maxRgbAbs),
    componentErrorsAreNonAdditive: maxInteractionResidual(reference, dcOnly, orderOnly, ellipseOnly, combined) > 1e-6,
    kernelPreservesContinuousMassProxyForIsotropicFixture: Math.abs(continuousMassProxyAfter - continuousMassProxyBefore) < 1e-15,
    kernelExpansionDoesNotImplyOpaquePixel: tinyCenterAlpha < 0.001,
    capCanEraseDisplayedAxisDifference: capSource.scale1 === capDecoded.scale1 && capSource.rawScale1 !== capDecoded.rawScale1
  },
  limits: {
    directTslOrGpuRasterization: false,
    browserOrTargetDevice: false,
    realPhotoOrLearnedAsset: false,
    humanAcceptance: false
  }
};

assert.equal(Object.values(result.checks).every(Boolean), true);
console.log(JSON.stringify(result, null, 2));
