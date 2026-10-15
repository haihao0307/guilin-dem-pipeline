/** R04.3: interpret declared SkirtLevels gathering and choose safe material frames.
 * No outline rescaling, no replaced faces and no weakened material validator.
 * The unchanged source archive is always retained and bound separately.
 */
const SOURCE='d449629979028123a5c4dc9e732a2ec19b7fce31';
const key=r=>`${r.panelId}:${r.edge}`;
const assert=(v,m)=>{if(!v)throw Error('SOURCE_REPAIR: '+m)};
export function prepareNativeSource(source){
 assert(source?.schema==='kaopu-analytic-sewing-pattern@1'&&source.units==='mm','expected native analytic paper');
 const out=structuredClone(source),tierRows=[],frames=[];
 const design=source.design,levels=design?.meta?.bottom?.v==='SkirtLevels',ratio=design?.['levels-skirt']?.level_ruffle?.v;
 if(levels&&Number.isFinite(ratio)&&ratio>1+1e-8){
  assert(source.source.commit===SOURCE,'unknown SkirtLevels implementation');
  const top=new Set(source.interfaces.filter(i=>i.name==='top'&&/^skirt_(?:front|back)_\d+$/.test(i.component)).flatMap(i=>i.edges.map(key)));
  const bottom=new Set(source.interfaces.filter(i=>i.name==='bottom'&&/^skirt_(?:front|back)(?:_\d+)?$/.test(i.component)).flatMap(i=>i.edges.map(key)));
  for(const s of out.seams){
   const a=top.has(key(s.a))&&bottom.has(key(s.b)),b=top.has(key(s.b))&&bottom.has(key(s.a));if(!a&&!b)continue;
   const lower=a?'a':'b',upper=a?'b':'a';
   const level=r=>{const m=r.panelId.match(/_(\d+)$/);return m?Number(m[1]):-1};
   assert(level(s[lower])===level(s[upper])+1,'nonadjacent tiers');
   const len=k=>k==='a'?s.lengthAMm:s.lengthBMm;const measured=len(lower)/len(upper);
   assert(Math.abs(measured-ratio)<1e-5,'declared layer_ruffle differs from source edge lengths');
   const g=s.gathering,la=g.ruffleCoefficientA,lb=g.ruffleCoefficientB;
   if(Math.abs(la-lb)<1e-8){
    s.originalGatheringBeforeR043=structuredClone(g);
    g['ruffleCoefficient'+lower.toUpperCase()]=measured;
    g['ruffleCoefficient'+upper.toUpperCase()]=1;
    g.projectedLengthAMm=s.lengthAMm/g.ruffleCoefficientA;g.projectedLengthBMm=s.lengthBMm/g.ruffleCoefficientB;
    tierRows.push({seamId:s.id,upper:s[upper],lower:s[lower],declaredRatio:ratio,recoveredRatio:measured,sourceFile:'assets/garment_programs/skirt_levels.py',sourceCommit:SOURCE});
   }
  }
  assert(tierRows.length===2*design['levels-skirt'].num_levels.v||source.source?.r043SourceRepair,'every declared tier connection must be recovered explicitly');
 }
 for(const p of out.panels){
  // Only long positive-offset coordinate frames are rebased; dimensions never shrink.
  const points=[...p.verticesMm,...p.edges.flatMap(e=>[...(e.controlPointsMm||[]),...(e.sampledPointsMm||[])])];
  if(!points.some(v=>v.some(x=>Math.abs(x)>2000)))continue;
  const lo=[0,1].map(k=>Math.min(...points.map(v=>v[k]))),hi=[0,1].map(k=>Math.max(...points.map(v=>v[k])));
  const origin=lo.map((x,k)=>(x+hi[k])/2);assert(hi.every((v,k)=>v-lo[k]<=3999),'one material piece exceeds safe computational frame extent');
  const move=v=>[v[0]-origin[0],v[1]-origin[1]];
  p.verticesMm=p.verticesMm.map(move);
  for(const e of p.edges){if(e.controlPointsMm)e.controlPointsMm=e.controlPointsMm.map(move);if(e.sampledPointsMm)e.sampledPointsMm=e.sampledPointsMm.map(move);if(e.arc)e.arc.centerMm=move(e.arc.centerMm);}
  const matrix=p.placement.matrix3;
  p.placement.translationMm=p.placement.translationMm.map((v,k)=>v+matrix[k][0]*origin[0]+matrix[k][1]*origin[1]);
  p.computationalFrame={sourceOriginMm:origin,transform:'uv_computational = uv_original - origin; placement compensates exactly',scale:1};frames.push({panelId:p.id,originMm:origin,sourceExtentMm:hi.map((v,k)=>v-lo[k])});
 }
 if(tierRows.length||frames.length)out.source={...out.source,r043SourceRepair:{schema:'kaopu-native-source-representation@1',originalRecipeHash:source.recipeHash,originalGeometryHash:source.geometryHash,tierRows,frames,cuttingGeometryRescaled:false,materialAreasChanged:false,displayGeometrySubstitution:false}};
 return out;
}
