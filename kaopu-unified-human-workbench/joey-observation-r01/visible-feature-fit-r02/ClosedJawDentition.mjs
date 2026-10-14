// Bounded single-frame compatibility correction. Does not replace teeth or head.
// Valid only at zero jaw control: smile/lip motion must not re-pose the lower teeth.
export function installClosedJawDentition(model){
 const h=model.headTransfer,original=h?.moveDental;
 if(typeof original!=='function')throw Error('Native HeadTransfer required');
 const I=()=>new Float64Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);let calls=0,active=true;
 function wrapper(before,after,options){
  if(options?.upper===true)return original.call(this,before,after,options);
  const s=model.effectiveState||model.state;
  if(s?.owners?.expression!=='anny')throw Error('Closed-jaw test requires current Anny expression owner');
  for(const k of ['jawOpen','jawForward','jawLeft','jawRight'])if(Math.abs(s.anny.facialActions[k]||0)>1e-12)throw Error('Closed-jaw single-frame test rejects nonzero '+k);
  if(before.length!==17821*3||after.length!==before.length)throw Error('Native head topology changed');
  for(const i of this.componentIds[4])for(let k=0;k<3;k++)after[i*3+k]=before[i*3+k];
  calls++;
  // The existing attachOralToDentition consumes this same transform and retains
  // its native dental anchors + harmonic cavity wall continuity.
  return {4:{matrix:I(),maxResidual:0,mode:'zero-jaw-rest-dentition'}};
 }
 h.moveDental=wrapper;
 return {report:()=>({version:'zero-jaw-rest-dentition/1',calls,active,scope:'Single frame, zero jaw controls, native current-identity dental rest',noOuterLipOverride:true,anatomicalOcclusionCertified:false}),dispose(){if(!active)return;if(h.moveDental!==wrapper)throw Error('Dental method changed externally');h.moveDental=original;active=false;}};
}
