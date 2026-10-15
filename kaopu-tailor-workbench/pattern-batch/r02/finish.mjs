// Explicit cut facings, turn-up stitching and elastic chest stays. All operations
// precede a new immutable cut and solve; no final garment positions are replaced.
const length=(p,ids)=>ids.slice(1).reduce((s,id,k)=>s+Math.hypot(...p.uvMm[id].map((x,j)=>x-p.uvMm[ids[k]][j])),0);
const area=p=>p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-a[1]*b[0]},0)/2;
const inside=(p,poly)=>{let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++)if((poly[i][1]>p[1])!==(poly[j][1]>p[1])&&p[0]<(poly[j][0]-poly[i][0])*(p[1]-poly[i][1])/(poly[j][1]-poly[i][1])+poly[i][0])c=!c;return c};
const key=(panel,id)=>panel+':'+id;
export function prepareFinishGuides(spec,analytic,triangulate){
 const refs=[],used=new Set(spec.seams.flatMap(s=>[s.a,s.b]).map(r=>r.panelId+':'+r.edge)),strapless=spec.panels.some(p=>p.analyticCurvesMm.some(e=>e.label==='strapless_top'));
 for(const p of spec.panels){
  const candidates=p.analyticCurvesMm.filter(e=>!used.has(p.id+':'+e.id)&&(e.label==='strapless_top'||(/^pant_/.test(p.id)&&!p.id.includes('sleeve')&&e.kind==='line')));
  for(const e of candidates){
   const ids=p.edges[e.id],poly=p.boundary.map(i=>p.uvMm[i]),ys=poly.map(q=>q[1]),mean=ids.reduce((s,i)=>s+p.uvMm[i][1],0)/ids.length;
   const chest=e.label==='strapless_top';if(!chest&&mean>Math.min(...ys)+2)continue;
   const points=ids.map(i=>p.uvMm[i]),L=length(p,ids),sign=Math.sign(area(poly)),width=chest?18:15;
   if(L<30)continue;let inset,row;
   for(const margin of [3,6,10,15,20]){
    const a=points[0],b=points.at(-1),d=[b[0]-a[0],b[1]-a[1]],D=Math.hypot(...d),tangent=d.map(x=>x/D),normal=[-tangent[1]*sign,tangent[0]*sign];
    if(!chest){inset=margin;row=ids.map((_,i)=>{const t=i/(ids.length-1),x=margin+(D-2*margin)*t;return [a[0]+tangent[0]*x+normal[0]*width,a[1]+tangent[1]*x+normal[1]*width]})}
    else {inset=margin;row=points.map((q,i)=>{const prev=points[Math.max(0,i-1)],next=points[Math.min(points.length-1,i+1)],d=[next[0]-prev[0],next[1]-prev[1]],l=Math.hypot(...d),n=[-d[1]/l*sign,d[0]/l*sign],t=i/(points.length-1);return [q[0]+n[0]*width+tangent[0]*margin*(1-2*t),q[1]+n[1]*width+tangent[1]*margin*(1-2*t)]})}
    if(row.every(q=>inside(q,poly)))break;row=null;
   }
   if(!row)throw Error('Finish return row leaves material: '+p.id+':'+e.id);
   if(chest){refs.push({panelId:p.id,edge:e.id,kind:'elastic-chest-stay',widthMm:2,lengthMm:L,representation:'sewn elastic cord line element; cloth casing not represented'});continue}
   const returnKey='finish_return_'+e.id,returnIds=row.map(q=>{const i=p.uvMm.length;p.uvMm.push(q);return i});p.edges[returnKey]=returnIds;p.edgeNotches[returnKey]=[];
   refs.push({panelId:p.id,edge:e.id,returnEdge:returnKey,widthMm:width,insetMm:inset,lengthMm:L,returnLengthMm:length(p,returnIds),kind:chest?'elastic-chest-stay':'hem-facing',sourceLabel:e.label,materialRow:row});
  }
  if(refs.some(r=>r.panelId===p.id)){
   const constraints=new Map();for(const ids of Object.values(p.edges))for(let i=1;i<ids.length;i++){const pair=[ids[i-1],ids[i]],k=pair.slice().sort((a,b)=>a-b).join(':');constraints.set(k,pair)}
   p.triangles=triangulate(p.uvMm,[...constraints.values()]).map(t=>{const[a,b,c]=t.map(i=>p.uvMm[i]);return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])>0?t:[t[0],t[2],t[1]]});
  }
 }
 const chestPerimeter=refs.filter(r=>r.kind==='elastic-chest-stay').reduce((s,r)=>s+r.lengthMm,0),bustMm=spec.source.bodyMeasurements.bust*10,target=chestPerimeter?bustMm*.92:0,ratio=chestPerimeter?Math.min(1.05,Math.max(.72,target/chestPerimeter)):.92;
 spec.source.finishRevision={revision:3,requestedByUser:true,refs,strapless,netRestCoordinatesScaled:false,hemTurnUpMm:15,chestStayWidthMm:18,elasticLengthRatio:ratio,chestPaperPerimeterMm:chestPerimeter,referenceBustMm:bustMm,targetElasticLengthMm:target,materialCalibrated:false,worldPins:false};return refs;
}
export function addFinishedEdges(spec){
 const info=spec.source.finishRevision;if(!info?.refs.length)return;const panels=new Map(spec.panels.map(p=>[p.id,p])),parent=new Map();
 const find=k=>{if(!parent.has(k))parent.set(k,k);if(parent.get(k)!==k)parent.set(k,find(parent.get(k)));return parent.get(k)};
 const union=(a,b)=>{a=find(a);b=find(b);if(a!==b)parent.set(a,b)};
 for(const s of spec.seams.filter(s=>!s.isInternalReinforcement))for(const[a,b]of s.stitchVertexPairs)union(key(s.a.panelId,a),key(s.b.panelId,b));
 const ends=new Map(),newSeams=[];
 const seam=(id,pa,ea,pb,eb,reverseB,stage,extra={})=>{
  const aa=pa.edges[ea],bb=reverseB?pb.edges[eb].slice().reverse():pb.edges[eb],la=length(pa,aa),lb=length(pb,bb),notches=[id+':start',id+':end'];
  pa.edgeNotches[ea]=notches.map((id,i)=>({id,t:i}));pb.edgeNotches[eb]=notches.map((id,i)=>({id,t:reverseB?1-i:i}));
  const pairs=aa.map((x,i)=>[x,bb[pb.finishFacing&&pa.id===pb.finishFacing.panelId?pb.finishFacing.fractions.indexOf(i/(aa.length-1)):Math.round(i*(bb.length-1)/(aa.length-1))]]);if(pairs.some(x=>x[1]===undefined)||new Set(pairs.map(x=>x[1])).size!==pairs.length)throw Error('Finish stitch sample correspondence');
  return {id,a:{panelId:pa.id,edge:ea,reverse:false},b:{panelId:pb.id,edge:eb,reverse:reverseB},easeMm:lb-la,notches,stageId:stage,stitchVertexPairs:pairs,isFinishConstruction:true,
   sourceSeam:{id,constructionFinish:true,isDart:false,lengthAMm:la,lengthBMm:lb,gathering:{ruffleCoefficientA:la/Math.min(la,lb),ruffleCoefficientB:lb/Math.min(la,lb),projectedLengthAMm:Math.min(la,lb),projectedLengthBMm:Math.min(la,lb)}},numericalStitchPlan:{constructionFinish:true,physicalNeedleSpacing:false,materialEdgeSampleCountA:aa.length,materialEdgeSampleCountB:bb.length},...extra};
 };
 if(!spec.materials.some(m=>m.id==='elastic-stay'))spec.materials.push({id:'elastic-stay',densityKgM2:.08,stretchCompliance:5e-7,bendCompliance:20,calibrated:false});
 for(const ref of info.refs){
  if(ref.kind==='elastic-chest-stay')continue;
  const p=panels.get(ref.panelId),source=p.edges[ref.edge],n=source.length,factor=ref.kind==='elastic-chest-stay'?info.elasticLengthRatio:1,L=ref.lengthMm*factor,top=ref.returnLengthMm*factor,width=ref.widthMm,uv=[];
  // Same stations as the source edge, plus interior end-stop columns.
  const fractions=[...new Set([0,2/ref.lengthMm,...source.map((_,i)=>i/(n-1)),1-2/ref.lengthMm,1])].sort((a,b)=>a-b),cols=fractions.length,rows=5;
  for(let r=0;r<rows;r++)for(const t of fractions){const q=r/(rows-1),rowL=L+(top-L)*q;uv.push([(L-rowL)/2+t*rowL,q*width])}
  const at=(r,c)=>r*cols+c,triangles=[];for(let r=0;r<rows-1;r++)for(let c=0;c<cols-1;c++)triangles.push([at(r,c),at(r,c+1),at(r+1,c+1)],[at(r,c),at(r+1,c+1),at(r+1,c)]);
  const id='finish_'+p.id+'_'+ref.edge,bottom=fractions.map((_,i)=>at(0,i)),upper=fractions.map((_,i)=>at(rows-1,i)),boundary=[...bottom,...Array.from({length:rows-1},(_,i)=>at(i+1,cols-1)),...upper.slice(0,-1).reverse(),...Array.from({length:rows-2},(_,i)=>at(rows-2-i,0))];
  const station=source.map((_,i)=>fractions.indexOf(i/(n-1))),start=fractions.indexOf(2/ref.lengthMm),end=fractions.indexOf(1-2/ref.lengthMm);
  const band={id,source:{kind:'project-owned-real-cut-finish-facing',version:'R02-finish-3',bodySide:p.source.bodySide,originalPanelId:id,originalPlacement:structuredClone(p.source.originalPlacement),parentPanel:p.id},materialId:ref.kind==='elastic-chest-stay'?'elastic-stay':p.materialId,uvMm:uv,triangles,boundary,edges:{attach:bottom,return:upper,end0:Array.from({length:rows},(_,r)=>at(r,0)),end1:Array.from({length:rows},(_,r)=>at(r,cols-1)),inner0:[1,2,3].map(r=>at(r,start)),inner1:[1,2,3].map(r=>at(r,end))},edgeNotches:{},grain:[1,0],seamAllowanceMm:0,allowanceState:'meshed_flat_unfolded',placement:structuredClone(p.placement),temporaryPins:[],temporaryPinTargetsMm:{},temporaryGuideMaterialIds:[],meshType:'unstructured',analyticCurvesMm:[],finishFacing:{...ref,factor,fractions,columns:cols,rows},reinforcementCut:{schema:'new-facing-material@1',originalMaterialVertexCount:uv.length,originalNetAreaMm2:(L+top)*width/2,newCutAreaMm2:(L+top)*width/2,addedAllowanceAreaMm2:0,originalCoordinatesScaled:false,newlyCutFacing:true}};
  spec.panels.push(band);panels.set(id,band);
  const stage=ref.kind==='hem-facing'?'legs':'sides',primary='finish_attach_'+id;
  newSeams.push(seam(primary,p,ref.edge,band,'attach',false,stage));
  newSeams.push(seam(primary+'__inner',p,ref.returnEdge,band,'return',false,stage+'__reinforce',{isInternalReinforcement:true,parentSeamId:primary}));
  for(const [column,vertex]of [[0,source[0]],[1,source.at(-1)]]){const root=find(key(p.id,vertex));if(!ends.has(root))ends.set(root,[]);ends.get(root).push({band,column,stage})}
 }
 for(const [root,group]of ends){if(group.length!==2)throw Error('Facing circuit has an open or branching junction: '+root+' '+group.length);const[a,b]=group,id='finish_join_'+a.band.id+'_'+a.column;
  newSeams.push(seam(id,a.band,'end'+a.column,b.band,'end'+b.column,false,a.stage));newSeams.push(seam(id+'__inner',a.band,'inner'+a.column,b.band,'inner'+b.column,false,a.stage+'__reinforce',{isInternalReinforcement:true,parentSeamId:id}));
 }
 spec.seams.push(...newSeams);const primaries=newSeams.filter(s=>!s.isInternalReinforcement).length;spec.source.internalReinforcement.primarySeams+=primaries;spec.source.internalReinforcement.reinforcedSeams+=primaries;info.newPanels=info.refs.filter(r=>r.kind==='hem-facing').length;info.newSeams=newSeams.length;
 if(info.strapless){spec.elasticStays=info.refs.filter(r=>r.kind==='elastic-chest-stay').map(ref=>{const p=panels.get(ref.panelId),path=p.edges[ref.edge],indices=path.filter((_,i)=>i%3===0||i===path.length-1),segments=[];for(let i=1;i<indices.length;i++){const a=path.indexOf(indices[i-1]),b=path.indexOf(indices[i]),rest=length(p,path.slice(a,b+1))*info.elasticLengthRatio;segments.push({a:indices[i-1],b:indices[i],restLengthMm:rest,...(spec.panels.some(p=>p.id.startsWith('skirt_'))?{axialRigidityN:60,springNPerM:60/(rest*.001),compliance:rest*.001/60}:{})})}return {panelId:p.id,sourceEdge:ref.edge,segments,material:'uncalibrated tensile elastic cord',compliance:spec.panels.some(p=>p.id.startsWith('skirt_'))?.00125:.0025,springNPerM:spec.panels.some(p=>p.id.startsWith('skirt_'))?800:400,diameterMm:2}})}

 // A strapless full-length skirt transfers its weight through the existing waist
 // band as well as the upper edge. Add a sewn tensile waist stay, never a world pin.
 if(info.strapless&&spec.panels.some(p=>p.id.startsWith('skirt_'))){
  const waistPanels=spec.panels.filter(p=>p.id.startsWith('wb_')),refs=waistPanels.map(p=>{const e=p.analyticCurvesMm.filter(e=>e.kind==='line').sort((a,b)=>length(p,p.edges[b.id])-length(p,p.edges[a.id]))[0];return {p,e,L:length(p,p.edges[e.id])}}),total=refs.reduce((s,r)=>s+r.L,0),target=spec.source.bodyMeasurements.waist*10*.94,ratio=target/total;
  for(const {p,e,L}of refs){const path=p.edges[e.id],ids=path.filter((_,i)=>i%3===0||i===path.length-1),segments=[];for(let j=1;j<ids.length;j++){const a=path.indexOf(ids[j-1]),b=path.indexOf(ids[j]),rest=length(p,path.slice(a,b+1))*ratio;segments.push({a:ids[j-1],b:ids[j],restLengthMm:rest,axialRigidityN:30,springNPerM:30/(rest*.001),compliance:rest*.001/30})}spec.elasticStays.push({panelId:p.id,sourceEdge:e.id,segments,kind:'waist-load-support',material:'uncalibrated tensile waist stay',compliance:.001,springNPerM:800,diameterMm:2});info.refs.push({panelId:p.id,edge:e.id,kind:'elastic-waist-stay',widthMm:2,lengthMm:L,representation:'sewn 1D waist stay on the existing waistband; no world target'})}
  info.waistSupport={referenceWaistMm:spec.source.bodyMeasurements.waist*10,restLengthMm:target,axialRigidityN:30,bodyChanged:false,worldPins:false,calibrated:false};
 }
 spec.revision++;return info;
}
export function installElasticStays(lab){if(!lab.spec.elasticStays)return;lab.elasticEnabled=false;lab.elasticConstraintIndices=[];for(const stay of lab.spec.elasticStays){const o=lab.offsets.get(stay.panelId);for(const seg of stay.segments){lab.elasticConstraintIndices.push(lab.constraints.length);lab.constraints.push({a:o+seg.a,b:o+seg.b,rest:seg.restLengthMm*.001,compliance:seg.compliance??stay.compliance,tensileCompliance:seg.compliance??stay.compliance,lambda:0,type:'elastic-stay'})}}lab.syncConstraints();lab.elasticStayProof={segments:lab.elasticConstraintIndices.length,restLengthMm:lab.spec.elasticStays.reduce((s,r)=>s+r.segments.reduce((s,r)=>s+r.restLengthMm,0),0),worldPins:false,bodyChanged:false,originalClothRestMetricChanged:false,oneDimensionalMaterial:true,calibrated:false}}
export function prepareFinishFixtures(spec,sdf,body){
 if(!spec.elasticStays||!spec.source.generationSource.finishPatternRevision)return;const q=new Float64Array(5),placed=[],height=spec.source.generationSource.finishPatternRevision.targetHeightMm+.013,segments=[];
 for(const tri of body.triangles){const P=tri.map(i=>body.positionsMm[i]),hits=[];for(let i=0;i<3;i++){const A=P[i],B=P[(i+1)%3];if((A[1]-height)*(B[1]-height)<0){const t=(height-A[1])/(B[1]-A[1]);hits.push(A.map((x,k)=>x+(B[k]-x)*t))}}if(hits.length===2)segments.push(hits)}
 const parent=new Map(),k=P=>[P[0],P[2]].map(x=>Math.round(x*1000)).join(','),find=x=>{if(!parent.has(x))parent.set(x,x);if(parent.get(x)!==x)parent.set(x,find(parent.get(x)));return parent.get(x)};
 for(const[A,B]of segments)parent.set(find(k(A)),find(k(B)));const groups=new Map();for(const s of segments){const root=find(k(s[0]));if(!groups.has(root))groups.set(root,[]);groups.get(root).push(s)}
 const torso=[...groups.values()].sort((a,b)=>b.reduce((s,[A,B])=>s+Math.hypot(...A.map((x,k)=>x-B[k])),0)-a.reduce((s,[A,B])=>s+Math.hypot(...A.map((x,k)=>x-B[k])),0))[0];
 const points=new Map(),neighbors=new Map();for(const[A,B]of torso){const a=k(A),b=k(B);points.set(a,A);points.set(b,B);if(!neighbors.has(a))neighbors.set(a,[]);if(!neighbors.has(b))neighbors.set(b,[]);neighbors.get(a).push(b);neighbors.get(b).push(a)}
 const start=[...points.keys()].sort((a,b)=>points.get(a)[2]-points.get(b)[2])[0],order=[start];let previous=null,current=start;
 do{const choices=neighbors.get(current),next=previous?choices.find(x=>x!==previous):choices.sort((a,b)=>points.get(b)[0]-points.get(a)[0])[0];previous=current;current=next;order.push(current);if(order.length>points.size+2)throw Error('Upper section is not a simple circuit')}while(current!==start);
 const contour=order.map(x=>points.get(x)),arc=[0];for(let i=1;i<contour.length;i++)arc.push(arc.at(-1)+Math.hypot(...contour[i].map((x,k)=>x-contour[i-1][k])));const perimeter=arc.at(-1);
 const sample=s=>{let i=0;while(i<arc.length-2&&arc[i+1]<s)i++;const t=(s-arc[i])/(arc[i+1]-arc[i]);return contour[i].map((x,k)=>x+(contour[i+1][k]-x)*t)};
 const quadrants=spec.elasticStays.map(stay=>{const p=spec.panels.find(p=>p.id===stay.panelId),path=p.edges[stay.sourceEdge],b=p.placement.rigidBasis,t=p.placement.translationMm,worldX=i=>b[0]*p.uvMm[i][0]+b[1]*p.uvMm[i][1]+t[0],mean=path.reduce((s,i)=>s+worldX(i),0)/path.length,front=p.source.bodySide!=='back',quadrant=front?(mean>0?1:2):(mean>0?0:3);return {stay,p,path,worldX,quadrant,front,extent:Math.max(...path.map(i=>Math.abs(worldX(i)))),L:length(p,path)}}).sort((a,b)=>a.quadrant-b.quadrant);
 const total=quadrants.reduce((s,r)=>s+r.L,0);let begin=0;
 for(const row of quadrants){const{p,path,worldX,quadrant,extent,L}=row;for(const i of path){const u=Math.abs(worldX(i))/extent,t=quadrant===0||quadrant===2?u:1-u,P=sample((begin+t*L)/total*perimeter).map(x=>x*.001);sdf.sample(...P,q);const l=Math.hypot(q[1],q[3])||1;P[0]+=q[1]/l*.004;P[2]+=q[3]/l*.004;p.temporaryPins.push(i);p.temporaryPinTargetsMm[i]=P.map(x=>x*1000);placed.push({panelId:p.id,materialVertex:i,targetMm:P.map(x=>x*1000)})}begin+=L}
 spec.source.finishFixtures={kind:'temporary upper sewing-jig boundary on the exact-body torso cross-section; flat cut interiors deform by sewing',placed,release:'all removed before gravity and 3-second wear test',permanentWearPins:false};
}
export function initializeFinishPanels(lab){
 const info=lab.spec.source.finishRevision;if(!info)return;const panels=new Map(lab.spec.panels.map(p=>[p.id,p]));

 const symmetric=lab.spec.source.initialLegSymmetry;
 if(symmetric){let copied=0;const sourceSuffix=symmetric.sourceSide==='right'?'r':'l',targetSuffix=sourceSuffix==='r'?'l':'r';for(const p of lab.spec.panels.filter(p=>new RegExp('^pant_[fb]_'+targetSuffix+'$').test(p.id))){const other=panels.get(p.id.replace(/_[rl]$/,'_'+sourceSuffix)),o=lab.offsets.get(other.id),to=lab.offsets.get(p.id);for(let i=0;i<p.uvMm.length;i++){const [u,v]=p.uvMm[i];if(v>=symmetric.blendEndsMaterialYmm)continue;const q=[-u,v];let world=null;for(const tri of other.triangles){const[A,B,C]=tri.map(i=>other.uvMm[i]),d=[B[0]-A[0],B[1]-A[1]],e=[C[0]-A[0],C[1]-A[1]],w=[q[0]-A[0],q[1]-A[1]],det=d[0]*e[1]-d[1]*e[0];if(Math.abs(det)<1e-10)continue;const x=(w[0]*e[1]-w[1]*e[0])/det,y=(d[0]*w[1]-d[1]*w[0])/det;if(x>=-1e-5&&y>=-1e-5&&x+y<=1+1e-5){world=[0,1,2].map(k=>(1-x-y)*lab.positions[o+tri[0]][k]+x*lab.positions[o+tri[1]][k]+y*lab.positions[o+tri[2]][k]);world[0]*=-1;break}}if(!world)throw Error('Initial mirrored leg UV has no matching cloth: '+p.id);const a=Math.max(0,Math.min(1,(symmetric.blendEndsMaterialYmm-v)/(symmetric.blendEndsMaterialYmm-symmetric.fullBelowMaterialYmm))),weight=a*a*(3-2*a);for(let k=0;k<3;k++){lab.positions[to+i][k]+=(world[k]-lab.positions[to+i][k])*weight;lab.previous[to+i][k]=lab.positions[to+i][k];lab.velocity[to+i][k]=0}copied++}}lab.initialLegSymmetryProof={...symmetric,copiedMaterialVertices:copied,finalPositionsReplaced:false};}
 // Lift only the INITIAL sewn state to its original design top datum. This is a
 // rigid assembly placement; gravity, all stitches and collision run afterwards.
 let lift=0;
 if(info.strapless){let planned=0,current=0,count=0;for(const ref of info.refs.filter(r=>r.kind==='elastic-chest-stay')){const p=panels.get(ref.panelId),b=p.placement.rigidBasis,t=p.placement.translationMm,o=lab.offsets.get(p.id);for(const i of p.edges[ref.edge]){const[u,v]=p.uvMm[i];planned+=(b[3]*u+b[4]*v+t[1])*.001;current+=lab.positions[o+i][1];count++}}lift=Math.max(0,Math.min(.09,(planned-current)/count));for(const p of lab.spec.panels.filter(p=>!p.finishFacing)){const off=lab.offsets.get(p.id);for(let i=0;i<p.uvMm.length;i++){lab.positions[off+i][1]+=lift;lab.previous[off+i][1]+=lift}}}
 for(const band of lab.spec.panels.filter(p=>p.finishFacing)){
  const ref=band.finishFacing,p=panels.get(ref.panelId),a=p.edges[ref.edge],b=p.edges[ref.returnEdge],off=lab.offsets.get(p.id),bo=lab.offsets.get(band.id);
  const sample=(ids,t)=>{const f=t*(ids.length-1),j=Math.min(ids.length-2,Math.floor(f)),u=f-j;return [0,1,2].map(k=>lab.positions[off+ids[j]][k]*(1-u)+lab.positions[off+ids[j+1]][k]*u)};
  for(let r=0;r<ref.rows;r++)for(let c=0;c<ref.columns;c++){const t=ref.fractions[c],A=sample(a,t),B=sample(b,t),q=r/(ref.rows-1),radial=[A[0],0,A[2]],l=Math.hypot(...radial)||1,world=A.map((x,k)=>x+(B[k]-x)*q-radial[k]/l*.00025),i=bo+r*ref.columns+c;for(let k=0;k<3;k++){lab.positions[i][k]=world[k];lab.previous[i][k]=world[k];lab.velocity[i][k]=0}}
 }
 if(info.strapless&&lab.spec.source.finishFixtures){for(const p of lab.spec.panels){const o=lab.offsets.get(p.id);for(const [i,target]of Object.entries(p.temporaryPinTargetsMm||{}))lab.pins.set(o+Number(i),target.map(x=>x*.001))}}
 else{for(const [i]of lab.pins)lab.pins.set(i,Array.from(lab.positions[i]));for(const h of lab.support){h.start=Array.from(lab.positions[h.id]);h.target=h.start.slice()}}
 lab.finishProof={revision:3,facings:info.newPanels,initialRigidLiftMm:lift*1000,allFinalPositionsSolved:true,worldPins:false,initialLegSymmetry:lab.initialLegSymmetryProof||null,elasticRestRatio:info.elasticLengthRatio};
}
export function contactSnapshot(lab){if(!lab.spec.source.finishRevision?.strapless||!lab.spec.elasticStays)return null;for(const i of lab.elasticConstraintIndices||[])lab.cf[i*10+1]=1e6;if(!lab.elasticEnabled)return null;return lab.positions.map((p,i)=>[...p,...lab.velocity[i]])}
export function measureFinish(lab){const info=lab.spec.source.finishRevision;if(!info)return null;return {pins:lab.pins.size,supports:lab.support.length,edges:info.refs.map(ref=>{const p=lab.spec.panels.find(p=>p.id===ref.panelId),off=lab.offsets.get(p.id),ids=p.edges[ref.edge],points=ids.map(i=>Array.from(lab.positions[off+i],x=>x*1000));return {panelId:p.id,kind:ref.kind,meanYmm:points.reduce((s,q)=>s+q[1],0)/points.length,minYmm:Math.min(...points.map(q=>q[1])),maxYmm:Math.max(...points.map(q=>q[1]))}})}}
export function applyFinishContact(lab,before,dt=1/60){
 if(!before)return;const operatorCap=Infinity;const q=new Float64Array(5),elasticRoots=new Set();for(const p of lab.spec.panels.filter(p=>p.materialId==='elastic-stay')){const o=lab.offsets.get(p.id);for(let i=0;i<p.uvMm.length;i++)elasticRoots.add(lab.alias[o+i])}for(const stay of lab.spec.elasticStays||[]){const o=lab.offsets.get(stay.panelId),p=lab.spec.panels.find(p=>p.id===stay.panelId);for(const i of p.edges[stay.sourceEdge])elasticRoots.add(lab.alias[o+i])}let contacts=0;
 // Contact the physical elastic spans as well as cloth vertices. A long chord
 // between two outside vertices must not cut through the chest surface.
 let spanContacts=0;const spanNormals=new Map(),elasticLambdas=new Map();
 for(let pass=0;pass<6;pass++){for(const stay of lab.spec.elasticStays||[]){const off=lab.offsets.get(stay.panelId);for(const s of stay.segments){const a=lab.alias[off+s.a],b=lab.alias[off+s.b],A=lab.positions[a],B=lab.positions[b],d=A.map((x,k)=>x-B[k]),L=Math.hypot(...d),C=L-s.restLengthMm*.001;if(a===b||C<=0)continue;const wa=lab.invMass[a],wb=lab.invMass[b],alpha=(s.compliance??stay.compliance)/(dt*dt),prior=elasticLambdas.get(s)||0,rawDl=(-C-alpha*prior)/(wa+wb+alpha),limit=operatorCap/(Math.max(wa,wb)||1),dl=Math.max(-limit,Math.min(limit,rawDl));elasticLambdas.set(s,prior+dl);for(let k=0;k<3;k++){A[k]+=wa*dl*d[k]/L;B[k]-=wb*dl*d[k]/L}}}for(const stay of lab.spec.elasticStays||[]){const o=lab.offsets.get(stay.panelId);for(const s of stay.segments){const ia=lab.alias[o+s.a],ib=lab.alias[o+s.b];if(ia===ib)continue;const A=lab.positions[ia],B=lab.positions[ib],wa=lab.invMass[ia],wb=lab.invMass[ib],count=Math.max(4,Math.ceil(Math.hypot(...A.map((x,k)=>x-B[k]))/.004));for(let j=1;j<count;j++){const t=j/count,point=A.map((x,k)=>x*(1-t)+B[k]*t);lab.sdf.sample(...point,q);if(!q[4]||q[0]>lab.clearance+.0005)continue;for(const [i,w]of [[ia,1-t],[ib,t]]){if(!spanNormals.has(i))spanNormals.set(i,[0,0,0]);for(let k=0;k<3;k++)spanNormals.get(i)[k]+=q[k+1]*w}if(q[0]>=lab.clearance)continue;const denominator=wa*(1-t)**2+wb*t*t;if(denominator<=0)continue;const delta=Math.min((lab.clearance-q[0])/denominator,operatorCap/(Math.max(wa*(1-t),wb*t)||1));for(let k=0;k<3;k++){A[k]+=q[k+1]*delta*wa*(1-t);B[k]+=q[k+1]*delta*wb*t}spanContacts++}}}}
 const forces=new Map();for(const stay of lab.spec.elasticStays||[]){const o=lab.offsets.get(stay.panelId);for(const s of stay.segments){const a=lab.alias[o+s.a],b=lab.alias[o+s.b],A=lab.positions[a],B=lab.positions[b],d=B.map((x,k)=>x-A[k]),L=Math.hypot(...d),T=(s.springNPerM??stay.springNPerM)*Math.max(0,L-s.restLengthMm*.001);if(!L||!T)continue;for(const [i,sign]of [[a,1],[b,-1]]){if(!forces.has(i))forces.set(i,[0,0,0]);for(let k=0;k<3;k++)forces.get(i)[k]+=sign*T*d[k]/L}}}
 for(let i=0;i<lab.positions.length;i++){if(lab.alias&&lab.alias[i]!==i)continue;const mu=elasticRoots.has(i)?.8:.3,P=lab.positions[i];lab.sdf.sample(...P,q);if(!q[4]||(q[0]>lab.clearance+.0005&&!spanNormals.has(i)))continue;const rawNormal=spanNormals.get(i)||[q[1],q[2],q[3]],normalLength=Math.hypot(...rawNormal)||1,N=rawNormal.map(x=>x/normalLength),old=before[i],move=P.map((x,k)=>x-old[k]),normal=move.reduce((s,x,k)=>s+x*N[k],0),tangent=move.map((x,k)=>x-normal*N[k]),slip=Math.hypot(...tangent);const predicted=old.slice(0,3).map((x,k)=>x+old[k+3]*dt-(k===1?9.81*dt*dt*lab.gravityScale:0));const response=Math.max(0,P.reduce((s,x,k)=>s+(x-predicted[k])*N[k],0)),force=forces.get(i)||[0,0,0],load=Math.max(0,-force.reduce((s,x,k)=>s+x*N[k],0)),pressure=load*lab.invMass[i]*dt*dt;const correction=Math.min(operatorCap,slip,mu*(response+pressure));if(correction>0&&slip>1e-12){for(let k=0;k<3;k++){P[k]-=tangent[k]*correction/slip;lab.velocity[i][k]-=tangent[k]*correction/slip/dt}contacts++}}
 lab.finishContactReport={model:'tension-only XPBD elastic projection after cloth strain guard, coupled span SDF contact and bounded Coulomb friction',elasticProjectionAfterClothGuard:true,elasticIterations:6,newOperatorDisplacementCapMm:Number.isFinite(operatorCap)?operatorCap*1000:null,elasticSpringNPerM:[...new Set(lab.spec.elasticStays.flatMap(s=>s.segments.map(q=>q.springNPerM??s.springNPerM)))],elasticAxialRigidityN:[...new Set(lab.spec.elasticStays.flatMap(s=>s.segments.map(q=>q.axialRigidityN).filter(Boolean)))],elasticSpanSamplingMm:4,elasticSpanPasses:6,elasticCoefficient:.8,clothCoefficient:.3,calibrated:false,worldPins:false,lastContacts:contacts,lastSpanContacts:spanContacts,continuousCollisionCertified:false};
}
