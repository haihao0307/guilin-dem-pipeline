(() => {
'use strict';
const base = window.LandscapeMotherFieldEvaluator;
const core = window.LandscapeMotherKernelCore;
const cacheApi = window.LandscapeMotherFormationCache;
if (!base || !core || !cacheApi) throw new Error('Landscape Mother V2 evaluator dependencies are missing');

let lastContext = null;

const extraFieldNames = [
  'parentMask', 'processMask', 'structure', 'weather', 'microEvent',
  'cavity', 'protrusion', 'separation', 'colorDriver',
  'roughnessDriver', 'aoDriver',
];

function createFieldContext(...args) {
  const context = base.createFieldContext(...args);
  for (const name of extraFieldNames) context.arrays[name] = new Float32Array(context.denseTruth.length);
  lastContext = context;
  context.fieldGraphStats = {
    eventDeltaMin: Infinity,
    eventDeltaMax: -Infinity,
    parentMaskMin: Infinity,
    parentMaskMax: -Infinity,
  };
  return context;
}

function evaluatePoint(context, row, column) {
  base.evaluatePoint(context, row, column);
  const { grid, spacing, arrays, cache, segments } = context;
  const index = row * grid + column;
  const x = column * spacing - context.side * 0.5;
  const z = row * spacing - context.side * 0.5;
  const waterDistance = core.nearestWaterDistance(x, z, segments);
  const waterCore = 1 - core.smoothstep(3.5, 22, waterDistance);
  const waterInfluence = Math.exp(-waterDistance / 105);
  const sample = name => cacheApi.sample(cache, cache.arrays[name], x, z);
  const macro = sample('graphMacro');
  const structure = sample('graphStructure');
  const micro = sample('graphMicro');
  const weather = sample('graphWeather');
  const cavity = sample('graphCavity');
  const protrusion = sample('graphProtrusion');
  const separation = sample('graphSeparation');
  const colorDriver = sample('graphColorDriver');

  const rock = arrays.rock[index];
  const paddy = arrays.paddy[index];
  const alluvium = arrays.alluvium[index];
  const parentMask = core.clamp((1 - waterCore) * (0.24 + Math.max(rock, paddy, alluvium) * 0.76), 0, 1);
  const processMask = core.clamp(parentMask * Math.max(rock, paddy * 0.82, alluvium * 0.68), 0, 1);
  const envelope = base.cellEnvelope(column, row, context.subdivision);

  const rockEvent = (
    (protrusion - 0.5) * 0.13 -
    cavity * 0.085 -
    separation * 0.032 +
    (structure - 0.5) * 0.055
  ) * rock * parentMask;
  const soilEvent = (
    (macro - 0.5) * 0.025 -
    cavity * 0.012 +
    weather * 0.008
  ) * alluvium * parentMask;
  const eventSurface = core.clamp(
    envelope * (rockEvent + soilEvent),
    -0.16,
    0.13,
  );
  const eventField = core.clamp(
    envelope * paddy * parentMask * ((macro - 0.5) * 0.018 + (separation - 0.5) * 0.010),
    -0.025,
    0.025,
  );

  const surfaceBudget = context.contract.displacementBudget.surfaceMaxAbsM;
  const fieldBudget = context.contract.displacementBudget.fieldMaxAbsM;
  arrays.surfaceDelta[index] = core.clamp(arrays.surfaceDelta[index] + eventSurface, -surfaceBudget, surfaceBudget);
  arrays.fieldDelta[index] = core.clamp(arrays.fieldDelta[index] + eventField, -fieldBudget, fieldBudget);
  arrays.displacement[index] = arrays.surfaceDelta[index] + arrays.fieldDelta[index];
  arrays.enhanced[index] = context.denseTruth[index] + arrays.displacement[index];

  arrays.fracture[index] = core.clamp(
    Math.max(arrays.fracture[index], separation * rock * 0.68, cavity * rock * 0.34),
    0, 1,
  );
  arrays.strata[index] = core.clamp(arrays.strata[index] * (0.78 + structure * 0.22), 0, 1);
  arrays.wet[index] = core.clamp(arrays.wet[index] + weather * alluvium * 0.085 + waterInfluence * 0.018, 0, 1);
  arrays.sediment[index] = core.clamp(arrays.sediment[index] + cavity * alluvium * 0.11 + weather * alluvium * 0.035, 0, 1);
  arrays.flow[index] = core.clamp(arrays.flow[index] + weather * waterInfluence * 0.055, 0, 1);

  arrays.parentMask[index] = parentMask;
  arrays.processMask[index] = processMask;
  arrays.structure[index] = structure;
  arrays.weather[index] = weather;
  arrays.microEvent[index] = micro;
  arrays.cavity[index] = cavity;
  arrays.protrusion[index] = protrusion;
  arrays.separation[index] = separation;
  arrays.colorDriver[index] = colorDriver;
  arrays.roughnessDriver[index] = core.clamp(
    0.30 + rock * 0.34 + separation * 0.17 + cavity * 0.13 - arrays.wet[index] * 0.22,
    0, 1,
  );
  arrays.aoDriver[index] = core.clamp(
    cavity * 0.52 + arrays.fracture[index] * 0.24 + Math.max(0, -arrays.curvature[index]) * 0.20,
    0, 1,
  );

  const stats = context.fieldGraphStats;
  stats.eventDeltaMin = Math.min(stats.eventDeltaMin, eventSurface + eventField);
  stats.eventDeltaMax = Math.max(stats.eventDeltaMax, eventSurface + eventField);
  stats.parentMaskMin = Math.min(stats.parentMaskMin, parentMask);
  stats.parentMaskMax = Math.max(stats.parentMaskMax, parentMask);
}

window.LandscapeMotherFieldEvaluator = Object.freeze({
  ...base,
  createFieldContext,
  evaluatePoint,
  extraFieldNames: Object.freeze(extraFieldNames.slice()),
  getLastContext: () => lastContext,
});
})();
