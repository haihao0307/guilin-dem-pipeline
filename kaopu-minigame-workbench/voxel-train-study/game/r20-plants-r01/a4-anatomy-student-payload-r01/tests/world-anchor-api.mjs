/** Read-only A4 glTF pose evaluator and renderer-independent regression assertion.
 * Pass the application's THREE namespace; no DOM, IO, fetching, or source payload dependencies.
 * Matrices use glTF/Three column-major ordering. Time is seconds, with endpoint clamping.
 */
export function hierarchy(gltf) {
  const parents=gltf.nodes.map(()=>-1);
  gltf.nodes.forEach((n,i)=>(n.children||[]).forEach(j=>{
    if(!Number.isInteger(j)||!gltf.nodes[j]||parents[j]!==-1)throw Error('INVALID_NODE_PARENT '+j);
    parents[j]=i;
  }));
  for(let i=0;i<parents.length;i++){const seen=new Set([i]);for(let j=parents[i];j!==-1;j=parents[j]){if(seen.has(j))throw Error('HIERARCHY_CYCLE');seen.add(j);}}
  return parents;
}
export function createPoseEvaluator(THREE,gltf,readAccessor) {
  const parents=hierarchy(gltf), nodes=gltf.nodes;
  const tracks=(gltf.animations||[]).map(a=>a.channels.map((c,channelIndex)=>{
    const s=a.samplers[c.sampler],path=c.target.path,n=nodes[c.target.node];
    if(!n||n.matrix||!['translation','rotation','scale'].includes(path))throw Error('UNSUPPORTED_ANIMATION_TARGET '+channelIndex);
    if((s.interpolation||'LINEAR')!=='LINEAR')throw Error('UNSUPPORTED_INTERPOLATION '+channelIndex);
    const times=readAccessor(s.input),values=readAccessor(s.output),width=path==='rotation'?4:3;
    if(times.length*width!==values.length)throw Error('ANIMATION_SAMPLE_COUNT');
    for(let i=1;i<times.length;i++)if(times[i]<=times[i-1])throw Error('NONINCREASING_KEY_TIMES');
    const Interpolant=path==='rotation'?THREE.QuaternionLinearInterpolant:THREE.LinearInterpolant;
    return {node:c.target.node,path,input:s.input,output:s.output,times,interpolant:new Interpolant(times,values,width,new Float64Array(width))};
  }));
  return {parents,tracks,evaluate({mode='animation',animationIndex=0,timeSeconds=0}={}) {
    if(!['rest','animation'].includes(mode)||!Number.isFinite(timeSeconds))throw Error('INVALID_POSE_REQUEST');
    const trs=nodes.map(n=>({translation:(n.translation||[0,0,0]).slice(),rotation:(n.rotation||[0,0,0,1]).slice(),scale:(n.scale||[1,1,1]).slice()}));
    if(mode==='animation'){
      if(!tracks[animationIndex])throw Error('MISSING_ANIMATION');
      for(const t of tracks[animationIndex])trs[t.node][t.path]=Array.from(t.interpolant.evaluate(timeSeconds));
    }
    const locals=nodes.map((n,i)=>n.matrix?new THREE.Matrix4().fromArray(n.matrix):new THREE.Matrix4().compose(new THREE.Vector3().fromArray(trs[i].translation),new THREE.Quaternion().fromArray(trs[i].rotation),new THREE.Vector3().fromArray(trs[i].scale)));
    const world=[];function calc(i){return world[i]||(world[i]=parents[i]===-1?locals[i].clone():new THREE.Matrix4().multiplyMatrices(calc(parents[i]),locals[i]));}
    nodes.forEach((_,i)=>calc(i));
    return {mode,animationIndex:mode==='rest'?null:animationIndex,timeSeconds:mode==='rest'?null:timeSeconds,localMatrices:locals.map(m=>m.toArray()),worldMatrices:world.map(m=>m.toArray()),trs};
  }};
}
export function transformPoint(m,p) {
  const w=m[3]*p[0]+m[7]*p[1]+m[11]*p[2]+m[15];
  return [(m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12])/w,(m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13])/w,(m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14])/w];
}
export function multiplyMatrices(a,b) {
  const out=Array(16).fill(0);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)out[c*4+r]+=a[k*4+r]*b[c*4+k];return out;
}
export function compareRuntimePose(fixture,phaseId,{getWorldMatrix,getVertexLocal,worldToSource=null,expectedDataset='student',matrixTolerance=1e-6,anchorTolerance=1e-6}={}) {
  if(!['source','student'].includes(expectedDataset))throw Error('INVALID_DATASET');
  if(typeof getWorldMatrix!=='function')throw Error('WORLD_MATRIX_READER_REQUIRED');
  if(worldToSource){const w=worldToSource.elements||worldToSource;if(w.length!==16||!Array.from(w).every(Number.isFinite))throw Error('INVALID_WORLD_TO_SOURCE');}
  if(!Number.isFinite(matrixTolerance)||matrixTolerance<0||!Number.isFinite(anchorTolerance)||anchorTolerance<0)throw Error('INVALID_TOLERANCE');
  const phase=fixture.phases.find(p=>p.id===phaseId);if(!phase)throw Error('UNKNOWN_PHASE '+phaseId);
  const failures=[],actual=[],worlds=phase.worldMatrices;
  let maxMatrixError=0,maxAnchorError=0,vertexAnchorsChecked=0;
  for(let i=0;i<fixture.nodeCount;i++){
    const supplied=getWorldMatrix(i),raw=supplied?.elements||supplied;
    if(!raw||raw.length!==16||!Array.from(raw).every(Number.isFinite)){failures.push({kind:'missing-or-invalid-node',node:i});continue;}
    const m=worldToSource?multiplyMatrices(worldToSource.elements||worldToSource,raw):Array.from(raw);actual[i]=m;
    const err=Math.max(...m.map((v,j)=>Math.abs(v-worlds[i][j])));maxMatrixError=Math.max(maxMatrixError,err);
    if(err>matrixTolerance)failures.push({kind:'world-matrix',node:i,maxAbsoluteError:err});
  }
  for(const [i,a]of fixture.anchors.entries()){
    if(!actual[a.node])continue;
    let local=expectedDataset==='student'?a.studentLocal:a.sourceLocal;
    if(a.kind==='source-vertex'&&getVertexLocal){local=getVertexLocal(a.node,a.primitiveIndex,a.vertexIndex);vertexAnchorsChecked++;}
    if(!local||local.length!==3||!Array.from(local).every(Number.isFinite)){failures.push({kind:'missing-or-invalid-vertex',anchor:a.id});continue;}
    const p=transformPoint(actual[a.node],local),e=phase.anchorWorld[i][expectedDataset],err=Math.hypot(...p.map((v,j)=>v-e[j]));maxAnchorError=Math.max(maxAnchorError,err);
    if(err>anchorTolerance)failures.push({kind:'world-anchor',anchor:a.id,distance:err,actual:p,expected:e});
  }
  return {status:failures.length?'FAIL':'PASS',phaseId,nodeCount:fixture.nodeCount,matrixTolerance,anchorTolerance,maxMatrixError,maxAnchorError,vertexAnchorsChecked,geometryAnchorsVerified:typeof getVertexLocal==='function',geometryCoverage:'Selected vertex anchors only; not a complete geometry-field audit',failures};
}
export function assertRuntimePose(fixture,phaseId,options) {
  const r=compareRuntimePose(fixture,phaseId,options);if(r.status!=='PASS'){const e=new Error('A4_WORLD_ANCHOR_REGRESSION '+JSON.stringify(r.failures.slice(0,10)));e.report=r;throw e;}return r;
}
