(() => {
'use strict';
const { decodeI16LE, buildDenseTruth, parseWater } = window.LandscapeMotherKernelCore;
const { deriveFields } = window.LandscapeMotherKernelFields;

function compile({ contract, dataManifest, truthBuffer, waterBuffer, mobile = false }) {
  const truth = decodeI16LE(truthBuffer);
  const truthWidth = dataManifest.truth.grid[0];
  const truthHeight = dataManifest.truth.grid[1];
  if (truth.length !== truthWidth * truthHeight) throw new Error('truth sample count mismatch');
  if (truthWidth !== truthHeight) throw new Error('Landscape Mother sample currently requires a square truth grid');

  const subdivision = mobile ? contract.sample.mobileSubdivision : contract.sample.desktopSubdivision;
  const spacing = contract.sample.truthSpacingM / subdivision;
  const denseResult = buildDenseTruth(truth, truthWidth, subdivision);
  if (denseResult.sourceNodeMaxError > contract.displacementBudget.sourceNodeMaxErrorM) {
    throw new Error(`truth interpolation anchor error ${denseResult.sourceNodeMaxError} m`);
  }

  const segments = parseWater(waterBuffer, dataManifest);
  if (!segments.length) throw new Error('sample contains no immutable waterway segments');
  const derived = deriveFields(
    denseResult.dense,
    denseResult.grid,
    spacing,
    subdivision,
    dataManifest,
    contract,
    segments,
  );

  const budget = contract.displacementBudget;
  const receipt = derived.receipt;
  if (receipt.sourceNodeMaxErrorM > budget.sourceNodeMaxErrorM) throw new Error('source node displacement budget failed');
  if (receipt.sourceCellMeanMaxAbsDeltaM > budget.sourceCellMeanAbsDeltaM) throw new Error('source cell mean displacement budget failed');
  if (receipt.macroBlurMaxAbsDeltaM > budget.macroBlurMaxAbsDeltaM) throw new Error('macro blur displacement budget failed');
  if (receipt.peakShiftM > budget.peakShiftMaxM) throw new Error('peak location shift budget failed');

  return {
    contract,
    dataManifest,
    mobile,
    truth,
    denseTruth: denseResult.dense,
    grid: denseResult.grid,
    spacing,
    subdivision,
    sideM: dataManifest.sideM,
    center: dataManifest.center,
    segments,
    ...derived,
  };
}

window.LandscapeMotherKernel = Object.freeze({
  version: '1.0.0',
  compile,
});
})();
