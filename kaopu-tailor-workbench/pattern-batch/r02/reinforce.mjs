// An explicit new cut revision adds a narrow seam-allowance strip, then sews
// a second row through that strip. No original material coordinate is scaled.
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const area=p=>p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-a[1]*b[0]},0)/2;
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const segdist=(p,a,b)=>{const d=[b[0]-a[0],b[1]-a[1]],l=d[0]**2+d[1]**2,t=l?Math.max(0,Math.min(1,((p[0]-a[0])*d[0]+(p[1]-a[1])*d[1])/l)):0;return dist(p,[a[0]+t*d[0],a[1]+t*d[1]])};
const proper=(a,b,c,d)=>cross(a,b,c)*cross(a,b,d)<-1e-10&&cross(c,d,a)*cross(c,d,b)<-1e-10;
function simple(poly){for(let i=0;i<poly.length;i++)for(let j=i+2;j<poly.length;j++){if(i===0&&j===poly.length-1)continue;if(proper(poly[i],poly[(i+1)%poly.length],poly[j],poly[(j+1)%poly.length]))return false}return true}
const inside=(p,poly)=>{let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++)if((poly[i][1]>p[1])!==(poly[j][1]>p[1])&&p[0]<(poly[j][0]-poly[i][0])*(p[1]-poly[i][1])/(poly[j][1]-poly[i][1])+poly[i][0])c=!c;return c};
export function scheduleInternalStages(spec){
 if(!spec.seams.some(s=>s.isInternalReinforcement))return;
 const originals=spec.seams.filter(s=>!s.isInternalReinforcement),byId=new Map(originals.map(s=>[s.id,s]));
 for(const s of spec.seams.filter(s=>s.isInternalReinforcement))s.stageId=byId.get(s.parentSeamId).stageId+'__reinforce';
 const order=['darts','centers','rises','legs','sleeve_tubes','waist','shoulders','armholes','sides','shell'].filter(id=>originals.some(s=>s.stageId===id));
 const stages=[{id:'cut',requires:[],seams:[]}],all=[];let previous='cut';
 if(spec.source.priorSewingContinuation){
  for(const id of order){stages.push({id,requires:[previous],seams:originals.filter(s=>s.stageId===id).map(s=>s.id)});all.push(id);previous=id}
  for(const id of order){const next=id+'__reinforce';stages.push({id:next,requires:[...new Set([id,previous])],seams:spec.seams.filter(s=>s.stageId===next).map(s=>s.id)});all.push(next);previous=next}
 }else for(const id of order){stages.push({id,requires:[previous],seams:originals.filter(s=>s.stageId===id).map(s=>s.id)});const next=id+'__reinforce';stages.push({id:next,requires:[id],seams:spec.seams.filter(s=>s.stageId===next).map(s=>s.id)});all.push(id,next);previous=next}
 spec.stages=stages;spec.source.assemblyExperiment=all;
}
function refineShortBoundaryEdges(spec){
 const needed=new Map(spec.panels.map(p=>[p.id,new Set()]));for(const s of spec.seams)for(const e of [s.a,s.b])needed.get(e.panelId).add(e.edge);
 for(const p of spec.panels){
  const splits=new Map();
  for(const key of needed.get(p.id)){
   const ids=p.edges[key];if(ids.length>=5)continue;const count=Math.ceil(4/(ids.length-1));
   for(let j=0;j<ids.length-1;j++){
    const a=ids[j],b=ids[j+1],k=[a,b].sort((x,y)=>x-y).join(':');if(splits.has(k))continue;
    const sequence=[a];for(let q=1;q<count;q++){sequence.push(p.uvMm.length);p.uvMm.push(p.uvMm[a].map((x,axis)=>x+(p.uvMm[b][axis]-x)*q/count))}sequence.push(b);splits.set(k,sequence);
    const ti=p.triangles.findIndex(t=>t.includes(a)&&t.includes(b));if(ti<0)throw Error('Missing short material boundary');
    const c=p.triangles[ti].find(i=>i!==a&&i!==b),faces=[];for(let q=0;q<sequence.length-1;q++){const t=[sequence[q],sequence[q+1],c];faces.push(cross(...t.map(i=>p.uvMm[i]))>0?t:[t[0],t[2],t[1]])}p.triangles.splice(ti,1,...faces);
   }
  }
  const expand=(ids,closed=false)=>{const out=[];for(let i=0;i<ids.length-(closed?0:1);i++){const a=ids[i],b=ids[(i+1)%ids.length],s=splits.get([a,b].sort((x,y)=>x-y).join(':'));out.push(...(s?(s[0]===a?s:s.slice().reverse()).slice(0,-1):[a]))}if(!closed)out.push(ids.at(-1));return out};
  p.boundary=expand(p.boundary,true);for(const k of Object.keys(p.edges))p.edges[k]=expand(p.edges[k]);
 }
}
export function addInternalReinforcement(input,{allowanceMm=6,rowFraction=.5}={}){
 if(!(allowanceMm>0&&allowanceMm<=8&&rowFraction>0&&rowFraction<1))throw Error('Invalid reinforcement construction');
 const spec=structuredClone(input);refineShortBoundaryEdges(spec);
 const original=spec.seams.slice(),panelMap=new Map(spec.panels.map(p=>[p.id,p])),sewn=new Map(spec.panels.map(p=>[p.id,new Set()]));
 for(const s of original)for(const e of [s.a,s.b])for(const i of panelMap.get(e.panelId).edges[e.edge])sewn.get(e.panelId).add(i);
 const rows=new Map(),reports=[];
 for(const p of spec.panels){
  const baseCount=p.uvMm.length,boundary=p.boundary.slice(),poly=boundary.map(i=>p.uvMm[i]),sign=Math.sign(area(poly));
  const active=sewn.get(p.id),normals=poly.map((a,i)=>{const b=poly[(i+1)%poly.length],l=dist(a,b);return sign>0?[(b[1]-a[1])/l,-(b[0]-a[0])/l]:[-(b[1]-a[1])/l,(b[0]-a[0])/l]});
  const offsets=poly.map((q,i)=>{
   if(!active.has(boundary[i]))return [0,0];
   const prev=normals[(i+poly.length-1)%poly.length],next=normals[i],sum=[prev[0]+next[0],prev[1]+next[1]],den=sum[0]*next[0]+sum[1]*next[1];
   let nearest=Infinity;for(let j=0;j<poly.length;j++){const delta=Math.min((j-i+poly.length)%poly.length,(i-j+poly.length)%poly.length);if(delta<=2||delta>=poly.length-2)continue;nearest=Math.min(nearest,segdist(q,poly[j],poly[(j+1)%poly.length]));}
   const width=Math.min(allowanceMm,nearest*.22),m=Math.min(2,Math.abs(den)>1e-6?1/den:1);
   return [sum[0]*width*m,sum[1]*width*m];
  });
  let scale=1,outer;
  for(let attempt=0;attempt<12;attempt++){
   outer=poly.map((q,i)=>[q[0]+offsets[i][0]*scale,q[1]+offsets[i][1]*scale]);
   if(simple(outer)&&Math.abs(area(outer))>=Math.abs(area(poly))&&outer.every((q,i)=>dist(q,poly[i])<1e-6||!inside(q,poly)))break;
   scale*=.5;outer=null;
  }
  if(!outer)throw Error('Cannot construct a nonintersecting allowance: '+p.id);
  const row=new Map(),cut=new Map(),widths=[];
  for(let i=0;i<boundary.length;i++){
   const old=boundary[i],q=poly[i],o=outer[i],w=dist(q,o);widths.push(w);
   if(w<1e-8){row.set(old,old);cut.set(old,old);continue}
   row.set(old,p.uvMm.length);p.uvMm.push([q[0]+(o[0]-q[0])*rowFraction,q[1]+(o[1]-q[1])*rowFraction]);
   cut.set(old,p.uvMm.length);p.uvMm.push(o);
  }
  const add=t=>{const a=cross(...t.map(i=>p.uvMm[i]));if(Math.abs(a)>1e-7)p.triangles.push(a>0?t:[t[0],t[2],t[1]])};
  const originalArea=p.triangles.reduce((s,t)=>s+cross(...t.map(i=>p.uvMm[i]))/2,0);
  for(let i=0;i<boundary.length;i++){
   const a=boundary[i],b=boundary[(i+1)%boundary.length],r=row.get(a),s=row.get(b),u=cut.get(a),v=cut.get(b);
   add([a,b,s]);add([a,s,r]);add([r,s,v]);add([r,v,u]);
  }
  p.boundary=boundary.map(i=>cut.get(i));
  const finalArea=p.triangles.reduce((s,t)=>s+cross(...t.map(i=>p.uvMm[i]))/2,0),expected=Math.abs(area(outer));
  if(Math.abs(finalArea-expected)>Math.max(.01,expected*1e-8))throw Error('Allowance material overlaps or reverses: '+p.id);
  rows.set(p.id,row);p.seamAllowanceMm=allowanceMm;p.reinforcementCut={schema:'kaopu-inner-double-stitch-cut@1',originalMaterialVertexCount:baseCount,originalNetAreaMm2:originalArea,
    newCutAreaMm2:finalArea,addedAllowanceAreaMm2:finalArea-originalArea,requestedAllowanceMm:allowanceMm,
    minNonzeroAllowanceMm:Math.min(...widths.filter(w=>w>1e-8)),maxAllowanceMm:Math.max(...widths),rowFraction,
    adaptiveNarrowCornerScale:scale,netBoundaryMaterialIds:boundary,originalCoordinatesScaled:false,originalNetMaterialPreserved:true,shortEdgeTrianglesMayBeSubdivided:true};
  reports.push({panelId:p.id,...p.reinforcementCut});
 }
 const added=[];
 for(const seam of original){
  const refs=[];
  for(const [side,end] of [['a',seam.a],['b',seam.b]]){
   const p=panelMap.get(end.panelId),key=`inner_${seam.id}_${side}`,row=rows.get(p.id);
   p.edges[key]=p.edges[end.edge].map(i=>row.get(i));
   if(p.edges[key].some(i=>i===undefined))throw Error('Reinforcing row left the cut boundary');
   p.edgeNotches[key]=structuredClone(p.edgeNotches[end.edge]);refs.push({...end,edge:key});
  }
  const pA=panelMap.get(refs[0].panelId),pB=panelMap.get(refs[1].panelId),a=pA.edges[refs[0].edge],b=pB.edges[refs[1].edge];
  const oriented=(ids,ref)=>ref.reverse?ids.slice().reverse():ids;
  const aa=oriented(a,refs[0]),bb=oriented(b,refs[1]),oa=oriented(pA.edges[seam.a.edge],seam.a),ob=oriented(pB.edges[seam.b.edge],seam.b);
  let pairs=seam.stitchVertexPairs.map(([x,y])=>[aa[oa.indexOf(x)],bb[ob.indexOf(y)]]);
  if(pairs.some(pair=>pair.some(i=>i===undefined)))throw Error('Reinforcement source stitch identity lost');
  if(pairs.length>=4)pairs=pairs.slice(1,-1);
  else pairs=[.25,.75].map(t=>[aa[Math.round(t*(aa.length-1))],bb[Math.round(t*(bb.length-1))]]);
  const crop=(p,ref,column)=>{const list=oriented(p.edges[ref.edge],ref),start=list.indexOf(pairs[0][column]),end=list.indexOf(pairs.at(-1)[column]);if(start<0||end<=start)throw Error('Invalid reinforcing end stops');const trimmed=list.slice(start,end+1);p.edges[ref.edge]=ref.reverse?trimmed.reverse():trimmed;return p.edges[ref.edge]};
  // End stops avoid welding together the seam-allowance corners of three or
  // more panels; the original primary stitches continue to cover each corner.
  const rowA=crop(pA,refs[0],0),rowB=crop(pB,refs[1],1);
  const length=(p,ids)=>ids.slice(1).reduce((s,i,k)=>s+dist(p.uvMm[i],p.uvMm[ids[k]]),0),la=length(pA,rowA),lb=length(pB,rowB);
  const secondary={...structuredClone(seam),id:seam.id+'__inner',a:refs[0],b:refs[1],easeMm:lb-la,stitchVertexPairs:pairs,
    isInternalReinforcement:true,parentSeamId:seam.id,seamModel:'second real stitch row in added seam-allowance material; activated with its parent',
    sourceSeam:{...structuredClone(seam.sourceSeam),id:seam.id+'__inner',kind:'project-owned-internal-reinforcing-stitch',lengthAMm:la,lengthBMm:lb,easeMm:la-lb,
      gathering:{...structuredClone(seam.sourceSeam.gathering),projectedLengthAMm:la/seam.sourceSeam.gathering.ruffleCoefficientA,projectedLengthBMm:lb/seam.sourceSeam.gathering.ruffleCoefficientB}},
    numericalStitchPlan:{...structuredClone(seam.numericalStitchPlan),reinforcement:true,cornerEndStops:true,fullMaterialEdgeSampleCount:rowA.length,materialEdgeSampleCountA:rowA.length,materialEdgeSampleCountB:rowB.length}};
  secondary.stageId=seam.stageId+'__reinforce';added.push(secondary);
 }
 spec.seams.push(...added);scheduleInternalStages(spec);spec.revision++;
 spec.source.internalReinforcement={schema:'kaopu-double-stitch-construction@1',revision:2,requestedByUser:true,primarySeams:original.length,reinforcedSeams:added.length,
    requestedAllowanceMm:allowanceMm,requestedSecondRowOffsetMm:allowanceMm*rowFraction,panels:reports,materialAdded:true,originalNetPaperRescaled:false,
    strengthCalibrated:false,tearDamageModel:false,requiresActualSolve:true};
 return spec;
}
