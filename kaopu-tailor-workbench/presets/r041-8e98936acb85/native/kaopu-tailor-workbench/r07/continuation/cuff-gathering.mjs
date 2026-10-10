/** Repair a specific, verified GarmentCode CuffBand serialization omission.
 * PantsHalf divides the whole leg opening by design.pants.cuff.top_ruffle to
 * size CuffBand, but its pant_bottom Interface omits the gathering coefficient.
 * Front and back source lengths differ while the cuff halves have equal widths.
 * Preserve all cutting geometry; record explicit local gathering consistent
 * with the existing total ratio. Never infer a general seam treatment by proximity.
 */
const COMMIT='d449629979028123a5c4dc9e732a2ec19b7fce31';
const key=r=>JSON.stringify([r.panelId,r.edge]);
const check=(b,m)=>{if(!b)throw Error('CUFF_GATHERING: '+m);};
const stable=x=>Array.isArray(x)?x.map(stable):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])])):x;
const sha=async x=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(stable(x))))),v=>v.toString(16).padStart(2,'0')).join('');
export async function recoverExplicitPantsCuffGathering(source){
 if(source?.source?.continuationCuffGathering)return source;
 const d=source?.design,ratio=d?.pants?.cuff?.top_ruffle?.v;
 if(d?.meta?.bottom?.v!=='Pants'||d?.pants?.cuff?.type?.v!=='CuffBand'||!Number.isFinite(ratio)||ratio<=1+1e-8)return source;
 check(source.schema==='kaopu-analytic-sewing-pattern@1'&&source.units==='mm'&&source.source.commit===COMMIT,'unverified source schema/version');
 const out=structuredClone(source),rows=[];
 for(const side of ['l','r']){
  // These exact component IDs and top interfaces come from the pinned source
  // PantsHalf -> CuffBand constructor, not a guess about an arbitrary mesh name.
  const component='CuffBand_pant_'+side,top=source.interfaces.filter(i=>i.component===component&&i.name==='top');
  check(top.length===1&&top[0].edges.length===2,'missing explicit two-half cuff top interface');
  const topKeys=new Set(top[0].edges.map(key)),used=new Set(),matches=[];
  for(const seam of out.seams){
   const a=topKeys.has(key(seam.a)),b=topKeys.has(key(seam.b));if(!a&&!b)continue;
   check(a!==b,'cuff top cannot sew to itself');const cuff=a?'a':'b',leg=a?'b':'a';
   const cuffRef=seam[cuff],legRef=seam[leg];check(!used.has(key(cuffRef)),'reused cuff edge');used.add(key(cuffRef));
   const supportedLegIds=new Set(['pant_f_'+side,'pant_b_'+side]);check(supportedLegIds.has(legRef.panelId),'unknown leg-side material identity');
   const namedBottom=source.interfaces.find(i=>i.component===legRef.panelId&&i.name==='bottom');
   check(namedBottom?.edges.some(r=>key(r)===key(legRef)),'seam is not the explicit leg-bottom interface');
   const cuffLength=cuff==='a'?seam.lengthAMm:seam.lengthBMm,legLength=leg==='a'?seam.lengthAMm:seam.lengthBMm;
   check(cuffLength>0&&legLength>=cuffLength&&Number.isFinite(legLength),'cannot assign compressive gathering to a shorter leg edge');
   check(seam.gathering&&Math.abs(seam.gathering.ruffleCoefficientA-1)<1e-8&&Math.abs(seam.gathering.ruffleCoefficientB-1)<1e-8,'existing nontrivial source gathering must not be overwritten');
   matches.push({seam,cuff,leg,cuffLength,legLength});
  }
  check(matches.length===2&&used.size===2,'cuff interface must have exactly two explicit leg connections');
  const totalLeg=matches.reduce((s,m)=>s+m.legLength,0),totalCuff=matches.reduce((s,m)=>s+m.cuffLength,0);
  check(Math.abs(totalLeg/totalCuff-ratio)<1e-6,'aggregate source edge ratio disagrees with the requested cuff gathering');
  for(const m of matches){
   const local=m.legLength/m.cuffLength,g=m.seam.gathering;
   m.seam.originalGatheringBeforeContinuationRepair=structuredClone(g);
   g['ruffleCoefficient'+m.leg.toUpperCase()]=local;g['ruffleCoefficient'+m.cuff.toUpperCase()]=1;
   g.projectedLengthAMm=m.seam.lengthAMm/g.ruffleCoefficientA;g.projectedLengthBMm=m.seam.lengthBMm/g.ruffleCoefficientB;
   m.seam.continuationGathering={kind:'explicit-source-cuff-intent-recovered',component,declaredTotalRatio:ratio,localLegRatio:local,geometryRescaled:false};
   rows.push({seamId:m.seam.id,component,declaredTotalRatio:ratio,localLegRatio:local,originalLegLengthMm:m.legLength,originalCuffLengthMm:m.cuffLength});
  }
 }
 out.validation.warnings=out.validation.warnings.filter(w=>!rows.some(r=>r.seamId===w.seam&&w.code==='PROJECTED_SEAM_LENGTH_MISMATCH'));
 out.source={...out.source,continuationCuffGathering:{revision:1,sourceRecipeHash:source.recipeHash,sourceGeometryHash:source.geometryHash,
  reason:'original pants cuff size consumes top_ruffle, but source stitch interfaces serialize coefficients as one',rows,
  sourcePanelGeometryChanged:false,bodyChanged:false,originalHighLevelInterfacesRetainedAsReference:true,physicalFoldConstructionCertified:false}};
 out.recipeHash=await sha({bodyCm:out.bodyCm,design:out.design,sourceRecipeHash:source.recipeHash,cuffGatheringInterpretation:rows});
 check(out.geometryHash===source.geometryHash,'cutting geometry hash unexpectedly changed');
 return out;
}
