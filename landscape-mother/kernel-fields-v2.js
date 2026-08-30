(() => {
'use strict';
const base = window.LandscapeMotherKernelFields;
const evaluator = window.LandscapeMotherFieldEvaluator;
if (!base || !evaluator?.getLastContext) throw new Error('Landscape Mother V2 field collector dependencies are missing');

function fieldHash(fields, count) {
  let hash = 2166136261 >>> 0;
  const names = ['structure', 'weather', 'cavity', 'protrusion', 'separation', 'colorDriver'];
  const step = Math.max(1, Math.floor(count / 8192));
  for (let index = 0; index < count; index += step) {
    for (const name of names) {
      const value = Math.round((fields[name]?.[index] || 0) * 65535) >>> 0;
      hash ^= value & 255;
      hash = Math.imul(hash, 16777619) >>> 0;
      hash ^= (value >>> 8) & 255;
      hash = Math.imul(hash, 16777619) >>> 0;
    }
  }
  return hash.toString(16).padStart(8, '0');
}

function rangeOf(values) {
  let minimum = Infinity;
  let maximum = -Infinity;
  for (const value of values || []) {
    minimum = Math.min(minimum, value);
    maximum = Math.max(maximum, value);
  }
  return [
    Number.isFinite(minimum) ? minimum : 0,
    Number.isFinite(maximum) ? maximum : 0,
  ];
}

function deriveFields(...args) {
  const result = base.deriveFields(...args);
  const context = evaluator.getLastContext();
  if (!context?.arrays) throw new Error('Landscape Mother V2 field context was not retained');
  for (const name of evaluator.extraFieldNames) result.fields[name] = context.arrays[name];
  result.receipt.fieldGraphVersion = context.cache.fieldGraphVersion || '1.0.0';
  result.receipt.fieldGraphHash = fieldHash(result.fields, context.denseTruth.length);
  result.receipt.diagnosticFieldCount = Object.keys(result.fields).length;
  result.receipt.seedChannelCount = Object.keys(context.cache.seedBank || {}).length;
  result.receipt.seedBank = { ...(context.cache.seedBank || {}) };
  result.receipt.parentMaskRange = rangeOf(result.fields.parentMask);
  result.receipt.processMaskRange = rangeOf(result.fields.processMask);
  result.receipt.eventDeltaRangeM = [
    Number.isFinite(context.fieldGraphStats.eventDeltaMin) ? context.fieldGraphStats.eventDeltaMin : 0,
    Number.isFinite(context.fieldGraphStats.eventDeltaMax) ? context.fieldGraphStats.eventDeltaMax : 0,
  ];
  result.receipt.fieldPipeline = [
    'source',
    'shape',
    'data-and-mask',
    'color',
    'render',
    'qa',
  ];
  return result;
}

window.LandscapeMotherKernelFields = Object.freeze({
  ...base,
  deriveFields,
});
})();
