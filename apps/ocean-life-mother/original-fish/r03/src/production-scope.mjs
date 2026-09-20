const HARD_FLOOR_MM = 20;
const PRIMARY_FLOOR_MM = 30;
const PRIMARY_CEILING_MM = 100;

export function classifyGameVisibleSize(lengthMm) {
  if (typeof lengthMm !== 'number' || !Number.isFinite(lengthMm) || lengthMm <= 0) {
    throw new Error('lengthMm:positive_finite_required');
  }
  if (lengthMm < HARD_FLOOR_MM) return {status:'OUT_OF_SCOPE_GAME_INVISIBLE', lengthMm};
  if (lengthMm < PRIMARY_FLOOR_MM) return {status:'VISIBLE_EDGE', lengthMm};
  if (lengthMm <= PRIMARY_CEILING_MM) return {status:'PRIMARY_REEF_FISH_BAND', lengthMm};
  return {status:'LATER_LARGE_FISH_BAND', lengthMm};
}

function validateSample(s, i) {
  if (!s || typeof s !== 'object') throw new Error('sample['+i+']:object_required');
  if (typeof s.lengthMm !== 'number' || !Number.isFinite(s.lengthMm) || s.lengthMm <= 0) {
    throw new Error('sample['+i+'].lengthMm:positive_finite_required');
  }
  if (!['TL','FL','SL'].includes(s.lengthDefinition)) {
    throw new Error('sample['+i+'].lengthDefinition:TL_FL_SL_required');
  }
  if (typeof s.sourceId !== 'string' || !s.sourceId.trim()) {
    throw new Error('sample['+i+'].sourceId:required');
  }
  return s;
}

export function chooseSizeProductionMode(samples, targetLengthMm) {
  classifyGameVisibleSize(targetLengthMm);
  if (!Array.isArray(samples) || samples.length === 0) {
    return {mode:'UNSUPPORTED_NO_MEASUREMENT', targetLengthMm};
  }
  const list = samples.map(validateSample).sort((a,b)=>a.lengthMm-b.lengthMm);
  const definitions = new Set(list.map(s=>s.lengthDefinition));
  if (definitions.size !== 1) throw new Error('samples:mixed_length_definitions_forbidden');
  const exact = list.find(s=>Math.abs(s.lengthMm-targetLengthMm) < 1e-9);
  if (exact) return {mode:'FIXED_MEASURED',targetLengthMm,lengthDefinition:exact.lengthDefinition,evidence:[exact]};
  if (list.length === 1) return {mode:'UNSUPPORTED_SINGLE_ANCHOR_ONLY',targetLengthMm,availableLengthMm:list[0].lengthMm,lengthDefinition:list[0].lengthDefinition};
  let lo=null, hi=null;
  for (const s of list) {
    if (s.lengthMm < targetLengthMm) lo=s;
    if (s.lengthMm > targetLengthMm) { hi=s; break; }
  }
  if (!lo || !hi) return {mode:'UNSUPPORTED_OUTSIDE_MEASURED_RANGE',targetLengthMm,measuredRangeMm:[list[0].lengthMm,list.at(-1).lengthMm],lengthDefinition:list[0].lengthDefinition};
  const t=(targetLengthMm-lo.lengthMm)/(hi.lengthMm-lo.lengthMm);
  return {mode:'MEASURED_INTERPOLATION',targetLengthMm,lengthDefinition:lo.lengthDefinition,bracketMm:[lo.lengthMm,hi.lengthMm],t,evidence:[lo,hi]};
}

export function engineeringPreview(sample, targetLengthMm) {
  validateSample(sample, 0);
  classifyGameVisibleSize(targetLengthMm);
  return {mode:'ENGINEERING_PREVIEW',engineeringPreview:true,biologicalClaim:false,persistAsNatureDerived:false,sourceLengthMm:sample.lengthMm,targetLengthMm,scale:targetLengthMm/sample.lengthMm,lengthDefinition:sample.lengthDefinition};
}
