const keys=['SLmm','headLengthMm','headWidthMm','bodyWidthMm','eyeDiameterMm'];
const lerp=(a,b,t)=>a+(b-a)*t;
function valid(a,i){
  if (!a || !Number.isFinite(a.TLmm) || a.TLmm<=0) throw new Error('anchor['+i+'].TLmm');
  for(const k of keys) if(!Number.isFinite(a[k])||a[k]<=0) throw new Error('anchor['+i+'].'+k);
  return a;
}
export function validateMeasuredSeries(series){
  if(series.mode!=='MEASURED_INTERPOLATION') throw new Error('mode');
  const a=series.anchors.map(valid).slice().sort((x,y)=>x.TLmm-y.TLmm);
  for(let i=1;i<a.length;i++) if(a[i].TLmm<=a[i-1].TLmm) throw new Error('TL:strict');
  if(Math.abs(a[0].TLmm-series.validInterpolationRangeTLmm[0])>1e-9||Math.abs(a.at(-1).TLmm-series.validInterpolationRangeTLmm[1])>1e-9) throw new Error('range:mismatch');
  return a;
}
export function sampleByTL(series,targetTLmm){
  if(!Number.isFinite(targetTLmm)||targetTLmm<=0) throw new Error('targetTLmm');
  const a=validateMeasuredSeries(series);
  if(targetTLmm<a[0].TLmm||targetTLmm>a.at(-1).TLmm) return {status:'UNSUPPORTED_OUTSIDE_MEASURED_RANGE',targetTLmm,range:[a[0].TLmm,a.at(-1).TLmm]};
  const exact=a.find(x=>Math.abs(x.TLmm-targetTLmm)<1e-9);
  if(exact) return {status:'FIXED_MEASURED',...structuredClone(exact),ratios:ratios(exact)};
  let hi=1; while(a[hi].TLmm<targetTLmm) hi++;
  const lo=hi-1,x=a[lo],y=a[hi],t=(targetTLmm-x.TLmm)/(y.TLmm-x.TLmm);
  const out={status:'MEASURED_INTERPOLATION',TLmm:targetTLmm,bracketTLmm:[x.TLmm,y.TLmm],t};
  for(const k of keys) out[k]=lerp(x[k],y[k],t);
  out.ageDph=lerp(x.ageDph,y.ageDph,t);
  out.ratios=ratios(out);
  return out;
}
function ratios(x){
  return {
    SLperTL:x.SLmm/x.TLmm,
    headLengthPerTL:x.headLengthMm/x.TLmm,
    headWidthPerTL:x.headWidthMm/x.TLmm,
    bodyWidthPerTL:x.bodyWidthMm/x.TLmm,
    eyeDiameterPerTL:x.eyeDiameterMm/x.TLmm
  };
}
export function proportionalChange(series){
  const a=validateMeasuredSeries(series), first=ratios(a[0]), last=ratios(a.at(-1)), out={};
  for(const k of Object.keys(first)) out[k]={from:first[k],to:last[k],delta:last[k]-first[k]};
  return out;
}