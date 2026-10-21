/* R07 candidate 01: bounded, screened fairing of the original lower return.
 * No replacement surface. Existing body/contact one-ring is fixed. Binding
 * uses original rest/index and graph distance, never the erroneous upper tag.
 * Fair only mouth-up/front, once before first native normal rebuild; then
 * preserve the complete inherited R06/R05/native evaluator and microgeometry.
 */
(function () {
  'use strict';
  if (window.__LIP_EDGE_SOLVER__) throw Error('Edge solver already exists');
  const VERSION='native-lower-return-fairing@2', LENGTH=.001, MAX_DELTA_MM=.6;
  const ZERO_REST_THRESHOLD=1e-12;
  const MAX_ITERATIONS=512, RESIDUAL_MM=.0001, RELATIVE_RESIDUAL=1e-6;
  const own=(o,k)=>Object.getOwnPropertyDescriptor(o,k);
  const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
  const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
  const point=(a,id)=>[a[id*3],a[id*3+1],a[id*3+2]];
  const sub=(a,b)=>a.map((x,k)=>x-b[k]);
  const dot=(a,b)=>a.reduce((s,x,k)=>s+x*b[k],0);
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const unit=a=>{const n=Math.hypot(...a);if(!(n>1e-12))throw Error('Degenerate mouth frame');return a.map(x=>x/n);};
  const sameDescriptor=(a,b)=>a===undefined?b===undefined:b!==undefined&&['value','get','set','writable','enumerable','configurable'].every(k=>a[k]===b[k]);
  function put(o,k,value){const d=own(o,k);if(d?.configurable===false)throw Error('Native descriptor is not configurable');Object.defineProperty(o,k,{configurable:true,writable:true,enumerable:d?.enumerable||false,value});}
  function undo(o,k,d){if(d)Object.defineProperty(o,k,d);else if(!Reflect.deleteProperty(o,k))throw Error('Native descriptor restoration failed');}
  function fingerprint(a){const b=new Uint8Array(a.buffer,a.byteOffset,a.byteLength);let h=2166136261;for(let i=0;i<b.length;i++)h=Math.imul(h^b[i],16777619);return(h>>>0).toString(16).padStart(8,'0')+':'+b.length;}
  const selectedExact=(a,b,ids)=>ids.every(id=>[0,1,2].every(k=>Object.is(a[id*3+k],b[id*3+k])));
  function sourceKey(c){const m=c.model;return JSON.stringify({identity:m.state.gnm.identity,phenotypes:m.state.anny.phenotypes,localChanges:m.state.anny.localChanges,identityShape:m.identityLab?.settings?.shape,
    nativeShape:['structure','upperVolume','lowerVolume','cupid','tubercle','corners'].map(k=>c.structure.settings[k]),tissueDepth:c.structure.anatomy.settings.tissueDepth,
    lip:window.lipRealism.settings(),head:window.headProceduralSkin.settings(),body:window.bodyProceduralSkin.settings(),
    material:c.structure.settings,anatomy:Object.fromEntries(Object.entries(c.structure.anatomy.settings).filter(([k])=>k!=='microGeometry'))});}
  function materialValues(m){const r={};for(const k of['roughness','metalness','ior','specularIntensity','clearcoat','clearcoatRoughness','transmission','thickness','opacity','side','transparent','wireframe','depthTest','depthWrite','alphaTest','vertexColors','flatShading','bumpScale','displacementScale','displacementBias','emissiveIntensity','envMapIntensity'])r[k]=m[k];for(const k of['color','emissive','specularColor','normalScale'])r[k]=m[k]?.toArray?.()||null;return JSON.stringify(r);}
  function compatibility(c){
    // Only outside native evaluation. R02 transiently scales microGeometry
    // inside mother.update; asking R06's public report there would invalidate
    // a legitimate zero-pucker bypass as if it were custom authoring.
    const r=window.cornerLip?.report?.();
    if(window.cornerLip?.version!=='LIP-CORNER-R06'||r?.comparison!=='r06'||r.solver?.version!=='native-corner-pucker-vector@3'||!r.solver.installed||!r.solver.valid||!r.solver.enabled||r.solver.errors?.length||
      r.motionComparison!=='r05'||!r.motionSolver?.valid||!r.motionSolver.enabled||r.innerComparison!=='r04')return 'Matched R06/R05/R04 is not enabled and valid';
    if(c.ownership&&r.motionSolver.calibration?.ownershipFingerprint!==c.ownership)return 'R05 ownership calibration changed';
    return null;
  }
  function invalidate(c,reason){c.valid=false;c.enabled=false;c.invalidationReason=reason;}
  function invalidation(c,inEvaluation){
    if(c.viewer.currentLip!==c.lip||c.model.lipStructure!==c.structure||c.solver.topology!==c.top||c.top.geometry!==c.geometry||c.structure.mother.surfaces.get(c.lip.geometry)!==c.solver)return 'Native person or geometry changed';
    const a=c.geometry.attributes;
    if(a.fRest.array!==c.rest||a.csType.array!==c.type||a.l19Oral.array!==c.oral||c.geometry.index.array!==c.index||c.top.samples!==c.samples||c.top.pairs!==c.pairs||c.top.count!==c.count)return 'Native topology or semantic domain changed';
    if(c.sourceKey&&sourceKey(c)!==c.sourceKey)return 'Native identity, shape or material authoring changed';
    if(c.reference!==c.solver.reference||c.referenceHorizontal!==c.solver.referenceHorizontal||c.referenceKey!==c.solver.lastKey)return 'Original neutral calibration changed';
    if(window.__LIP_CORNER_SOLVER__!==c.corner||window.__LIP_MOTION_SOLVER__!==c.motion)return 'Inherited evaluator API changed';
    if(c.materials?.some(s=>s.material!==(s.native?c.viewer.skin.material:window.headProceduralSkin.material())||s.material.onBeforeCompile!==s.compile||s.material.customProgramCacheKey!==s.cacheKey||materialValues(s.material)!==s.values))return 'Original material or shader owner changed';
    const micro=inEvaluation?c.microDuringEvaluation:c.microOutsideEvaluation;
    if(c.structure.anatomy.settings.microGeometry!==micro)return 'Native microgeometry authoring changed';
    return inEvaluation?null:compatibility(c);
  }
  function bound(c){const p=c.geometry.attributes.position;if(p.itemSize!==3||p.count!==c.count||p.array.length!==c.count*3||p.isInterleavedBufferAttribute)throw Error('Native position domain changed');if(p.array===c.model.positions||p.array.buffer===c.model.positions?.buffer)throw Error('Refusing canonical position writes');return p.array;}
  function frame(c){const lm=i=>c.model.faceSurface.fields.landmark(c.model.positions,i),a=lm(48),b=lm(54),x=unit(sub(b,a)),v=sub(lm(27),lm(8)),up=unit(v.map((q,k)=>q-x[k]*dot(v,x))),center=lm(62).map((q,k)=>(q+lm(66)[k])*.5);let front=unit(cross(x,up));if(dot(front,sub(lm(30),center))<0)front=front.map(q=>-q);const cv=p=>[p[0],p[2],-p[1]];return{x:cv(x),up:cv(up),front:cv(front),center:cv(center)};}
  class Heap{
    constructor(){this.a=[];}
    push(id,d){const a=this.a;let i=a.length;a.push([id,d]);while(i){const p=(i-1)>>1;if(a[p][1]<=d)break;a[i]=a[p];i=p;}a[i]=[id,d];}
    pop(){const a=this.a,r=a[0],last=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let j=i*2+1;if(j+1<a.length&&a[j+1][1]<a[j][1])j++;if(a[j][1]>=last[1])break;a[i]=a[j];i=j;}a[i]=last;}return r;}
  }
  function distances(c,seeds){const d=new Float64Array(c.count).fill(Infinity),h=new Heap();for(const id of seeds){d[id]=0;h.push(id,0);}let settled=0;while(h.a.length){const[id,value]=h.pop();if(value!==d[id])continue;settled++;for(let k=c.offset[id];k<c.offset[id+1];k++){const j=c.adjacent[k],next=value+c.edgeLength[k];if(next<d[j]){d[j]=next;h.push(j,next);}}}return{distance:d,settled};}
  function build(c){
    const n=c.count,packed=[];let degenerate=0;
    // Full original index. No topology.neighbors, no sampled edge subset.
    for(let k=0;k<c.index.length;k+=3){const ids=[c.index[k],c.index[k+1],c.index[k+2]];if(ids.some(id=>!Number.isInteger(id)||id<0||id>=n))throw Error('Invalid native triangle index');for(const[a0,b0]of[[ids[0],ids[1]],[ids[1],ids[2]],[ids[2],ids[0]]])if(c.type[a0]<.5&&c.type[b0]<.5){const a=Math.min(a0,b0),b=Math.max(a0,b0);if(a===b){degenerate++;continue;}packed.push(a*n+b);}}
    packed.sort((a,b)=>a-b);let unique=0;for(let k=0;k<packed.length;k++)if(k===0||packed[k]!==packed[k-1])packed[unique++]=packed[k];packed.length=unique;
    const degree=new Uint32Array(n),lengths=new Float64Array(unique),zeroEndpoints=new Uint8Array(n);
    let exactZero=0,nearZero=0,minimumZeroLength=Infinity,maximumZeroLength=0;const zeroExamples=[];
    for(let k=0;k<unique;k++){const a=Math.floor(packed[k]/n),b=packed[k]-a*n,l=Math.hypot(...sub(point(c.rest,a),point(c.rest,b)));if(!Number.isFinite(l))throw Error('Nonfinite original rest edge');
      if(l<=ZERO_REST_THRESHOLD){if(l===0)exactZero++;else nearZero++;zeroEndpoints[a]=zeroEndpoints[b]=1;minimumZeroLength=Math.min(minimumZeroLength,l);maximumZeroLength=Math.max(maximumZeroLength,l);if(zeroExamples.length<16)zeroExamples.push({a,b,originalLengthMetres:l,carrierCostMetres:0});lengths[k]=0;}
      else lengths[k]=l;degree[a]++;degree[b]++;
    }
    c.offset=new Uint32Array(n+1);for(let i=0;i<n;i++)c.offset[i+1]=c.offset[i]+degree[i];c.adjacent=new Uint32Array(c.offset[n]);c.edgeLength=new Float64Array(c.offset[n]);const cursor=c.offset.slice();
    for(let k=0;k<unique;k++){const a=Math.floor(packed[k]/n),b=packed[k]-a*n,l=lengths[k];let j=cursor[a]++;c.adjacent[j]=b;c.edgeLength[j]=l;j=cursor[b]++;c.adjacent[j]=a;c.edgeLength[j]=l;}
    const lower=[],upper=[],contacts=new Set();for(const p of c.pairs){for(const key of['lower','upper']){const id=p[key];if(!Number.isInteger(id)||id<0||id>=n||c.type[id]>=.5)throw Error('Invalid native contact sample');contacts.add(id);}lower.push(p.lower);upper.push(p.upper);}
    if(c.pairs.length!==49)throw Error('Original 49 contact sections required');c.contactIds=[...contacts].sort((a,b)=>a-b);
    const dl=distances(c,lower),du=distances(c,upper),protectBase=new Uint8Array(n),protect=new Uint8Array(n),gain=new Float64Array(n);
    c.bodyIds=[];c.nonSkinIds=[];c.cornerIds=[];
    for(let id=0;id<n;id++){if(c.samples[id].v>=-.015){protectBase[id]=1;c.bodyIds.push(id);}if(c.type[id]>=.5)c.nonSkinIds.push(id);if(Math.abs(c.samples[id].u)>=.7)c.cornerIds.push(id);}
    for(const id of c.contactIds)protectBase[id]=1;protect.set(protectBase);
    // Exactly one original-index ring around the base set, no recursive growth.
    const zeroCollar=zeroEndpoints.slice();
    for(let k=0;k<c.index.length;k+=3){const a=c.index[k],b=c.index[k+1],d=c.index[k+2];if(protectBase[a]||protectBase[b]||protectBase[d])protect[a]=protect[b]=protect[d]=1;
      if(zeroEndpoints[a]||zeroEndpoints[b]||zeroEndpoints[d])zeroCollar[a]=zeroCollar[b]=zeroCollar[d]=1;}
    const bodyContactRingCount=protect.reduce((s,x)=>s+x,0),bodyContactRingFingerprint=fingerprint(protect),bodyContactMask=protect.slice();let zeroAddedProtected=0;c.zeroRestIds=[];
    for(let id=0;id<n;id++)if(zeroCollar[id]){c.zeroRestIds.push(id);if(!protect[id])zeroAddedProtected++;protect[id]=1;}
    c.freeIds=[];c.crestIds=[];const freeIndex=new Int32Array(n).fill(-1);
    for(let id=0;id<n;id++){
      const s=c.samples[id];let margin=du.distance[id]-dl.distance[id];
      if(c.type[id]>=.5||protect[id]||!Number.isFinite(dl.distance[id])||!(margin>.001)||!(s.v>-.65&&s.v<-.02&&Math.abs(s.u)<.7))continue;
      gain[id]=smooth(-.65,-.50,s.v)*(1-smooth(-.08,-.02,s.v))*(1-smooth(.55,.7,Math.abs(s.u)))*smooth(.001,.003,margin);
      if(gain[id]<=1e-8)continue;freeIndex[id]=c.freeIds.length;c.freeIds.push(id);
    }
    c.protectedIds=[];for(let id=0;id<n;id++)if(freeIndex[id]<0)c.protectedIds.push(id);
    for(let id=0;id<n;id++)if(c.type[id]<.5&&c.oral[id]>=1-1e-7&&c.samples[id].v<-.02&&c.samples[id].v>-.65&&Math.abs(c.samples[id].u)<.7&&dl.distance[id]+.001<du.distance[id]){
      for(let k=c.offset[id];k<c.offset[id+1];k++)if(c.oral[c.adjacent[k]]<1-1e-7){c.crestIds.push(id);break;}
    }
    c.rows=c.freeIds.map(id=>{const neighbors=[];let diagonal=degree[id]/(LENGTH*LENGTH*gain[id]);for(let k=c.offset[id];k<c.offset[id+1];k++){const j=c.adjacent[k],length=c.edgeLength[k];if(!(length>ZERO_REST_THRESHOLD))throw Error('Zero-cost carrier edge reached a free fairing row');const weight=1/(length*length);if(!(weight>0)||!Number.isFinite(weight))throw Error('Invalid positive rest weight');diagonal+=weight;neighbors.push({id:j,free:freeIndex[j],weight});}return{id,diagonal,neighbors};});
    c.affectedTriangles=[];for(let k=0;k<c.index.length;k+=3)if(freeIndex[c.index[k]]>=0||freeIndex[c.index[k+1]]>=0||freeIndex[c.index[k+2]]>=0)c.affectedTriangles.push(k);
    c.freeIndex=freeIndex;
    c.binding={method:'Screened positive original-rest graph fairing of current lower return positions in mouth-up/front only',smoothingLengthRestMM:LENGTH*1000,maximumProposedDeltaMM:MAX_DELTA_MM,
      engineeringParametersNotPhysiology:true,poseUsedForInstall:false,nativeVertices:n,scannedTriangles:c.index.length/3,fullIndexPasses:3,usedTopologyNeighbors:false,uniqueSkinEdges:unique,degenerateIndexEdges:degenerate,
      bodyVertices:c.bodyIds.length,uniqueContactVertices:c.contactIds.length,contactPairSlots:49,contactVertexSlots:98,nonSkinVertices:c.nonSkinIds.length,cornerVertices:c.cornerIds.length,
      baseBodyAndContactVertices:protectBase.reduce((s,x)=>s+x,0),bodyAndContactOneRingVertices:bodyContactRingCount,freeReturnVertices:c.freeIds.length,protectedVertices:c.protectedIds.length,
      zeroRestEdges:{thresholdMetres:ZERO_REST_THRESHOLD,exactZeroEdges:exactZero,positiveNearZeroEdges:nearZero,totalZeroCostEdges:exactZero+nearZero,
        minimumOriginalLengthMetres:exactZero+nearZero?minimumZeroLength:null,maximumOriginalLengthMetres:exactZero+nearZero?maximumZeroLength:null,
        endpointVertices:zeroEndpoints.reduce((s,x)=>s+x,0),endpointAndOneRingVertices:c.zeroRestIds.length,additionalProtectedVertices:zeroAddedProtected,
        freeRowsTouchingZeroCostEdges:0,carrierEdgesRetained:true,protectionFingerprint:fingerprint(zeroCollar),
        meaning:'All original skin edges retained for carrier paths. Finite length<=1e-12m has zero path cost; its endpoints plus exactly one original-index ring are fixed. No zero-length inverse weight is constructed.',
        examples:zeroExamples.map(e=>({...e,a:{id:e.a,rest:point(c.rest,e.a),csType:c.type[e.a],u:c.samples[e.a].u,v:c.samples[e.a].v,inner:c.samples[e.a].inner,rawOral:c.oral[e.a],rawUpper:c.samples[e.a].upper,lowerDistanceMM:dl.distance[e.a]*1000,upperDistanceMM:du.distance[e.a]*1000},b:{id:e.b,rest:point(c.rest,e.b),csType:c.type[e.b],u:c.samples[e.b].u,v:c.samples[e.b].v,inner:c.samples[e.b].inner,rawOral:c.oral[e.b],rawUpper:c.samples[e.b].upper,lowerDistanceMM:dl.distance[e.b]*1000,upperDistanceMM:du.distance[e.b]*1000}})),omittedExamples:Math.max(0,exactZero+nearZero-zeroExamples.length)},
      crestVertices:c.crestIds.length,freeCrestVertices:c.crestIds.filter(id=>freeIndex[id]>=0).length,affectedTriangles:c.affectedTriangles.length,lowerDistanceSettled:dl.settled,upperDistanceSettled:du.settled,
      nativeRestFingerprint:fingerprint(c.rest),nativeIndexFingerprint:fingerprint(c.index),freeVertexFingerprint:fingerprint(new Uint32Array(c.freeIds)),protectedBodyContactFingerprint:bodyContactRingFingerprint,protectedBodyContactAndDegenerateFingerprint:fingerprint(protect),ownershipFingerprint:c.ownership,
      domain:'csType<.5; -.65<v<-.02; abs(u)<.7; rest graph lower-pair distance +1mm < upper-pair distance; positive smooth fades; body v>=-.015 plus original pair IDs and exactly one raw-index ring fixed',
      fades:'v -.65 to -.50 and -.08 to -.02; abs(u) .55 to .70; lower-vs-upper graph separation 1 to 3mm',
      lowerCarrier:'Multi-source shortest rest-edge paths from original upper/lower 49 pair IDs. Native sample.upper is never used for ownership.',
      crestRule:'Observed semantic crest candidates: pure oral=1 with a neighboring oral<1, within the lower return domain. Recorded, not fixed and not assumed to exhaust the anatomical crest.',
      jawGate:{start:.08,end:.24,formula:'smooth(.08,.24,jawOpen)',purpose:'Engineering visibility/activity scope, not a physiological threshold; no poseName special case'},
      solver:{method:'Diagonal-preconditioned conjugate gradients, SPD screened correction system',maximumIterations:MAX_ITERATIONS,maximumNormalizedResidualMM:RESIDUAL_MM,maximumRelativeResidual:RELATIVE_RESIDUAL},
      examples:[19668,149748,104455,131023,69547,140180].filter(id=>id<n).map(id=>({id,u:c.samples[id].u,v:c.samples[id].v,inner:c.samples[id].inner,rawUpper:c.samples[id].upper,lowerDistanceMM:dl.distance[id]*1000,upperDistanceMM:du.distance[id]*1000,free:freeIndex[id]>=0,gain:gain[id],bodyContactRingProtected:!!bodyContactMask[id],zeroRestCollarProtected:!!zeroCollar[id],combinedProtection:!!protect[id]}))};
  }
  function solve(c,values){
    const rows=c.rows,n=rows.length,d=new Float64Array(n),rhs=new Float64Array(n),r=new Float64Array(n),direction=new Float64Array(n),z=new Float64Array(n),work=new Float64Array(n);
    let min=Infinity,max=-Infinity;
    for(let i=0;i<n;i++){const row=rows[i],v=values[row.id];min=Math.min(min,v);max=Math.max(max,v);for(const e of row.neighbors){rhs[i]+=e.weight*(values[e.id]-v);min=Math.min(min,values[e.id]);max=Math.max(max,values[e.id]);}}
    const inner=(a,b)=>{let t=0;for(let i=0;i<n;i++)t+=a[i]*b[i];return t;};
    function multiply(a,out){for(let i=0;i<n;i++){let x=rows[i].diagonal*a[i];for(const e of rows[i].neighbors)if(e.free>=0)x-=e.weight*a[e.free];out[i]=x;}}
    const rhsNorm=Math.sqrt(inner(rhs,rhs));
    function measure(){multiply(d,work);let maxMM=0,sum=0;for(let i=0;i<n;i++){r[i]=rhs[i]-work[i];maxMM=Math.max(maxMM,Math.abs(r[i])/rows[i].diagonal*1000);sum+=r[i]*r[i];}return{maxResidualMM:maxMM,relativeResidual:rhsNorm>0?Math.sqrt(sum)/rhsNorm:Math.sqrt(sum)};}
    let residual=measure(),iterations=0;const converged=()=>Number.isFinite(residual.maxResidualMM)&&Number.isFinite(residual.relativeResidual)&&residual.maxResidualMM<=RESIDUAL_MM&&residual.relativeResidual<=RELATIVE_RESIDUAL;
    for(let i=0;i<n;i++)direction[i]=z[i]=r[i]/rows[i].diagonal;let rz=inner(r,z);
    while(!converged()&&iterations<MAX_ITERATIONS){multiply(direction,work);const denom=inner(direction,work);if(!(denom>0)||!(rz>0)||!Number.isFinite(denom+rz))throw Error('Fairing SPD solver lost finite definiteness');const alpha=rz/denom;for(let i=0;i<n;i++)d[i]+=alpha*direction[i];iterations++;residual=measure();if(converged())break;for(let i=0;i<n;i++)z[i]=r[i]/rows[i].diagonal;const next=inner(r,z),beta=next/rz;for(let i=0;i<n;i++)direction[i]=z[i]+beta*direction[i];rz=next;}
    let boundExcessMM=0;for(let i=0;i<n;i++){const x=values[rows[i].id]+d[i];if(!Number.isFinite(x))throw Error('Nonfinite fairing solution');boundExcessMM=Math.max(boundExcessMM,(min-x)*1000,(x-max)*1000);}
    const report={converged:converged(),iterations,...residual,finite:true,positiveWeights:true,noOvershoot:boundExcessMM<=RESIDUAL_MM,maximumBoundExcessMM:boundExcessMM,maximumIterations:MAX_ITERATIONS,maximumNormalizedResidualMM:RESIDUAL_MM,maximumRelativeResidual:RELATIVE_RESIDUAL,
      residualDefinition:'max abs(A*delta-rhs)/diagonal in mm, plus relative L2 residual; actual residual recomputed every iteration; not a solution-error or physiology bound'};
    if(!report.converged||!report.noOvershoot)throw Error('Fairing did not satisfy finite convergence and positive bounds');return{delta:d,report};
  }
  function fair(c,array,f,rec){
    const before=array.slice(),staged=array.slice(),values={up:new Float64Array(c.count),front:new Float64Array(c.count)};
    for(let id=0;id<c.count;id++){const p=sub(point(before,id),f.center);values.up[id]=dot(p,f.up);values.front[id]=dot(p,f.front);}
    const up=solve(c,values.up),front=solve(c,values.front),parts=[up.report,front.report];
    rec.linearSolve={converged:parts.every(x=>x.converged),finite:true,positiveWeights:true,noOvershoot:parts.every(x=>x.noOvershoot),iterations:Math.max(...parts.map(x=>x.iterations)),totalComponentIterations:parts.reduce((s,x)=>s+x.iterations,0),maxResidualMM:Math.max(...parts.map(x=>x.maxResidualMM)),relativeResidual:Math.max(...parts.map(x=>x.relativeResidual)),maximumIterations:MAX_ITERATIONS,maximumNormalizedResidualMM:RESIDUAL_MM,maximumRelativeResidual:RELATIVE_RESIDUAL,components:{up:up.report,front:front.report}};
    for(let i=0;i<c.rows.length;i++){const id=c.rows[i].id,du=up.delta[i]*rec.jawGate,df=front.delta[i]*rec.jawGate,mag=Math.hypot(du,df)*1000;if(!Number.isFinite(mag))throw Error('Nonfinite proposed fairing displacement');rec.maximumProposedDeltaMM=Math.max(rec.maximumProposedDeltaMM,mag);for(let k=0;k<3;k++)staged[id*3+k]=before[id*3+k]+f.up[k]*du+f.front[k]*df;}
    if(rec.maximumProposedDeltaMM>MAX_DELTA_MM)throw Error('Entire fairing proposal rejected: displacement exceeds 0.6mm');
    let minAreaRatio=Infinity,minOrientationCosine=Infinity,flips=0;
    for(const offset of c.affectedTriangles){const ids=[c.index[offset],c.index[offset+1],c.index[offset+2]],old=ids.map(id=>point(before,id)),now=ids.map(id=>point(staged,id)),a=cross(sub(old[1],old[0]),sub(old[2],old[0])),b=cross(sub(now[1],now[0]),sub(now[2],now[0])),la=Math.hypot(...a),lb=Math.hypot(...b);if(!(la>1e-16)||!(lb>1e-16)||!Number.isFinite(la+lb))throw Error('Degenerate affected triangle in fairing proposal');const ratio=lb/la,cosine=dot(a,b)/(la*lb);minAreaRatio=Math.min(minAreaRatio,ratio);minOrientationCosine=Math.min(minOrientationCosine,cosine);if(cosine<=0)flips++;}
    rec.triangleGuard={checkedTriangles:c.affectedTriangles.length,finite:true,flippedTriangles:flips,minimumAreaRatio:minAreaRatio,minimumOrientationCosine:minOrientationCosine,requiredMinimumAreaRatio:.1,passed:flips===0&&minAreaRatio>=.1};
    if(!rec.triangleGuard.passed)throw Error('Entire fairing proposal rejected: local area/orientation guard');
    rec.zeroRestComparedVertices=c.zeroRestIds.length;rec.zeroRestDirectExact=selectedExact(staged,before,c.zeroRestIds);rec.bodyComparedVertices=c.bodyIds.length;rec.contactComparedVertices=c.contactIds.length;rec.protectedComparedVertices=c.protectedIds.length;
    rec.bodyDirectExact=selectedExact(staged,before,c.bodyIds);rec.contactDirectExact=selectedExact(staged,before,c.contactIds);rec.nonSkinDirectExact=selectedExact(staged,before,c.nonSkinIds);rec.cornerDirectExact=selectedExact(staged,before,c.cornerIds);rec.protectedDirectExact=selectedExact(staged,before,c.protectedIds);
    if(!rec.zeroRestDirectExact||!rec.bodyDirectExact||!rec.contactDirectExact||!rec.nonSkinDirectExact||!rec.cornerDirectExact||!rec.protectedDirectExact)throw Error('A protected domain changed in the staged proposal');
    for(const id of c.freeIds){const d=sub(point(staged,id),point(before,id)),length=Math.hypot(...d)*1000;if(!Number.isFinite(length))throw Error('Nonfinite staged coordinate');rec.maximumAppliedDeltaMM=Math.max(rec.maximumAppliedDeltaMM,length);rec.lateralComponentMaximumMM=Math.max(rec.lateralComponentMaximumMM,Math.abs(dot(d,f.x))*1000);if(length>0)rec.changedVertices++;}
    if(rec.maximumAppliedDeltaMM>MAX_DELTA_MM+.0001||rec.lateralComponentMaximumMM>.0001)throw Error('Staged Float32 correction violates displacement/component bounds');
    let crestChanged=0,maxCrest=0,maxUp=0,maxFront=0;const examples=[];
    for(const id of c.crestIds){const d=sub(point(staged,id),point(before,id)),u=dot(d,f.up)*1000,z=dot(d,f.front)*1000,length=Math.hypot(...d)*1000;if(length>0)crestChanged++;maxCrest=Math.max(maxCrest,length);maxUp=Math.max(maxUp,Math.abs(u));maxFront=Math.max(maxFront,Math.abs(z));if([19668,149748,104455,131023,69547,140180].includes(id))examples.push({id,before:point(before,id),after:point(staged,id),upMM:u,frontMM:z,distanceMM:length});}
    rec.crestDisplacement={vertices:c.crestIds.length,changedVertices:crestChanged,maximumDistanceMM:maxCrest,maximumAbsoluteUpMM:maxUp,maximumAbsoluteFrontMM:maxFront,examples};
    // All convergence/cap/area/protection checks precede every native write.
    for(const id of c.freeIds)for(let k=0;k<3;k++)array[id*3+k]=staged[id*3+k];
    rec.committed=true;
  }
  let context=null;
  function install(viewer,model){
    if(context)uninstall();const structure=model?.lipStructure,lip=viewer?.currentLip,solver=structure?.mother?.surfaces?.get(lip?.geometry),top=solver?.topology;
    if(!top||top.geometry!==lip.geometry||!top.geometry.index||!top.geometry.attributes.fRest||!top.geometry.attributes.l19Oral)throw Error('Original indexed lip evaluator unavailable');
    const c={viewer,model,structure,lip,solver,top,geometry:top.geometry,count:top.count,samples:top.samples,pairs:top.pairs,rest:top.geometry.attributes.fRest.array,type:top.geometry.attributes.csType.array,oral:top.geometry.attributes.l19Oral.array,index:top.geometry.index.array,
      originalApply:solver.apply,descriptor:own(solver,'apply'),reference:solver.reference,referenceHorizontal:solver.referenceHorizontal,referenceKey:solver.lastKey,corner:window.__LIP_CORNER_SOLVER__,motion:window.__LIP_MOTION_SOLVER__,enabled:false,valid:true,attached:false,running:false,calls:0,errors:[],last:null,binding:null};
    context=c;bound(c);const reason=compatibility(c);if(reason){invalidate(c,reason);return report();}
    const inherited=window.cornerLip.report();c.ownership=inherited.motionSolver.calibration.ownershipFingerprint;c.sourceKey=sourceKey(c);c.microOutsideEvaluation=structure.anatomy.settings.microGeometry;c.microDuringEvaluation=window.lipRealism.report().coarseReliefScale;
    c.materials=[viewer.skin.material,window.headProceduralSkin.material()].map((material,i)=>({material,native:i===0,compile:material.onBeforeCompile,cacheKey:material.customProgramCacheKey,values:materialValues(material)}));
    build(c);if(!c.freeIds.length){invalidate(c,'No eligible lower return field on this original surface');return report();}
    if(!(c.binding.freeCrestVertices>0)){invalidate(c,'No diagnosed semantic crest vertices remain free; candidate does not address its target');return report();}
    c.wrapper=function(...args){
      if(!c.enabled)return Reflect.apply(c.originalApply,this,args);
      if(this!==c.solver||c.running)throw Error('Unexpected edge solver call');
      const reason=invalidation(c,true);if(reason){invalidate(c,reason);return Reflect.apply(c.originalApply,this,args);}
      const jaw=c.structure.performance.jawOpen;if(!Number.isFinite(jaw)||jaw<0||jaw>1)throw Error('Invalid native jaw input');const gate=smooth(.08,.24,jaw);
      const rec={call:++c.calls,completed:false,hooksRestored:false,bypass:gate===0,reason:gate===0?'jaw gate zero: direct inherited evaluator':null,jawOpen:jaw,jawGate:gate,normalCalls:0,changedVertices:0,maximumProposedDeltaMM:0,maximumAppliedDeltaMM:0,lateralComponentMaximumMM:0,
        zeroRestDirectExact:true,zeroRestComparedVertices:0,bodyDirectExact:true,contactDirectExact:true,nonSkinDirectExact:true,cornerDirectExact:true,protectedDirectExact:true,bodyComparedVertices:0,contactComparedVertices:0,protectedComparedVertices:0,linearSolve:null,triangleGuard:null,crestDisplacement:null,committed:false,allOriginalStagesExecuted:false};
      if(gate===0){try{const answer=Reflect.apply(c.originalApply,this,args);rec.completed=true;rec.allOriginalStagesExecuted=true;rec.hooksRestored=true;c.last=rec;return answer;}catch(error){rec.error=String(error);c.last=rec;c.errors.push(String(error));invalidate(c,'Unexpected inherited evaluation failure');throw error;}}
      const g=c.geometry,normal=g.computeVertexNormals,nd=own(g,'computeVertexNormals'),pairsMap=c.pairs.map,pmd=own(c.pairs,'map'),iterator=c.top.lips[Symbol.iterator],ild=own(c.top.lips,Symbol.iterator),array=bound(c),f=frame(c);
      let answer,failure=null;c.running=true;
      try{put(g,'computeVertexNormals',function(...normalArgs){if(this!==g||++rec.normalCalls>2)throw Error('Native normal stage count changed');if(rec.normalCalls===1)fair(c,array,f,rec);return Reflect.apply(normal,this,normalArgs);});answer=Reflect.apply(c.originalApply,this,args);if(rec.normalCalls!==2||(answer&&typeof answer.then==='function'))throw Error('Native normal stages or synchronous contract changed');rec.completed=true;rec.allOriginalStagesExecuted=true;}
      catch(error){failure=error;rec.error=String(error);c.errors.push(String(error));}
      finally{try{undo(g,'computeVertexNormals',nd);if(g.computeVertexNormals!==normal||!sameDescriptor(own(g,'computeVertexNormals'),nd)||c.pairs.map!==pairsMap||!sameDescriptor(own(c.pairs,'map'),pmd)||c.top.lips[Symbol.iterator]!==iterator||!sameDescriptor(own(c.top.lips,Symbol.iterator),ild))throw Error('Original nested stage descriptors not restored');rec.hooksRestored=true;}catch(error){c.errors.push(String(error));failure=failure||error;}c.running=false;c.last=rec;}
      if(failure){invalidate(c,'Unexpected fairing/stage failure; original update required after detach');throw failure;}return answer;
    };
    put(solver,'apply',c.wrapper);c.attached=true;return report();
  }
  function setEnabled(value){if(typeof value!=='boolean')throw Error('Edge enable must be boolean');const c=context;if(!c)throw Error('Install edge binding first');if(c.running)throw Error('Cannot switch during native evaluation');if(!value){c.enabled=false;return report();}const reason=invalidation(c,false);if(reason)invalidate(c,reason);if(c.valid&&c.attached)c.enabled=true;return report();}
  function uninstall(){const c=context;if(!c)return{version:VERSION,installed:false,enabled:false,originalApplyRestored:true,nativeUpdateRequired:false};if(c.running)throw Error('Cannot uninstall during native evaluation');if(c.attached){if(c.solver.apply!==c.wrapper)throw Error('Another owner replaced edge wrapper: uninstall edge before R06/R05 rebuild');undo(c.solver,'apply',c.descriptor);if(c.solver.apply!==c.originalApply||!sameDescriptor(own(c.solver,'apply'),c.descriptor))throw Error('Exact inherited R06 apply restoration failed');}context=null;return{version:VERSION,installed:false,enabled:false,originalApplyRestored:true,nativeUpdateRequired:true};}
  function report(){const c=context;if(c?.valid&&!c.running){const reason=invalidation(c,false);if(reason)invalidate(c,reason);}return structuredClone({version:VERSION,installed:!!c?.attached,enabled:!!c?.enabled,disabled:!c?.enabled,valid:!!c?.valid,invalidationReason:c?.invalidationReason||null,calls:c?.calls||0,errors:c?.errors||[],binding:c?.binding||null,last:c?.last||null,
    canonicalPositionsChanged:false,topologyChanged:false,semanticFieldsChangedByModule:false,materialChanged:false,dnaWritten:false,newMeshes:0,poseUsedForInstall:false,
    component:'Current lower return mouth-up/front position field, screened over original rest adjacency; mouth-x increment exactly zero before Float32 storage',
    limits:['1mm screening length,0.6mm proposal cap and jaw .08-.24 gate are engineering bounds, not measured anatomy.','Crest may move; report records actual movement. Protected body/pair one-ring is fixed directly; final equality needs independent on/off verification.','Original microgeometry and both native normal rebuilds remain; finite area/orientation guards do not prove global no-collision or physiological thickness.','Supported only on the matched R06/R05/R04 authoring state; unsupported changes disable without altering their values or labels.'],fullBiomechanics:false,visualAcceptance:false,productionReady:false});}
  window.__LIP_EDGE_SOLVER__=Object.freeze({version:VERSION,install,setEnabled,report,uninstall});
})();
