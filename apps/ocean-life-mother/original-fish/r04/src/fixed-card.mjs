export function validateFixedCard(card) {
  if (card.mode !== 'FIXED_MEASURED') throw new Error('mode:FIXED_MEASURED_required');
  if (card.lengthDefinition !== 'TL') throw new Error('lengthDefinition:TL_required_for_this_card');
  const TL=card.totalLengthMm;
  if (!(Number.isFinite(TL)&&TL>0)) throw new Error('totalLengthMm:positive_finite_required');
  const pct=card.measurements, mm=card.derivedMm;
  const check=(name,actual,expected,tol=1e-9)=>{ if (Math.abs(actual-expected)>tol) throw new Error(name+':derived_value_mismatch'); };
  check('standardLengthMm',card.standardLengthMm,TL*pct.standardLengthPctTL/100);
  check('preAnal',mm.preAnal,TL*pct.preAnalPctTL/100);
  check('preDorsal',mm.preDorsal,TL*pct.preDorsalPctTL/100);
  check('prePelvic',mm.prePelvic,TL*pct.prePelvicPctTL/100);
  check('prePectoral',mm.prePectoral,TL*pct.prePectoralPctTL/100);
  check('bodyDepth',mm.bodyDepth,TL*pct.bodyDepthPctTL/100);
  check('headLength',mm.headLength,TL*pct.headLengthPctTL/100);
  check('eyeDiameter',mm.eyeDiameter,mm.headLength*pct.eyeDiameterPctHL/100);
  check('preOrbital',mm.preOrbital,mm.headLength*pct.preOrbitalPctHL/100);
  const depthInSL=card.standardLengthMm/mm.bodyDepth;
  if (depthInSL<card.constraints.adultDiagnosisBodyDepthInSL[0] || depthInSL>card.constraints.adultDiagnosisBodyDepthInSL[1]) throw new Error('bodyDepth:outside_adult_diagnosis_range');
  if (card.readiness.full3D !== false) throw new Error('full3D:must_remain_false_without_width');
  return {status:'VALID_FIXED_MEASURED_CARD',depthInSL};
}
export function ruler(card){
  validateFixedCard(card);
  return {totalLengthMm:card.totalLengthMm,standardLengthMm:card.standardLengthMm,bodyDepthMm:card.derivedMm.bodyDepth,headLengthMm:card.derivedMm.headLength,eyeDiameterMm:card.derivedMm.eyeDiameter,anchors:structuredClone(card.normalizedAnchorsTL),topWidthStatus:'UNKNOWN_NOT_MEASURED'};
}