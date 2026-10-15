// Transfer a previously simulated version of the SAME source material into a
// refined cut state, then press only the newly added allowance toward one side.
// This is initialization of a fresh solve, never a displayed garment substitute.
const distance=(a,b)=>Math.hypot(...a.map((x,k)=>x-b[k]));
const sub=(a,b)=>a.map((x,k)=>x-b[k]),dot=(a,b)=>a.reduce((s,x,k)=>s+x*b[k],0),norm=a=>{const l=Math.hypot(...a);return l>1e-12?a.map(x=>x/l):[1,0,0]};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const key=q=>q.map(x=>Math.round(x*1e5)).join(',');
function nearestSegment(q,p,ids){let best;for(let i=0;i<ids.length-1;i++){const a=p.uvMm[ids[i]],b=p.uvMm[ids[i+1]],d=sub(b,a),l=dot(d,d),t=l?Math.max(0,Math.min(1,dot(sub(q,a),d)/l)):0,point=a.map((x,k)=>x+t*d[k]),gap=distance(q,point);if(!best||gap<best.gap)best={i,t,point,gap}}return best}
export function warmStartAllowances(lab,base){
 const points=base.record?.positionsMm;if(!points)throw Error('Warm start requires an actual completed source sewing record');
 const oldPanels=new Map(),current=new Map(lab.spec.panels.map(p=>[p.id,p]));let count=0;
 for(const p of base.spec.panels){oldPanels.set(p.id,{panel:p,offset:count,lookup:new Map(p.uvMm.map((q,i)=>[key(q),i]))});count+=p.uvMm.length}
 if(points.length!==count)throw Error('Warm source material coordinate count differs');
 const edgeKey=r=>r.panelId+'|'+r.edge;
 const baseSeams=new Map(base.spec.seams.map(s=>[edgeKey(s.a)+'::'+edgeKey(s.b),s])),frame=(spec,id)=>spec.source.generationSource?.r043SourceRepair?.frames?.find(f=>f.panelId===id)?.originMm||[0,0];
 const interpolate=(entry,q)=>{
  const p=entry.panel,match=entry.lookup.get(key(q));if(match!==undefined)return points[entry.offset+match].map(x=>x*.001);
  for(const t of p.triangles){const [a,b,c]=t.map(i=>p.uvMm[i]),u=sub(b,a),v=sub(c,a),w=sub(q,a),det=u[0]*v[1]-u[1]*v[0];if(Math.abs(det)<1e-12)continue;const x=(w[0]*v[1]-w[1]*v[0])/det,y=(u[0]*w[1]-u[1]*w[0])/det;if(x>=-1e-5&&y>=-1e-5&&x+y<=1+1e-5)return [0,1,2].map(k=>((1-x-y)*points[entry.offset+t[0]][k]+x*points[entry.offset+t[1]][k]+y*points[entry.offset+t[2]][k])*.001)}
  const near=nearestSegment(q,p,p.boundary.concat(p.boundary[0]));const a=p.boundary[near.i%p.boundary.length],b=p.boundary[(near.i+1)%p.boundary.length];return [0,1,2].map(k=>(points[entry.offset+a][k]*(1-near.t)+points[entry.offset+b][k]*near.t)*.001);
 };
 const mapping=[];let originalTransferred=0,newAllowance=0,maxAnalyticDifferenceMm=0;
 for(const p of lab.spec.panels){
  const entry=oldPanels.get(p.id);if(!entry)throw Error('Warm start cannot add an unrelated panel: '+p.id);
  const origin=frame(lab.spec,p.id),oldOrigin=frame(base.spec,p.id),shift=origin.map((x,k)=>x-oldOrigin[k]),offset=lab.offsets.get(p.id),netCount=p.reinforcementCut?.originalMaterialVertexCount||p.uvMm.length;
  const curves=new Map(entry.panel.analyticCurvesMm.map(e=>[e.id,e]));
  for(const curve of p.analyticCurvesMm){const old=curves.get(curve.id);if(!old||old.kind!==curve.kind)throw Error('Warm source analytic paper differs: '+p.id);const a=curve.sampledPointsMm.map(q=>q.map((x,k)=>x+shift[k])),b=old.sampledPointsMm;for(const [source,target]of [[a,b],[b,a]])for(const q of source){const d=nearestSegment(q,{uvMm:target},target.map((_,i)=>i)).gap;maxAnalyticDifferenceMm=Math.max(maxAnalyticDifferenceMm,d);if(d>10)throw Error('Warm initialization cut differs by more than 10 mm: '+p.id)}}
  const joins=lab.spec.seams.filter(s=>!s.isInternalReinforcement&&(s.a.panelId===p.id||s.b.panelId===p.id));
  for(let i=0;i<p.uvMm.length;i++){
   const q=p.uvMm[i].map((x,k)=>x+shift[k]);let world;
   if(i<netCount){world=interpolate(entry,q);originalTransferred++}
   else{
    let closest;
    for(const seam of joins){let oldSeam=baseSeams.get(edgeKey(seam.a)+'::'+edgeKey(seam.b));if(!oldSeam){const swapped=baseSeams.get(edgeKey(seam.b)+'::'+edgeKey(seam.a));if(swapped)oldSeam={...swapped,a:swapped.b,b:swapped.a}}if(!oldSeam)throw Error('Warm source material edge identity differs: '+seam.id);for(const side of ['a','b']){if(oldSeam[side].panelId!==p.id)continue;const ref=oldSeam[side],edge=entry.panel.edges[ref.edge];if(!edge)throw Error('Warm material edge missing: '+edgeKey(ref));const near=nearestSegment(q,entry.panel,edge);if(!closest||near.gap<closest.near.gap)closest={seam:oldSeam,side,near,ref}}}
    if(!closest)throw Error('Allowance has no source sewing edge');
    const {seam,side,near,ref}=closest,ids=entry.panel.edges[ref.edge],lengths=[0];for(let j=1;j<ids.length;j++)lengths.push(lengths.at(-1)+distance(entry.panel.uvMm[ids[j-1]],entry.panel.uvMm[ids[j]]));
    let t=(lengths[near.i]+near.t*(lengths[near.i+1]-lengths[near.i]))/lengths.at(-1);if(ref.reverse)t=1-t;
    const B=oldPanels.get(seam.b.panelId),bp=B.panel,bi=seam.b.reverse?bp.edges[seam.b.edge].slice().reverse():bp.edges[seam.b.edge],lens=[0];for(let j=1;j<bi.length;j++)lens.push(lens.at(-1)+distance(bp.uvMm[bi[j-1]],bp.uvMm[bi[j]]));
    const station=t*lens.at(-1);let j=0;while(j<bi.length-2&&lens[j+1]<station)j++;const f=(station-lens[j])/Math.max(1e-12,lens[j+1]-lens[j]),a=bi[j],b=bi[j+1],A=points[B.offset+a].map(x=>x*.001),C=points[B.offset+b].map(x=>x*.001),center=A.map((x,k)=>x+(C[k]-x)*f),face=bp.triangles.find(tri=>tri.includes(a)&&tri.includes(b));
    if(!face)throw Error('Warm source edge has no material face');const c=face.find(i=>i!==a&&i!==b),inner=points[B.offset+c].map(x=>x*.001),tangent=norm(sub(C,A)),vector=sub(inner,center),perp=norm(vector.map((x,k)=>x-dot(vector,tangent)*tangent[k]));let normal=norm(cross(tangent,perp));if(dot(normal,[center[0],0,center[2]])>0)normal=normal.map(x=>-x);
    const width=near.gap*.001;world=center.map((x,k)=>x+perp[k]*width+normal[k]*(side==='a'?.00025:.00035));newAllowance++;
   }
   for(let k=0;k<3;k++){lab.positions[offset+i][k]=world[k];lab.previous[offset+i][k]=world[k];lab.velocity[offset+i][k]=0}
  }
  mapping.push({panelId:p.id,oldMaterialVertices:entry.panel.uvMm.length,newMaterialVertices:p.uvMm.length,frameShiftMm:shift});
 }
 for(const [i]of lab.pins)lab.pins.set(i,Array.from(lab.positions[i]));
 for(const hold of lab.support){hold.start=Array.from(lab.positions[hold.id]);hold.target=Array.from(lab.positions[hold.id])}
 lab.warmStartProof={schema:'kaopu-source-material-warm-start@1',sourcePreset:base.binding?.presetId,archiveSHA256:base.archiveSHA256,sourcePerson:base.binding.person,maxAnalyticDifferenceMm,originalTransferred,newAllowance,mapping,
  method:'same-panel UV interpolation of a real prior sewing state as initialization only; source paper delta is measured and bounded at 10 mm; current frozen paper defines all new rest metrics and a fresh complete solve',
  sourceCoordinatesScaled:false,bodyModified:false,finalDisplayOverride:false,permanentTargetPins:false};
 return lab.warmStartProof;
}
