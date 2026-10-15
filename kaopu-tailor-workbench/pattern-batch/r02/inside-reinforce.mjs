// A new sewing revision takes a narrow 0.8 mm fold in the existing cloth. This
// provides a distinct second needle row without unstable exterior dart slivers.
// The cut UV coordinates remain unchanged; the small take-up is explicit.
import {scheduleInternalStages} from './reinforce.mjs';
const dist=(a,b)=>Math.hypot(...a.map((x,k)=>x-b[k]));
const length=(p,ids)=>ids.slice(1).reduce((s,i,j)=>s+dist(p.uvMm[i],p.uvMm[ids[j]]),0);
const signed=poly=>poly.reduce((s,a,i)=>{const b=poly[(i+1)%poly.length];return s+a[0]*b[1]-a[1]*b[0]},0)/2;
const inside=(p,poly)=>{let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++)if((poly[i][1]>p[1])!==(poly[j][1]>p[1])&&p[0]<(poly[j][0]-poly[i][0])*(p[1]-poly[i][1])/(poly[j][1]-poly[i][1])+poly[i][0])c=!c;return c};
export function addInteriorReinforcement(input,triangulate,{offsetMm=.8}={}){
 const spec=structuredClone(input),panels=new Map(spec.panels.map(p=>[p.id,p])),original=spec.seams.slice(),added=[],reports=[];
 for(const seam of original){
  const sourcePairs=seam.stitchVertexPairs,stations=sourcePairs.length>=4?sourcePairs.slice(1,-1).map(pair=>({pair})): [{t:.25},{t:.75}],refs=[],pairs=stations.map(()=>[]);
  for(const [column,ref]of [seam.a,seam.b].entries()){
   const p=panels.get(ref.panelId),raw=p.edges[ref.edge],ids=ref.reverse?raw.slice().reverse():raw,poly=p.boundary.map(i=>p.uvMm[i]),sign=Math.sign(signed(poly))*(ref.reverse?-1:1),points=ids.map(i=>p.uvMm[i]),path=[];
   for(let j=0;j<stations.length;j++){
    const station=stations[j];let index,q,tangent;
    if(station.pair){index=ids.indexOf(station.pair[column]);if(index<0)throw Error('Interior stitch lost original station');q=points[index];const a=points[Math.max(0,index-1)],b=points[Math.min(points.length-1,index+1)];tangent=[b[0]-a[0],b[1]-a[1]]}
    else{const f=station.t*(points.length-1),k=Math.min(points.length-2,Math.floor(f)),u=f-k;q=points[k].map((x,a)=>x+(points[k+1][a]-x)*u);tangent=points[k+1].map((x,a)=>x-points[k][a])}
    const l=Math.hypot(...tangent);let width=offsetMm,target;
    for(let attempt=0;attempt<12;attempt++){target=[q[0]-tangent[1]/l*sign*width,q[1]+tangent[0]/l*sign*width];if(inside(target,poly))break;width*=.5;target=null}
    if(!target)throw Error('No material for interior row: '+p.id+' '+seam.id);
    const id=p.uvMm.length;p.uvMm.push(target);path.push(id);pairs[j][column]=id;
   }
   const edge='inside_'+seam.id+'_'+column;p.edges[edge]=path;p.edgeNotches[edge]=[];refs.push({panelId:p.id,edge,reverse:false});
  }
  const a=panels.get(refs[0].panelId),b=panels.get(refs[1].panelId),la=length(a,a.edges[refs[0].edge]),lb=length(b,b.edges[refs[1].edge]),id=seam.id+'__inner',notches=[id+':start',id+':end'];
  for(const ref of refs)panels.get(ref.panelId).edgeNotches[ref.edge]=notches.map((id,i)=>({id,t:i}));
  added.push({...structuredClone(seam),id,a:refs[0],b:refs[1],notches,easeMm:lb-la,stitchVertexPairs:pairs,isInternalReinforcement:true,parentSeamId:seam.id,stageId:seam.stageId+'__reinforce',sourceSeam:{...structuredClone(seam.sourceSeam),id,kind:'narrow-interior-fold-second-row',lengthAMm:la,lengthBMm:lb,gathering:{...structuredClone(seam.sourceSeam.gathering),projectedLengthAMm:la/seam.sourceSeam.gathering.ruffleCoefficientA,projectedLengthBMm:lb/seam.sourceSeam.gathering.ruffleCoefficientB}},numericalStitchPlan:{reinforcement:true,physicalNeedleSpacing:false,interiorFoldTakeUpMm:offsetMm,cornerEndStops:true}});
 }
 for(const p of spec.panels){const constraints=new Map();for(const path of Object.values(p.edges))for(let i=1;i<path.length;i++){const e=[path[i-1],path[i]],k=e.slice().sort((a,b)=>a-b).join(':');constraints.set(k,e)}p.triangles=triangulate(p.uvMm,[...constraints.values()]).map(t=>{const[a,b,c]=t.map(i=>p.uvMm[i]);return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])>0?t:[t[0],t[2],t[1]]});
  const area=Math.abs(signed(p.boundary.map(i=>p.uvMm[i])));p.reinforcementCut={schema:'interior-narrow-fold-cut@1',originalMaterialVertexCount:p.uvMm.length,originalNetAreaMm2:area,newCutAreaMm2:area,addedAllowanceAreaMm2:0,netBoundaryMaterialIds:p.boundary.slice(),originalCoordinatesScaled:false,originalNetMaterialPreserved:true,interiorFoldTakeUpMm:offsetMm,newlyCutFacing:false};reports.push({panelId:p.id,...p.reinforcementCut});
 }
 spec.seams.push(...added);spec.revision++;spec.source.internalReinforcement={schema:'kaopu-double-stitch-construction@1',revision:3,requestedByUser:true,primarySeams:original.length,reinforcedSeams:added.length,requestedSecondRowOffsetMm:offsetMm,construction:'narrow inward folded row through existing original material; explicit local seam take-up, no exterior sliver allowance',panels:reports,materialAdded:false,originalNetPaperRescaled:false,strengthCalibrated:false,tearDamageModel:false,requiresActualSolve:true};scheduleInternalStages(spec);return spec;
}
