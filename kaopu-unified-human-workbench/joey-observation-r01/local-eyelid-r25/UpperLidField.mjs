import {SurfaceChart,headFrame,visibleRim,curve2,point,sub,dot,cross,unit,smooth} from './SurfaceBinding.mjs';
const finite=a=>a.every(Number.isFinite),clamp=x=>Math.max(0,Math.min(1,x));
const distance=(a,b)=>Math.hypot(...sub(a,b));
function validate(positions,faces,components,semantic){if(positions.length!==17821*3||components.length!==17821||semantic.length!==17821||faces.length%3)throw Error('Wrong fixed native domain');for(const i of faces)if(!Number.isInteger(i)||i<0||i>=17821)throw Error('Invalid native face');}
function makeFrame(landmark){return headFrame({eyeSurface:{landmark}});}
function adjacency(faces,n){const a=Array.from({length:n},()=>new Set());for(let k=0;k<faces.length;k+=3){const t=Array.from(faces.slice(k,k+3));for(let j=0;j<3;j++){a[t[j]].add(t[(j+1)%3]);a[t[(j+1)%3]].add(t[j]);}}return a;}
function interpolate(samples,u){let a=samples[0];for(let j=1;j<samples.length;j++){const b=samples[j];if(u<=b.u){const t=clamp((u-a.u)/(b.u-a.u));return a.y+(b.y-a.y)*t;}a=b;}return a.y;}
export function nativeSemantic(transfer){const s=new Int16Array(17821).fill(-1);for(let i=0;i<transfer.outer_ids.length;i++){if(transfer.anny_semantic_class[i]!==transfer.mhr_semantic_class[i])throw Error('Semantic sources disagree');s[transfer.outer_ids[i]]=transfer.anny_semantic_class[i];}return s;}
export function canonicalNativeFaces(canonical,bodyCount){const map=new Int32Array(bodyCount+canonical.gnmRecipes.length).fill(-1);canonical.gnmRecipes.forEach(([a,b,t],k)=>{if(a===b||t===0)map[bodyCount+k]=a;else if(t===1)map[bodyCount+k]=b;});const out=[];for(let k=0;k<canonical.faces.length;k+=3){const ids=canonical.faces.slice(k,k+3).map(i=>map[i]);if(ids.every(i=>i>=0))out.push(...ids);}return new Uint32Array(out);}
// This is an original, explicit local shape corrective. It is not a new
// GNM model, a learned identity direction, or a copy of the Disney detector.
export function buildUpperLidDomain({positions,faces,components,semantic,landmark,transfer}){
 validate(positions,faces,components,semantic);const frame=makeFrame(landmark),skinMask=Uint8Array.from(components,c=>c===0),skin=new SurfaceChart(positions,faces,frame,{mask:skinMask}),adj=adjacency(faces,17821),sides=[];
 const cornerIds=new Set(); // Runtime supplies exact landmark triangle support below.
 for(const def of [{name:'left',upper:3,lower:4,eye:1,lm:[42,43,44,45],lowerLM:[42,47,46,45]},{name:'right',upper:5,lower:6,eye:2,lm:[36,37,38,39],lowerLM:[36,41,40,39]}]){
  const q=def.lm.map(i=>frame.project(landmark(i))),lo=def.lowerLM.map(i=>frame.project(landmark(i))),x0=q[0][0],x1=q[3][0],width=x1-x0;if(!(width>.015&&width<.05))throw Error('Eye side or chord invalid');
  const globes=new SurfaceChart(positions,faces,frame,{mask:Uint8Array.from(components,c=>c===def.eye)}),samples=[];
  for(let k=0;k<=40;k++){const u=.12+.76*k/40,upper=curve2(q,u),lower=curve2(lo,u),x=x0+width*u,y0=(upper[1]+lower[1])*.5,y=visibleRim(x,y0,upper[1],1,skin,globes);if(y===null)continue;const hit=skin.query(x,y);if(!hit)continue;samples.push({u,x,y,ids:[...hit.ids],bary:[...hit.weights]});}
  if(samples.length<25)throw Error('Insufficient actual upper visible rim: '+def.name+' '+samples.length);
  const region=[];for(let i=0;i<17821;i++)if(semantic[i]===def.upper)region.push(i);
  // Distance to the external semantic-band boundary, excluding the registered
  // eye cavity. This yields a soft support boundary rather than a hard crease.
  const dist=new Float64Array(17821).fill(Infinity),pending=new Set(region);
  for(const i of region)if([...adj[i]].some(j=>semantic[j]>=0&&semantic[j]!==def.upper)){dist[i]=0;}
  while(pending.size){let chosen=-1,best=Infinity;for(const i of pending)if(dist[i]<best){chosen=i;best=dist[i];}if(chosen<0)break;pending.delete(chosen);for(const j of adj[chosen])if(pending.has(j))dist[j]=Math.min(dist[j],best+distance(point(positions,j),point(positions,chosen)));}
  const rows=[];for(const id of region){const p=frame.project(point(positions,id)),u=(p[0]-x0)/width;if(u<=.12||u>=.88)continue;const rim=interpolate(samples,u),band=1-smooth(.001,.008,Math.abs(p[1]-rim)),edge=smooth(0,.002,dist[id]),end=smooth(.12,.25,u)*(1-smooth(.75,.88,u));const w=band*edge*end;if(w>1e-8)rows.push({id,u,w,edgeMM:dist[id]*1000,rimDistanceMM:(p[1]-rim)*1000});}
  if(rows.length<30)throw Error('Upper-lid support too small');
  const cavityIds=Array.from(transfer[def.name+'_ocular_skin_ids']),boundary=Array.from(transfer[def.name+'_ocular_skin_boundary']),weights=Array.from(transfer[def.name+'_ocular_skin_weights']);
  const cavityGate=cavityIds.map(id=>{const p=frame.project(point(positions,id)),u=clamp((p[0]-x0)/width),chord=q[0][1]*(1-u)+q[3][1]*u;return smooth(0,.0018,p[1]-chord)*smooth(.12,.25,u)*(1-smooth(.75,.88,u));});
  const aperture=((q[1][1]-lo[1][1])+(q[2][1]-lo[2][1]))*.5;
  sides.push({...def,x0,x1,width,aperture,samples,rows,cavityIds,boundary,weights,cavityGate,centroidNativeX:region.reduce((s,i)=>s+positions[i*3],0)/region.length});
 }
 return{schema:'kaopu/local-upper-lid-domain/1',faces,components,semantic,sides,cornerIds,baseFrame:frame,description:'Fixed semantic upper bands; actual skin/globe projected rim; original ocular extension; fixed corners/lower skin/globes'};
}
export function applyUpperLidField({positions,landmark,domain,amplitudeMM=0,skew=0,blink={left:0,right:0},lockedIds=[]}){
 if(!Number.isFinite(amplitudeMM)||Math.abs(amplitudeMM)>.8||!Number.isFinite(skew)||Math.abs(skew)>.5)throw Error('Curvature parameter outside validated range');
 for(const side of ['left','right'])if(!Number.isFinite(blink[side])||blink[side]<0||blink[side]>1)throw Error('Invalid blink');
 const out=positions.slice(),delta=new Float64Array(positions.length),diagnostic={amplitudeMM,skew,sides:[],projectionSupportChanges:0};if(amplitudeMM===0)return{positions:out,delta,diagnostic};
 const frame=makeFrame(landmark),locked=new Set(lockedIds);
 for(const side of domain.sides){const upper=side.lm.map(i=>frame.project(landmark(i))),lower=side.lowerLM.map(i=>frame.project(landmark(i))),gap=((upper[1][1]-lower[1][1])+(upper[2][1]-lower[2][1]))*.5,gate=Math.min((1-blink[side.name])**2,smooth(.0002,Math.max(.001,side.aperture*.65),gap));const globes=new SurfaceChart(positions,domain.faces,frame,{mask:Uint8Array.from(domain.components,c=>c===side.eye)});let moved=0;
  if(gate>0)for(const {id,u,w}of side.rows){if(locked.has(id))continue;const p=point(positions,id),q=frame.project(p),arch=Math.sin(Math.PI*(u-.12)/.76)**2,shift=amplitudeMM*.001*w*arch*(1+skew*(2*(side.name==='left'?u:1-u)-1))*gate;if(Math.abs(shift)<1e-15)continue;const oldEye=globes.query(q[0],q[1]),newEye=globes.query(q[0],q[1]+shift);let dz=0;if(oldEye&&newEye)dz=newEye.depth-oldEye.depth;else if(!!oldEye!==!!newEye)diagnostic.projectionSupportChanges++;const d=frame.up.map((x,k)=>x*shift+frame.front[k]*dz);delta.set(d,id*3);moved++;}
  // Same fixed eye-cavity extension weights as HeadTransfer. The additional
  // upper-half gate keeps the lower inner wall fixed; it is explicitly tested.
  for(let r=0;r<side.cavityIds.length;r++){const id=side.cavityIds[r];if(locked.has(id)||side.cavityGate[r]===0)continue;for(let c=0;c<3;c++){let d=0;for(let k=0;k<side.boundary.length;k++)d+=side.weights[r*side.boundary.length+k]*delta[side.boundary[k]*3+c];delta[id*3+c]=d*side.cavityGate[r];}}
  diagnostic.sides.push({side:side.name,gate,apertureMM:gap*1000,movedUpper:moved,semanticClass:side.upper});
 }
 for(let i=0;i<out.length;i++)out[i]+=delta[i];if(!finite(out))throw Error('Nonfinite eyelid output');return{positions:out,delta,diagnostic};
}
export function geometricAudit(before,after,domain){
 let changed=0,maxMM=0,forbiddenMM=0,lowerMM=0,eyeMM=0,minNormalDot=1,minAreaRatio=Infinity,maxEdgeRatio=1;const allowed=new Set(domain.sides.flatMap(s=>[...s.rows.map(r=>r.id),...s.cavityIds]));
 for(let i=0;i<17821;i++){if(!Number.isFinite(before[i*3]))continue;const d=distance(point(before,i),point(after,i))*1000;if(d>0)changed++;maxMM=Math.max(maxMM,d);if(!allowed.has(i))forbiddenMM=Math.max(forbiddenMM,d);if([4,6].includes(domain.semantic[i]))lowerMM=Math.max(lowerMM,d);if([1,2].includes(domain.components[i]))eyeMM=Math.max(eyeMM,d);}
 for(let k=0;k<domain.faces.length;k+=3){const ids=Array.from(domain.faces.slice(k,k+3));if(!ids.some(i=>allowed.has(i)))continue;const a=ids.map(i=>point(before,i)),b=ids.map(i=>point(after,i)),n0=cross(sub(a[1],a[0]),sub(a[2],a[0])),n1=cross(sub(b[1],b[0]),sub(b[2],b[0])),l0=Math.hypot(...n0),l1=Math.hypot(...n1);if(l0<1e-14)continue;minNormalDot=Math.min(minNormalDot,dot(n0,n1)/l0/Math.max(l1,1e-30));minAreaRatio=Math.min(minAreaRatio,l1/l0);for(let e=0;e<3;e++){const x=distance(a[e],a[(e+1)%3]),y=distance(b[e],b[(e+1)%3]);if(x>1e-8)maxEdgeRatio=Math.max(maxEdgeRatio,y/x,x/Math.max(y,1e-30));}}
 return{changed,maxMM,forbiddenMM,lowerMM,eyeMM,minNormalDot,minAreaRatio,maxEdgeRatio};
}
export function contactAudit(before,after,domain,landmark){
 const frame=makeFrame(landmark),skin=new SurfaceChart(after,domain.faces,frame,{mask:Uint8Array.from(domain.components,c=>c===0)}),beforeSkin=new SurfaceChart(before,domain.faces,frame,{mask:Uint8Array.from(domain.components,c=>c===0)}),result=[];
 for(const side of domain.sides){const globes=new SurfaceChart(before,domain.faces,frame,{mask:Uint8Array.from(domain.components,c=>c===side.eye)}),support=new Set([...side.rows.map(r=>r.id),...side.cavityIds]),stats={side:side.name,samples:0,unsupported:0,lostEyeSupport:0,gainedEyeSupport:0,maxGapReductionMM:0,baselineMaxBehindMM:0,candidateMaxBehindMM:0,nearSurfaceSamples:0,nearSurfaceGapReductionMM:0,newBehindSamples:0,newBehindMaxMM:0,rim:[]};
  for(let k=0;k<domain.faces.length;k+=3){const ids=Array.from(domain.faces.slice(k,k+3));if(!ids.every(i=>domain.components[i]===0)||!ids.some(i=>support.has(i)))continue;const a=ids.map(i=>frame.project(point(before,i))),b=ids.map(i=>frame.project(point(after,i)));
   for(const w of [[1,0,0],[0,1,0],[0,0,1],[1/3,1/3,1/3],[.5,.5,0],[0,.5,.5],[.5,0,.5]]){const p=[0,1,2].map(c=>w.reduce((s,x,i)=>s+x*a[i][c],0)),q=[0,1,2].map(c=>w.reduce((s,x,i)=>s+x*b[i][c],0)),e0=globes.query(p[0],p[1]),e1=globes.query(q[0],q[1]);if(!e0||!e1){stats.unsupported++;if(e0&&!e1)stats.lostEyeSupport++;if(!e0&&e1)stats.gainedEyeSupport++;continue;}const g0=p[2]-e0.depth,g1=q[2]-e1.depth;stats.samples++;if(g0>=0&&g1<-.00004){stats.newBehindSamples++;stats.newBehindMaxMM=Math.max(stats.newBehindMaxMM,-g1*1000);}if(g0>-.0005){stats.nearSurfaceSamples++;stats.nearSurfaceGapReductionMM=Math.max(stats.nearSurfaceGapReductionMM,(g0-g1)*1000);}stats.maxGapReductionMM=Math.max(stats.maxGapReductionMM,(g0-g1)*1000);stats.baselineMaxBehindMM=Math.max(stats.baselineMaxBehindMM,-g0*1000);stats.candidateMaxBehindMM=Math.max(stats.candidateMaxBehindMM,-g1*1000);}
  }
  const q=side.lm.map(i=>frame.project(landmark(i))),lo=side.lowerLM.map(i=>frame.project(landmark(i)));
  for(const sample of side.samples){const hi=curve2(q,sample.u),low=curve2(lo,sample.u),x=q[0][0]+(q[3][0]-q[0][0])*sample.u,y0=(hi[1]+low[1])*.5,beforeY=visibleRim(x,y0,hi[1],1,beforeSkin,globes),afterY=visibleRim(x,y0,hi[1],1,skin,globes);stats.rim.push({u:sample.u,baselineY:beforeY,candidateY:afterY,deltaMM:beforeY===null||afterY===null?null:(afterY-beforeY)*1000});}
  result.push(stats);
 }return{method:'Head-frame front-envelope depth samples at affected skin triangle vertices/edges/centroids; actual visible-rim re-extraction',boundary:'A sampled depth audit, not full volumetric triangle collision or clinical eyelid contact',sides:result};
}
